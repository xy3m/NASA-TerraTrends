/**
 * GEOIRIS Stats Web Worker
 * Offloads heavy statistical computations from the main thread:
 * - Bootstrap confidence intervals (B >= 2000 iterations)
 * - Full Theil-Sen pairwise slopes (O(n^2))
 * - PCA/SVD decomposition
 * - Seasonal Mann-Kendall with autocorrelation correction
 * - Pettitt change-point detection
 * - Descriptive summary statistics
 */
import {
  computeDescriptiveStats,
  bootstrapCI,
  pcaAnalysis,
  seasonalMannKendall,
  senSlopeExact,
  pettittChangePoint,
} from '../services/statistics';

export interface StatsWorkerRequest {
  id: string;
  type:
    | 'bootstrap'
    | 'theilSenFull'
    | 'seasonalMK'
    | 'pca'
    | 'pettitt'
    | 'descriptive';
  payload: Record<string, unknown>;
}

export interface StatsWorkerResponse {
  id: string;
  type: StatsWorkerRequest['type'];
  result: unknown;
  error?: string;
  durationMs: number;
}

function medianOf(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

self.onmessage = (event: MessageEvent<StatsWorkerRequest>) => {
  const { id, type, payload } = event.data;
  const start = performance.now();

  try {
    let result: unknown;

    switch (type) {
      case 'bootstrap': {
        const { values, statFn, B, alpha } = payload as {
          values: number[];
          statFn?: 'mean' | 'median';
          B?: number;
          alpha?: number;
        };
        const fn =
          statFn === 'median'
            ? medianOf
            : (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
        result = bootstrapCI(values, fn, B ?? 2000, alpha ?? 0.05);
        break;
      }

      case 'theilSenFull': {
        const { times, values } = payload as { times?: number[]; values: number[] };
        result = senSlopeExact(values, times);
        break;
      }

      case 'seasonalMK': {
        const { values, seasonLength, method } = payload as {
          values: number[];
          seasonLength?: number;
          method?: 'standard' | 'hamed_rao' | 'tfpw';
        };
        result = seasonalMannKendall(values, seasonLength ?? 12, method ?? 'standard');
        break;
      }

      case 'pca': {
        const { dataMatrix, labels } = payload as { dataMatrix: number[][]; labels?: string[] };
        result = pcaAnalysis(dataMatrix, labels);
        break;
      }

      case 'pettitt': {
        const { values, dates } = payload as { values: number[]; dates?: string[] };
        result = pettittChangePoint(values, dates);
        break;
      }

      case 'descriptive': {
        const { values } = payload as { values: number[] };
        result = computeDescriptiveStats(values);
        break;
      }

      default:
        throw new Error(`Unknown worker task type: ${type}`);
    }

    const response: StatsWorkerResponse = {
      id,
      type,
      result,
      durationMs: performance.now() - start,
    };
    self.postMessage(response);
  } catch (err) {
    const response: StatsWorkerResponse = {
      id,
      type,
      result: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: performance.now() - start,
    };
    self.postMessage(response);
  }
};
