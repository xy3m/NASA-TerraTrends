import React, { useMemo, useRef, useState } from 'react';
import {
  GIBS_LAYERS,
  GIBSLayer,
  clampDateForLayer,
  getGIBSTileTemplate,
  getLayerDateBounds,
  listCompositeDates,
} from '../../services/connectors/gibsConnector';
import { Layers, Eye, EyeOff, Calendar, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

export interface GIBSSelectionPayload {
  layer: GIBSLayer;
  date: string;
  tileUrl: string;
  opacity: number;
}

interface GIBSOverlayProps {
  onSelectLayer?: (selection: GIBSSelectionPayload | null) => void;
  onOpacityChange?: (opacity: number) => void;
  tileStatus?: 'idle' | 'loading' | 'ready' | 'error';
  failedTileCount?: number;
}

export const GIBSOverlay: React.FC<GIBSOverlayProps> = ({
  onSelectLayer,
  onOpacityChange,
  tileStatus = 'idle',
  failedTileCount = 0,
}) => {
  const defaultLayer = GIBS_LAYERS[0];
  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    () => getLayerDateBounds(defaultLayer).maxDate
  );
  const lastDatedRef = useRef<string>(getLayerDateBounds(defaultLayer).maxDate);
  const [followLatest, setFollowLatest] = useState<boolean>(true);
  const [opacity, setOpacity] = useState<number>(0.75);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  const activeLayer = GIBS_LAYERS.find(l => l.id === selectedLayerId) ?? defaultLayer;
  const dateBounds = getLayerDateBounds(activeLayer);
  const compositeOptions = useMemo(() => listCompositeDates(activeLayer), [activeLayer]);
  const isStaticLayer = activeLayer.cadence === 'static';
  const isCompositeSelect = activeLayer.cadence === '8day' || activeLayer.cadence === 'monthly';
  const isLatestComplete = !isStaticLayer && selectedDate === dateBounds.maxDate;

  const emitSelection = (layer: GIBSLayer, date: string, nextOpacity = opacity) => {
    const safeDate = clampDateForLayer(layer, date);
    const tileUrl = getGIBSTileTemplate(layer.id, safeDate);
    onSelectLayer?.({ layer, date: safeDate, tileUrl, opacity: nextOpacity });
  };

  const resolveDateForLayer = (layer: GIBSLayer, useLatestMode: boolean): string => {
    const bounds = getLayerDateBounds(layer);
    if (layer.cadence === 'static') return '';
    if (useLatestMode) return bounds.maxDate;
    const seedDate = selectedDate || lastDatedRef.current;
    return clampDateForLayer(layer, seedDate);
  };

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    if (!next) {
      onSelectLayer?.(null);
      return;
    }

    const targetLayer = selectedLayerId
      ? (GIBS_LAYERS.find(l => l.id === selectedLayerId) ?? defaultLayer)
      : defaultLayer;
    const nextDate = resolveDateForLayer(targetLayer, followLatest);
    if (nextDate) lastDatedRef.current = nextDate;
    setSelectedLayerId(targetLayer.id);
    setSelectedDate(nextDate);
    emitSelection(targetLayer, nextDate, opacity);
  };

  const handleLayerChange = (layerId: string) => {
    const nextLayer = GIBS_LAYERS.find(l => l.id === layerId) ?? defaultLayer;
    const nextDate = resolveDateForLayer(nextLayer, followLatest);
    if (nextDate) lastDatedRef.current = nextDate;
    setSelectedLayerId(nextLayer.id);
    setSelectedDate(nextDate);
    if (isEnabled) {
      emitSelection(nextLayer, nextDate, opacity);
    }
  };

  const handleDateChange = (rawDate: string) => {
    if (!rawDate) return;
    const clampedDate = clampDateForLayer(activeLayer, rawDate);
    if (clampedDate) lastDatedRef.current = clampedDate;
    setFollowLatest(clampedDate === dateBounds.maxDate);
    setSelectedDate(clampedDate);
    if (isEnabled) {
      emitSelection(activeLayer, clampedDate, opacity);
    }
  };

  const handleSnapToLatest = () => {
    if (isStaticLayer) return;
    const latest = dateBounds.maxDate;
    lastDatedRef.current = latest;
    setFollowLatest(true);
    setSelectedDate(latest);
    if (isEnabled) {
      emitSelection(activeLayer, latest, opacity);
    }
  };

  return (
    <div
      className={`bg-[#071326]/90 backdrop-blur border border-[#3EC7F2]/20 hover:border-[#3EC7F2]/40 rounded-xl text-xs shadow-xl transition-colors ${
        isEnabled ? 'p-3 space-y-2 w-64 sm:w-72 max-w-[calc(100vw-1.5rem)]' : 'p-2'
      }`}
    >
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer"
        title={isEnabled ? 'Disable GIBS Overlay' : 'Enable GIBS Overlay'}
      >
        <div className="flex items-center space-x-1.5 font-bold text-white">
          <Layers className="w-4 h-4 text-[#3EC7F2] shrink-0" />
          <span className="hidden sm:inline">NASA GIBS Satellite Tiles</span>
          <span className="sm:hidden">GIBS Tiles</span>
        </div>
        <span
          className={`p-1 rounded-md text-xs transition-colors shrink-0 ${
            isEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
          }`}
        >
          {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </span>
      </button>

      {isEnabled && (
        <div className="space-y-2 pt-1">
          {/* Layer select */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider">
                Select Satellite Product
              </label>
              <span className="text-[10px] font-mono text-cyan-300/80">
                {activeLayer.resolutionLabel}
              </span>
            </div>
            <select
              aria-label="Satellite Product"
              value={activeLayer.id}
              title={activeLayer.description}
              onChange={e => handleLayerChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
            >
              {GIBS_LAYERS.map((layer: GIBSLayer) => (
                <option key={layer.id} value={layer.id}>
                  {layer.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date / Composite Period Control */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center space-x-1">
                <Calendar className="w-3 h-3 text-cyan-400" />
                <span>
                  {activeLayer.cadence === '8day'
                    ? 'Composite Window (8-Day)'
                    : activeLayer.cadence === 'monthly'
                    ? 'Analysis Month'
                    : isStaticLayer
                    ? 'Global Composite'
                    : 'Observation Date'}
                </span>
              </label>
              {!isStaticLayer && (
                <button
                  type="button"
                  onClick={handleSnapToLatest}
                  className={`text-[10px] font-mono px-1.5 py-0.5 rounded border transition-colors ${
                    isLatestComplete
                      ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                  }`}
                  title={`Jump to latest settled product date (${dateBounds.maxDate})`}
                >
                  {isLatestComplete ? 'Latest Complete' : 'Use Latest'}
                </button>
              )}
            </div>

            {isStaticLayer ? (
              <div className="w-full bg-slate-900/70 border border-slate-700/70 rounded-lg px-2 py-1.5 text-slate-300 text-[11px] font-mono">
                Cloud-Free Seasonal Mosaic
              </div>
            ) : isCompositeSelect ? (
              <select
                aria-label="Composite Period"
                value={selectedDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400"
              >
                {compositeOptions.map(opt => (
                  <option key={opt.date} value={opt.date}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="date"
                value={selectedDate}
                min={dateBounds.minDate}
                max={dateBounds.maxDate}
                onChange={e => handleDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400"
              />
            )}

            {activeLayer.rollingWindowDays && (
              <p className="text-[10px] text-slate-400 mt-1">
                Rolling window: {dateBounds.minDate} to {dateBounds.maxDate}
              </p>
            )}
          </div>

          {/* Opacity slider */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-0.5">
              <span>Opacity</span>
              <span className="font-mono">{Math.round(opacity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={opacity}
              onChange={e => {
                const nextOpacity = parseFloat(e.target.value);
                setOpacity(nextOpacity);
                onOpacityChange?.(nextOpacity);
              }}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Tile Stream Status */}
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
            {tileStatus === 'loading' && (
              <span className="flex items-center gap-1 text-cyan-300">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Streaming NASA tiles...</span>
              </span>
            )}
            {tileStatus === 'ready' && (
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                <span>Synced ({isStaticLayer ? 'Cloud-Free Mosaic' : selectedDate})</span>
              </span>
            )}
            {tileStatus === 'error' && (
              <span className="flex items-center gap-1 text-amber-300">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                <span>
                  {failedTileCount > 0 ? `${failedTileCount} tile gap(s) — try adjacent date` : 'Tile gap — try adjacent date'}
                </span>
              </span>
            )}
            {tileStatus === 'idle' && (
              <span className="text-slate-400 truncate">{activeLayer.name}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
