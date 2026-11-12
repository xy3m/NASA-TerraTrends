import { DiagnosticResults } from '../../types/earthScience';
import { chiSquaredCDF, normalCdf } from './distributions';
import { Matrix, inverse } from 'ml-matrix';

/**
 * Run comprehensive statistical diagnostics on a dataset, residuals, and optional predictor matrix
 */
export function runDiagnostics(
  values: number[],
  residuals?: number[],
  X?: number[][]
): DiagnosticResults {
  const norm = dagostinoTest(values);
  const outliers = detectOutliers(values, 'iqr');
  const missing = missingnessProfile(values);

  const res = residuals && residuals.length > 0 ? residuals : values;
  const dw = durbinWatsonTest(res);
  const lb = ljungBoxTest(res);
  const lag1 = computeLag1(res);

  const diag: DiagnosticResults = {
    normalityTest: {
      method: norm.method,
      statistic: norm.statistic,
      pValue: norm.pValue,
      isNormal: norm.pValue > 0.05,
    },
    outliers,
    missingnessProfile: missing,
    autocorrelation: {
      lag1,
      durbinWatson: dw,
      ljungBoxQ: lb.q,
      ljungBoxP: lb.pValue,
    },
  };

  if (residuals && X && X.length === residuals.length && X[0].length > 0) {
    const bp = breuschPaganTest(residuals, X);
    diag.heteroskedasticity = {
      bpStatistic: bp.statistic,
      bpPValue: bp.pValue,
      isHomoskedastic: bp.pValue > 0.05,
    };

    if (X[0].length > 1) {
      diag.vif = computeVIF(X);
    }
  }

  return diag;
}

/** D'Agostino-Pearson K² omnibus test for normality */
export function dagostinoTest(values: number[]): {
  method: string;
  statistic: number;
  pValue: number;
} {
  const clean = values.filter(v => !isNaN(v) && isFinite(v));
  const n = clean.length;
  if (n < 8) {
    return { method: "D'Agostino K²", statistic: 0, pValue: 1 };
  }

  const mean = clean.reduce((s, v) => s + v, 0) / n;
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of clean) {
    const d = v - mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  m2 /= n;
  m3 /= n;
  m4 /= n;

  if (m2 === 0) {
    return { method: "D'Agostino K²", statistic: 0, pValue: 1 };
  }

  const sqrtB1 = m3 / Math.pow(m2, 1.5); // sample skewness
  const b2 = m4 / (m2 * m2);             // sample kurtosis

  // Skewness transform Z1(sqrtB1)
  const y = sqrtB1 * Math.sqrt(((n + 1) * (n + 3)) / (6 * (n - 2)));
  const beta2 = (3 * (n * n + 27 * n - 70) * (n + 1) * (n + 3)) / ((n - 2) * (n + 5) * (n + 7) * (n + 9));
  const w2 = -1 + Math.sqrt(2 * (beta2 - 1));
  const delta = 1 / Math.sqrt(Math.max(1e-10, Math.log(w2)));
  const alpha = Math.sqrt(2 / Math.max(1e-10, w2 - 1));
  const z1 = delta * Math.asinh(y / alpha);

  // Kurtosis transform Z2(b2)
  const meanB2 = (3 * (n - 1)) / (n + 1);
  const varB2 = (24 * n * (n - 2) * (n - 3)) / ((n + 1) * (n + 1) * (n + 3) * (n + 5));
  const x = (b2 - meanB2) / Math.sqrt(varB2);
  const sqrtBeta1 = (6 * (n * n - 5 * n + 2)) / ((n + 7) * (n + 9)) * Math.sqrt((6 * (n + 3) * (n + 5)) / (n * (n - 2) * (n - 3)));
  const a = 6 + (8 / sqrtBeta1) * (2 / sqrtBeta1 + Math.sqrt(1 + 4 / (sqrtBeta1 * sqrtBeta1)));
  const z2 = (1 - 2 / (9 * a) - Math.cbrt(Math.max(1e-10, 1 - 2 / a) / (1 + x * Math.sqrt(2 / (a - 4))))) / Math.sqrt(2 / (9 * a));

  const k2 = z1 * z1 + (isNaN(z2) ? 0 : z2 * z2);
  const pValue = 1 - chiSquaredCDF(k2, 2);

  return {
    method: "D'Agostino-Pearson K²",
    statistic: k2,
    pValue: Math.max(0, Math.min(1, pValue)),
  };
}

/** Outlier detection via IQR, Z-Score, or Grubbs */
export function detectOutliers(
  values: number[],
  method: 'iqr' | 'zscore' | 'grubbs' = 'iqr'
): { index: number; value: number; method: string; zScore?: number }[] {
  const cleanIndexed = values
    .map((v, i) => ({ v, i }))
    .filter(item => !isNaN(item.v) && isFinite(item.v));

  const n = cleanIndexed.length;
  if (n < 4) return [];

  const outliers: { index: number; value: number; method: string; zScore?: number }[] = [];

  if (method === 'iqr') {
    const sorted = [...cleanIndexed].sort((a, b) => a.v - b.v);
    const q1 = sorted[Math.floor(n * 0.25)].v;
    const q3 = sorted[Math.floor(n * 0.75)].v;
    const iqr = q3 - q1;
    const lower = q1 - 1.5 * iqr;
    const upper = q3 + 1.5 * iqr;

    for (const item of cleanIndexed) {
      if (item.v < lower || item.v > upper) {
        outliers.push({ index: item.i, value: item.v, method: 'IQR (1.5x)' });
      }
    }
  } else if (method === 'zscore') {
    const mean = cleanIndexed.reduce((s, it) => s + it.v, 0) / n;
    const std = Math.sqrt(cleanIndexed.reduce((s, it) => s + (it.v - mean) ** 2, 0) / (n - 1));

    for (const item of cleanIndexed) {
      const z = std > 0 ? (item.v - mean) / std : 0;
      if (Math.abs(z) > 3.0) {
        outliers.push({ index: item.i, value: item.v, method: 'Z-Score (|z| > 3)', zScore: z });
      }
    }
  } else if (method === 'grubbs') {
    const mean = cleanIndexed.reduce((s, it) => s + it.v, 0) / n;
    const std = Math.sqrt(cleanIndexed.reduce((s, it) => s + (it.v - mean) ** 2, 0) / (n - 1));

    let maxDev = 0;
    let maxItem = cleanIndexed[0];
    for (const item of cleanIndexed) {
      const dev = Math.abs(item.v - mean);
      if (dev > maxDev) {
        maxDev = dev;
        maxItem = item;
      }
    }

    const g = std > 0 ? maxDev / std : 0;
    // Critical value approx
    const tCrit = 2.5; // for typical alpha=0.05
    const gCrit = ((n - 1) / Math.sqrt(n)) * Math.sqrt((tCrit * tCrit) / (n - 2 + tCrit * tCrit));

    if (g > gCrit) {
      outliers.push({ index: maxItem.i, value: maxItem.v, method: "Grubbs' Test", zScore: g });
    }
  }

  return outliers;
}

/** Durbin-Watson statistic for AR(1) residuals */
export function durbinWatsonTest(residuals: number[]): number {
  const n = residuals.length;
  if (n < 2) return 2.0;

  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    den += residuals[i] * residuals[i];
    if (i > 0) {
      num += (residuals[i] - residuals[i - 1]) ** 2;
    }
  }
  return den > 0 ? num / den : 2.0;
}

/** Ljung-Box Q portmanteau test for serial correlation */
export function ljungBoxTest(
  residuals: number[],
  lags = 10
): { q: number; pValue: number; df: number } {
  const n = residuals.length;
  const h = Math.min(lags, Math.floor(n / 4));
  if (n < 4 || h < 1) {
    return { q: 0, pValue: 1, df: 1 };
  }

  const mean = residuals.reduce((s, v) => s + v, 0) / n;
  let c0 = 0;
  for (let i = 0; i < n; i++) c0 += (residuals[i] - mean) ** 2;

  let q = 0;
  for (let k = 1; k <= h; k++) {
    let ck = 0;
    for (let i = k; i < n; i++) {
      ck += (residuals[i] - mean) * (residuals[i - k] - mean);
    }
    const rk = c0 > 0 ? ck / c0 : 0;
    q += (rk * rk) / (n - k);
  }
  q *= n * (n + 2);

  const pValue = 1 - chiSquaredCDF(q, h);
  return { q, pValue: Math.max(0, Math.min(1, pValue)), df: h };
}

/** Breusch-Pagan test for heteroskedasticity */
export function breuschPaganTest(
  residuals: number[],
  X: number[][]
): { statistic: number; pValue: number } {
  const n = residuals.length;
  const p = X[0].length;
  if (n <= p + 1) return { statistic: 0, pValue: 1 };

  // Square of residuals normalized by sigma^2
  const s2 = residuals.reduce((s, r) => s + r * r, 0) / n;
  if (s2 === 0) return { statistic: 0, pValue: 1 };

  const g = residuals.map(r => (r * r) / s2);

  // Regress g on X with intercept
  const XDesign = new Matrix(n, p + 1);
  for (let i = 0; i < n; i++) {
    XDesign.set(i, 0, 1.0);
    for (let j = 0; j < p; j++) {
      XDesign.set(i, j + 1, X[i][j]);
    }
  }

  const gVec = Matrix.columnVector(g);
  const Xt = XDesign.transpose();
  const beta = inverse(Xt.mmul(XDesign).add(Matrix.eye(p + 1, p + 1).mul(1e-6)))
    .mmul(Xt)
    .mmul(gVec);

  const gMean = g.reduce((s, v) => s + v, 0) / n;
  let ssModel = 0;
  for (let i = 0; i < n; i++) {
    let pred = beta.get(0, 0);
    for (let j = 0; j < p; j++) pred += beta.get(j + 1, 0) * X[i][j];
    ssModel += (pred - gMean) ** 2;
  }

  const lm = 0.5 * ssModel;
  const pValue = 1 - chiSquaredCDF(lm, p);

  return { statistic: lm, pValue: Math.max(0, Math.min(1, pValue)) };
}

/** Variance Inflation Factor (VIF) for multicollinearity */
export function computeVIF(X: number[][], varNames?: string[]): { variable: string; vif: number }[] {
  const n = X.length;
  const p = X[0].length;
  if (n <= p || p < 2) return [];

  const results: { variable: string; vif: number }[] = [];

  for (let j = 0; j < p; j++) {
    const y = X.map(row => row[j]);
    const others = X.map(row => row.filter((_, idx) => idx !== j));

    // Regress variable j on other predictors
    const XDesign = new Matrix(n, p);
    for (let i = 0; i < n; i++) {
      XDesign.set(i, 0, 1.0);
      for (let k = 0; k < p - 1; k++) {
        XDesign.set(i, k + 1, others[i][k]);
      }
    }

    const yVec = Matrix.columnVector(y);
    const Xt = XDesign.transpose();
    const beta = inverse(Xt.mmul(XDesign).add(Matrix.eye(p, p).mul(1e-6)))
      .mmul(Xt)
      .mmul(yVec);

    const yMean = y.reduce((s, v) => s + v, 0) / n;
    let ssTot = 0, ssRes = 0;
    for (let i = 0; i < n; i++) {
      let pred = beta.get(0, 0);
      for (let k = 0; k < p - 1; k++) pred += beta.get(k + 1, 0) * others[i][k];
      const res = y[i] - pred;
      ssRes += res * res;
      ssTot += (y[i] - yMean) ** 2;
    }

    const r2 = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
    const vif = r2 < 0.999 ? 1 / (1 - r2) : 999.0;
    const name = varNames?.[j] || `Var_${j + 1}`;
    results.push({ variable: name, vif: Math.round(vif * 100) / 100 });
  }

  return results;
}

/** Missingness profiling */
export function missingnessProfile(values: (number | null | undefined)[]): {
  total: number;
  missing: number;
  percent: number;
  pattern: string;
} {
  const total = values.length;
  let missing = 0;
  for (const v of values) {
    if (v === null || v === undefined || isNaN(v as number)) {
      missing++;
    }
  }

  const percent = total > 0 ? (missing / total) * 100 : 0;
  let pattern = 'Complete (0% missing)';
  if (percent > 0 && percent <= 5) pattern = 'Sparse (≤5% missing, safe for imputation)';
  else if (percent > 5 && percent <= 20) pattern = 'Moderate (5-20% missing, requires missingness analysis)';
  else if (percent > 20) pattern = 'Severe (>20% missing, statistical inferences compromised)';

  return { total, missing, percent, pattern };
}

function computeLag1(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    den += (values[i] - mean) ** 2;
    if (i > 0) num += (values[i] - mean) * (values[i - 1] - mean);
  }
  return den > 0 ? num / den : 0;
}
