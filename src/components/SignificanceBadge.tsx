import React, { useState } from 'react';
import { TrendAnalysisResult } from '../types/earthScience';
import { CheckCircle2, AlertTriangle, HelpCircle, X, ShieldCheck } from 'lucide-react';

interface SignificanceBadgeProps {
  stats: TrendAnalysisResult;
}

export const SignificanceBadge: React.FC<SignificanceBadgeProps> = ({ stats }) => {
  const [showExplainer, setShowExplainer] = useState<boolean>(false);

  const getBadgeStyle = () => {
    switch (stats.significanceLevel) {
      case 'Extremely Significant':
        return 'bg-emerald-950/80 border-emerald-500/80 text-emerald-300 ring-emerald-500/30';
      case 'Highly Significant':
        return 'bg-cyan-950/80 border-cyan-500/80 text-cyan-300 ring-cyan-500/30';
      case 'Significant':
        return 'bg-blue-950/80 border-blue-500/80 text-blue-300 ring-blue-500/30';
      case 'Marginally Significant':
        return 'bg-amber-950/80 border-amber-500/80 text-amber-300 ring-amber-500/30';
      default:
        return 'bg-slate-900/80 border-slate-700 text-slate-300 ring-slate-500/20';
    }
  };

  const getStatusIcon = () => {
    if (stats.significanceLevel === 'Not Significant') {
      return <AlertTriangle className="w-4 h-4 text-slate-400" />;
    }
    return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div
          onClick={() => setShowExplainer(true)}
          className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border ring-1 cursor-pointer hover:brightness-110 transition-all ${getBadgeStyle()}`}
          title="Click to learn how Earth scientists calculate statistical significance"
        >
          {getStatusIcon()}
          <span className="font-mono font-black text-sm tracking-widest">{stats.significanceStars}</span>
          <span className="text-xs font-bold tracking-wide uppercase">{stats.significanceLevel}</span>
          <span className="text-xs font-mono opacity-80 border-l border-white/20 pl-2">
            p {stats.mkPValue < 0.001 ? '< 0.001' : `= ${stats.mkPValue.toFixed(3)}`}
          </span>
          <HelpCircle className="w-3.5 h-3.5 opacity-60 hover:opacity-100 ml-1" />
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-2.5 py-1.5 rounded-lg border border-slate-800">
          <span>MK Z: <strong className="text-slate-200">{stats.mkZ > 0 ? '+' : ''}{stats.mkZ}</strong></span>
          <span>•</span>
          <span>Tau τ: <strong className="text-slate-200">{stats.mkTau > 0 ? '+' : ''}{stats.mkTau}</strong></span>
        </div>
      </div>

      {/* Explainer Modal */}
      {showExplainer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 text-slate-200">
            {/* Close button */}
            <button
              onClick={() => setShowExplainer(false)}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-blue-950 text-cyan-400 border border-blue-800">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Statistical Significance in Earth Science</h3>
                <p className="text-xs text-slate-400">How scientists know if changes are real or just random weather</p>
              </div>
            </div>

            {/* Modal Body */}
            <div className="space-y-3.5 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-white block mb-1">1. The Null Hypothesis (H₀)</span>
                <p>
                  Scientists always begin by assuming: <em>"There is NO real climate trend; any rise or fall is merely accidental weather noise."</em>
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-white block mb-1">2. The p-Value (Probability of False Alarm)</span>
                <p>
                  The p-value measures: <em>"What is the probability of seeing this pattern purely by coincidence?"</em>
                  <br />
                  • <strong>p &lt; 0.05 (*)</strong>: Standard scientific threshold (less than 5% probability of coincidence).
                  <br />
                  • <strong>p &lt; 0.01 (**)</strong>: High confidence (less than 1% chance).
                  <br />
                  • <strong>p &lt; 0.001 (***)</strong>: Extreme certainty (less than 0.1% chance).
                </p>
              </div>

              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="font-bold text-white block mb-1">3. Why the Mann-Kendall Test?</span>
                <p>
                  Standard linear regression can be easily skewed by a single freak storm, heatwave, or volcanic eruption. The <strong>Mann-Kendall Test</strong> is non-parametric: it only checks whether consecutive observations consistently rank higher or lower, making it robust against extreme weather outliers and non-normal climate distributions.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={() => setShowExplainer(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-xl transition-colors shadow-md"
              >
                Got it, Detective!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
