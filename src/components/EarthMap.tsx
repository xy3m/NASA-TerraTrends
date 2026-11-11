import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { HotspotRegion } from '../types/earthScience';
import { HOTSPOT_REGIONS } from '../services/nasaData';
import { MapPin, Navigation, Crosshair, Layers } from 'lucide-react';

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

  // Tile layer URLs
  const tileLayers = {
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    streets: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  };

  const tileLayerRef = useRef<L.TileLayer | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize Map
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [20, 0],
        zoom: 2,
        minZoom: 2,
        maxZoom: 16,
        zoomControl: false,
        attributionControl: false,
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Add base tile layer
      tileLayerRef.current = L.tileLayer(tileLayers.dark, {
        maxZoom: 18,
      }).addTo(map);

      // Handle Map Click for custom coordinates
      map.on('click', (e: L.LeafletMouseEvent) => {
        const { lat, lng } = e.latlng;
        // Normalize lon to -180 .. 180
        const normalizedLon = ((lng + 180) % 360 + 360) % 360 - 180;
        const roundedLat = +lat.toFixed(3);
        const roundedLon = +normalizedLon.toFixed(3);

        setClickCoords({ lat: roundedLat, lon: roundedLon });

        // Update custom pin
        if (activePinRef.current) {
          activePinRef.current.setLatLng([lat, normalizedLon]);
        } else {
          const pinIcon = L.divIcon({
            className: 'custom-pin-icon',
            html: `<div class="relative flex items-center justify-center">
                    <span class="animate-ping absolute inline-flex h-6 w-6 rounded-full bg-cyan-400 opacity-75"></span>
                    <div class="relative w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow-md"></div>
                  </div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
          });
          activePinRef.current = L.marker([lat, normalizedLon], { icon: pinIcon }).addTo(map);
        }

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
      // Keep map alive across standard re-renders
    };
  }, []);

  // Update map view when selected region changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Center map smoothly on selected region
    map.flyTo(selectedRegion.coordinates, Math.max(map.getZoom(), 4), {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [selectedRegion]);

  // Switch tile layer
  const handleTileChange = (layerKey: 'dark' | 'satellite' | 'streets') => {
    setMapTileLayer(layerKey);
    if (tileLayerRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
      tileLayerRef.current = L.tileLayer(tileLayers[layerKey], { maxZoom: 18 }).addTo(mapInstanceRef.current);
    }
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-xl group">
      {/* Map Canvas */}
      <div ref={mapContainerRef} className="h-72 sm:h-84 md:h-96 w-full z-0" />

      {/* Floating Map Controls & Overlays */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        {/* Layer Switcher */}
        <div className="flex items-center bg-slate-950/85 backdrop-blur-md rounded-lg p-1 border border-slate-700/80 shadow-md text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
          <button
            onClick={() => handleTileChange('dark')}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              mapTileLayer === 'dark' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Dark
          </button>
          <button
            onClick={() => handleTileChange('satellite')}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              mapTileLayer === 'satellite' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Satellite
          </button>
          <button
            onClick={() => handleTileChange('streets')}
            className={`px-2 py-1 rounded font-medium transition-colors ${
              mapTileLayer === 'streets' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Terrain
          </button>
        </div>

        {/* Click-to-Pin Helper */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-950/80 backdrop-blur-md rounded-lg border border-slate-700/80 text-xs text-slate-300">
          <Crosshair className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
          <span>Click any point on Earth to query NASA data</span>
        </div>
      </div>

      {/* Selected Region Status Pill (Bottom Left) */}
      <div className="absolute bottom-3 left-3 z-10 max-w-sm">
        <div className="bg-slate-950/90 backdrop-blur-md rounded-xl p-3 border border-slate-800 shadow-xl flex items-start space-x-3">
          <div className="p-2 rounded-lg bg-blue-950/80 text-cyan-400 border border-blue-800/60 shrink-0">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-bold text-white truncate">{selectedRegion.name}</h4>
              <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-slate-800 text-cyan-300 rounded border border-slate-700 shrink-0">
                {selectedRegion.category}
              </span>
            </div>
            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5 font-mono">
              {selectedRegion.coordinates[0].toFixed(2)}°, {selectedRegion.coordinates[1].toFixed(2)}° • {selectedRegion.keyPhenomenon}
            </p>
          </div>
        </div>
      </div>

      {/* Reset Map View Button (Bottom Right next to zoom) */}
      <button
        onClick={() => mapInstanceRef.current?.setView([20, 0], 2)}
        className="absolute bottom-3 right-12 z-10 p-2 bg-slate-950/90 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700/80 shadow-md transition-colors"
        title="Reset World View"
      >
        <Navigation className="w-4 h-4" />
      </button>
    </div>
  );
};
