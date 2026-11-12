/**
 * descriptive.ts — Descriptive statistics, correlations, cross-correlation
 */
import type { DescriptiveStats, CorrelationResult } from '../../types/earthScience';
import { normalPValue, tPValue } from './distributions';

// ── Helpers ───────────────────────────────────────────────────────────

function clean(values: number[]): number[] {
  return values.filter(v => v != null && isFinite(v) && !isNaN(v));
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (pos - lo) * (sorted[hi] - sorted[lo]);
}

function rankData(arr: number[]): number[] {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j < indexed.length && indexed[j].v === indexed[i].v) j++;
    const avgRank = (i + j - 1) / 2 + 1; // 1-based average rank
    for (let k = i; k < j; k++) ranks[indexed[k].i] = avgRank;
    i = j;
  }
  return ranks;
}

// ── Descriptive Statistics ────────────────────────────────────────────

export function computeDescriptiveStats(values: number[]): DescriptiveStats {
  const totalCount = values.length;
  const valid = clean(values);
  const n = valid.length;
  const missingCount = totalCount - n;
  const missingPercent = totalCount > 0 ? (missingCount / totalCount) * 100 : 0;

  if (n === 0) {
    return {
      count: 0, mean: 0, median: 0, mode: [], stdDev: 0, variance: 0,
      skewness: 0, kurtosis: 0, min: 0, max: 0, range: 0,
      q1: 0, q3: 0, iqr: 0, cv: 0, sem: 0, missingCount, missingPercent,
    };
  }

  const sorted = [...valid].sort((a, b) => a - b);
  const mean = valid.reduce((s, v) => s + v, 0) / n;

  // Variance (sample)
  let m2 = 0, m3 = 0, m4 = 0;
  for (const v of valid) {
    const d = v - mean;
    m2 += d * d;
    m3 += d * d * d;
    m4 += d * d * d * d;
  }
  const variance = n > 1 ? m2 / (n - 1) : 0;
  const stdDev = Math.sqrt(variance);

  // Fisher skewness & excess kurtosis
  const skewness = n > 2 && stdDev > 0
    ? (n / ((n - 1) * (n - 2))) * (m3 / (stdDev * stdDev * stdDev * n) * n)
    : 0;
  // Corrected Fisher skewness: g1 = [n / ((n-1)(n-2))] * Σ((xi - x̄)/s)³
  const skewnessCorrect = n > 2 && stdDev > 0
    ? (n * m3) / ((n - 1) * (n - 2) * stdDev * stdDev * stdDev)
    : 0;

  // Excess kurtosis
  const kurtosis = n > 3 && variance > 0
    ? ((n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3))) * (m4 / (variance * variance))
      - (3 * (n - 1) * (n - 1)) / ((n - 2) * (n - 3))
    : 0;

  // Mode (values that appear most frequently)
  const freqMap = new Map<number, number>();
  for (const v of valid) freqMap.set(v, (freqMap.get(v) || 0) + 1);
  let maxFreq = 0;
  for (const f of freqMap.values()) if (f > maxFreq) maxFreq = f;
  const mode = maxFreq > 1
    ? [...freqMap.entries()].filter(([, f]) => f === maxFreq).map(([v]) => v).sort((a, b) => a - b)
    : [];

  const min = sorted[0];
  const max = sorted[n - 1];
  const q1 = quantile(sorted, 0.25);
  const q3 = quantile(sorted, 0.75);
  const sem = stdDev / Math.sqrt(n);
  const cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;

  return {
    count: n,
    mean,
    median: median(sorted),
    mode,
    stdDev,
    variance,
    skewness: skewnessCorrect,
    kurtosis,
    min,
    max,
    range: max - min,
    q1,
    q3,
    iqr: q3 - q1,
    cv,
    sem,
    missingCount,
    missingPercent,
  };
}

// ── Correlation ───────────────────────────────────────────────────────

export function computeCorrelation(x: number[], y: number[]): CorrelationResult {
  const n = Math.min(x.length, y.length);
  if (n < 3) {
    return { pearsonR: 0, pearsonP: 1, spearmanRho: 0, spearmanP: 1, kendallTau: 0, kendallP: 1 };
  }

  const xv = x.slice(0, n);
  const yv = y.slice(0, n);

  // ── Pearson r ──
  const mx = xv.reduce((s, v) => s + v, 0) / n;
  const my = yv.reduce((s, v) => s + v, 0) / n;
  let ssXY = 0, ssXX = 0, ssYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xv[i] - mx;
    const dy = yv[i] - my;
    ssXY += dx * dy;
    ssXX += dx * dx;
    ssYY += dy * dy;
  }
  const pearsonR = ssXX > 0 && ssYY > 0 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
  // t-test for Pearson: t = r √(n-2) / √(1-r²)
  const rSq = pearsonR * pearsonR;
  const tPearson = rSq < 1 ? pearsonR * Math.sqrt((n - 2) / (1 - rSq)) : 0;
  const pearsonP = n > 2 ? tPValue(tPearson, n - 2) : 1;

  // ── Spearman rho ──
  const xRanks = rankData(xv);
  const yRanks = rankData(yv);
  const mrx = xRanks.reduce((s, v) => s + v, 0) / n;
  const mry = yRanks.reduce((s, v) => s + v, 0) / n;
  let srXY = 0, srXX = 0, srYY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xRanks[i] - mrx;
    const dy = yRanks[i] - mry;
    srXY += dx * dy;
    srXX += dx * dx;
    srYY += dy * dy;
  }
  const spearmanRho = srXX > 0 && srYY > 0 ? srXY / Math.sqrt(srXX * srYY) : 0;
  const tSpearman = spearmanRho * spearmanRho < 1
    ? spearmanRho * Math.sqrt((n - 2) / (1 - spearmanRho * spearmanRho)) : 0;
  const spearmanP = n > 2 ? tPValue(tSpearman, n - 2) : 1;

  // ── Kendall tau-b ──
  let concordant = 0;
  let discordant = 0;
  let tiedX = 0;
  let tiedY = 0;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = xv[j] - xv[i];
      const dy = yv[j] - yv[i];
      if (dx === 0 && dy === 0) { tiedX++; tiedY++; }
      else if (dx === 0) { tiedX++; }
      else if (dy === 0) { tiedY++; }
      else if ((dx > 0 && dy > 0) || (dx < 0 && dy < 0)) { concordant++; }
      else { discordant++; }
    }
  }
  const n0 = n * (n - 1) / 2;
  const denom = Math.sqrt((n0 - tiedX) * (n0 - tiedY));
  const kendallTau = denom > 0 ? (concordant - discordant) / denom : 0;

  // Normal approximation for Kendall p-value
  const varTau = (2 * (2 * n + 5)) / (9 * n * (n - 1));
  const zKendall = kendallTau / Math.sqrt(varTau);
  const kendallP = normalPValue(zKendall);

  return { pearsonR, pearsonP, spearmanRho, spearmanP, kendallTau, kendallP };
}

// ── Cross-correlation function ────────────────────────────────────────

export function crossCorrelationFunction(x: number[], y: number[], maxLag: number): number[] {
  const n = Math.min(x.length, y.length);
  if (n === 0) return [];

  const mx = x.slice(0, n).reduce((s, v) => s + v, 0) / n;
  const my = y.slice(0, n).reduce((s, v) => s + v, 0) / n;

  let sx = 0, sy = 0;
  for (let i = 0; i < n; i++) {
    sx += (x[i] - mx) ** 2;
    sy += (y[i] - my) ** 2;
  }
  const denom = Math.sqrt(sx * sy);
  if (denom === 0) return new Array(2 * maxLag + 1).fill(0);

  const result: number[] = [];
  for (let lag = -maxLag; lag <= maxLag; lag++) {
    let sum = 0;
    for (let i = 0; i < n; i++) {
      const j = i + lag;
      if (j >= 0 && j < n) {
        sum += (x[i] - mx) * (y[j] - my);
      }
    }
    result.push(sum / denom);
  }
  return result;
}
