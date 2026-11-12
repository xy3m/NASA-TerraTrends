import { Matrix, SVD, inverse } from 'ml-matrix';
import { RegressionResult, PCAResult } from '../../types/earthScience';
import { tCDF, fCDF } from './distributions';

/**
 * Multiple Ordinary Least Squares (OLS) Linear Regression
 * Uses normal equations (X^T X)^(-1) X^T y
 */
export function multipleOLS(X: number[][], y: number[]): RegressionResult {
  const n = y.length;
  if (n === 0 || X.length === 0 || X[0].length === 0) {
    throw new Error('Empty dataset provided to multipleOLS');
  }

  const p = X[0].length;
  if (n <= p + 1) {
    throw new Error(`Insufficient observations (n=${n}) for ${p} predictors`);
  }

  // Design matrix with leading column of 1s
  const XDesign = new Matrix(n, p + 1);
  for (let i = 0; i < n; i++) {
    XDesign.set(i, 0, 1.0);
    for (let j = 0; j < p; j++) {
      XDesign.set(i, j + 1, X[i][j]);
    }
  }

  const yVec = Matrix.columnVector(y);

  // Beta = (X^T X)^(-1) X^T y
  const Xt = XDesign.transpose();
  const XtX = Xt.mmul(XDesign);
  let invXtX: Matrix;
  try {
    invXtX = inverse(XtX);
  } catch {
    const ridge = Matrix.eye(p + 1, p + 1).mul(1e-6);
    invXtX = inverse(XtX.add(ridge));
  }

  const beta = invXtX.mmul(Xt).mmul(yVec);
  const intercept = beta.get(0, 0);
  const coefficients: number[] = [];
  for (let j = 1; j <= p; j++) {
    coefficients.push(beta.get(j, 0));
  }

  const predictedValues: number[] = [];
  const residuals: number[] = [];
  let ssRes = 0;
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  let ssTot = 0;

  for (let i = 0; i < n; i++) {
    let pred = intercept;
    for (let j = 0; j < p; j++) {
      pred += coefficients[j] * X[i][j];
    }
    predictedValues.push(pred);
    const res = y[i] - pred;
    residuals.push(res);
    ssRes += res * res;
    ssTot += (y[i] - yMean) ** 2;
  }

  const dfRes = n - p - 1;
  const dfReg = p;
  const s2 = dfRes > 0 ? ssRes / dfRes : 0;
  const rSquared = ssTot > 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  const adjustedRSquared = dfRes > 0 && ssTot > 0
    ? 1 - (ssRes / dfRes) / (ssTot / (n - 1))
    : rSquared;

  const msReg = dfReg > 0 ? (ssTot - ssRes) / dfReg : 0;
  const msRes = dfRes > 0 ? ssRes / dfRes : 1;
  const fStatistic = msRes > 0 ? msReg / msRes : 0;
  const fPValue = dfReg > 0 && dfRes > 0 ? Math.max(0, Math.min(1, 1 - fCDF(fStatistic, dfReg, dfRes))) : 1;

  const standardErrors: number[] = [];
  const tStatistics: number[] = [];
  const tPValues: number[] = [];

  for (let j = 0; j <= p; j++) {
    const varBeta = invXtX.get(j, j) * s2;
    const se = Math.sqrt(Math.max(0, varBeta));
    const coef = beta.get(j, 0);
    const t = se > 0 ? coef / se : 0;
    const pVal = dfRes > 0 ? Math.max(0, Math.min(1, 2 * (1 - tCDF(Math.abs(t), dfRes)))) : 1;

    standardErrors.push(se);
    tStatistics.push(t);
    tPValues.push(pVal);
  }

  let dwNum = 0;
  for (let i = 1; i < n; i++) {
    dwNum += (residuals[i] - residuals[i - 1]) ** 2;
  }
  const durbinWatson = ssRes > 0 ? dwNum / ssRes : 2.0;

  return {
    coefficients,
    intercept,
    rSquared,
    adjustedRSquared,
    fStatistic,
    fPValue,
    standardErrors,
    tStatistics,
    tPValues,
    residuals,
    predictedValues,
    durbinWatson,
  };
}

/** Robust Iteratively Reweighted Least Squares (IRLS) with Huber M-estimator */
export function robustIRLS(X: number[][], y: number[], maxIter = 50): RegressionResult {
  const n = y.length;

  let ols = multipleOLS(X, y);
  const k = 1.345;
  let weights = new Array(n).fill(1.0);

  for (let iter = 0; iter < maxIter; iter++) {
    const sortedAbsRes = ols.residuals.map(r => Math.abs(r)).sort((a, b) => a - b);
    const mad = (sortedAbsRes[Math.floor(n / 2)] || 1.0) / 0.6745;
    if (mad < 1e-10) break;

    let weightChange = 0;
    for (let i = 0; i < n; i++) {
      const u = Math.abs(ols.residuals[i]) / mad;
      const newW = u <= k ? 1.0 : k / u;
      weightChange += Math.abs(newW - weights[i]);
      weights[i] = newW;
    }

    const XWeighted: number[][] = [];
    const yWeighted: number[] = [];
    for (let i = 0; i < n; i++) {
      const sw = Math.sqrt(weights[i]);
      XWeighted.push(X[i].map(x => x * sw));
      yWeighted.push(y[i] * sw);
    }

    try {
      ols = multipleOLS(XWeighted, yWeighted);
    } catch {
      break;
    }

    if (weightChange / n < 1e-4) break;
  }

  return ols;
}

/** Principal Component Analysis (PCA) via SVD */
export function pcaAnalysis(data: number[][], _labels?: string[]): PCAResult {
  const n = data.length;
  if (n === 0) throw new Error('Data empty for PCA');
  const p = data[0].length;
  if (p === 0) throw new Error('No features provided for PCA');

  const means: number[] = [];
  const stds: number[] = [];

  for (let j = 0; j < p; j++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += data[i][j];
    const mean = sum / n;
    means.push(mean);

    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += (data[i][j] - mean) ** 2;
    const std = Math.sqrt(sumSq / (n - 1)) || 1.0;
    stds.push(std);
  }

  const XNorm = new Matrix(n, p);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XNorm.set(i, j, (data[i][j] - means[j]) / stds[j]);
    }
  }

  const svd = new SVD(XNorm);
  const s = svd.diagonal;
  const V = svd.rightSingularVectors;

  const eigenvalues: number[] = [];
  let totalVariance = 0;
  for (let j = 0; j < Math.min(n, p); j++) {
    const val = (s[j] ** 2) / (n - 1);
    eigenvalues.push(val);
    totalVariance += val;
  }

  const explainedVariance = eigenvalues.map(ev => totalVariance > 0 ? (ev / totalVariance) * 100 : 0);
  const cumulativeVariance: number[] = [];
  let cum = 0;
  for (const ev of explainedVariance) {
    cum += ev;
    cumulativeVariance.push(cum);
  }

  const k = Math.min(p, 5);
  const loadings: number[][] = [];
  for (let j = 0; j < p; j++) {
    const row: number[] = [];
    for (let c = 0; c < k; c++) {
      row.push(V.get(j, c));
    }
    loadings.push(row);
  }

  const scoresMatrix = XNorm.mmul(V);
  const scores: number[][] = [];
  for (let i = 0; i < n; i++) {
    const row: number[] = [];
    for (let c = 0; c < k; c++) {
      row.push(scoresMatrix.get(i, c));
    }
    scores.push(row);
  }

  const componentLabels = Array.from({ length: k }, (_, idx) => `PC${idx + 1}`);

  return {
    eigenvalues,
    explainedVariance,
    cumulativeVariance,
    loadings,
    scores,
    componentLabels,
  };
}
