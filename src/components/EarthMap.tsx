import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { HotspotRegion } from '../types/earthScience';
import { HOTSPOT_REGIONS } from '../services/nasaData';
import { MapPin, Navigation, Crosshair, Layers } from 'lucide-react';
import { GIBSOverlay } from './charts/GIBSOverlay';

interface EarthMapProps {
  selectedRegion: HotspotRegion;
  onSelectRegion: (region: HotspotRegion) => void;
  onSelectCustomCoordinates: (lat: number, lon: number) => void;
}

export const EarthMap: React.FC<EarthMapProps> = ({
  selectedRegion,
  onSelectRegion,
  onSelectCustomCoordinates,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const activePinRef = useRef<L.Marker | null>(null);
  
  const [mapTileLayer, setMapTileLayer] = useState<'dark' | 'satellite' | 'streets'>('dark');
  const [clickCoords, setClickCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isPinModeActive, setIsPinModeActive] = useState<boolean>(false);

  // Free, keyless basemap tile URLs
  const tileLayers = {
    dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    darkLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    streets: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  };

  const tileLayerRef = useRef<L.Layer | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const gibsOpacityRef = useRef<number>(0.75);

  const handleGIBSLayerSelect = (
    tileUrl: string | null,
    _layerName?: string,
    opacity?: number,
    maxNativeZoom?: number
  ) => {
    if (opacity !== undefined) {
      gibsOpacityRef.current = opacity;
    }
    if (gibsLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }
    if (tileUrl && mapInstanceRef.current) {
      gibsLayerRef.current = L.tileLayer(tileUrl, {
        maxNativeZoom: maxNativeZoom ?? 7,
        maxZoom: 16,
        zIndex: 10,
        opacity: gibsOpacityRef.current,
        noWrap: true,
        bounds: [[-85.05112878, -180], [85.05112878, 180]],
      });
      gibsLayerRef.current.addTo(mapInstanceRef.current);
    }
  };

  const handleGIBSOpacityChange = (nextOpacity: number) => {
    gibsOpacityRef.current = nextOpacity;
    gibsLayerRef.current?.setOpacity(nextOpacity);
  };

  const createBaseLayer = (layerKey: 'dark' | 'satellite' | 'streets'): L.Layer => {
    if (layerKey === 'dark') {
      return L.layerGroup([
        L.tileLayer(tileLayers.dark, { maxZoom: 18, zIndex: 1 }),
        L.tileLayer(tileLayers.darkLabels, { maxZoom: 18, zIndex: 2 }),
      ]);
    }
    return L.tileLayer(tileLayers[layerKey], { maxZoom: 18 });
  };

  const placeCustomPin = (map: L.Map, lat: number, lon: number) => {
    if (activePinRef.current) {
      activePinRef.current.setLatLng([lat, lon]);
      return;
    }
    const pinIcon = L.divIcon({
      className: 'custom-pin-icon',
      html: `<div class="relative flex items-center justify-center">
              <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-75"></span>
              <div class="relative w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md"></div>
            </div>`,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    activePinRef.current = L.marker([lat, lon], { icon: pinIcon }).addTo(map);
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const hasCoords = selectedRegion.hasCoordinates !== false;
    const isCustomPin =
      hasCoords &&
      (selectedRegion.id.startsWith('coord_') || selectedRegion.id.startsWith('csv_'));

    // Initialize Map at [0,0] if CSV has no coordinates, or centered on custom coordinates
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: !hasCoords ? [0, 0] : isCustomPin ? selectedRegion.coordinates : [20, 0],
        zoom: isCustomPin ? 5 : 2,
        minZoom: 2,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add base tile layer
      tileLayerRef.current = createBaseLayer('dark').addTo(map);

      // Handle Map Click for custom coordinates
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        // Normalize lon to -180 .. 180
        const normalizedLon = ((lng + 180) % 360 + 360) % 360 - 180;
        const roundedLat = +lat.toFixed(3);
        const roundedLon = +normalizedLon.toFixed(3);

        setClickCoords({ lat: roundedLat, lon: roundedLon });
        placeCustomPin(map, lat, normalizedLon);
        onSelectCustomCoordinates(roundedLat, roundedLon);
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Populate Hotspot Markers
    HOTSPOT_REGIONS.forEach(region => {
      if (markersRef.current[region.id]) return;

      const isSelected = selectedRegion.id === region.id;
      const getCategoryColor = (cat: string) => {
        switch (cat) {
          case 'Polar': return '#06B6D4'; // cyan
          case 'Tropical Rainforest': return '#10B981'; // emerald
          case 'Arid / Desert': return '#F59E0B'; // amber
          case 'Urban': return '#EC4899'; // pink
          case 'Marine': return '#3B82F6'; // blue
          case 'Agricultural': return '#84CC16'; // lime
          case 'High Altitude': return '#A855F7'; // purple
          default: return '#3B82F6';
        }
      };

      const markerColor = getCategoryColor(region.category);

      const customIcon = L.divIcon({
        className: 'hotspot-marker',
        html: `
          <div class="group relative flex items-center justify-center cursor-pointer">
            <div class="w-5 h-5 rounded-full border-2 border-white/90 shadow-lg flex items-center justify-center transition-transform transform group-hover:scale-125" style="background-color: ${markerColor}">
              <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
            </div>
            <div class="absolute bottom-6 hidden group-hover:flex flex-col items-center pointer-events-none z-50">
              <span class="px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-xl border border-slate-700 whitespace-nowrap font-medium">
                ${region.name}
              </span>
            </div>
          </div>
        `,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });

      const marker = L.marker(region.coordinates, { icon: customIcon }).addTo(map);

      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelectRegion(region);
      });

      markersRef.current[region.id] = marker;
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
      activePinRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Update map view and custom pin when selected region changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    const hasCoords = selectedRegion.hasCoordinates !== false;
    const isCustomPin =
      hasCoords &&
      (selectedRegion.id.startsWith('coord_') || selectedRegion.id.startsWith('csv_'));

    if (isCustomPin) {
      placeCustomPin(map, selectedRegion.coordinates[0], selectedRegion.coordinates[1]);
    } else if (activePinRef.current) {
      map.removeLayer(activePinRef.current);
      activePinRef.current = null;
    }

    if (!hasCoords) {
      map.setView([0, 0], 2);
      return;
    }

    // Center map smoothly on selected region
    map.flyTo(selectedRegion.coordinates, Math.max(map.getZoom(), isCustomPin ? 5 : 4), {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedRegion]);

  // Switch tile layer
  const handleTileChange = (layerKey: 'dark' | 'satellite' | 'streets') => {
    setMapTileLayer(layerKey);
    if (tileLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = createBaseLayer(layerKey).addTo(mapInstanceRef.current);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl group">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-72 sm:h-84 md:h-96 w-full z-0" />

      {/* Floating Map Controls & Overlays */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        {/* Layer Switcher */}
        <div className="flex items-center bg-[#030915]/90 backdrop-blur-md rounded-lg p-1 border border-slate-700/80 shadow-md text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          {(
            [
              { key: 'dark', label: 'Dark' },
              { key: 'satellite', label: 'Satellite' },
              { key: 'streets', label: 'Terrain' },
            ] as const
          ).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleTileChange(key)}
              className={`px-2 py-1 rounded font-medium transition-colors ${
                mapTileLayer === key
                  ? 'bg-[#3EC7F2] text-[#030915] font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Click-to-Pin Helper */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#030915]/85 backdrop-blur-md rounded-lg border border-slate-700/80 text-xs text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-[#3EC7F2] animate-spin-slow" />
          <span>Click any point on Earth to query NASA data</span>
        </div>
      </div>

      {/* GIBS Satellite Overlay Floating Controller (Top Right) */}
      <div className="absolute top-3 right-3 z-10 hidden sm:block">
        <GIBSOverlay onSelectLayer={handleGIBSLayerSelect} onOpacityChange={handleGIBSOpacityChange} />
      </div>

      {/* Selected Region Status Pill (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 max-w-sm">
        <div className="bg-[#030915]/90 backdrop-blur-md rounded-xl p-3 border border-slate-800 shadow-xl flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-[#071A2F] text-[#3EC7F2] border border-[#3EC7F2]/30 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white truncate">{selectedRegion.name}</h4>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-[#3EC7F2] rounded border border-slate-700 shrink-0">
                {selectedRegion.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-mono">
              {selectedRegion.hasCoordinates === false
                ? `No coordinates provided • ${selectedRegion.keyPhenomenon}`
                : `${selectedRegion.coordinates[0].toFixed(2)}°, ${selectedRegion.coordinates[1].toFixed(2)}° • ${selectedRegion.keyPhenomenon}`}
            </p>
          </div>
        </div>
      </div>

      {/* Reset Map View Button (Bottom Right next to zoom) */}
      <button
        onClick={() => mapInstanceRef.current?.setView([20, 0], 2)}
        className="absolute bottom-3 right-12 z-10 p-2 bg-[#030915]/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 shadow-md transition-colors"
        title="Reset World View"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
};
