import React from 'react';
import { EarthVariable, HotspotRegion, TrendAnalysisResult } from '../types/earthScience';
import { 
  Sparkles, 
  Satellite, 
  HelpCircle, 
  Globe2, 
  ArrowUpRight, 
  AlertCircle 
} from 'lucide-react';

interface PlainEnglishSummaryProps {
  stats: TrendAnalysisResult;
  variable: EarthVariable;
  region: HotspotRegion;
}

export const PlainEnglishSummary: React.FC<PlainEnglishSummaryProps> = ({
  stats,
  variable,
  region,
}) => {
  return (
    <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-5">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-blue-950 text-cyan-400 border border-blue-800">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Data Detective Analysis & Real-World Impact</h3>
            <p className="text-xs text-slate-400">Connecting satellite math to physical planetary processes</p>
          </div>
        </div>

        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-950 text-cyan-300 border border-slate-800">
          Target: {region.name}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Card 1: What is the Physical Driver? */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-cyan-300 uppercase tracking-wider">
            <Globe2 className="w-4 h-4 text-cyan-400" />
            <span>Underlying Process</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {stats.scientificImplication}
          </p>
          <div className="pt-2 text-[11px] text-slate-500">
            <strong>Key Driver:</strong> {region.keyPhenomenon}
          </div>
        </div>

        {/* Card 2: Mission & Measurement Attribution */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
            <Satellite className="w-4 h-4 text-blue-400" />
            <span>Observing Missions</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Observed via <strong>{variable.missions.join(', ')}</strong> utilizing {variable.measurementType.toLowerCase()} techniques.
          </p>
          <div className="pt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded-lg border border-slate-800">
            <strong>Sensor Specs:</strong> {variable.description}
          </div>
        </div>

        {/* Card 3: Why Does Significance Matter? */}
        <div className="bg-slate-950/80 rounded-xl border border-slate-800/80 p-4 space-y-2">
          <div className="flex items-center space-x-2 text-xs font-bold text-amber-300 uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>Why "Significance" Matters</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            {stats.significanceLevel === 'Extremely Significant' || stats.significanceLevel === 'Highly Significant' || stats.significanceLevel === 'Significant' ? (
              <>
                Because <strong>p &lt; 0.05</strong>, scientists can conclusively state that this change is not random chance or an artifact of weather cycles. It represents sustained directional forcing on the Earth system.
              </>
            ) : (
              <>
                Because <strong>p ≥ 0.05</strong>, the trend cannot yet be separated with high statistical confidence from natural climate variability (like ENSO or volcanic spikes). A longer time-series baseline is required.
              </>
            )}
          </p>
          <div className="pt-2 text-[11px] text-slate-500">
            Confidence: <strong>{stats.significanceLevel} ({stats.significanceStars})</strong>
          </div>
        </div>

      </div>

      {/* Opposite Region Teaser (If available) */}
      {region.oppositeExplanation && (
        <div className="p-3.5 bg-indigo-950/40 rounded-xl border border-indigo-800/60 flex items-start space-x-3 text-xs text-indigo-200">
          <ArrowUpRight className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-white block mb-0.5">The Opposite Region Paradox:</span>
            <p className="leading-relaxed">
              {region.oppositeExplanation} Check out the <strong>Opposite Trends Lab</strong> tab in the navigation bar to compare them side-by-side!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
