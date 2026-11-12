import React from 'react';
import { AnalysisConfig } from './AnalysisPanel';
import { LabResultsBundle } from './StatisticalLab';
import { HistogramChart } from '../charts/HistogramChart';
import { BoxPlotChart } from '../charts/BoxPlotChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { DiagnosticPlots } from '../charts/DiagnosticPlots';
import { ScatterMatrix } from '../charts/ScatterMatrix';
import { TrendingUp, Download, Cpu } from 'lucide-react';

interface ResultsViewProps {
  config: AnalysisConfig;
  data: {
    primaryColName: string;
    primaryValues: number[];
    secondaryColsData: { name: string; values: number[] }[];
  };
  results: LabResultsBundle;
  onSendToPhase2?: () => void;
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  config,
  data,
  results,
  onSendToPhase2,
}) => {
  const {
    descriptive,
    bootstrap,
    entropy,
    correlation,
    correlationMatrix,
    crossCorrelation,
    correlationFDR,
    ttest,
    anova,
    twoWayAnova,
    regression,
    nonlinear,
    pca,
    trend,
    gev,
    changePoint,
    cusumChangePoint,
    fdr,
    executionMeta,
  } = results;

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify({ config, results }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoiris_${config.type}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header with Execution Telemetry & Export */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#071326] border border-slate-800 rounded-xl p-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
              {config.type.toUpperCase()} ANALYSIS
            </span>
            {executionMeta?.viaWorker && (
              <span
                className="inline-flex items-center space-x-1 text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30"
                title={`Off-thread tasks: ${executionMeta.tasks.join(', ')}`}
              >
                <Cpu className="w-3 h-3" />
                <span>Web Worker • {executionMeta.durationMs.toFixed(1)} ms</span>
              </span>
            )}
          </div>
          <h3 className="text-base font-bold text-white mt-1">
            Statistical Results for {data.primaryColName}
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {onSendToPhase2 && (
            <button
              onClick={onSendToPhase2}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-xs font-bold text-white shadow-md transition-all"
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Run SARIMA / Bayesian MCMC (Phase 2)</span>
            </button>
          )}
          <button
            onClick={exportJSON}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Results (JSON)</span>
          </button>
        </div>
      </div>

      {/* 1. DESCRIPTIVE STATS */}
      {config.type === 'descriptive' && descriptive && (
        <div className="space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Mean', val: descriptive.mean.toFixed(3) },
              { label: 'Median', val: descriptive.median.toFixed(3) },
              { label: 'Std Dev (s)', val: descriptive.stdDev.toFixed(3) },
              { label: 'IQR', val: descriptive.iqr.toFixed(3) },
              { label: 'Skewness', val: descriptive.skewness.toFixed(3) },
              { label: 'Kurtosis', val: descriptive.kurtosis.toFixed(3) },
            ].map((m, idx) => (
              <div key={idx} className="bg-[#071326] border border-slate-800 rounded-xl p-3">
                <span className="text-[10px] uppercase text-slate-500 font-semibold">{m.label}</span>
                <div className="text-base font-bold text-white font-mono mt-0.5">{m.val}</div>
              </div>
            ))}
          </div>

          {/* Histogram and BoxPlot side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-[#071326] border border-slate-800 rounded-2xl p-4 space-y-2">
              <h4 className="text-xs font-bold text-slate-300">Histogram & Frequency</h4>
              <HistogramChart data={data.primaryValues} title={`${data.primaryColName} Frequency`} />
            </div>

            <BoxPlotChart
              groups={[{ label: data.primaryColName, values: data.primaryValues }]}
              title={`${data.primaryColName} Quartile Spread`}
            />
          </div>

          {/* Bootstrap CI + Information Entropy */}
          {(bootstrap || entropy) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bootstrap && (
                <div className="bg-[#071326] border border-slate-800 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white">
                      Bootstrap Percentile CI ({bootstrap.statLabel.toUpperCase()}, B = {bootstrap.iterations})
                    </h4>
                    <span className="text-[10px] font-mono text-cyan-400">
                      {Math.round((1 - config.alpha) * 100)}% CI
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs font-mono pt-1">
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Estimate</span>
                      <span className="font-bold text-white">{bootstrap.estimate.toFixed(4)}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Bootstrap SE</span>
                      <span className="font-bold text-amber-400">{bootstrap.standardError.toFixed(4)}</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">CI Bounds</span>
                      <span className="font-bold text-emerald-400">
                        [{bootstrap.ciLower.toFixed(3)}, {bootstrap.ciUpper.toFixed(3)}]
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {entropy && (
                <div className="bg-[#071326] border border-slate-800 rounded-2xl p-4 space-y-2">
                  <h4 className="text-xs font-bold text-white">
                    Information Entropy & Regularity
                  </h4>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Shannon Entropy</span>
                      <span className="font-bold text-purple-400">{entropy.shannon.toFixed(3)} bits</span>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-lg">
                      <span className="text-[10px] text-slate-500 block">Sample Entropy (SampEn)</span>
                      <span className="font-bold text-cyan-400">{entropy.sample.toFixed(3)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 2. CORRELATION */}
      {config.type === 'correlation' && (
        <div className="space-y-6">
          {correlation && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#071326] border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] uppercase text-slate-400">Pearson r</span>
                <div className="text-2xl font-bold font-mono text-cyan-400 mt-1">
                  {correlation.pearsonR.toFixed(3)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  p = {correlation.pearsonP.toFixed(4)}
                </div>
              </div>

              <div className="bg-[#071326] border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] uppercase text-slate-400">Spearman Rho (ρ)</span>
                <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
                  {correlation.spearmanRho.toFixed(3)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  p = {correlation.spearmanP.toFixed(4)}
                </div>
              </div>

              <div className="bg-[#071326] border border-slate-800 rounded-xl p-4 text-center">
                <span className="text-[10px] uppercase text-slate-400">Kendall Tau (τ)</span>
                <div className="text-2xl font-bold font-mono text-purple-400 mt-1">
                  {correlation.kendallTau.toFixed(3)}
                </div>
                <div className="text-[11px] text-slate-400 font-mono mt-1">
                  p = {correlation.kendallP.toFixed(4)}
                </div>
              </div>
            </div>
          )}

          {/* Correlation Heatmap and Scatter Matrix */}
          {correlationMatrix && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <HeatmapChart
                matrix={correlationMatrix.matrix}
                labels={correlationMatrix.labels}
              />
              <ScatterMatrix
                columns={[
                  { name: data.primaryColName, values: data.primaryValues },
                  ...data.secondaryColsData,
                ]}
              />
            </div>
          )}

          {/* Cross-Correlation Function (Lead-Lag) */}
          {crossCorrelation && crossCorrelation.lags.length > 0 && (
            <div className="bg-[#071326] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">
                  Lead-Lag Cross-Correlation Function (CCF): {crossCorrelation.pairLabel}
                </h4>
                {(() => {
                  let bestIdx = 0;
                  crossCorrelation.values.forEach((v, i) => {
                    if (Math.abs(v) > Math.abs(crossCorrelation.values[bestIdx])) bestIdx = i;
                  });
                  return (
                    <span className="text-[11px] font-mono text-cyan-400">
                      Peak r = {crossCorrelation.values[bestIdx].toFixed(3)} at Lag {crossCorrelation.lags[bestIdx]}
                    </span>
                  );
                })()}
              </div>
              <div className="flex items-end space-x-1 h-24 pt-2 border-b border-slate-800">
                {crossCorrelation.values.map((val, idx) => {
                  const pct = Math.min(100, Math.abs(val) * 100);
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                      <div
                        className={`w-full rounded-t transition-all ${
                          val >= 0 ? 'bg-cyan-500/80' : 'bg-rose-500/80'
                        }`}
                        style={{ height: `${Math.max(4, pct)}%` }}
                        title={`Lag ${crossCorrelation.lags[idx]}: r = ${val.toFixed(3)}`}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>Lag {crossCorrelation.lags[0]}</span>
                <span>Lag 0 (Synchronous)</span>
                <span>Lag +{crossCorrelation.lags[crossCorrelation.lags.length - 1]}</span>
              </div>
            </div>
          )}

          {/* Pairwise Multiple-Testing FDR Table */}
          {correlationFDR && (
            <div className="bg-[#071326] border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-white">
                  Pairwise Multiple-Testing Correction (α = {config.alpha})
                </h4>
                <span className="text-[11px] font-mono text-emerald-400">
                  {correlationFDR.bh.significantCount}/{correlationFDR.pairs.length} significant after BH FDR
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-2">Pair</th>
                      <th className="py-2">Raw p</th>
                      <th className="py-2">BH FDR (q)</th>
                      <th className="py-2">Holm p</th>
                      <th className="py-2">Bonferroni p</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {correlationFDR.pairs.map((pair, idx) => (
                      <tr key={pair}>
                        <td className="py-1.5 font-semibold text-white">{pair}</td>
                        <td className="py-1.5">{correlationFDR.rawPValues[idx].toFixed(4)}</td>
                        <td className={`py-1.5 font-bold ${correlationFDR.bh.significant[idx] ? 'text-emerald-400' : 'text-slate-400'}`}>
                          {correlationFDR.bh.adjusted[idx].toFixed(4)}
                        </td>
                        <td className="py-1.5">{correlationFDR.holm.adjusted[idx].toFixed(4)}</td>
                        <td className="py-1.5">{correlationFDR.bonferroni.adjusted[idx].toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. T-TEST */}
      {config.type === 'ttest' && ttest && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white">Student's t-Test Verification</div>
              <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                ttest.pValue < config.alpha
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {ttest.pValue < config.alpha ? 'Statistically Significant (p < α)' : 'Null Hypothesis Retained (p ≥ α)'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">t-Statistic</span>
                <span className="text-base font-bold text-cyan-400">{ttest.t.toFixed(3)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Degrees of Freedom</span>
                <span className="text-base font-bold text-white">{ttest.df.toFixed(1)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">p-Value (two-tailed)</span>
                <span className="text-base font-bold text-emerald-400">{ttest.pValue.toFixed(4)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Mean Difference</span>
                <span className="text-base font-bold text-amber-400">{ttest.meanDiff.toFixed(3)}</span>
              </div>
            </div>

            <div className="p-3 bg-slate-900/60 rounded-xl text-xs text-slate-300">
              <span className="font-semibold text-cyan-400">{Math.round((1 - config.alpha) * 100)}% Confidence Interval:</span>{' '}
              [{ttest.ciLower.toFixed(3)}, {ttest.ciUpper.toFixed(3)}]
            </div>
          </div>

          {data.secondaryColsData[0] && (
            <BoxPlotChart
              groups={[
                { label: data.primaryColName, values: data.primaryValues },
                { label: data.secondaryColsData[0].name, values: data.secondaryColsData[0].values },
              ]}
              title="Group Distribution Comparison"
            />
          )}
        </div>
      )}

      {/* 4. ANOVA */}
      {config.type === 'anova' && anova && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-white">One-Way ANOVA Table</div>
              <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                anova.pValue < config.alpha
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {anova.pValue < config.alpha ? 'Significant Group Variance' : 'No Significant Difference'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">F-Statistic</span>
                <span className="text-base font-bold text-purple-400">{anova.f.toFixed(3)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">p-Value</span>
                <span className="text-base font-bold text-emerald-400">{anova.pValue.toFixed(4)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">df (Between, Within)</span>
                <span className="text-base font-bold text-white">{anova.dfBetween}, {anova.dfWithin}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Grand Mean</span>
                <span className="text-base font-bold text-cyan-400">{anova.grandMean.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <BoxPlotChart
            groups={[
              { label: data.primaryColName, values: data.primaryValues },
              ...data.secondaryColsData.map(c => ({ label: c.name, values: c.values })),
            ]}
            title="Multi-Group ANOVA Comparison"
          />
        </div>
      )}

      {/* 5. REGRESSION */}
      {config.type === 'regression' && regression && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Multiple OLS Regression Model</h4>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Dependent (Y): {data.primaryColName} | Predictors: {data.secondaryColsData.map(c => c.name).join(', ')}
                </div>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-400">R² = </span>
                <span className="text-cyan-400 font-bold">{regression.rSquared.toFixed(3)}</span>
                <span className="text-slate-500 ml-2">(Adj R²: {regression.adjustedRSquared.toFixed(3)})</span>
              </div>
            </div>

            {/* Coefficients Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 text-[10px] uppercase">
                    <th className="py-2">Term</th>
                    <th className="py-2">Estimate (β)</th>
                    <th className="py-2">Std Error</th>
                    <th className="py-2">t-Stat</th>
                    <th className="py-2">p-Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  <tr>
                    <td className="py-2 font-bold text-cyan-400">Intercept (β₀)</td>
                    <td className="py-2">{regression.intercept.toFixed(4)}</td>
                    <td className="py-2">{regression.standardErrors[0]?.toFixed(4)}</td>
                    <td className="py-2">{regression.tStatistics[0]?.toFixed(3)}</td>
                    <td className="py-2">{regression.tPValues[0]?.toFixed(4)}</td>
                  </tr>
                  {data.secondaryColsData.map((col, idx) => (
                    <tr key={idx}>
                      <td className="py-2 font-medium text-white">{col.name}</td>
                      <td className="py-2">{regression.coefficients[idx]?.toFixed(4)}</td>
                      <td className="py-2">{regression.standardErrors[idx + 1]?.toFixed(4)}</td>
                      <td className="py-2">{regression.tStatistics[idx + 1]?.toFixed(3)}</td>
                      <td className="py-2">{regression.tPValues[idx + 1]?.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Diagnostic Plots for Regression */}
          <DiagnosticPlots
            residuals={regression.residuals}
            fitted={regression.predictedValues}
            values={data.primaryValues}
          />
        </div>
      )}

      {/* 4b. TWO-WAY FACTORIAL ANOVA */}
      {config.type === 'two_way_anova' && twoWayAnova && (
        <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white">
              Two-Way Factorial ANOVA ({twoWayAnova.factorALabel} × {twoWayAnova.factorBLabel})
            </h4>
            <span className="text-xs font-mono text-cyan-300">
              Grand Mean = {twoWayAnova.grandMean.toFixed(3)}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                  <th className="py-2">Source of Variance</th>
                  <th className="py-2">df</th>
                  <th className="py-2">Sum of Squares</th>
                  <th className="py-2">Mean Square</th>
                  <th className="py-2">F-Statistic</th>
                  <th className="py-2">p-Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {[
                  { name: `Main Effect: ${twoWayAnova.factorALabel}`, row: twoWayAnova.factorA },
                  { name: `Main Effect: ${twoWayAnova.factorBLabel}`, row: twoWayAnova.factorB },
                  { name: 'Interaction (Factor A × Factor B)', row: twoWayAnova.interaction },
                ].map(item => (
                  <tr key={item.name}>
                    <td className="py-2 font-semibold text-white">{item.name}</td>
                    <td className="py-2">{item.row.df}</td>
                    <td className="py-2">{item.row.ss.toFixed(3)}</td>
                    <td className="py-2">{item.row.ms.toFixed(3)}</td>
                    <td className="py-2 text-cyan-300">{item.row.f.toFixed(3)}</td>
                    <td className={`py-2 font-bold ${item.row.pValue < config.alpha ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {item.row.pValue.toFixed(4)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2 text-slate-400">Within-Cell Residual</td>
                  <td className="py-2">{twoWayAnova.within.df}</td>
                  <td className="py-2">{twoWayAnova.within.ss.toFixed(3)}</td>
                  <td className="py-2">{twoWayAnova.within.ms.toFixed(3)}</td>
                  <td className="py-2 text-slate-500">—</td>
                  <td className="py-2 text-slate-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
            {twoWayAnova.cellMeans.map((cell, idx) => (
              <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 font-mono text-[11px]">
                <div className="text-slate-400 truncate">{cell.levelA} × {cell.levelB}</div>
                <div className="text-sm font-bold text-white mt-0.5">{cell.mean.toFixed(3)}</div>
                <div className="text-[10px] text-slate-500">n = {cell.n}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5b. NONLINEAR REGRESSION */}
      {config.type === 'nonlinear' && nonlinear && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Bounded Nonlinear Fit ({nonlinear.model})
                </h4>
                <p className="text-xs font-mono text-cyan-300 mt-1">{nonlinear.equation}</p>
              </div>
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="text-emerald-400 font-bold">R² = {nonlinear.rSquared.toFixed(4)}</span>
                <span className="text-slate-400">RMSE = {nonlinear.rmse.toFixed(4)}</span>
                <span className="text-slate-400">AIC = {nonlinear.aic.toFixed(1)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {nonlinear.params.map((p, idx) => (
                <div key={idx} className="bg-slate-900 rounded-xl p-3 font-mono text-xs">
                  <span className="text-[10px] text-slate-400 block">{nonlinear.paramLabels[idx]}</span>
                  <span className="text-sm font-bold text-white">{p.toFixed(4)}</span>
                </div>
              ))}
            </div>
          </div>
          <DiagnosticPlots
            residuals={nonlinear.residuals}
            fitted={nonlinear.predictedValues}
            values={data.primaryValues}
          />
        </div>
      )}

      {/* 6. PCA */}
      {config.type === 'pca' && pca && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-5">
            <h4 className="text-xs font-bold text-white">Principal Components Scree &amp; Explained Variance</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pca.componentLabels.map((label, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-bold">{label}</span>
                    <span className="text-[10px] text-slate-400">λ = {pca.eigenvalues[idx]?.toFixed(2)}</span>
                  </div>
                  <div className="text-lg font-bold text-white mt-1">
                    {pca.explainedVariance[idx]?.toFixed(1)}%
                  </div>
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-1.5">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                      style={{ width: `${Math.min(100, pca.explainedVariance[idx] ?? 0)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">
                    Cumulative: {pca.cumulativeVariance[idx]?.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>

            {/* Feature Factor Loadings Matrix */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h5 className="text-xs font-bold text-slate-200">Component Factor Loadings (Eigenvector Weights)</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                      <th className="py-2">Variable</th>
                      {pca.componentLabels.map(lbl => (
                        <th key={lbl} className="py-2">{lbl}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {[data.primaryColName, ...data.secondaryColsData.map(c => c.name)].map((colName, rIdx) => (
                      <tr key={colName}>
                        <td className="py-2 font-semibold text-white">{colName}</td>
                        {pca.componentLabels.map((_, cIdx) => {
                          const w = pca.loadings[rIdx]?.[cIdx] ?? 0;
                          return (
                            <td
                              key={cIdx}
                              className={`py-2 font-bold ${
                                Math.abs(w) >= 0.45 ? (w > 0 ? 'text-cyan-300' : 'text-rose-300') : 'text-slate-400'
                              }`}
                            >
                              {w > 0 ? '+' : ''}{w.toFixed(3)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* PC1 vs PC2 Scatter Biplot Projection (when >= 2 components exist) */}
            {pca.componentLabels.length >= 2 && pca.scores.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <h5 className="text-xs font-bold text-slate-200">
                  Observation Scores Projection (PC1 vs PC2)
                </h5>
                <ScatterMatrix
                  columns={[
                    { name: 'PC1', values: pca.scores.map(row => row[0] ?? 0) },
                    { name: 'PC2', values: pca.scores.map(row => row[1] ?? 0) },
                  ]}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* 7b. EXTREME VALUE GEV */}
      {config.type === 'extremes' && gev && (
        <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-white">
                Generalized Extreme Value (GEV) Block-Maxima Analysis ({gev.blockMaxima.length} Blocks)
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">Tail Family: <strong className="text-rose-300">{gev.family}</strong></p>
            </div>
            <div className="flex items-center space-x-3 font-mono text-xs">
              <span>ξ = <strong className="text-cyan-300">{gev.shapeXi.toFixed(3)}</strong></span>
              <span>μ = <strong className="text-white">{gev.locationMu.toFixed(3)}</strong></span>
              <span>σ = <strong className="text-white">{gev.scaleSigma.toFixed(3)}</strong></span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            {gev.returnLevels.map(rl => (
              <div key={rl.period} className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs">
                <span className="text-[10px] text-slate-400 block">{rl.period}-Period Level</span>
                <span className="text-sm font-bold text-rose-300">{rl.level.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 7. TREND ANALYSIS */}
      {config.type === 'trend' && trend && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                <h4 className="text-xs font-bold text-white">
                  Seasonal Mann-Kendall Trend ({config.trendMethod})
                </h4>
              </div>
              <span className={`px-2.5 py-1 rounded text-xs font-bold font-mono ${
                trend.pValue < config.alpha
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-400'
              }`}>
                {trend.pValue < config.alpha ? 'Monotonic Trend Verified' : 'No Monotonic Trend'}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Kendall S</span>
                <span className="text-base font-bold text-white">{trend.s}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Z-Score</span>
                <span className="text-base font-bold text-cyan-400">{trend.z.toFixed(3)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">p-Value</span>
                <span className="text-base font-bold text-emerald-400">{trend.pValue.toFixed(4)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Theil-Sen Slope / step</span>
                <span className="text-base font-bold text-amber-400">{trend.slope.toFixed(4)}</span>
              </div>
            </div>

            {(trend.acceleration !== undefined || entropy) && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono pt-2 border-t border-slate-800">
                {trend.acceleration !== undefined && (
                  <div className="p-3 bg-slate-900/80 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">Trend Acceleration (Δ slope)</span>
                    <span className="text-sm font-bold text-cyan-300">
                      {trend.acceleration > 0 ? '+' : ''}{trend.acceleration.toFixed(4)}
                    </span>
                    {trend.reversalPoint !== undefined && (
                      <span className="text-[10px] text-amber-300 block mt-0.5">
                        Sign Reversal @ index {trend.reversalPoint}
                      </span>
                    )}
                  </div>
                )}
                {entropy && (
                  <>
                    <div className="p-3 bg-slate-900/80 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Shannon Entropy</span>
                      <span className="text-sm font-bold text-purple-300">{entropy.shannon.toFixed(3)} bits</span>
                    </div>
                    <div className="p-3 bg-slate-900/80 rounded-xl">
                      <span className="text-[10px] text-slate-500 block">Sample Entropy</span>
                      <span className="text-sm font-bold text-emerald-300">{entropy.sample.toFixed(3)}</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. CHANGE-POINT (Pettitt + CUSUM comparison) */}
      {config.type === 'changepoint' && (changePoint || cusumChangePoint) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[changePoint, cusumChangePoint]
            .filter((cp): cp is NonNullable<typeof cp> => Boolean(cp))
            .map(cp => (
              <div key={cp.method} className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-white">
                    {cp.method} Non-Parametric Change-Point
                  </h4>
                  <span className="px-2.5 py-1 rounded text-xs font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    {cp.significanceLevel} (p = {cp.pValue.toFixed(4)})
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">Change Index</span>
                    <span className="text-base font-bold text-cyan-400">{cp.changePointIndex}</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">Mean Before</span>
                    <span className="text-base font-bold text-white">{cp.meanBefore.toFixed(2)}</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">Mean After</span>
                    <span className="text-base font-bold text-white">{cp.meanAfter.toFixed(2)}</span>
                  </div>
                  <div className="p-3 bg-slate-900 rounded-xl">
                    <span className="text-[10px] text-slate-500 block">Abrupt Shift (Δ)</span>
                    <span className="text-base font-bold text-amber-400">
                      {cp.shift > 0 ? '+' : ''}{cp.shift.toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* 9. MULTIPLE-TESTING CORRECTION (FDR) */}
      {config.type === 'fdr' && fdr && (
        <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold text-white">
                Multiple-Testing Trend Corrections ({fdr.items.length} Series, α = {config.alpha})
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Adjusts Seasonal Mann-Kendall p-values across variables to control False Discovery Rate (BH) and Family-Wise Error Rate.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-[11px] font-mono">
              <span className="px-2 py-1 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                BH FDR: {fdr.bh.significantCount}/{fdr.items.length} sig
              </span>
              <span className="px-2 py-1 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                Holm: {fdr.holm.significantCount}/{fdr.items.length} sig
              </span>
              <span className="px-2 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
                Bonferroni: {fdr.bonferroni.significantCount}/{fdr.items.length} sig
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase text-slate-400">
                  <th className="py-2">Column</th>
                  <th className="py-2">Kendall τ</th>
                  <th className="py-2">Raw p</th>
                  <th className="py-2">BH FDR (q)</th>
                  <th className="py-2">Holm p</th>
                  <th className="py-2">Bonferroni p</th>
                  <th className="py-2">FDR Decision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {fdr.items.map((item, idx) => (
                  <tr key={item.name}>
                    <td className="py-2 font-bold text-white">{item.name}</td>
                    <td className="py-2">{item.tau.toFixed(3)}</td>
                    <td className="py-2">{item.rawP.toFixed(4)}</td>
                    <td className="py-2 text-emerald-300">{fdr.bh.adjusted[idx].toFixed(4)}</td>
                    <td className="py-2 text-cyan-300">{fdr.holm.adjusted[idx].toFixed(4)}</td>
                    <td className="py-2 text-amber-300">{fdr.bonferroni.adjusted[idx].toFixed(4)}</td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          fdr.bh.significant[idx]
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {fdr.bh.significant[idx] ? 'Significant' : 'Not Significant'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
