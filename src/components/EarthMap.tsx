import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { HotspotRegion } from '../types/earthScience';
import { HOTSPOT_REGIONS } from '../services/nasaData';
import { GIBS_WMS_URL } from '../services/connectors/gibsConnector';
import { MapPin, Navigation, Crosshair, Layers } from 'lucide-react';
import { GIBSOverlay, GIBSSelectionPayload } from './charts/GIBSOverlay';

interface EarthMapProps {
  selectedRegion: HotspotRegion;
  onSelectRegion: (region: HotspotRegion) => void;
  onSelectCustomCoordinates: (lat: number, lon: number) => void;
}

const MAP_MAX_ZOOM = 12;

// ArcGIS public basemaps return 2521B "Map data not yet available" tiles beyond z=10 in oceans/Antarctica;
// World_Imagery serves real imagery through z=12 across all Geo-Iris hotspots and oceans.
const BASE_TILE_URLS = {
  dark: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
  darkLabels: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
  satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  streets: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
} as const;

const WORLD_MAX_BOUNDS: L.LatLngBoundsExpression = [
  [-85.05112878, -3600],
  [85.05112878, 3600],
];

function getCategoryColor(cat: string): string {
  switch (cat) {
    case 'Polar': return '#06B6D4';
    case 'Tropical Rainforest': return '#10B981';
    case 'Arid / Desert': return '#F59E0B';
    case 'Urban': return '#EC4899';
    case 'Marine': return '#3B82F6';
    case 'Agricultural': return '#84CC16';
    case 'High Altitude': return '#A855F7';
    default: return '#3B82F6';
  }
}

function normalizeLongitude(lng: number): number {
  const wrapped = ((lng + 180) % 360 + 360) % 360 - 180;
  return wrapped === -180 ? 180 : wrapped;
}

function buildHotspotIcon(region: HotspotRegion, isSelected: boolean): L.DivIcon {
  const markerColor = getCategoryColor(region.category);
  const ringClass = isSelected
    ? 'ring-2 ring-[#3EC7F2] ring-offset-2 ring-offset-[#030915] scale-125'
    : 'group-hover/marker:scale-125';

  return L.divIcon({
    className: 'hotspot-marker',
    html: `
      <div class="group/marker relative flex items-center justify-center cursor-pointer">
        <div class="w-5 h-5 rounded-full border-2 border-white/90 shadow-lg flex items-center justify-center transition-transform transform ${ringClass}" style="background-color: ${markerColor}">
          <div class="w-1.5 h-1.5 rounded-full bg-slate-950"></div>
        </div>
        <div class="absolute bottom-6 hidden group-hover/marker:flex flex-col items-center pointer-events-none z-50">
          <span class="px-2 py-1 bg-slate-900 text-white text-xs rounded-md shadow-xl border border-slate-700 whitespace-nowrap font-medium">
            ${region.name}
          </span>
        </div>
      </div>
    `,
    iconSize: [20, 20],
    iconAnchor: [10, 10],
  });
}

function createBaseLayer(layerKey: 'dark' | 'satellite' | 'streets'): L.Layer {
  if (layerKey === 'dark') {
    return L.layerGroup([
      L.tileLayer(BASE_TILE_URLS.dark, {
        maxNativeZoom: 10,
        maxZoom: MAP_MAX_ZOOM,
        zIndex: 1,
      }),
      L.tileLayer(BASE_TILE_URLS.darkLabels, {
        maxNativeZoom: 10,
        maxZoom: MAP_MAX_ZOOM,
        zIndex: 20,
      }),
    ]);
  }
  return L.tileLayer(BASE_TILE_URLS[layerKey], {
    maxNativeZoom: layerKey === 'satellite' ? 12 : 10,
    maxZoom: MAP_MAX_ZOOM,
    zIndex: 1,
  });
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
  const tileLayerRef = useRef<L.Layer | null>(null);
  const gibsLayerRef = useRef<L.TileLayer | null>(null);
  const gibsOpacityRef = useRef<number>(0.75);
  const gibsRequestIdRef = useRef<number>(0);

  const callbacksRef = useRef({ onSelectRegion, onSelectCustomCoordinates });
  callbacksRef.current = { onSelectRegion, onSelectCustomCoordinates };

  const [mapTileLayer, setMapTileLayer] = useState<'dark' | 'satellite' | 'streets'>('dark');
  const [gibsStatus, setGibsStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [gibsFailedCount, setGibsFailedCount] = useState<number>(0);

  const handleGIBSLayerSelect = (selection: GIBSSelectionPayload | null) => {
    const requestId = ++gibsRequestIdRef.current;

    if (selection) {
      gibsOpacityRef.current = selection.opacity;
    }

    if (gibsLayerRef.current && mapInstanceRef.current) {
      gibsLayerRef.current.off();
      mapInstanceRef.current.removeLayer(gibsLayerRef.current);
      gibsLayerRef.current = null;
    }

    if (!selection || !mapInstanceRef.current) {
      setGibsStatus('idle');
      setGibsFailedCount(0);
      return;
    }

    setGibsStatus('loading');
    setGibsFailedCount(0);

    let failedInPass = 0;
    const commonOpts: L.TileLayerOptions = {
      maxNativeZoom: selection.layer.maxZoom,
      maxZoom: MAP_MAX_ZOOM,
      zIndex: 10,
      opacity: gibsOpacityRef.current,
      noWrap: false,
    };

    const layer =
      selection.layer.service === 'wms'
        ? L.tileLayer.wms(GIBS_WMS_URL, {
            ...commonOpts,
            layers: selection.layer.id,
            format: 'image/png',
            transparent: true,
            version: '1.3.0',
            time: selection.date,
          } as L.WMSOptions & { time: string })
        : L.tileLayer(selection.tileUrl, commonOpts);

    layer.on('loading', () => {
      if (gibsRequestIdRef.current !== requestId) return;
      failedInPass = 0;
      setGibsFailedCount(0);
      setGibsStatus('loading');
    });

    layer.on('tileerror', () => {
      if (gibsRequestIdRef.current !== requestId) return;
      failedInPass += 1;
      setGibsFailedCount(failedInPass);
      setGibsStatus('error');
    });

    layer.on('load', () => {
      if (gibsRequestIdRef.current !== requestId) return;
      setGibsStatus(failedInPass > 0 ? 'error' : 'ready');
    });

    gibsLayerRef.current = layer;
    layer.addTo(mapInstanceRef.current);
  };

  const handleGIBSOpacityChange = (nextOpacity: number) => {
    gibsOpacityRef.current = nextOpacity;
    gibsLayerRef.current?.setOpacity(nextOpacity);
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
    activePinRef.current = L.marker([lat, lon], { icon: pinIcon, zIndexOffset: 600 }).addTo(map);
  };

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const hasCoords = selectedRegion.hasCoordinates !== false;
    const isCustomPin =
      hasCoords &&
      (selectedRegion.id.startsWith('coord_') || selectedRegion.id.startsWith('csv_'));

    if (!mapInstanceRef.current) {
      const map = L.map(container, {
        center: !hasCoords ? [0, 0] : isCustomPin ? selectedRegion.coordinates : [20, 0],
        zoom: isCustomPin ? 5 : 2,
        minZoom: 2,
        maxZoom: MAP_MAX_ZOOM,
        worldCopyJump: true,
        maxBounds: WORLD_MAX_BOUNDS,
        maxBoundsViscosity: 1.0,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);
      tileLayerRef.current = createBaseLayer('dark').addTo(map);

      map.on('click', (e: L.LeafletMouseEvent) => {
        const clampedLat = Math.max(-85, Math.min(85, e.latlng.lat));
        const normalizedLon = normalizeLongitude(e.latlng.lng);
        const roundedLat = +clampedLat.toFixed(3);
        const roundedLon = +normalizedLon.toFixed(3);
        callbacksRef.current.onSelectCustomCoordinates(roundedLat, roundedLon);
      });

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Keep tiles cleanly sized if responsive breakpoints resize the map wrapper
    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            map.invalidateSize({ pan: false });
          })
        : null;
    resizeObserver?.observe(container);

    // Populate Hotspot Markers
    HOTSPOT_REGIONS.forEach(region => {
      if (markersRef.current[region.id]) return;

      const isSelected = selectedRegion.id === region.id;
      const marker = L.marker(region.coordinates, {
        icon: buildHotspotIcon(region, isSelected),
        zIndexOffset: isSelected ? 500 : 0,
      }).addTo(map);

      marker.on('click', e => {
        L.DomEvent.stopPropagation(e);
        callbacksRef.current.onSelectRegion(region);
      });

      markersRef.current[region.id] = marker;
    });

    return () => {
      resizeObserver?.disconnect();
      if (gibsLayerRef.current) {
        gibsLayerRef.current.off();
        gibsLayerRef.current = null;
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      tileLayerRef.current = null;
      activePinRef.current = null;
      markersRef.current = {};
    };
  }, []);

  // Update active marker highlight, view, and custom pin when selected region changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    HOTSPOT_REGIONS.forEach(region => {
      const marker = markersRef.current[region.id];
      if (!marker) return;
      const isSelected = selectedRegion.id === region.id;
      marker.setIcon(buildHotspotIcon(region, isSelected));
      marker.setZIndexOffset(isSelected ? 500 : 0);
    });

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

    map.flyTo(selectedRegion.coordinates, Math.max(map.getZoom(), isCustomPin ? 5 : 4), {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedRegion]);

  // Switch basemap tile layer
  const handleTileChange = (layerKey: 'dark' | 'satellite' | 'streets') => {
    setMapTileLayer(layerKey);
    if (tileLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = createBaseLayer(layerKey).addTo(mapInstanceRef.current);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl">
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
        <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1.5 bg-[#030915]/85 backdrop-blur-md rounded-lg border border-slate-700/80 text-xs text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-[#3EC7F2] animate-spin-slow" />
          <span>Click any point on Earth to query NASA data</span>
        </div>
      </div>

      {/* GIBS Satellite Overlay Floating Controller (Top Right — accessible on all viewports) */}
      <div className="absolute top-3 right-3 z-10">
        <GIBSOverlay
          onSelectLayer={handleGIBSLayerSelect}
          onOpacityChange={handleGIBSOpacityChange}
          tileStatus={gibsStatus}
          failedTileCount={gibsFailedCount}
        />
      </div>

      {/* Selected Region Status Pill (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 max-w-[calc(100%-6.5rem)] sm:max-w-sm">
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
        onClick={() => mapInstanceRef.current?.setView([20, 0], 2, { animate: true })}
        className="absolute bottom-3 right-12 z-10 p-2 bg-[#030915]/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 shadow-md transition-colors"
        title="Reset World View"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
};
