/**
 * False Discovery Rate (FDR) and Multiple Testing Corrections
 * Benjamini-Hochberg, Bonferroni, and Holm-Bonferroni methods
 */

export interface MultipleTestingResult {
  adjusted: number[];
  significant: boolean[];
  method: 'Benjamini-Hochberg' | 'Bonferroni' | 'Holm';
  alpha: number;
  significantCount: number;
}

/**
 * Benjamini-Hochberg procedure for controlling the False Discovery Rate (FDR)
 * O(m log m) complexity
 */
export function benjaminiHochberg(pValues: number[], alpha = 0.05): MultipleTestingResult {
  const m = pValues.length;
  if (m === 0) {
    return { adjusted: [], significant: [], method: 'Benjamini-Hochberg', alpha, significantCount: 0 };
  }

  // Track original indices
  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  // Compute adjusted p-values from largest to smallest
  const adjusted = new Array(m);
  let minAdj = 1.0;

  for (let k = m - 1; k >= 0; k--) {
    const rank = k + 1;
    const rawP = indexed[k].p;
    const adj = (rawP * m) / rank;
    minAdj = Math.min(minAdj, adj);
    adjusted[indexed[k].i] = Math.min(1.0, minAdj);
  }

  const significant = adjusted.map(p => p <= alpha);
  const significantCount = significant.filter(Boolean).length;

  return {
    adjusted,
    significant,
    method: 'Benjamini-Hochberg',
    alpha,
    significantCount,
  };
}

/**
 * Bonferroni single-step family-wise error rate (FWER) correction
 * Conservative: p_adj = min(1, p * m)
 */
export function bonferroniCorrection(pValues: number[], alpha = 0.05): MultipleTestingResult {
  const m = pValues.length;
  const adjusted = pValues.map(p => Math.min(1.0, p * m));
  const significant = adjusted.map(p => p <= alpha);

  return {
    adjusted,
    significant,
    method: 'Bonferroni',
    alpha,
    significantCount: significant.filter(Boolean).length,
  };
}

/**
 * Holm-Bonferroni step-down procedure
 * More powerful than standard Bonferroni while still controlling FWER
 */
export function holmCorrection(pValues: number[], alpha = 0.05): MultipleTestingResult {
  const m = pValues.length;
  if (m === 0) {
    return { adjusted: [], significant: [], method: 'Holm', alpha, significantCount: 0 };
  }

  const indexed = pValues.map((p, i) => ({ p, i }));
  indexed.sort((a, b) => a.p - b.p);

  const adjusted = new Array(m);
  let maxAdj = 0;

  for (let k = 0; k < m; k++) {
    const rawP = indexed[k].p;
    const adj = rawP * (m - k);
    maxAdj = Math.max(maxAdj, adj);
    adjusted[indexed[k].i] = Math.min(1.0, maxAdj);
  }

  const significant = adjusted.map(p => p <= alpha);

  return {
    adjusted,
    significant,
    method: 'Holm',
    alpha,
    significantCount: significant.filter(Boolean).length,
  };
}
