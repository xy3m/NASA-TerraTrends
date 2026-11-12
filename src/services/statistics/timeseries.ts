import { SeasonalMKResult, ChangePointResult, GEVResult } from '../../types/earthScience';
import { normalCdf, normalPValue } from './distributions';

/**
 * Standard Seasonal Mann-Kendall test (Hirsch, Slack & Smith 1982)
 * Includes exact centered detrended Hamed-Rao (1998) variance modification and
 * true Yue et al. (2002) Trend-Free Pre-Whitening (TFPW).
 */
export function seasonalMannKendall(
  values: number[],
  seasonLength = 12,
  method: 'standard' | 'hamed_rao' | 'tfpw' = 'standard'
): SeasonalMKResult {
  const n = values.length;
  const nYears = Math.floor(n / seasonLength);

  if (nYears < 3) {
    return {
      s: 0,
      varS: 1,
      z: 0,
      pValue: 1,
      tau: 0,
      method,
      seasonCount: seasonLength,
    };
  }

  // Yue et al. (2002) Trend-Free Pre-Whitening (TFPW) per season before MK evaluation
  let workingValues = values;
  let tfpwR1: number | undefined;
  if (method === 'tfpw') {
    const whitened = [...values];
    const r1Estimates: number[] = [];

    for (let m = 0; m < seasonLength; m++) {
      const seasonIndices: number[] = [];
      const seasonVals: number[] = [];
      for (let y = 0; y < nYears; y++) {
        const idx = y * seasonLength + m;
        if (idx < n && !isNaN(values[idx]) && isFinite(values[idx])) {
          seasonIndices.push(idx);
          seasonVals.push(values[idx]);
        }
      }
      if (seasonVals.length < 4) continue;

      // 1. Estimate season monotonic trend via Sen slope & detrend
      const beta = senSlopeExact(seasonVals);
      const detrended = seasonVals.map((v, k) => v - beta * k);
      const r1 = lag1Autocorrelation(detrended);
      r1Estimates.push(r1);

      // 2. If lag-1 autocorrelation exceeds white-noise bound, pre-whiten & re-blend trend
      if (Math.abs(r1) > 1.96 / Math.sqrt(detrended.length)) {
        for (let k = 0; k < seasonVals.length; k++) {
          const pwResidual = k === 0 ? detrended[0] : detrended[k] - r1 * detrended[k - 1];
          whitened[seasonIndices[k]] = pwResidual + beta * k;
        }
      }
    }

    workingValues = whitened;
    if (r1Estimates.length > 0) {
      tfpwR1 = r1Estimates.reduce((s, v) => s + v, 0) / r1Estimates.length;
    }
  }

  let totalS = 0;
  let totalVarS = 0;
  let totalPairs = 0;

  for (let m = 0; m < seasonLength; m++) {
    const seasonValues: number[] = [];
    for (let y = 0; y < nYears; y++) {
      const idx = y * seasonLength + m;
      if (idx < n && !isNaN(workingValues[idx]) && isFinite(workingValues[idx])) {
        seasonValues.push(workingValues[idx]);
      }
    }

    const ns = seasonValues.length;
    if (ns < 2) continue;

    let s = 0;
    for (let i = 0; i < ns - 1; i++) {
      for (let j = i + 1; j < ns; j++) {
        const diff = seasonValues[j] - seasonValues[i];
        if (diff > 1e-7) s += 1;
        else if (diff < -1e-7) s -= 1;
      }
    }
    totalS += s;

    // Tied groups variance calculation
    const counts = new Map<number, number>();
    for (const v of seasonValues) {
      const rounded = Math.round(v * 1000) / 1000;
      counts.set(rounded, (counts.get(rounded) || 0) + 1);
    }
    let tieTerm = 0;
    for (const c of counts.values()) {
      if (c > 1) tieTerm += c * (c - 1) * (2 * c + 5);
    }

    const varS = (ns * (ns - 1) * (2 * ns + 5) - tieTerm) / 18;
    totalVarS += varS;
    totalPairs += (ns * (ns - 1)) / 2;
  }

  let autoCorrection = 1.0;

  // Hamed & Rao (1998): centered detrended rank autocorrelation variance factor
  if (method === 'hamed_rao' && nYears > 3) {
    // Form annual anomaly series so cross-year persistence isn't confounded by seasonal cycles
    const clean = workingValues.filter(v => !isNaN(v) && isFinite(v));
    const overallBeta = senSlopeExact(clean);
    const detrended = clean.map((v, i) => v - overallBeta * i);
    const ranks = rankArray(detrended);
    const mLen = ranks.length;
    if (mLen >= 6) {
      const meanRank = ranks.reduce((a, b) => a + b, 0) / mLen;
      const centered = ranks.map(r => r - meanRank);
      const denom = centered.reduce((s, r) => s + r * r, 0);

      if (denom > 1e-12) {
        let correctionSum = 0;
        const maxLag = Math.min(12, Math.floor(mLen / 4));
        const crit = 1.96 / Math.sqrt(mLen);

        for (let lag = 1; lag <= maxLag; lag++) {
          let num = 0;
          for (let i = 0; i < mLen - lag; i++) {
            num += centered[i] * centered[i + lag];
          }
          const rho = num / denom;
          if (Math.abs(rho) > crit) {
            correctionSum +=
              ((mLen - lag) * (mLen - lag - 1) * (mLen - lag - 2)) * rho;
          }
        }

        const nOverNStar =
          1 + (2 / (mLen * (mLen - 1) * (mLen - 2))) * correctionSum;
        autoCorrection = Math.max(0.5, Math.min(6.0, nOverNStar));
        totalVarS *= autoCorrection;
      }
    }
  } else if (method === 'tfpw' && tfpwR1 !== undefined) {
    autoCorrection = tfpwR1;
  }

  const sqrtVar = Math.sqrt(Math.max(1e-9, totalVarS));
  let z = 0;
  if (totalS > 0) z = (totalS - 1) / sqrtVar;
  else if (totalS < 0) z = (totalS + 1) / sqrtVar;

  const tau = totalPairs > 0 ? totalS / totalPairs : 0;
  const pValue = normalPValue(z);

  return {
    s: totalS,
    varS: totalVarS,
    z,
    pValue,
    tau,
    method,
    seasonCount: seasonLength,
    autocorrelationCorrection:
      method === 'hamed_rao'
        ? autoCorrection !== 1.0
          ? autoCorrection
          : undefined
        : tfpwR1,
  };
}

/** Hamed-Rao modified Mann-Kendall */
export function hamedRaoCorrection(values: number[], seasonLength = 12): SeasonalMKResult {
  return seasonalMannKendall(values, seasonLength, 'hamed_rao');
}

/** Trend-Free Pre-Whitening (TFPW) Mann-Kendall */
export function tfpwMannKendall(values: number[], seasonLength = 12): SeasonalMKResult {
  return seasonalMannKendall(values, seasonLength, 'tfpw');
}

/** Exact Sen's slope without subsampling */
export function senSlopeExact(values: number[], times?: number[]): number {
  const n = values.length;
  if (n < 2) return 0;

  const t = times || Array.from({ length: n }, (_, i) => i);
  const slopes: number[] = [];

  for (let i = 0; i < n; i++) {
    if (isNaN(values[i])) continue;
    for (let j = i + 1; j < n; j++) {
      if (isNaN(values[j])) continue;
      const dt = t[j] - t[i];
      if (dt > 1e-6) {
        slopes.push((values[j] - values[i]) / dt);
      }
    }
  }

  if (slopes.length === 0) return 0;
  slopes.sort((a, b) => a - b);
  const mid = Math.floor(slopes.length / 2);
  return slopes.length % 2 === 0 ? (slopes[mid - 1] + slopes[mid]) / 2 : slopes[mid];
}

/** Trend acceleration and reversal detection */
export function trendAcceleration(values: number[]): {
  acceleration: number;
  isAccelerating: boolean;
  reversalPoint?: number;
} {
  const n = values.length;
  if (n < 6) return { acceleration: 0, isAccelerating: false };

  const half = Math.floor(n / 2);
  const firstHalf = values.slice(0, half);
  const secondHalf = values.slice(half);

  const slope1 = senSlopeExact(firstHalf);
  const slope2 = senSlopeExact(secondHalf);

  const acceleration = slope2 - slope1;
  const isAccelerating = Math.abs(acceleration) > 0.05 * (Math.abs(slope1) + 1e-4);

  // Check for slope sign reversal
  let reversalPoint: number | undefined;
  if ((slope1 > 0 && slope2 < 0) || (slope1 < 0 && slope2 > 0)) {
    reversalPoint = half;
  }

  return { acceleration, isAccelerating, reversalPoint };
}

/** Pettitt's non-parametric change-point test */
export function pettittChangePoint(values: number[], dates?: string[]): ChangePointResult {
  const n = values.length;
  if (n < 4) {
    return {
      method: 'Pettitt',
      changePointIndex: 0,
      changePointDate: dates?.[0] || 'index_0',
      testStatistic: 0,
      pValue: 1,
      significanceLevel: 'Not Significant',
      meanBefore: 0,
      meanAfter: 0,
      shift: 0,
    };
  }

  let maxK = 0;
  let cpIndex = 0;
  let runningU = 0;

  for (let t = 1; t < n; t++) {
    let count = 0;
    for (let j = t; j < n; j++) {
      const diff = values[j] - values[t - 1];
      if (diff > 1e-7) count++;
      else if (diff < -1e-7) count--;
    }
    runningU += count;
    const absU = Math.abs(runningU);
    if (absU > maxK) {
      maxK = absU;
      cpIndex = t;
    }
  }

  // Pettitt approximate p-value
  const pValue = Math.min(1.0, 2 * Math.exp((-6 * maxK * maxK) / (n * n * n + n * n)));

  const before = values.slice(0, cpIndex);
  const after = values.slice(cpIndex);
  const meanBefore = before.reduce((s, v) => s + v, 0) / before.length;
  const meanAfter = after.reduce((s, v) => s + v, 0) / after.length;
  const shift = meanAfter - meanBefore;

  let significanceLevel = 'Not Significant';
  if (pValue < 0.001) significanceLevel = 'Extremely Significant';
  else if (pValue < 0.01) significanceLevel = 'Highly Significant';
  else if (pValue < 0.05) significanceLevel = 'Significant';
  else if (pValue < 0.10) significanceLevel = 'Marginally Significant';

  return {
    method: 'Pettitt',
    changePointIndex: cpIndex,
    changePointDate: dates?.[cpIndex] || `index_${cpIndex}`,
    testStatistic: maxK,
    pValue,
    significanceLevel,
    meanBefore,
    meanAfter,
    shift,
  };
}

/** CUSUM change point detection */
export function cusumChangePoint(values: number[], dates?: string[]): ChangePointResult {
  const n = values.length;
  if (n < 4) {
    return {
      method: 'CUSUM',
      changePointIndex: 0,
      changePointDate: dates?.[0] || 'index_0',
      testStatistic: 0,
      pValue: 1,
      significanceLevel: 'Not Significant',
      meanBefore: 0,
      meanAfter: 0,
      shift: 0,
    };
  }

  const mean = values.reduce((s, v) => s + v, 0) / n;
  let maxAbsC = 0;
  let cpIndex = 0;
  let cumsum = 0;

  for (let i = 0; i < n; i++) {
    cumsum += values[i] - mean;
    if (Math.abs(cumsum) > maxAbsC) {
      maxAbsC = Math.abs(cumsum);
      cpIndex = i;
    }
  }

  const s = Math.sqrt(values.reduce((ss, v) => ss + (v - mean) ** 2, 0) / (n - 1));
  const testStat = s > 0 ? maxAbsC / (s * Math.sqrt(n)) : 0;
  const pValue = Math.min(1.0, 2 * (1 - normalCdf(testStat)));

  const before = values.slice(0, cpIndex + 1);
  const after = values.slice(cpIndex + 1);
  const meanBefore = before.reduce((ss, v) => ss + v, 0) / (before.length || 1);
  const meanAfter = after.reduce((ss, v) => ss + v, 0) / (after.length || 1);

  return {
    method: 'CUSUM',
    changePointIndex: cpIndex,
    changePointDate: dates?.[cpIndex] || `index_${cpIndex}`,
    testStatistic: testStat,
    pValue,
    significanceLevel: pValue < 0.05 ? 'Significant' : 'Not Significant',
    meanBefore,
    meanAfter,
    shift: meanAfter - meanBefore,
  };
}

/** Shannon Entropy of numeric series using histogram binning */
export function shannonEntropy(values: number[], bins = 10): number {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  if (clean.length === 0) return 0;

  const min = Math.min(...clean);
  const max = Math.max(...clean);
  if (max === min) return 0;

  const counts = new Array(bins).fill(0);
  const binWidth = (max - min) / bins;

  for (const v of clean) {
    const idx = Math.min(bins - 1, Math.floor((v - min) / binWidth));
    counts[idx]++;
  }

  let entropy = 0;
  const total = clean.length;
  for (const c of counts) {
    if (c > 0) {
      const p = c / total;
      entropy -= p * Math.log2(p);
    }
  }

  return entropy;
}

/** Sample Entropy (SampEn) for time-series regularity */
export function sampleEntropy(values: number[], m = 2, r?: number): number {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  const n = clean.length;
  if (n < m + 2) return 0;

  const std = Math.sqrt(clean.reduce((s, v, _, arr) => {
    const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
    return s + (v - mean) ** 2;
  }, 0) / (n - 1));

  const tolerance = r !== undefined ? r : 0.2 * std;

  const countMatches = (dim: number): number => {
    let matches = 0;
    const total = n - dim;
    for (let i = 0; i < total; i++) {
      for (let j = i + 1; j < total; j++) {
        let maxDiff = 0;
        for (let k = 0; k < dim; k++) {
          const diff = Math.abs(clean[i + k] - clean[j + k]);
          if (diff > maxDiff) maxDiff = diff;
        }
        if (maxDiff <= tolerance) matches++;
      }
    }
    return matches;
  };

  const A = countMatches(m + 1);
  const B = countMatches(m);

  if (B === 0 || A === 0) return 0;
  return -Math.log(A / B);
}

// ── Helpers ──────────────────────────────────────────────────────────

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
  const mean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += (values[i] - mean) ** 2;
    if (i < n - 1) {
      num += (values[i] - mean) * (values[i + 1] - mean);
    }
  }
  return den > 0 ? num / den : 0;
}

/**
 * Hosking (1990) L-Moments Generalized Extreme Value (GEV) Block-Maxima Fit
 * Fits location (mu), scale (sigma), and shape (xi = -kappa) with return levels.
 */
export function fitGEV(
  values: number[],
  blockSize = 12,
  returnPeriods: number[] = [2, 5, 10, 20, 50, 100]
): GEVResult {
  const blockMaxima: number[] = [];
  for (let i = 0; i + blockSize <= values.length; i += blockSize) {
    const slice = values.slice(i, i + blockSize).filter(v => !isNaN(v) && isFinite(v));
    if (slice.length >= Math.max(2, Math.floor(blockSize / 3))) {
      blockMaxima.push(Math.max(...slice));
    }
  }

  if (blockMaxima.length < 5) {
    const clean = values.filter(v => !isNaN(v) && isFinite(v));
    const step = Math.max(2, Math.floor(clean.length / 8));
    blockMaxima.length = 0;
    for (let i = 0; i + step <= clean.length; i += step) {
      blockMaxima.push(Math.max(...clean.slice(i, i + step)));
    }
  }

  const x = [...blockMaxima].sort((a, b) => a - b);
  const n = x.length;
  if (n < 3) {
    return {
      shapeXi: 0,
      locationMu: x[0] ?? 0,
      scaleSigma: 1,
      family: 'Gumbel (light-tailed)',
      blockMaxima,
      returnLevels: returnPeriods.map(p => ({ period: p, level: x[0] ?? 0 })),
    };
  }

  // Unbiased Probability Weighted Moments b0, b1, b2 (Hosking & Wallis 1997)
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let j = 0; j < n; j++) {
    b0 += x[j];
    b1 += (j / (n - 1)) * x[j];
    b2 += ((j * (j - 1)) / ((n - 1) * (n - 2))) * x[j];
  }
  b0 /= n;
  b1 /= n;
  b2 /= n;

  const l1 = b0;
  const l2 = 2 * b1 - b0;
  const l3 = 6 * b2 - 6 * b1 + b0;
  const t3 = l2 > 1e-12 ? l3 / l2 : 0;

  // Hosking rational approximation for GEV shape kappa (xi = -kappa)
  const c = (2 / Math.max(1e-6, 3 + t3)) - Math.log(2) / Math.log(3);
  const kappa = 7.859 * c + 2.9554 * c * c;
  const xi = Math.max(-0.5, Math.min(0.5, -kappa));

  // Gamma approximation via Lanczos or Euler constant fallback for kappa near 0
  const gammaApprox = (z: number): number => {
    const g = 7;
    const p = [
      0.99999999999980993, 676.5203681218851, -1259.1392167224028,
      771.32342877765313, -176.61502916214059, 12.507343278686905,
      -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
    ];
    let zc = z - 1;
    let xSum = p[0];
    for (let i = 1; i < g + 2; i++) xSum += p[i] / (zc + i);
    const t = zc + g + 0.5;
    return Math.sqrt(2 * Math.PI) * Math.pow(t, zc + 0.5) * Math.exp(-t) * xSum;
  };

  let scaleSigma: number;
  let locationMu: number;
  if (Math.abs(kappa) < 1e-4) {
    scaleSigma = Math.max(1e-6, l2 / Math.log(2));
    locationMu = l1 - 0.5772156649 * scaleSigma;
  } else {
    const g1 = gammaApprox(1 + kappa);
    scaleSigma = Math.max(1e-6, (l2 * kappa) / ((1 - Math.pow(2, -kappa)) * g1));
    locationMu = l1 - (scaleSigma * (1 - g1)) / kappa;
  }

  const returnLevels = returnPeriods.map(T => {
    const p = 1 - 1 / Math.max(1.01, T);
    const yP = -Math.log(p);
    const level =
      Math.abs(xi) < 1e-4
        ? locationMu - scaleSigma * Math.log(yP)
        : locationMu - (scaleSigma / xi) * (1 - Math.pow(yP, -xi));
    return { period: T, level };
  });

  const family: GEVResult['family'] =
    xi > 0.05
      ? 'Frechet (heavy-tailed)'
      : xi < -0.05
        ? 'Weibull (bounded)'
        : 'Gumbel (light-tailed)';

  return {
    shapeXi: xi,
    locationMu,
    scaleSigma,
    family,
    blockMaxima,
    returnLevels,
  };
}
