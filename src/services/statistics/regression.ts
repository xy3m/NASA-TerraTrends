import { Matrix, SVD, inverse } from 'ml-matrix';
import { RegressionResult, PCAResult, NonlinearRegressionResult } from '../../types/earthScience';
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

/**
 * Bounded Nonlinear Least-Squares Regression via Levenberg-Marquardt / Closed-Form Transforms.
 * Supports Exponential, Logarithmic, Power-Law, Quadratic, and Sigmoidal Logistic curves.
 */
export function nonlinearRegression(
  xRaw: number[],
  yRaw: number[],
  model: 'exponential' | 'logarithmic' | 'power' | 'quadratic' | 'logistic'
): NonlinearRegressionResult {
  const paired = xRaw
    .map((x, i) => ({ x, y: yRaw[i] }))
    .filter(p => isFinite(p.x) && isFinite(p.y));
  const n = paired.length;
  if (n < 5) {
    throw new Error('At least 5 valid (X, Y) pairs are required for nonlinear regression.');
  }

  const x = paired.map(p => p.x);
  const y = paired.map(p => p.y);
  const yMean = y.reduce((s, v) => s + v, 0) / n;
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);

  const solveLinear = (design: number[][], rhs: number[]): number[] => {
    const X = new Matrix(design);
    const yV = Matrix.columnVector(rhs);
    const Xt = X.transpose();
    const p = design[0].length;
    const beta = inverse(Xt.mmul(X).add(Matrix.eye(p, p).mul(1e-7))).mmul(Xt).mmul(yV);
    return Array.from({ length: p }, (_, i) => beta.get(i, 0));
  };

  let params: number[] = [];
  let paramLabels: string[] = [];
  let equation = '';
  let evalFn: (xi: number, p: number[]) => number;

  if (model === 'quadratic') {
    const beta = solveLinear(x.map(xi => [1, xi, xi * xi]), y);
    params = beta;
    paramLabels = ['a (Intercept)', 'b (Linear)', 'c (Quadratic)'];
    equation = `y = ${beta[0].toFixed(3)} + ${beta[1].toFixed(4)}x + ${beta[2].toFixed(5)}x²`;
    evalFn = (xi, p) => p[0] + p[1] * xi + p[2] * xi * xi;
  } else if (model === 'logarithmic') {
    const xMin = Math.min(...x);
    const shift = xMin <= 0 ? Math.abs(xMin) + 1 : 0;
    const beta = solveLinear(x.map(xi => [1, Math.log(xi + shift)]), y);
    params = shift > 0 ? [beta[0], beta[1], shift] : [beta[0], beta[1]];
    paramLabels = shift > 0 ? ['a', 'b', 'x_shift'] : ['a', 'b'];
    equation =
      shift > 0
        ? `y = ${beta[0].toFixed(3)} + ${beta[1].toFixed(3)} ln(x + ${shift.toFixed(1)})`
        : `y = ${beta[0].toFixed(3)} + ${beta[1].toFixed(3)} ln(x)`;
    evalFn = (xi, p) => p[0] + p[1] * Math.log(Math.max(1e-6, xi + (p[2] ?? 0)));
  } else {
    // Bounded Levenberg-Marquardt damped Gauss-Newton solver for true nonlinear models
    const xMin = Math.min(...x);
    const xSpan = Math.max(1e-4, Math.max(...x) - xMin);
    const u = x.map(xi => (xi - xMin) / xSpan); // normalize x to [0, 1] for stability
    const yMin = Math.min(...y);
    const yMax = Math.max(...y);
    const ySpan = Math.max(1e-4, yMax - yMin);

    let theta: number[];
    let bounds: [number, number][];
    let fNorm: (ui: number, p: number[]) => number;

    if (model === 'exponential') {
      theta = [Math.max(1e-3, y[0] - yMin + 0.1 * ySpan), 0.25, yMin - 0.05 * ySpan];
      bounds = [[1e-4, 20 * ySpan], [-8.0, 8.0], [yMin - 5 * ySpan, yMax + 2 * ySpan]];
      fNorm = (ui, p) => p[2] + p[0] * Math.exp(Math.max(-20, Math.min(20, p[1] * ui)));
    } else if (model === 'power') {
      theta = [ySpan, 1.0, yMin];
      bounds = [[-15 * ySpan, 15 * ySpan], [-4.0, 5.0], [yMin - 5 * ySpan, yMax + 5 * ySpan]];
      fNorm = (ui, p) => p[2] + p[0] * Math.pow(ui + 0.05, p[1]);
    } else {
      // Logistic growth / saturation curve: c + L / (1 + exp(-k*(u - u0)))
      theta = [ySpan, 5.0, 0.5, yMin];
      bounds = [[1e-4, 4 * ySpan], [-25.0, 25.0], [-0.5, 1.5], [yMin - 2 * ySpan, yMax]];
      fNorm = (ui, p) => p[3] + p[0] / (1 + Math.exp(-Math.max(-25, Math.min(25, p[1] * (ui - p[2])))));
    }

    const sse = (p: number[]) =>
      u.reduce((acc, ui, idx) => acc + (y[idx] - fNorm(ui, p)) ** 2, 0);

    let lambda = 1e-2;
    let bestErr = sse(theta);
    const m = theta.length;
    const eps = 1e-5;

    for (let iter = 0; iter < 60; iter++) {
      const res = u.map((ui, idx) => y[idx] - fNorm(ui, theta));
      const J: number[][] = Array.from({ length: n }, () => Array(m).fill(0));
      for (let j = 0; j < m; j++) {
        const pPlus = [...theta];
        pPlus[j] += eps;
        for (let i = 0; i < n; i++) {
          J[i][j] = (fNorm(u[i], pPlus) - fNorm(u[i], theta)) / eps;
        }
      }

      const JMat = new Matrix(J);
      const Jt = JMat.transpose();
      const A = Jt.mmul(JMat).add(Matrix.eye(m, m).mul(lambda));
      const grad = Jt.mmul(Matrix.columnVector(res));
      let delta: Matrix;
      try {
        delta = inverse(A).mmul(grad);
      } catch {
        lambda *= 10;
        continue;
      }

      const candidate = theta.map((v, j) =>
        Math.max(bounds[j][0], Math.min(bounds[j][1], v + delta.get(j, 0)))
      );
      const candErr = sse(candidate);
      if (candErr < bestErr) {
        const relImp = (bestErr - candErr) / Math.max(1e-9, bestErr);
        theta = candidate;
        bestErr = candErr;
        lambda = Math.max(1e-6, lambda * 0.4);
        if (relImp < 1e-7) break;
      } else {
        lambda = Math.min(1e4, lambda * 5);
      }
    }

    params = theta;
    if (model === 'exponential') {
      paramLabels = ['a (Scale)', 'b (Normalized Rate)', 'c (Asymptote)'];
      equation = `y = ${theta[2].toFixed(3)} + ${theta[0].toFixed(3)} exp(${theta[1].toFixed(3)}·u)`;
    } else if (model === 'power') {
      paramLabels = ['a (Scale)', 'b (Exponent)', 'c (Offset)'];
      equation = `y = ${theta[2].toFixed(3)} + ${theta[0].toFixed(3)} (u+0.05)^${theta[1].toFixed(3)}`;
    } else {
      paramLabels = ['L (Amplitude)', 'k (Steepness)', 'u0 (Midpoint frac)', 'c (Floor)'];
      equation = `y = ${theta[3].toFixed(3)} + ${theta[0].toFixed(3)} / (1 + exp(-${theta[1].toFixed(2)}(u - ${theta[2].toFixed(2)})))`;
    }
    evalFn = (xi, p) => fNorm((xi - xMin) / xSpan, p);
  }

  const predictedValues = x.map(xi => evalFn(xi, params));
  const residuals = y.map((yi, i) => yi - predictedValues[i]);
  const ssRes = residuals.reduce((s, r) => s + r * r, 0);
  const rSquared = ssTot > 0 ? Math.max(0, Math.min(1, 1 - ssRes / ssTot)) : 0;
  const rmse = Math.sqrt(ssRes / n);
  const kParams = params.length;
  const aic = n * Math.log(Math.max(1e-12, ssRes / n)) + 2 * kParams;

  return {
    model,
    equation,
    paramLabels,
    params,
    rSquared,
    rmse,
    aic,
    predictedValues,
    residuals,
  };
}

