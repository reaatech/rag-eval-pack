/**
 * Calibration data point
 */
export interface CalibrationDataPoint {
  rawScore: number;
  humanScore: number;
}

/**
 * Calibration method type
 */
export type CalibrationMethod = 'temperature_scaling' | 'isotonic_regression';

/**
 * Judge Calibrator
 *
 * Calibrates LLM judge scores against human labels to improve accuracy.
 * Supports temperature scaling and isotonic regression.
 */
export class JudgeCalibrator {
  private method: CalibrationMethod;
  private temperature = 1.0;
  private trained = false;
  private calibrationData: CalibrationDataPoint[] = [];

  constructor(config?: { method?: CalibrationMethod }) {
    this.method = config?.method ?? 'temperature_scaling';
  }

  /**
   * Add calibration data point
   */
  addDataPoint(rawScore: number, humanScore: number): void {
    this.calibrationData.push({ rawScore, humanScore });
    this.trained = false;
  }

  /**
   * Load calibration data from array
   */
  loadData(data: CalibrationDataPoint[]): void {
    this.calibrationData = [...data];
    this.trained = false;
  }

  /**
   * Train the calibrator
   */
  async train(): Promise<void> {
    if (this.calibrationData.length === 0) {
      throw new Error('No calibration data available');
    }

    switch (this.method) {
      case 'temperature_scaling':
        await this.trainTemperatureScaling();
        break;
      case 'isotonic_regression':
        await this.trainIsotonicRegression();
        break;
    }

    this.trained = true;
  }

  /**
   * Train temperature scaling
   */
  private async trainTemperatureScaling(): Promise<void> {
    // Find optimal temperature using gradient descent
    // Temperature scaling: calibrated = sigmoid(logit(raw) / T)
    let bestTemp = 1.0;
    let bestLoss = Number.POSITIVE_INFINITY;

    for (let temp = 0.1; temp <= 5.0; temp += 0.1) {
      let loss = 0;
      for (const point of this.calibrationData) {
        const calibrated = this.applyTemperatureScaling(point.rawScore, temp);
        loss += (calibrated - point.humanScore) ** 2;
      }

      if (loss < bestLoss) {
        bestLoss = loss;
        bestTemp = temp;
      }
    }

    this.temperature = bestTemp;
  }

  /**
   * Train isotonic regression
   * Creates a piecewise linear mapping from raw scores to calibrated scores
   */
  private async trainIsotonicRegression(): Promise<void> {
    if (this.calibrationData.length < 2) {
      this.temperature = 1.0;
      return;
    }

    const sorted = [...this.calibrationData].sort((a, b) => a.rawScore - b.rawScore);
    const uniqueRaw = new Map<number, number>();

    for (const point of sorted) {
      const existing = uniqueRaw.get(point.rawScore);
      if (existing !== undefined) {
        uniqueRaw.set(point.rawScore, (existing + point.humanScore) / 2);
      } else {
        uniqueRaw.set(point.rawScore, point.humanScore);
      }
    }

    this.mappingData = Array.from(uniqueRaw.entries()).map(([raw, calibrated]) => ({
      raw,
      calibrated,
    }));
  }

  private mappingData: { raw: number; calibrated: number }[] = [];

  /**
   * Apply temperature scaling
   */
  private applyTemperatureScaling(rawScore: number, temperature: number): number {
    // Convert to logit space
    const clipped = Math.max(0.001, Math.min(0.999, rawScore));
    const logit = Math.log(clipped / (1 - clipped));

    // Apply temperature
    const scaledLogit = logit / temperature;

    // Convert back to probability
    return 1 / (1 + Math.exp(-scaledLogit));
  }

  /**
   * Apply calibration to a raw score
   */
  apply(rawScore: number): number {
    if (!this.trained && this.calibrationData.length > 0) {
      throw new Error('Calibrator must be trained before use. Call train() first.');
    }

    if (!this.trained) {
      return rawScore;
    }

    switch (this.method) {
      case 'temperature_scaling':
        return this.applyTemperatureScaling(rawScore, this.temperature);
      case 'isotonic_regression':
        return this.applyIsotonicRegression(rawScore);
      default:
        return rawScore;
    }
  }

  /**
   * Apply isotonic regression calibration
   */
  private applyIsotonicRegression(rawScore: number): number {
    if (this.mappingData.length === 0) return rawScore;

    const mapping = this.mappingData;

    if (mapping.length === 1) {
      return mapping[0]?.calibrated;
    }

    if (rawScore <= mapping[0]?.raw) {
      return mapping[0]?.calibrated;
    }

    if (rawScore >= mapping[mapping.length - 1]?.raw) {
      return mapping[mapping.length - 1]?.calibrated;
    }

    for (let i = 0; i < mapping.length - 1; i++) {
      if (rawScore >= mapping[i]?.raw && rawScore <= mapping[i + 1]?.raw) {
        const ratio = (rawScore - mapping[i]?.raw) / (mapping[i + 1]?.raw - mapping[i]?.raw);
        return (
          mapping[i]?.calibrated + ratio * (mapping[i + 1]?.calibrated - mapping[i]?.calibrated)
        );
      }
    }

    return rawScore;
  }

  /**
   * Get calibration quality metrics
   */
  getMetrics(): { meanAbsoluteError: number; rootMeanSquareError: number } {
    if (!this.trained || this.calibrationData.length === 0) {
      return { meanAbsoluteError: 0, rootMeanSquareError: 0 };
    }

    let mae = 0;
    let rmse = 0;

    for (const point of this.calibrationData) {
      const calibrated = this.apply(point.rawScore);
      const error = Math.abs(calibrated - point.humanScore);
      mae += error;
      rmse += error * error;
    }

    const n = this.calibrationData.length;
    mae /= n;
    rmse = Math.sqrt(rmse / n);

    return {
      meanAbsoluteError: Math.round(mae * 1000) / 1000,
      rootMeanSquareError: Math.round(rmse * 1000) / 1000,
    };
  }

  /**
   * Check if calibrator is trained
   */
  isTrained(): boolean {
    return this.trained;
  }

  /**
   * Get the calibration method
   */
  getMethod(): CalibrationMethod {
    return this.method;
  }
}
