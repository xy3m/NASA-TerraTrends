import React from 'react';
import { 
  Globe2, 
  Search, 
  GitCompare, 
  BookOpen, 
  UploadCloud, 
  FileText, 
  Radio
} from 'lucide-react';

export type AppMode = 'explorer' | 'detective' | 'contrast' | 'encyclopedia' | 'upload';

interface NavbarProps {
  currentMode: AppMode;
  onSelectMode: (mode: AppMode) => void;
  onOpenExport: () => void;
  isLiveNasa: boolean;
  selectedRegionName: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentMode,
  onSelectMode,
  onOpenExport,
  isLiveNasa,
  selectedRegionName,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-all">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Brand & NASA Logo */}
        <div className="flex items-center space-x-3 w-full md:w-auto justify-between md:justify-start">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => onSelectMode('explorer')}>
            <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 via-indigo-700 to-cyan-500 shadow-lg shadow-blue-500/20 ring-1 ring-blue-400/40">
              <Globe2 className="w-6 h-6 text-white animate-pulse" />
              <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-cyan-400 ring-2 ring-slate-950"></div>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-white">
                  NASA TerraTrends
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-widest uppercase bg-blue-900/60 text-cyan-300 rounded border border-blue-600/40">
                  2026 Space Apps
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Earth Science Change Detective & Significance Engine
              </p>
            </div>
          </div>

          {/* NASA API Status Pill (Mobile view) */}
          <div className="md:hidden flex items-center space-x-1.5 px-2 py-1 rounded-full text-xs font-mono bg-slate-900 border border-slate-800">
            <Radio className={`w-3 h-3 ${isLiveNasa ? 'text-emerald-400 animate-pulse' : 'text-blue-400'}`} />
            <span className={isLiveNasa ? 'text-emerald-400' : 'text-slate-400'}>
              {isLiveNasa ? 'LIVE NASA' : 'CALIBRATED'}
            </span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800/80 shadow-inner overflow-x-auto max-w-full">
          <button
            onClick={() => onSelectMode('explorer')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
              currentMode === 'explorer'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
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
        </nav>

        {/* Right Actions: API Status & Export */}
        <div className="hidden md:flex items-center space-x-3">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono">
            <Radio className={`w-3.5 h-3.5 ${isLiveNasa ? 'text-emerald-400 animate-pulse' : 'text-cyan-400'}`} />
            <div>
              <span className="text-slate-500 text-[10px] block leading-none">DATA FEED</span>
              <span className={`font-semibold ${isLiveNasa ? 'text-emerald-400' : 'text-cyan-400'}`}>
                {isLiveNasa ? 'NASA POWER API (Live)' : 'NASA Merged Climatology'}
              </span>
            </div>
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
