import React, { useState } from 'react';
import { GIBS_LAYERS, GIBSLayer, getGIBSTileTemplate } from '../../services/connectors/gibsConnector';
import { Layers, Eye, EyeOff, Calendar } from 'lucide-react';

interface GIBSOverlayProps {
  onSelectLayer?: (tileUrl: string | null, layerName?: string, opacity?: number, maxNativeZoom?: number) => void;
  onOpacityChange?: (opacity: number) => void;
}

export const GIBSOverlay: React.FC<GIBSOverlayProps> = ({ onSelectLayer, onOpacityChange }) => {
  const [selectedLayerId, setSelectedLayerId] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0]
  );
  const [opacity, setOpacity] = useState<number>(0.75);
  const [isEnabled, setIsEnabled] = useState<boolean>(false);

  const handleToggle = () => {
    const next = !isEnabled;
    setIsEnabled(next);
    if (!next) {
      onSelectLayer?.(null);
    } else if (selectedLayerId) {
      updateLayer(selectedLayerId, selectedDate);
    } else {
      // Default to first layer
      const first = GIBS_LAYERS[0].id;
      setSelectedLayerId(first);
      updateLayer(first, selectedDate);
    }
  };

  const updateLayer = (layerId: string, date: string, nextOpacity = opacity) => {
    const tileUrl = getGIBSTileTemplate(layerId, date);
    const layer = GIBS_LAYERS.find(l => l.id === layerId);
    onSelectLayer?.(tileUrl, layer?.name, nextOpacity, layer?.maxZoom);
  };

  const handleLayerChange = (layerId: string) => {
    setSelectedLayerId(layerId);
    if (isEnabled) {
      updateLayer(layerId, selectedDate);
    }
  };

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    if (isEnabled && selectedLayerId) {
      updateLayer(selectedLayerId, date);
    }
  };

  return (
    <div className="bg-[#071326]/90 backdrop-blur border border-[#3EC7F2]/20 rounded-xl p-3 text-xs space-y-2 max-w-xs shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1.5 font-bold text-white">
          <Layers className="w-4 h-4 text-[#3EC7F2]" />
          <span>NASA GIBS Satellite Tiles</span>
        </div>
        <button
          onClick={handleToggle}
          className={`p-1 rounded-md text-xs transition-colors ${
            isEnabled ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-400'
          }`}
          title={isEnabled ? 'Disable GIBS Overlay' : 'Enable GIBS Overlay'}
        >
          {isEnabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      {isEnabled && (
        <div className="space-y-2 pt-1">
          {/* Layer select */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider block mb-1">
              Select Satellite Product
            </label>
            <select
              value={selectedLayerId}
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

          {/* Date Picker */}
          <div>
            <label className="text-[10px] text-slate-400 uppercase tracking-wider flex items-center space-x-1 mb-1">
              <Calendar className="w-3 h-3 text-cyan-400" />
              <span>Observation Date</span>
            </label>
            <input
              type="date"
              value={selectedDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={e => handleDateChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400"
            />
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
        </div>
      )}
    </div>
  );
};
