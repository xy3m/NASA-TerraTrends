import React from 'react';
import { PROVENANCE_META, TrendAnalysisResult } from '../types/earthScience';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Percent, 
  Activity, 
  Binary
} from 'lucide-react';
import { SignificanceBadge } from './SignificanceBadge';

interface StatsSummaryCardProps {
  stats: TrendAnalysisResult;
}

export const StatsSummaryCard: React.FC<StatsSummaryCardProps> = ({ stats }) => {
  const getDirectionIcon = () => {
    if (stats.direction === 'Increasing') {
      return <TrendingUp className="w-5 h-5 text-rose-400" />;
    }
    if (stats.direction === 'Decreasing') {
      return <TrendingDown className="w-5 h-5 text-blue-400" />;
    }
    return <Minus className="w-5 h-5 text-slate-400" />;
  };

  const getDirectionColor = () => {
    if (stats.direction === 'Increasing') return 'text-rose-400';
    if (stats.direction === 'Decreasing') return 'text-blue-400';
    return 'text-slate-400';
  };

  return (
    <div className="space-y-4">
      {/* 4-Column Grid: Core Trend Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        
        {/* Metric 1: Rate of Change per Decade */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Rate of Change
            </span>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800">
              {getDirectionIcon()}
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className={`text-2xl sm:text-3xl font-black font-mono tracking-tight ${getDirectionColor()}`}>
                {stats.slopePerDecade > 0 ? '+' : ''}{stats.slopePerDecade.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {stats.unit}/decade
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono mt-0.5">
              Annual: {stats.slopePerYear > 0 ? '+' : ''}{stats.slopePerYear.toFixed(3)} {stats.unit}/yr
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Theil-Sen Slope:</span>
            <span className="font-mono text-cyan-300 font-semibold">
              {stats.sensSlopePerDecade > 0 ? '+' : ''}{stats.sensSlopePerDecade.toFixed(2)} {stats.unit}/dec
            </span>
          </div>
        </div>

        {/* Metric 2: Cumulative Planetary Change */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cumulative Shift
            </span>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-cyan-400">
              <Percent className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight">
                {stats.totalChange > 0 ? '+' : ''}{stats.totalChange.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {stats.unit}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center space-x-1 font-mono">
              <span>Total departure:</span>
              <strong className={stats.percentChange >= 0 ? 'text-rose-400' : 'text-blue-400'}>
                {stats.percentChange >= 0 ? '+' : ''}{stats.percentChange.toFixed(1)}%
              </strong>
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Baseline Window:</span>
            <span className="font-mono text-slate-300">
              {stats.startDate} → {stats.endDate}
            </span>
          </div>
        </div>

        {/* Metric 3: Mann-Kendall Trend Test */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Mann-Kendall Test
            </span>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-blue-400">
              <Activity className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-xl sm:text-2xl font-black font-mono text-cyan-300 tracking-tight">
                Z = {stats.mkZ > 0 ? '+' : ''}{stats.mkZ.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              Kendall Tau τ = {stats.mkTau > 0 ? '+' : ''}{stats.mkTau.toFixed(3)}
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">p-value:</span>
            <span className="font-mono text-emerald-400 font-bold">
              {stats.mkPValue < 0.001 ? '< 0.001 (***)' : `= ${stats.mkPValue.toFixed(4)}`}
            </span>
          </div>
        </div>

        {/* Metric 4: Regression Model & Student's t */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Regression Fit & t-test
            </span>
            <div className="p-1.5 rounded-lg bg-slate-950 border border-slate-800 text-purple-400">
              <Binary className="w-4 h-4" />
            </div>
          </div>

          <div className="my-2">
            <div className="flex items-baseline space-x-1.5">
              <span className="text-2xl font-black font-mono text-indigo-300 tracking-tight">
                R² = {stats.rSquared.toFixed(3)}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
              t-stat = {stats.tStatistic.toFixed(2)} (p {stats.tPValue < 0.001 ? '< 0.001' : `= ${stats.tPValue.toFixed(3)}`})
            </p>
          </div>

          <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
            <span className="text-slate-400">Std Error:</span>
            <span className="font-mono text-slate-300">
              ±{stats.standardError.toFixed(2)} {stats.unit}
            </span>
          </div>
        </div>

      </div>

      {/* Significance Banner & Plain English Verdict */}
      <div className="bg-slate-900/95 rounded-2xl border border-slate-800 p-4 sm:p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Scientific Verdict
            </span>
            <SignificanceBadge stats={stats} />
            {stats.provenance && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-slate-700 bg-slate-950/90 ${PROVENANCE_META[stats.provenance].colorClass}`}
              >
                {PROVENANCE_META[stats.provenance].icon} {PROVENANCE_META[stats.provenance].label}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-medium">
            {stats.plainEnglishVerdict}
          </p>
          {stats.statusMessage && (
            <p className="text-[11px] font-mono text-slate-400">
              Source{stats.provenanceSource ? ` (${stats.provenanceSource})` : ''}: {stats.statusMessage}
            </p>
          )}
        </div>

        <div className="w-full md:w-auto p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs shrink-0 space-y-1">
          <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block">
            Sampling Integrity
          </span>
          <div className="flex items-center justify-between md:justify-start space-x-3 text-slate-300 font-mono">
            <span>N = <strong>{stats.sampleCount}</strong> valid</span>
            {(stats.missingCount ?? 0) > 0 && (
              <>
                <span>•</span>
                <span className="text-amber-300">{stats.missingCount} missing</span>
              </>
            )}
            <span>•</span>
            <span>Monthly resolution</span>
          </div>
        </div>
      </div>
    </div>
  );
};
