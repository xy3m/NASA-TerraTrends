import React from 'react';
import { DiagnosticResults } from '../../types/earthScience';
import { AlertCircle, CheckCircle, ShieldAlert, BarChart, Info } from 'lucide-react';

interface DiagnosticsPanelProps {
  diagnostics: DiagnosticResults;
  variableName: string;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  diagnostics,
  variableName,
}) => {
  const { normalityTest, outliers, missingnessProfile, autocorrelation, heteroskedasticity, vif } = diagnostics;

  return (
    <div className="space-y-6 bg-[#071326] border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <h3 className="text-sm font-bold text-white">
            Statistical Assumptions & Diagnostic Suite ({variableName})
          </h3>
        </div>
        <span className="text-xs text-slate-400 font-mono">
          Rigorous Scientific Validation
        </span>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* 1. Normality */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Normality
            </span>
            {normalityTest.isNormal ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {normalityTest.isNormal ? 'Gaussian Normal' : 'Non-Normal'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            p = {normalityTest.pValue.toFixed(4)} ({normalityTest.method})
          </div>
        </div>

        {/* 2. Outliers */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Outliers
            </span>
            {outliers.length === 0 ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {outliers.length} Outliers Detected
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Method: {outliers[0]?.method || '1.5x IQR Rule'}
          </div>
        </div>

        {/* 3. Autocorrelation */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Autocorrelation (DW)
            </span>
            <BarChart className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-white font-mono">
            DW: {autocorrelation.durbinWatson.toFixed(2)}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            Lag-1 r: {autocorrelation.lag1.toFixed(3)}
          </div>
        </div>

        {/* 4. Missing Data */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Data Completeness
            </span>
            {missingnessProfile.missing === 0 ? (
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-400" />
            )}
          </div>
          <div className="text-sm font-bold text-white font-mono">
            {missingnessProfile.missing === 0 ? '100% Complete' : `${missingnessProfile.percent.toFixed(1)}% Missing`}
          </div>
          <div className="text-[10px] text-slate-400 font-mono">
            {missingnessProfile.missing} missing of {missingnessProfile.total}
          </div>
        </div>
      </div>

      {/* Multicollinearity VIF Table if present */}
      {vif && vif.length > 0 && (
        <div className="space-y-2 bg-slate-900/60 border border-slate-800 rounded-xl p-4">
          <h4 className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Multicollinearity Analysis (Variance Inflation Factor - VIF)</span>
          </h4>
          <p className="text-[11px] text-slate-400">
            VIF &gt; 5 indicates moderate collinearity; VIF &gt; 10 signals severe multicollinearity requiring predictor removal.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
            {vif.map((item, idx) => (
              <div
                key={idx}
                className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 text-xs font-mono"
              >
                <div className="text-slate-400 truncate">{item.variable}</div>
                <div className={`text-sm font-bold ${
                  item.vif > 10 ? 'text-rose-400' : item.vif > 5 ? 'text-amber-400' : 'text-emerald-400'
                }`}>
                  VIF = {item.vif.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Heteroskedasticity if present */}
      {heteroskedasticity && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center justify-between text-xs">
          <div>
            <div className="font-semibold text-slate-200">
              Breusch-Pagan Heteroskedasticity Test
            </div>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Tests whether residual variance depends systematically on predictor magnitudes.
            </p>
          </div>
          <div className="text-right font-mono">
            <span className={`px-2 py-1 rounded text-xs font-bold ${
              heteroskedasticity.isHomoskedastic
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/30'
            }`}>
              {heteroskedasticity.isHomoskedastic ? 'Homoskedastic (Equal Variance)' : 'Heteroskedastic'}
            </span>
            <div className="text-[10px] text-slate-500 mt-1">
              p = {heteroskedasticity.bpPValue.toFixed(4)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
