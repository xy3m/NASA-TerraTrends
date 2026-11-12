/**
 * distributions.ts — Exact statistical distribution functions
 * Pure TypeScript implementations with no external dependencies.
 */

// ── Constants ─────────────────────────────────────────────────────────
const LN_SQRT_2PI = 0.9189385332046727; // ln(sqrt(2π))
const GAMMA_COEFS = [
  76.18009172947146, -86.50532032941677, 24.01409824083091,
  -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
];

// ── Helpers ───────────────────────────────────────────────────────────

/** Lanczos log-gamma */
function lnGamma(z: number): number {
  if (z <= 0) return Infinity;
  let x = 1.000000000190015;
  for (let i = 0; i < 6; i++) x += GAMMA_COEFS[i] / (z + 1 + i);
  const t = z + 5.5;
  return LN_SQRT_2PI + Math.log(x / z) + (z + 0.5) * Math.log(t) - t;
}

/** Standard error function (Abramowitz & Stegun 7.1.26) */
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

// ── Normal distribution ───────────────────────────────────────────────

/** Normal CDF Φ(z) */
export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2));
}

/** Two-tailed p-value from a standard normal Z score */
export function normalPValue(z: number): number {
  const p = 2 * (1 - normalCdf(Math.abs(z)));
  return Math.max(0, Math.min(1, p));
}

// ── Regularized incomplete gamma (lower) ──────────────────────────────

/**
 * Regularized lower incomplete gamma P(a, x) = γ(a,x) / Γ(a)
 * Uses series expansion for x < a+1, continued fraction otherwise.
 */
export function incompleteGamma(a: number, x: number): number {
  if (x < 0) return 0;
  if (x === 0) return 0;
  if (a <= 0) return 1;

  if (x < a + 1) {
    return gammaSeries(a, x);
  } else {
    return 1 - gammaCF(a, x);
  }
}

/** Series expansion for P(a, x) */
function gammaSeries(a: number, x: number): number {
  const lnGa = lnGamma(a);
  let ap = a;
  let sum = 1.0 / a;
  let del = sum;
  for (let i = 0; i < 200; i++) {
    ap += 1;
    del *= x / ap;
    sum += del;
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - lnGa);
}

/** Continued fraction for Q(a, x) = 1 - P(a, x) via Lentz's method */
function gammaCF(a: number, x: number): number {
  const lnGa = lnGamma(a);
  let b = x + 1 - a;
  let c = 1e30;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 200; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-14) break;
  }
  return Math.exp(-x + a * Math.log(x) - lnGa) * h;
}

// ── Regularized incomplete beta ───────────────────────────────────────

/**
 * Regularized incomplete beta I_x(a, b)
 * Uses continued-fraction representation (Lentz).
 */
export function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  if (a <= 0 || b <= 0) return NaN;

  // Symmetry transformation for numerical stability
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(b, a, 1 - x);
  }

  const lnPre =
    lnGamma(a + b) - lnGamma(a) - lnGamma(b) +
    a * Math.log(x) + b * Math.log(1 - x);
  const pre = Math.exp(lnPre);

  // Lentz continued fraction
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= 200; m++) {
    // even step
    let numerator = m * (b - m) * x / ((a + 2 * m - 1) * (a + 2 * m));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    // odd step
    numerator = -(a + m) * (a + b + m) * x / ((a + 2 * m) * (a + 2 * m + 1));
    d = 1 + numerator * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + numerator / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < 1e-14) break;
  }

  return (pre / a) * h;
}

// ── Distribution CDFs ─────────────────────────────────────────────────

/**
 * Student's t CDF (two-tailed area in the LOWER tail, i.e., P(T <= t))
 * Uses the incomplete beta function.
 */
export function tCDF(t: number, df: number): number {
  if (df <= 0) return NaN;
  if (!isFinite(t)) return t > 0 ? 1 : 0;
  const x = df / (df + t * t);
  const ib = incompleteBeta(df / 2, 0.5, x);
  return t >= 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

/**
 * Two-tailed p-value from Student's t distribution
 */
export function tPValue(t: number, df: number): number {
  if (df <= 0) return 1;
  const x = df / (df + t * t);
  return incompleteBeta(df / 2, 0.5, x);
}

/**
 * F distribution CDF: P(F <= f | df1, df2)
 */
export function fCDF(f: number, df1: number, df2: number): number {
  if (df1 <= 0 || df2 <= 0 || f < 0) return NaN;
  if (f === 0) return 0;
  const x = (df1 * f) / (df1 * f + df2);
  return incompleteBeta(df1 / 2, df2 / 2, x);
}

/**
 * Chi-squared CDF: P(X² <= x | df)
 */
export function chiSquaredCDF(x: number, df: number): number {
  if (df <= 0 || x < 0) return NaN;
  if (x === 0) return 0;
  return incompleteGamma(df / 2, x / 2);
}

// ── Quantile (inverse CDF) ───────────────────────────────────────────

/**
 * t distribution quantile: finds t such that P(T <= t) = p.
 * Uses Newton-Raphson with a normal initial approximation.
 */
export function tQuantile(p: number, df: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (df <= 0) return NaN;

  // Initial approximation from inverse normal
  let t = normalQuantileApprox(p);

  // Refine with Newton-Raphson using t-CDF and t-PDF
  for (let i = 0; i < 25; i++) {
    const cdf = tCDF(t, df);
    const pdf = tPDF(t, df);
    if (pdf < 1e-30) break;
    const delta = (cdf - p) / pdf;
    t -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  return t;
}

/** t distribution PDF (for Newton-Raphson) */
function tPDF(t: number, df: number): number {
  const lnCoef = lnGamma((df + 1) / 2) - 0.5 * Math.log(df * Math.PI) - lnGamma(df / 2);
  return Math.exp(lnCoef - ((df + 1) / 2) * Math.log(1 + (t * t) / df));
}

/** Rational approximation of the inverse standard normal (Beasley-Springer-Moro) */
function normalQuantileApprox(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;

  // Abramowitz & Stegun 26.2.23
  if (p < 0.5) return -normalQuantileApprox(1 - p);
  const t = Math.sqrt(-2 * Math.log(1 - p));
  const c0 = 2.515517;
  const c1 = 0.802853;
  const c2 = 0.010328;
  const d1 = 1.432788;
  const d2 = 0.189269;
  const d3 = 0.001308;
  return t - (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t);
}
