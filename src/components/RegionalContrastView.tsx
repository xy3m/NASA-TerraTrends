import React, { useState } from 'react';
import { REGIONAL_CONTRASTS } from '../services/regionalContrasts';
import { HOTSPOT_REGIONS, EARTH_VARIABLES, generateCuratedTimeSeries } from '../services/nasaData';
import { analyzeTrend } from '../services/statistics';
import { TimeSeriesChart } from './TimeSeriesChart';
import { SignificanceBadge } from './SignificanceBadge';
import { 
  GitCompare, 
  ArrowRight, 
  Sparkles, 
  TrendingUp, 
  TrendingDown, 
  Globe2, 
  Layers, 
  ArrowLeftRight 
} from 'lucide-react';

export const RegionalContrastView: React.FC = () => {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const scenario = REGIONAL_CONTRASTS[selectedScenarioIndex];

  // Also support custom pairing comparison
  const [customRegionAId, setCustomRegionAId] = useState<string>(scenario.regionA.hotspotId);
  const [customRegionBId, setCustomRegionBId] = useState<string>(scenario.regionB.hotspotId);
  const [customVariableId, setCustomVariableId] = useState<string>(scenario.variableId);

  // Sync custom pickers when preset scenario changes
  const handleSelectScenario = (index: number) => {
    setSelectedScenarioIndex(index);
    setCustomRegionAId(REGIONAL_CONTRASTS[index].regionA.hotspotId);
    setCustomRegionBId(REGIONAL_CONTRASTS[index].regionB.hotspotId);
    setCustomVariableId(REGIONAL_CONTRASTS[index].variableId);
  };

  const regionA = HOTSPOT_REGIONS.find(r => r.id === customRegionAId) || HOTSPOT_REGIONS[0];
  const regionB = HOTSPOT_REGIONS.find(r => r.id === customRegionBId) || HOTSPOT_REGIONS[1];
  const variable = EARTH_VARIABLES.find(v => v.id === customVariableId) || EARTH_VARIABLES[0];

  // Generate data and stats for Region A
  const pointsA = React.useMemo(() => {
    return generateCuratedTimeSeries(regionA, variable);
  }, [regionA, variable]);

  const statsA = React.useMemo(() => {
    return analyzeTrend(pointsA, variable.id, variable.name, variable.unit, regionA.name, regionA.coordinates, true);
  }, [pointsA, variable, regionA]);

  // Generate data and stats for Region B
  const pointsB = React.useMemo(() => {
    return generateCuratedTimeSeries(regionB, variable);
  }, [regionB, variable]);

  const statsB = React.useMemo(() => {
    return analyzeTrend(pointsB, variable.id, variable.name, variable.unit, regionB.name, regionB.coordinates, true);
  }, [pointsB, variable, regionB]);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 rounded-2xl border border-indigo-800/40 p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500 text-white uppercase tracking-widest flex items-center space-x-1">
              <GitCompare className="w-3 h-3" />
              <span>NASA Challenge Core Feature</span>
            </span>
            <span className="text-xs text-slate-400">• Opposite Regional Trends Engine</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            One Planetary Driver, Two Opposite Regional Trends
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
            "A measured Earth science data variable can trend one way in one region and the opposite way in another, even when the same process drives both."
          </p>
        </div>

        {/* Preset Scenario Selector Buttons */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">
            Curated NASA Case Scenarios:
          </span>
          <div className="flex flex-wrap gap-2">
            {REGIONAL_CONTRASTS.map((sc, idx) => (
              <button
                key={sc.id}
                onClick={() => handleSelectScenario(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  selectedScenarioIndex === idx
                    ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {sc.title.split(':')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Shared Driver Spotlight Card */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 sm:p-6 shadow-xl space-y-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800">
            <Globe2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold tracking-widest">
              COMMON PLANETARY PROCESS
            </span>
            <h3 className="text-lg font-bold text-white">{scenario.commonDriver}</h3>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-xl border border-slate-800/80">
          {scenario.description}
        </p>

        <div className="p-3 bg-indigo-950/40 rounded-xl border border-indigo-800/50 text-xs text-indigo-200">
          <strong>Scientific Takeaway:</strong> {scenario.scientificTakeaway}
        </div>
      </div>

      {/* Side-by-Side Comparison Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* REGION A COLUMN */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-bold">
                REGION A (TREND 1)
              </span>
              <h4 className="text-base font-bold text-white">{regionA.name}</h4>
              <p className="text-xs text-slate-400 font-mono">
                {regionA.coordinates[0].toFixed(2)}°, {regionA.coordinates[1].toFixed(2)}° • {regionA.countryOrOcean}
              </p>
            </div>
            <SignificanceBadge stats={statsA} />
          </div>

          {/* Rate Metric */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Observed Rate of Change
              </span>
              <span className={`text-xl font-mono font-black ${statsA.slopePerDecade > 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {statsA.slopePerDecade > 0 ? '+' : ''}{statsA.slopePerDecade.toFixed(2)} {variable.unit}/decade
              </span>
            </div>
            <div className="text-right text-xs font-mono text-slate-400">
              <span>Total: {statsA.totalChange > 0 ? '+' : ''}{statsA.totalChange.toFixed(1)} {variable.unit}</span>
              <span className="block text-[11px] text-slate-500">MK Z = {statsA.mkZ}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <strong>Local Mechanism:</strong> {scenario.regionA.mechanism}
          </p>

          <TimeSeriesChart
            points={pointsA}
            variable={variable}
            regionName={regionA.name}
            stats={statsA}
          />
        </div>

        {/* REGION B COLUMN */}
        <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-5 shadow-xl space-y-4">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <span className="text-[10px] font-mono text-amber-400 uppercase tracking-widest font-bold">
                REGION B (TREND 2)
              </span>
              <h4 className="text-base font-bold text-white">{regionB.name}</h4>
              <p className="text-xs text-slate-400 font-mono">
                {regionB.coordinates[0].toFixed(2)}°, {regionB.coordinates[1].toFixed(2)}° • {regionB.countryOrOcean}
              </p>
            </div>
            <SignificanceBadge stats={statsB} />
          </div>

          {/* Rate Metric */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 uppercase font-semibold block">
                Observed Rate of Change
              </span>
              <span className={`text-xl font-mono font-black ${statsB.slopePerDecade > 0 ? 'text-rose-400' : 'text-blue-400'}`}>
                {statsB.slopePerDecade > 0 ? '+' : ''}{statsB.slopePerDecade.toFixed(2)} {variable.unit}/decade
              </span>
            </div>
            <div className="text-right text-xs font-mono text-slate-400">
              <span>Total: {statsB.totalChange > 0 ? '+' : ''}{statsB.totalChange.toFixed(1)} {variable.unit}</span>
              <span className="block text-[11px] text-slate-500">MK Z = {statsB.mkZ}</span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-lg border border-slate-800/60">
            <strong>Local Mechanism:</strong> {scenario.regionB.mechanism}
          </p>

          <TimeSeriesChart
            points={pointsB}
            variable={variable}
            regionName={regionB.name}
            stats={statsB}
          />
        </div>

      </div>
    </div>
  );
};
