import React, { useState } from 'react';
import { DataColumn } from './DataIngestion';
import { Play, Sliders, BarChart3, GitFork, TrendingUp, Layers, CheckCircle } from 'lucide-react';

export type AnalysisCategory =
  | 'descriptive'
  | 'correlation'
  | 'ttest'
  | 'anova'
  | 'regression'
  | 'pca'
  | 'trend'
  | 'changepoint'
  | 'fdr';

export interface AnalysisConfig {
  type: AnalysisCategory;
  primaryCol: string;
  secondaryCols: string[];
  alpha: number;
  bootstrapIter: number;
  bootstrapStat: 'mean' | 'median';
  seasonLength: number;
  regressionMethod: 'ols' | 'robust';
  trendMethod: 'standard' | 'hamed_rao' | 'tfpw';
}

interface AnalysisPanelProps {
  columns: DataColumn[];
  onRunAnalysis: (config: AnalysisConfig) => void;
  isRunning?: boolean;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({
  columns,
  onRunAnalysis,
  isRunning = false,
}) => {
  const numericCols = columns.filter(c => c.type === 'numeric' && c.values.length > 0);

  const [selectedType, setSelectedType] = useState<AnalysisCategory>('descriptive');
  const [primaryCol, setPrimaryCol] = useState<string>(numericCols[0]?.name || '');
  const [secondaryCols, setSecondaryCols] = useState<string[]>(
    numericCols.length > 1 ? [numericCols[1].name] : []
  );
  const [alpha, setAlpha] = useState<number>(0.05);
  const [bootstrapIter, setBootstrapIter] = useState<number>(2000);
  const [bootstrapStat, setBootstrapStat] = useState<'mean' | 'median'>('mean');
  const [seasonLength, setSeasonLength] = useState<number>(12);
  const [regressionMethod, setRegressionMethod] = useState<'ols' | 'robust'>('ols');
  const [trendMethod, setTrendMethod] = useState<'standard' | 'hamed_rao' | 'tfpw'>('standard');

  const analysisOptions: { id: AnalysisCategory; label: string; icon: React.ReactNode; desc: string }[] = [
    {
      id: 'descriptive',
      label: 'Descriptive Stats',
      icon: <BarChart3 className="w-4 h-4 text-cyan-400" />,
      desc: 'Mean, median, mode, IQR, skewness, kurtosis, distributions',
    },
    {
      id: 'correlation',
      label: 'Correlation Matrix',
      icon: <Sliders className="w-4 h-4 text-emerald-400" />,
      desc: 'Pearson r, Spearman rho, Kendall tau with exact p-values',
    },
    {
      id: 'ttest',
      label: 't-Test Comparison',
      icon: <GitFork className="w-4 h-4 text-indigo-400" />,
      desc: '1-sample vs baseline or 2-sample Welch / paired t-test',
    },
    {
      id: 'anova',
      label: 'One-Way ANOVA',
      icon: <Layers className="w-4 h-4 text-purple-400" />,
      desc: 'Variance comparison across multiple experimental groups',
    },
    {
      id: 'regression',
      label: 'Multiple Regression',
      icon: <TrendingUp className="w-4 h-4 text-amber-400" />,
      desc: 'Ordinary Least Squares & Huber Robust IRLS with VIF & DW',
    },
    {
      id: 'pca',
      label: 'PCA Dimension Reduction',
      icon: <Layers className="w-4 h-4 text-rose-400" />,
      desc: 'SVD-based Principal Component Analysis and loadings',
    },
    {
      id: 'trend',
      label: 'Trend & Seasonal MK',
      icon: <TrendingUp className="w-4 h-4 text-cyan-400" />,
      desc: 'Seasonal Mann-Kendall, Hamed-Rao correction & exact Sen slope',
    },
    {
      id: 'changepoint',
      label: 'Change-Point Detection',
      icon: <Sliders className="w-4 h-4 text-orange-400" />,
      desc: 'Pettitt non-parametric and CUSUM shift detection',
    },
    {
      id: 'fdr',
      label: 'Multiple-Testing (FDR)',
      icon: <CheckCircle className="w-4 h-4 text-teal-400" />,
      desc: 'Benjamini-Hochberg FDR, Holm & Bonferroni trend adjustments',
    },
  ];

  const handleToggleSecondary = (name: string) => {
    if (secondaryCols.includes(name)) {
      setSecondaryCols(secondaryCols.filter(c => c !== name));
    } else {
      setSecondaryCols([...secondaryCols, name]);
    }
  };

  const handleRun = () => {
    onRunAnalysis({
      type: selectedType,
      primaryCol,
      secondaryCols,
      alpha,
      bootstrapIter,
      bootstrapStat,
      seasonLength,
      regressionMethod,
      trendMethod,
    });
  };

  return (
    <div className="space-y-6 bg-[#071326] border border-slate-800 rounded-2xl p-5">
      {/* Analysis Type Picker */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
          1. Select Scientific Analysis Method
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {analysisOptions.map(opt => (
            <button
              key={opt.id}
              onClick={() => setSelectedType(opt.id)}
              className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                selectedType === opt.id
                  ? 'bg-slate-900 border-[#3EC7F2] shadow-md shadow-cyan-500/15'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
              }`}
            >
              <div className="flex items-center space-x-2">
                {opt.icon}
                <span className={`text-xs font-bold ${selectedType === opt.id ? 'text-white' : 'text-slate-300'}`}>
                  {opt.label}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 line-clamp-2">
                {opt.desc}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Column Pickers & Parameters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-800">
        {/* Primary Variable Picker */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            {selectedType === 'regression' ? 'Dependent Variable (Y)' : 'Primary Column (X)'}
          </label>
          <select
            value={primaryCol}
            onChange={e => setPrimaryCol(e.target.value)}
            className="w-full bg-[#030915] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-mono"
          >
            {numericCols.map(c => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.values.length} observations)
              </option>
            ))}
          </select>
        </div>

        {/* Secondary / Multi-column Picker */}
        {(selectedType === 'correlation' ||
          selectedType === 'ttest' ||
          selectedType === 'anova' ||
          selectedType === 'regression' ||
          selectedType === 'pca' ||
          selectedType === 'fdr') && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-300 block">
              {selectedType === 'regression'
                ? 'Independent Predictors (X1, X2...)'
                : selectedType === 'ttest'
                ? 'Comparison Group (Sample B)'
                : 'Additional Columns (select multiple)'}
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-[#030915] rounded-xl border border-slate-800">
              {numericCols
                .filter(c => c.name !== primaryCol)
                .map(c => {
                  const selected = secondaryCols.includes(c.name);
                  return (
                    <button
                      key={c.name}
                      onClick={() => handleToggleSecondary(c.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center space-x-1 ${
                        selected
                          ? 'bg-[#3EC7F2] text-[#030915] font-bold'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {selected && <CheckCircle className="w-3 h-3" />}
                      <span>{c.name}</span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Advanced Method Parameters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800 text-xs">
        {/* Alpha Level */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
            Significance Level (α)
          </label>
          <select
            value={alpha}
            onChange={e => setAlpha(parseFloat(e.target.value))}
            className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
          >
            <option value={0.01}>0.01 (99% Confidence)</option>
            <option value={0.05}>0.05 (95% Confidence)</option>
            <option value={0.10}>0.10 (90% Confidence)</option>
          </select>
        </div>

        {/* Descriptive / Bootstrap options */}
        {selectedType === 'descriptive' && (
          <>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Bootstrap Statistic
              </label>
              <select
                value={bootstrapStat}
                onChange={e => setBootstrapStat(e.target.value as 'mean' | 'median')}
                className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="mean">Mean (Bootstrap CI)</option>
                <option value="median">Median (Bootstrap CI)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Bootstrap Iterations (B)
              </label>
              <select
                value={bootstrapIter}
                onChange={e => setBootstrapIter(parseInt(e.target.value, 10))}
                className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
              >
                <option value={1000}>1,000 resamples</option>
                <option value={2000}>2,000 resamples</option>
                <option value={5000}>5,000 resamples</option>
              </select>
            </div>
          </>
        )}

        {/* Trend & FDR options */}
        {(selectedType === 'trend' || selectedType === 'fdr') && (
          <>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Autocorrelation Method
              </label>
              <select
                value={trendMethod}
                onChange={e => setTrendMethod(e.target.value as any)}
                className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
              >
                <option value="standard">Standard Seasonal MK</option>
                <option value="hamed_rao">Hamed-Rao Variance Mod</option>
                <option value="tfpw">Trend-Free Pre-Whitening</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
                Season Length
              </label>
              <input
                type="number"
                min={2}
                max={365}
                value={seasonLength}
                onChange={e => setSeasonLength(parseInt(e.target.value, 10) || 12)}
                className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 font-mono"
              />
            </div>
          </>
        )}

        {/* Regression options */}
        {selectedType === 'regression' && (
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
              Estimator
            </label>
            <select
              value={regressionMethod}
              onChange={e => setRegressionMethod(e.target.value as any)}
              className="w-full bg-[#030915] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200"
            >
              <option value="ols">Ordinary Least Squares</option>
              <option value="robust">Huber Robust IRLS</option>
            </select>
          </div>
        )}
      </div>

      {/* Submit Button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={handleRun}
          disabled={isRunning || !primaryCol}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#3EC7F2] to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 disabled:opacity-40 text-[#030915] font-extrabold text-xs flex items-center space-x-2 transition-all shadow-lg shadow-cyan-500/20"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>{isRunning ? 'Computing Statistics...' : 'Execute Statistical Analysis'}</span>
        </button>
      </div>
    </div>
  );
};
