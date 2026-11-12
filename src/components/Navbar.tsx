import React from 'react';
import { 
  Globe2, 
  Search, 
  GitCompare, 
  BookOpen, 
  UploadCloud, 
  FileText, 
  Radio,
  FlaskConical,
  Cpu,
  Loader2
} from 'lucide-react';

export type AppMode = 'explorer' | 'detective' | 'contrast' | 'encyclopedia' | 'upload' | 'lab' | 'phase2';
export type DataFeedSource = 'live' | 'calibrated' | 'csv' | 'satellite' | 'reanalysis';

const DATA_FEED_META: Record<
  string,
  { shortLabel: string; label: string; colorClass: string; pulse: boolean; icon: string }
> = {
  live: {
    shortLabel: 'NASA POWER',
    label: 'NASA POWER Reanalysis',
    colorClass: 'text-cyan-400',
    pulse: true,
    icon: '🔄',
  },
  reanalysis: {
    shortLabel: 'REANALYSIS',
    label: 'NASA Model / Reanalysis',
    colorClass: 'text-cyan-400',
    pulse: true,
    icon: '🔄',
  },
  satellite: {
    shortLabel: 'SAT OBS',
    label: 'Satellite Observation (MODIS/NOAA/USGS)',
    colorClass: 'text-emerald-400',
    pulse: true,
    icon: '🛰️',
  },
  csv: {
    shortLabel: 'CUSTOM CSV',
    label: 'User Upload (CSV/JSON)',
    colorClass: 'text-amber-400',
    pulse: false,
    icon: '📤',
  },
  calibrated: {
    shortLabel: 'CALIBRATED',
    label: 'Calibrated Demo Model',
    colorClass: 'text-[#3EC7F2]',
    pulse: false,
    icon: '🧪',
  },
};

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenExport: () => void;
  dataFeedSource: DataFeedSource;
  selectedRegionName: string;
  isLoadingFeed?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  onOpenExport,
  dataFeedSource,
  selectedRegionName,
  isLoadingFeed = false,
}) => {
  const feedMeta = DATA_FEED_META[dataFeedSource];

  return (
    <header className="sticky top-0 z-50 bg-[#030915]/95 backdrop-blur-md border-b border-[#3EC7F2]/15 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & GEOIRIS Logo */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectMode('explorer')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-[#030915] border border-[#3EC7F2]/40 shadow-lg shadow-[#3EC7F2]/15 ring-1 ring-white/10">
              <Globe2 className="w-6 h-6 text-[#3EC7F2] animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-[#3EC7F2] ring-2 ring-[#030915]"></div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-xl tracking-widest uppercase leading-none">
                  <span className="text-white">GEO</span><span className="text-[#3EC7F2]">IRIS</span>
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-[#071A2F] text-[#3EC7F2] rounded border border-[#3EC7F2]/30">
                  2026 Space Apps
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Earth Science Change Detective & Significance Engine
              </p>
            </div>
          </div>

          {/* Data Feed Status Pill (Mobile view) */}
          <div className="md:hidden flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-mono bg-[#071326] border border-slate-800">
            {isLoadingFeed ? (
              <>
                <Loader2 className="w-3 h-3 text-amber-400 animate-spin" />
                <span className="text-amber-300">FETCHING...</span>
              </>
            ) : (
              <>
                <Radio className={`w-3 h-3 ${feedMeta.colorClass} ${feedMeta.pulse ? 'animate-pulse' : ''}`} />
                <span className={feedMeta.colorClass}>
                  {feedMeta.shortLabel}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-[#071326]/90 p-1 rounded-xl border border-slate-800/80 shadow-inner overflow-x-auto max-w-full">
          <button
            onClick={() => onSelectMode('explorer')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'explorer'
                ? 'bg-[#3EC7F2] text-[#030915] font-bold shadow-md shadow-[#3EC7F2]/25'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Trend Explorer</span>
          </button>

          <button
            onClick={() => onSelectMode('detective')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'detective'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                : 'text-slate-400 hover:text-amber-300 hover:bg-slate-800/60'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Data Detective</span>
          </button>

          <button
            onClick={() => onSelectMode('contrast')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'contrast'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-indigo-300 hover:bg-slate-800/60'
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Opposite Trends Lab</span>
          </button>

          <button
            onClick={() => onSelectMode('encyclopedia')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'encyclopedia'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Encyclopedia</span>
          </button>

          <button
            onClick={() => onSelectMode('upload')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'upload'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-slate-800/60'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Custom Data</span>
          </button>

          <button
            onClick={() => onSelectMode('lab')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'lab'
                ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/30'
                : 'text-slate-400 hover:text-purple-300 hover:bg-slate-800/60'
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Statistical Lab</span>
          </button>

          <button
            onClick={() => onSelectMode('phase2')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'phase2'
                ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white font-bold shadow-md shadow-cyan-600/30'
                : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800/60'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Phase 2 Lab</span>
          </button>
        </nav>

        {/* Right Actions: Data Feed Status & Export */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            {isLoadingFeed ? (
              <>
                <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                <div>
                  <span className="text-slate-500 text-[10px] block leading-none">DATA FEED</span>
                  <span className="font-semibold text-amber-300">
                    Fetching Live Data...
                  </span>
                </div>
              </>
            ) : (
              <>
                <Radio className={`w-3.5 h-3.5 ${feedMeta.colorClass} ${feedMeta.pulse ? 'animate-pulse' : ''}`} />
                <div>
                  <span className="text-slate-500 text-[10px] block leading-none">DATA FEED</span>
                  <span className={`font-semibold ${feedMeta.colorClass}`}>
                    {feedMeta.label}
                  </span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={onOpenExport}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shadow-sm"
            title={`Export dossier for ${selectedRegionName}`}
          >
            <FileText className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export Report</span>
          </button>
        </div>

      </div>
    </header>
  );
};
