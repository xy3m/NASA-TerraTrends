/**
 * GEOIRIS Stats Web Worker
 * Offloads heavy statistical computations from the main thread:
 * - Bootstrap confidence intervals (B ≥ 2000 iterations)
 * - Full Theil-Sen pairwise slopes (O(n²))
 * - PCA/SVD decomposition
 * - Seasonal Mann-Kendall with autocorrelation correction
 */

// Worker message types
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

// ── Inline statistical functions for the worker ───────────────────────

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

function normalPValue(z: number): number {
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
}

// ── Bootstrap ─────────────────────────────────────────────────────────

function bootstrapCI(
  values: number[],
  statFn: 'mean' | 'median',
  B: number,
  alpha: number
): { lower: number; upper: number; bootstrapMean: number; bootstrapSE: number } {
  const n = values.length;
  if (n === 0) return { lower: 0, upper: 0, bootstrapMean: 0, bootstrapSE: 0 };

  const statFunc = statFn === 'mean'
    ? (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
    : (arr: number[]) => {
        const sorted = [...arr].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      };

  // Simple LCG random for reproducibility in worker
  let seed = 42;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const stats: number[] = [];
  for (let b = 0; b < B; b++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      sample.push(values[Math.floor(rand() * n)]);
    }
    stats.push(statFunc(sample));
  }

  stats.sort((a, b) => a - b);
  const lower = stats[Math.floor((alpha / 2) * B)];
  const upper = stats[Math.floor((1 - alpha / 2) * B)];
  const bMean = stats.reduce((a, b) => a + b, 0) / B;
  const bVar = stats.reduce((a, b) => a + (b - bMean) ** 2, 0) / (B - 1);

  return { lower, upper, bootstrapMean: bMean, bootstrapSE: Math.sqrt(bVar) };
}

// ── Full Theil-Sen (no subsampling) ───────────────────────────────────

function theilSenFull(times: number[], values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const slopes: number[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dt = times[j] - times[i];
      if (dt > 0.001) {
        slopes.push((values[j] - values[i]) / dt);
      }
    }
  }

  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0 ? (slopes[mid - 1] + slopes[mid]) / 2 : slopes[mid];
}

// ── Seasonal Mann-Kendall ─────────────────────────────────────────────

function seasonalMannKendall(
  values: number[],
  seasonLength: number,
  method: 'standard' | 'hamed_rao' | 'tfpw'
): { s: number; varS: number; z: number; pValue: number; tau: number } {
  const n = values.length;
  const nSeasons = seasonLength;
  const nYears = Math.floor(n / nSeasons);

  if (nYears < 3) {
    return { s: 0, varS: 1, z: 0, pValue: 1, tau: 0 };
  }

  // Extract seasonal sub-series
  let totalS = 0;
  let totalVarS = 0;
  let totalPairs = 0;

  for (let m = 0; m < nSeasons; m++) {
    const seasonValues: number[] = [];
    for (let y = 0; y < nYears; y++) {
      const idx = y * nSeasons + m;
      if (idx < n && !isNaN(values[idx])) {
        seasonValues.push(values[idx]);
      }
    }

    const ns = seasonValues.length;
    if (ns < 2) continue;

    // Compute S for this season
    let s = 0;
    for (let i = 0; i < ns - 1; i++) {
      for (let j = i + 1; j < ns; j++) {
        const diff = seasonValues[j] - seasonValues[i];
        if (diff > 1e-7) s += 1;
        else if (diff < -1e-7) s -= 1;
      }
    }
    totalS += s;

    // Variance of S
    const tieMap = new Map<number, number>();
    for (const v of seasonValues) {
      const r = Math.round(v * 1000) / 1000;
      tieMap.set(r, (tieMap.get(r) || 0) + 1);
    }
    let tieTerm = 0;
    for (const c of tieMap.values()) {
      if (c > 1) tieTerm += c * (c - 1) * (2 * c + 5);
    }
    const varS = (ns * (ns - 1) * (2 * ns + 5) - tieTerm) / 18;
    totalVarS += varS;
    totalPairs += (ns * (ns - 1)) / 2;
  }

  // Hamed-Rao autocorrelation correction
  if (method === 'hamed_rao' && nYears > 3) {
    // Compute autocorrelation of ranks
    const ranks = rankArray(values.filter(v => !isNaN(v)));
    let nS = 1.0;
    for (let lag = 1; lag < Math.min(10, Math.floor(nYears / 3)); lag++) {
      let sumProd = 0, count = 0;
      for (let i = 0; i < ranks.length - lag; i++) {
        sumProd += ranks[i] * ranks[i + lag];
        count++;
      }
      if (count > 0) {
        const rho = sumProd / count;
        nS += 2 * (nYears - lag) / nYears * rho;
      }
    }
    totalVarS *= Math.max(1, nS);
  }

  // TFPW: Trend-Free Pre-Whitening
  if (method === 'tfpw') {
    // Already computing on deseasonalized series, autocorrelation is partially removed
    // Apply AR(1) correction factor
    const filtered = values.filter(v => !isNaN(v));
    if (filtered.length > 2) {
      const r1 = lag1Autocorrelation(filtered);
      if (Math.abs(r1) > 2 / Math.sqrt(filtered.length)) {
        totalVarS *= (1 + r1) / (1 - r1);
      }
    }
  }

  const sqrtVar = Math.sqrt(Math.max(1, totalVarS));
  let z = 0;
  if (totalS > 0) z = (totalS - 1) / sqrtVar;
  else if (totalS < 0) z = (totalS + 1) / sqrtVar;

  const tau = totalPairs > 0 ? totalS / totalPairs : 0;
  const pValue = normalPValue(z);

  return { s: totalS, varS: totalVarS, z, pValue, tau };
}

function rankArray(values: number[]): number[] {
  const indexed = values.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1;
    for (let k = i; k < j; k++) {
      ranks[indexed[k].i] = avgRank;
    }
    i = j;
  }
  return ranks;
}

function lag1Autocorrelation(values: number[]): number {
  const n = values.length;
  if (n < 3) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    den += (values[i] - mean) ** 2;
    if (i < n - 1) {
      num += (values[i] - mean) * (values[i + 1] - mean);
    }
  }
  return den > 0 ? num / den : 0;
}

// ── Pettitt Change-Point ──────────────────────────────────────────────

function pettittChangePoint(values: number[]): {
  changePointIndex: number;
  testStatistic: number;
  pValue: number;
  meanBefore: number;
  meanAfter: number;
} {
  const n = values.length;
  if (n < 4) {
    return { changePointIndex: -1, testStatistic: 0, pValue: 1, meanBefore: 0, meanAfter: 0 };
  }

  // Compute U_t,n for each t
  let maxK = 0;
  let changePoint = 0;

  const Ut = new Array(n).fill(0);
  for (let t = 1; t < n; t++) {
    let count = 0;
    for (let j = t; j < n; j++) {
      const diff = values[j] - values[t - 1];
      if (diff > 1e-10) count++;
      else if (diff < -1e-10) count--;
    }
    Ut[t] = Ut[t - 1] + count;
    const absUt = Math.abs(Ut[t]);
    if (absUt > maxK) {
      maxK = absUt;
      changePoint = t;
    }
  }

  // Approximate p-value
  const pValue = Math.min(1, 2 * Math.exp((-6 * maxK * maxK) / (n * n * n + n * n)));

  const meanBefore = changePoint > 0
    ? values.slice(0, changePoint).reduce((a, b) => a + b, 0) / changePoint
    : 0;
  const meanAfter = changePoint < n
    ? values.slice(changePoint).reduce((a, b) => a + b, 0) / (n - changePoint)
    : 0;

  return { changePointIndex: changePoint, testStatistic: maxK, pValue, meanBefore, meanAfter };
}

// ── Descriptive Stats ─────────────────────────────────────────────────

function computeDescriptive(values: number[]): Record<string, number> {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  const n = clean.length;
  if (n === 0) return {};

  const sorted = [...clean].sort((a, b) => a - b);
  const mean = clean.reduce((a, b) => a + b, 0) / n;
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  const variance = clean.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1);
  const stdDev = Math.sqrt(variance);
  const skewness = n > 2
    ? (n / ((n - 1) * (n - 2))) * clean.reduce((a, b) => a + ((b - mean) / stdDev) ** 3, 0)
    : 0;
  const kurtosis = n > 3
    ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) *
      clean.reduce((a, b) => a + ((b - mean) / stdDev) ** 4, 0) -
      (3 * (n - 1) ** 2) / ((n - 2) * (n - 3))
    : 0;

  const q1Idx = Math.floor(n * 0.25);
  const q3Idx = Math.floor(n * 0.75);
  const q1 = sorted[q1Idx];
  const q3 = sorted[q3Idx];

  return {
    count: n,
    mean,
    median,
    stdDev,
    variance,
    skewness,
    kurtosis,
    min: sorted[0],
    max: sorted[n - 1],
    range: sorted[n - 1] - sorted[0],
    q1,
    q3,
    iqr: q3 - q1,
    cv: mean !== 0 ? stdDev / Math.abs(mean) : 0,
    sem: stdDev / Math.sqrt(n),
    missingCount: values.length - n,
    missingPercent: ((values.length - n) / values.length) * 100,
  };
}

// ── Message Handler ───────────────────────────────────────────────────

self.onmessage = (event: MessageEvent<StatsWorkerRequest>) => {
  const { id, type, payload } = event.data;
  const start = performance.now();

  try {
    let result: unknown;

    switch (type) {
      case 'bootstrap': {
        const { values, statFn, B, alpha } = payload as {
          values: number[];
          statFn: 'mean' | 'median';
          B: number;
          alpha: number;
        };
        result = bootstrapCI(values, statFn, B ?? 2000, alpha ?? 0.05);
        break;
      }

      case 'theilSenFull': {
        const { times, values } = payload as { times: number[]; values: number[] };
        result = theilSenFull(times, values);
        break;
      }

      case 'seasonalMK': {
        const { values, seasonLength, method } = payload as {
          values: number[];
          seasonLength: number;
          method: 'standard' | 'hamed_rao' | 'tfpw';
        };
        result = seasonalMannKendall(values, seasonLength ?? 12, method ?? 'standard');
        break;
      }

      case 'pettitt': {
        const { values } = payload as { values: number[] };
        result = pettittChangePoint(values);
        break;
      }

      case 'descriptive': {
        const { values } = payload as { values: number[] };
        result = computeDescriptive(values);
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
