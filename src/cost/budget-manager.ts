export interface BudgetAlert {
  threshold: number;
  triggered: boolean;
  triggeredAt?: string;
  message: string;
}

export interface BudgetConfig {
  budgetLimit: number;
  hardLimit?: boolean;
  alertThresholds?: number[];
}

export class BudgetManager {
  private budgetLimit: number;
  private hardLimit: boolean;
  private alertThresholds: number[];
  private alerts: BudgetAlert[];
  private totalSpent: number = 0;

  constructor(config?: BudgetConfig) {
    this.budgetLimit = config?.budgetLimit ?? Infinity;
    this.hardLimit = config?.hardLimit ?? false;
    this.alertThresholds = config?.alertThresholds ?? [0.5, 0.75, 0.9];
    this.alerts = this.alertThresholds.map((threshold) => ({
      threshold,
      triggered: false,
      message: `Budget usage reached ${(threshold * 100).toFixed(0)}%`,
    }));
  }

  recordSpend(amount: number): {
    withinBudget: boolean;
    shouldStop: boolean;
    newAlerts: BudgetAlert[];
  } {
    this.totalSpent += amount;
    const usageRatio = this.budgetLimit === Infinity ? 0 : this.totalSpent / this.budgetLimit;
    const newAlerts: BudgetAlert[] = [];

    for (const alert of this.alerts) {
      if (usageRatio >= alert.threshold && !alert.triggered) {
        alert.triggered = true;
        alert.triggeredAt = new Date().toISOString();
        newAlerts.push(alert);
      }
    }

    const withinBudget = this.totalSpent <= this.budgetLimit;
    const shouldStop = this.hardLimit && !withinBudget;

    return { withinBudget, shouldStop, newAlerts };
  }

  getRemainingBudget(): number {
    return Math.max(0, this.budgetLimit - this.totalSpent);
  }

  getBudgetUsage(): number {
    if (this.budgetLimit === Infinity) return 0;
    return this.totalSpent / this.budgetLimit;
  }

  isWithinBudget(): boolean {
    return this.totalSpent <= this.budgetLimit;
  }

  getTotalSpent(): number {
    return this.totalSpent;
  }

  getBudgetLimit(): number {
    return this.budgetLimit;
  }

  getAlerts(): BudgetAlert[] {
    return [...this.alerts];
  }

  getActiveAlerts(): BudgetAlert[] {
    return this.alerts.filter((a) => a.triggered);
  }

  setBudgetLimit(limit: number): void {
    this.budgetLimit = limit;
  }

  reset(): void {
    this.totalSpent = 0;
    for (const alert of this.alerts) {
      alert.triggered = false;
      alert.triggeredAt = undefined;
    }
  }

  suggestOptimization(): string[] {
    const suggestions: string[] = [];
    const usage = this.getBudgetUsage();

    if (usage > 0.9) {
      suggestions.push('Consider reducing evaluation batch size');
      suggestions.push('Use smaller/faster judge models for non-critical metrics');
    }
    if (usage > 0.75) {
      suggestions.push('Consider enabling only essential metrics');
    }

    return suggestions;
  }
}
