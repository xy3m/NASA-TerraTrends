import { tCDF, fCDF, tQuantile } from './distributions';

export interface TTestResult {
  t: number;
  df: number;
  pValue: number;
  meanDiff: number;
  ciLower: number;
  ciUpper: number;
  meanA: number;
  meanB?: number;
}

export interface AnovaResult {
  f: number;
  dfBetween: number;
  dfWithin: number;
  pValue: number;
  groupMeans: number[];
  grandMean: number;
  ssBetween: number;
  ssWithin: number;
  msBetween: number;
  msWithin: number;
}

export interface BootstrapResult {
  estimate: number;
  ciLower: number;
  ciUpper: number;
  standardError: number;
  iterations: number;
}

/** One-sample Student's t-test */
export function oneSampleTTest(values: number[], mu0 = 0, alpha = 0.05): TTestResult {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  const n = clean.length;
  if (n < 2) {
    return { t: 0, df: 1, pValue: 1, meanDiff: 0, ciLower: 0, ciUpper: 0, meanA: 0 };
  }

  const mean = clean.reduce((s, v) => s + v, 0) / n;
  const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const se = Math.sqrt(variance / n);
  const df = n - 1;
  const t = se > 0 ? (mean - mu0) / se : 0;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  const tCrit = tQuantile(1 - alpha / 2, df);
  const ciLower = mean - tCrit * se;
  const ciUpper = mean + tCrit * se;

  return {
    t,
    df,
    pValue: Math.max(0, Math.min(1, pValue)),
    meanDiff: mean - mu0,
    ciLower,
    ciUpper,
    meanA: mean,
  };
}

/** Two-sample Student's t-test (independent Welch or paired) */
export function twoSampleTTest(
  a: number[],
  b: number[],
  paired = false,
  alpha = 0.05
): TTestResult {
  if (paired) {
    const minLen = Math.min(a.length, b.length);
    const diffs: number[] = [];
    for (let i = 0; i < minLen; i++) {
      if (!isNaN(a[i]) && !isNaN(b[i])) {
        diffs.push(a[i] - b[i]);
      }
    }
    const res = oneSampleTTest(diffs, 0, alpha);
    const meanA = a.reduce((s, v) => s + v, 0) / a.length;
    const meanB = b.reduce((s, v) => s + v, 0) / b.length;
    return { ...res, meanA, meanB };
  }

  const cleanA = a.filter(v => !isNaN(v) && isFinite(v));
  const cleanB = b.filter(v => !isNaN(v) && isFinite(v));
  const n1 = cleanA.length;
  const n2 = cleanB.length;
  if (n1 < 2 || n2 < 2) {
    return { t: 0, df: 1, pValue: 1, meanDiff: 0, ciLower: 0, ciUpper: 0, meanA: 0, meanB: 0 };
  }

  const m1 = cleanA.reduce((s, v) => s + v, 0) / n1;
  const m2 = cleanB.reduce((s, v) => s + v, 0) / n2;
  const v1 = cleanA.reduce((s, v) => s + (v - m1) ** 2, 0) / (n1 - 1);
  const v2 = cleanB.reduce((s, v) => s + (v - m2) ** 2, 0) / (n2 - 1);

  const se1 = v1 / n1;
  const se2 = v2 / n2;
  const seDiff = Math.sqrt(se1 + se2);

  const df = (se1 + se2) ** 2 / ((se1 ** 2) / (n1 - 1) + (se2 ** 2) / (n2 - 1));
  const t = seDiff > 0 ? (m1 - m2) / seDiff : 0;
  const pValue = 2 * (1 - tCDF(Math.abs(t), df));

  const tCrit = tQuantile(1 - alpha / 2, Math.max(1, Math.round(df)));
  const ciLower = (m1 - m2) - tCrit * seDiff;
  const ciUpper = (m1 - m2) + tCrit * seDiff;

  return {
    t,
    df,
    pValue: Math.max(0, Math.min(1, pValue)),
    meanDiff: m1 - m2,
    ciLower,
    ciUpper,
    meanA: m1,
    meanB: m2,
  };
}

/** One-way Analysis of Variance (ANOVA) */
export function oneWayAnova(groups: number[][]): AnovaResult {
  const cleanGroups = groups.map(g => g.filter(v => !isNaN(v) && isFinite(v))).filter(g => g.length > 0);
  const k = cleanGroups.length;
  if (k < 2) {
    return {
      f: 0,
      dfBetween: 1,
      dfWithin: 1,
      pValue: 1,
      groupMeans: [],
      grandMean: 0,
      ssBetween: 0,
      ssWithin: 0,
      msBetween: 0,
      msWithin: 0,
    };
  }

  const groupMeans = cleanGroups.map(g => g.reduce((s, v) => s + v, 0) / g.length);
  const totalN = cleanGroups.reduce((s, g) => s + g.length, 0);
  const grandMean = cleanGroups.reduce((s, g) => s + g.reduce((ss, v) => ss + v, 0), 0) / totalN;

  let ssBetween = 0;
  let ssWithin = 0;

  for (let i = 0; i < k; i++) {
    const ni = cleanGroups[i].length;
    const mi = groupMeans[i];
    ssBetween += ni * (mi - grandMean) ** 2;

    for (const val of cleanGroups[i]) {
      ssWithin += (val - mi) ** 2;
    }
  }

  const dfBetween = k - 1;
  const dfWithin = totalN - k;

  const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;
  const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;

  const f = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = 1 - fCDF(f, dfBetween, dfWithin);

  return {
    f,
    dfBetween,
    dfWithin,
    pValue: Math.max(0, Math.min(1, pValue)),
    groupMeans,
    grandMean,
    ssBetween,
    ssWithin,
    msBetween,
    msWithin,
  };
}

/** Percentile Bootstrap Confidence Interval */
export function bootstrapCI(
  values: number[],
  statFn?: (arr: number[]) => number,
  B = 2000,
  alpha = 0.05
): BootstrapResult {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  const n = clean.length;
  if (n === 0) {
    return { estimate: 0, ciLower: 0, ciUpper: 0, standardError: 0, iterations: B };
  }

  const func = statFn || ((arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length);
  const originalEstimate = func(clean);

  let seed = 12345;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  const bootEstimates: number[] = [];
  for (let b = 0; b < B; b++) {
    const sample: number[] = [];
    for (let i = 0; i < n; i++) {
      sample.push(clean[Math.floor(random() * n)]);
    }
    bootEstimates.push(func(sample));
  }

  bootEstimates.sort((a, b) => a - b);
  const lowerIdx = Math.max(0, Math.floor((alpha / 2) * B));
  const upperIdx = Math.min(B - 1, Math.floor((1 - alpha / 2) * B));

  const ciLower = bootEstimates[lowerIdx];
  const ciUpper = bootEstimates[upperIdx];

  const bMean = bootEstimates.reduce((s, v) => s + v, 0) / B;
  const bVar = bootEstimates.reduce((s, v) => s + (v - bMean) ** 2, 0) / (B - 1);
  const standardError = Math.sqrt(bVar);

  return {
    estimate: originalEstimate,
    ciLower,
    ciUpper,
    standardError,
    iterations: B,
  };
}
