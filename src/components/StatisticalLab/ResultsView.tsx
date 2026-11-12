import React from 'react';
import { AnalysisConfig } from './AnalysisPanel';
import {
  DescriptiveStats,
  CorrelationResult,
  RegressionResult,
  PCAResult,
  ChangePointResult,
  SeasonalMKResult,
} from '../../types/earthScience';
import { TTestResult, AnovaResult } from '../../services/statistics/inferential';
import { HistogramChart } from '../charts/HistogramChart';
import { BoxPlotChart } from '../charts/BoxPlotChart';
import { HeatmapChart } from '../charts/HeatmapChart';
import { DiagnosticPlots } from '../charts/DiagnosticPlots';
import { ScatterMatrix } from '../charts/ScatterMatrix';
import { Award, CheckCircle2, TrendingUp, Download } from 'lucide-react';

interface ResultsViewProps {
  config: AnalysisConfig;
  data: {
    primaryColName: string;
    primaryValues: number[];
    secondaryColsData: { name: string; values: number[] }[];
  };
  results: {
    descriptive?: DescriptiveStats;
    correlation?: CorrelationResult;
    correlationMatrix?: { matrix: number[][]; labels: string[] };
    ttest?: TTestResult;
    anova?: AnovaResult;
    regression?: RegressionResult;
    pca?: PCAResult;
    trend?: SeasonalMKResult & { slope: number; acceleration?: number };
    changePoint?: ChangePointResult;
  };
}

export const ResultsView: React.FC<ResultsViewProps> = ({
  config,
  data,
  results,
}) => {
  const { descriptive, correlation, correlationMatrix, ttest, anova, regression, pca, trend, changePoint } = results;

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
      {/* Header with Export */}
      <div className="flex items-center justify-between bg-[#071326] border border-slate-800 rounded-xl p-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/20">
            {config.type.toUpperCase()} ANALYSIS
          </span>
          <h3 className="text-base font-bold text-white mt-1">
            Statistical Results for {data.primaryColName}
          </h3>
        </div>
        <button
          onClick={exportJSON}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 transition-colors"
        >
          <Download className="w-3.5 h-3.5 text-cyan-400" />
          <span>Export Results (JSON)</span>
        </button>
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

      {/* 6. PCA */}
      {config.type === 'pca' && pca && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <h4 className="text-xs font-bold text-white">Principal Components & Explained Variance</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {pca.componentLabels.map((label, idx) => (
                <div key={idx} className="bg-slate-900 border border-slate-800 rounded-xl p-3 font-mono text-xs">
                  <span className="text-cyan-400 font-bold">{label}</span>
                  <div className="text-lg font-bold text-white mt-1">
                    {pca.explainedVariance[idx]?.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Cumulative: {pca.cumulativeVariance[idx]?.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
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
                <span className="text-[10px] text-slate-500 block">Theil-Sen Slope / yr</span>
                <span className="text-base font-bold text-amber-400">{trend.slope.toFixed(4)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 8. CHANGE-POINT */}
      {config.type === 'changepoint' && changePoint && (
        <div className="space-y-6">
          <div className="bg-[#071326] border border-slate-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white">
                {changePoint.method} Non-Parametric Change-Point
              </h4>
              <span className="px-2.5 py-1 rounded text-xs font-bold font-mono bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                {changePoint.significanceLevel}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Change Index / Step</span>
                <span className="text-base font-bold text-cyan-400">{changePoint.changePointIndex}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Mean Before</span>
                <span className="text-base font-bold text-white">{changePoint.meanBefore.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Mean After</span>
                <span className="text-base font-bold text-white">{changePoint.meanAfter.toFixed(2)}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl">
                <span className="text-[10px] text-slate-500 block">Abrupt Shift (Δ)</span>
                <span className="text-base font-bold text-amber-400">
                  {changePoint.shift > 0 ? '+' : ''}{changePoint.shift.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
