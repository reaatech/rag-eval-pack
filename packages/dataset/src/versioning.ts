import type { DatasetSampleStats, DatasetVersion, EvaluationSample } from '@reaatech/rag-eval-core';

export interface VersionedDataset {
  version: string;
  created: string;
  author?: string;
  description?: string;
  changes?: string[];
  stats?: DatasetSampleStats;
  samples: EvaluationSample[];
}

export interface ChangelogEntry {
  version: string;
  date: string;
  author: string;
  changes: string[];
  stats?: DatasetSampleStats;
}

export class DatasetVersioning {
  private versions: Map<string, VersionedDataset> = new Map();
  private changelog: ChangelogEntry[] = [];

  createVersion(samples: EvaluationSample[], metadata?: Partial<DatasetVersion>): DatasetVersion {
    const version = this.generateVersionId();
    const stats = this.calculateStats(samples);

    const versionInfo: DatasetVersion = {
      version,
      created: new Date().toISOString(),
      author: metadata?.author,
      description: metadata?.description,
      changes: metadata?.changes,
      samples: stats,
    };

    this.versions.set(version, { ...versionInfo, samples });
    this.addChangelogEntry(version, metadata?.author ?? 'unknown', metadata?.changes ?? []);

    return versionInfo;
  }

  getVersion(version: string): VersionedDataset | undefined {
    return this.versions.get(version);
  }

  getAllVersions(): DatasetVersion[] {
    return Array.from(this.versions.values()).map((v) => ({
      version: v.version,
      created: v.created,
      author: v.author,
      description: v.description,
      changes: v.changes,
      samples: v.stats,
    }));
  }

  getChangelog(): ChangelogEntry[] {
    return [...this.changelog];
  }

  compareVersions(
    version1: string,
    version2: string,
  ): {
    version1Newer: boolean;
    sampleCountDiff: number;
    statsDiff?: Record<string, number>;
  } | null {
    const v1 = this.versions.get(version1);
    const v2 = this.versions.get(version2);

    if (!v1 || !v2) return null;

    const date1 = new Date(v1.created).getTime();
    const date2 = new Date(v2.created).getTime();

    return {
      version1Newer: date1 > date2,
      sampleCountDiff: v1.samples.length - v2.samples.length,
    };
  }

  private generateVersionId(): string {
    const major = 1;
    const minor = this.versions.size + 1;
    const patch = 0;
    return `${major}.${minor}.${patch}`;
  }

  private calculateStats(samples: EvaluationSample[]): DatasetSampleStats {
    const byDomain: Record<string, number> = {};
    const byDifficulty: Record<string, number> = {};

    for (const sample of samples) {
      const domain = (sample.metadata?.domain as string) || 'unknown';
      const difficulty = (sample.metadata?.difficulty as string) || 'unknown';

      byDomain[domain] = (byDomain[domain] || 0) + 1;
      byDifficulty[difficulty] = (byDifficulty[difficulty] || 0) + 1;
    }

    return {
      total: samples.length,
      by_domain: byDomain,
      by_difficulty: byDifficulty,
    };
  }

  private addChangelogEntry(version: string, author: string, changes: string[]): void {
    const entry: ChangelogEntry = {
      version,
      date: new Date().toISOString(),
      author,
      changes,
      stats: this.calculateStats(this.versions.get(version)?.samples ?? []),
    };
    this.changelog.push(entry);
  }

  ensureBackwardCompatibility(oldVersion: string, newVersion: string): boolean {
    const old = this.versions.get(oldVersion);
    const fresh = this.versions.get(newVersion);

    if (!old || !fresh) return false;

    const requiredFields = ['query', 'context', 'ground_truth', 'generated_answer'];
    for (const sample of fresh.samples) {
      for (const field of requiredFields) {
        if (!sample[field as keyof EvaluationSample]) {
          return false;
        }
      }
    }

    return true;
  }
}
