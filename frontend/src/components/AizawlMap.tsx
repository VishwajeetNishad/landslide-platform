import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

type MapLibreInstance = maplibregl.Map;
type GeoJSONSource = maplibregl.GeoJSONSource;
import { SlopeUnitFeatureCollection, SlopeUnitProperties, RiskLevel } from '../types';
import { Layers, Maximize2, RotateCcw, ZoomIn, ZoomOut, AlertCircle, Compass, ShieldAlert } from 'lucide-react';
import { RISK_COLORS } from '../lib/riskHelpers';

export type MapLayerType = 'risk' | 'susceptibility' | 'rainfall' | 'swi' | 'runout' | 'terrain';

interface AizawlMapProps {
  geoJsonData: SlopeUnitFeatureCollection | null;
  selectedSlopeUnitId: string | null;
  onSelectSlopeUnit: (slopeUnitId: string) => void;
  hoveredSlopeUnitId?: string | null;
  onHoverSlopeUnit?: (slopeUnitId: string | null) => void;
  activeLayer?: MapLayerType;
}

const AIZAWL_CENTER: [number, number] = [92.72, 23.73]; // [lon, lat]
const AIZAWL_ZOOM = 12;

export const AizawlMap: React.FC<AizawlMapProps> = ({
  geoJsonData,
  selectedSlopeUnitId,
  onSelectSlopeUnit,
  hoveredSlopeUnitId,
  onHoverSlopeUnit,
  activeLayer = 'risk',
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreInstance | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [webGlError, setWebGlError] = useState<string | null>(null);
  const [tileMode, setTileMode] = useState<'dark' | 'satellite' | 'voyager' | 'light'>('dark');
  const [currentCoords, setCurrentCoords] = useState('92.7214° E, 23.7307° N');
  const hoveredFeatureIdRef = useRef<string | number | null>(null);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        throw new Error('WebGL is not supported in this browser context.');
      }

      const map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: {
          version: 8,
          sources: {
            'basemap-tiles': {
              type: 'raster',
              tiles: [
                'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
                'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              ],
              tileSize: 256,
              attribution: '© CARTO, © OpenStreetMap contributors',
            },
          },
          layers: [
            {
              id: 'basemap-tiles',
              type: 'raster',
              source: 'basemap-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: AIZAWL_CENTER,
        zoom: AIZAWL_ZOOM,
        pitch: 30,
        attributionControl: false,
      });

      map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: false }), 'bottom-right');
      map.addControl(new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        setMapLoaded(true);
      });

      map.on('mousemove', (e) => {
        const lng = e.lngLat.lng.toFixed(4);
        const lat = e.lngLat.lat.toFixed(4);
        setCurrentCoords(`${lng}° E, ${lat}° N`);
      });

      map.on('error', (e) => {
        console.warn('MapLibre warning/error:', e);
      });

      mapRef.current = map;

      return () => {
        map.remove();
        mapRef.current = null;
      };
    } catch (err: any) {
      console.error('Failed to initialize MapLibre:', err);
      setWebGlError(err?.message || 'Failed to initialize WebGL map');
    }
  }, []);

  // Update Base Map Style
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    let tileUrls = [
      'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
    ];

    if (tileMode === 'satellite') {
      tileUrls = [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ];
    } else if (tileMode === 'voyager') {
      tileUrls = [
        'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png',
      ];
    } else if (tileMode === 'light') {
      tileUrls = [
        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png',
      ];
    }

    try {
      if (map.getLayer('basemap-tiles')) {
        map.removeLayer('basemap-tiles');
      }
      if (map.getSource('basemap-tiles')) {
        map.removeSource('basemap-tiles');
      }
      map.addSource('basemap-tiles', {
        type: 'raster',
        tiles: tileUrls,
        tileSize: 256,
      });
      // Insert before slope units if present
      const beforeId = map.getLayer('slope-units-fill') ? 'slope-units-fill' : undefined;
      map.addLayer(
        {
          id: 'basemap-tiles',
          type: 'raster',
          source: 'basemap-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
        beforeId
      );
    } catch (err) {
      console.warn('Error changing basemap tile layer:', err);
    }
  }, [tileMode, mapLoaded]);

  // Load / Update GeoJSON Data and Layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geoJsonData) return;

    try {
      const source = map.getSource('slope-units-source') as GeoJSONSource;

      if (!source) {
        // Add GeoJSON Source
        map.addSource('slope-units-source', {
          type: 'geojson',
          data: geoJsonData as any,
          generateId: true,
        });

        // 1. Fill Layer: Colored by risk_level or activeLayer
        map.addLayer({
          id: 'slope-units-fill',
          type: 'fill',
          source: 'slope-units-source',
          paint: {
            'fill-color': [
              'case',
              ['==', ['get', 'risk_level'], 'HIGH'],
              '#ef4444', // High Risk Red
              ['==', ['get', 'risk_level'], 'MEDIUM'],
              '#f97316', // Medium Risk Orange
              ['==', ['get', 'risk_level'], 'LOW'],
              '#10b981', // Low Risk Green
              '#64748b', // unassessed
            ],
            'fill-opacity': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              0.85,
              ['boolean', ['feature-state', 'hover'], false],
              0.7,
              0.5,
            ],
          },
        });

        // 2. Stroke / Outline Layer
        map.addLayer({
          id: 'slope-units-outline',
          type: 'line',
          source: 'slope-units-source',
          paint: {
            'line-color': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              '#ffffff', // crisp white outline on selection
              ['==', ['get', 'risk_level'], 'HIGH'],
              '#dc2626',
              ['==', ['get', 'risk_level'], 'MEDIUM'],
              '#ea580c',
              ['==', ['get', 'risk_level'], 'LOW'],
              '#059669',
              '#475569',
            ],
            'line-width': [
              'case',
              ['boolean', ['feature-state', 'selected'], false],
              3.5,
              ['boolean', ['feature-state', 'hover'], false],
              2.5,
              1.5,
            ],
          },
        });

        // 3. Runout Envelopes Source and Layer (for zones with runout_envelope)
        const runoutFeatures = geoJsonData.features
          .filter((f) => f.properties?.runout_envelope)
          .map((f) => ({
            type: 'Feature' as const,
            geometry: f.properties.runout_envelope!,
            properties: {
              parent_id: f.properties.slope_unit_id,
              risk_level: f.properties.risk_level,
            },
          }));

        if (!map.getSource('runout-source')) {
          map.addSource('runout-source', {
            type: 'geojson',
            data: {
              type: 'FeatureCollection',
              features: runoutFeatures,
            },
          });

          map.addLayer({
            id: 'runout-fill',
            type: 'fill',
            source: 'runout-source',
            paint: {
              'fill-color': '#f43f5e',
              'fill-opacity': 0.25,
            },
          });

          map.addLayer({
            id: 'runout-outline',
            type: 'line',
            source: 'runout-source',
            paint: {
              'line-color': '#f43f5e',
              'line-width': 2,
              'line-dasharray': [3, 2],
            },
          });
        }

        // Click Handler
        map.on('click', 'slope-units-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const props = e.features[0].properties as any;
          const slopeUnitId = props.slope_unit_id;
          if (slopeUnitId) {
            onSelectSlopeUnit(slopeUnitId);
          }
        });

        // Cursor & Hover Handlers
        map.on('mouseenter', 'slope-units-fill', () => {
          map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mousemove', 'slope-units-fill', (e) => {
          if (!e.features || e.features.length === 0) return;
          const feature = e.features[0];
          const featureId = feature.id;
          const props = feature.properties as any;

          if (hoveredFeatureIdRef.current !== null && hoveredFeatureIdRef.current !== featureId) {
            map.setFeatureState(
              { source: 'slope-units-source', id: hoveredFeatureIdRef.current },
              { hover: false }
            );
          }

          if (featureId !== undefined) {
            hoveredFeatureIdRef.current = featureId;
            map.setFeatureState(
              { source: 'slope-units-source', id: featureId },
              { hover: true }
            );
          }

          if (onHoverSlopeUnit && props.slope_unit_id) {
            onHoverSlopeUnit(props.slope_unit_id);
          }
        });

        map.on('mouseleave', 'slope-units-fill', () => {
          map.getCanvas().style.cursor = '';
          if (hoveredFeatureIdRef.current !== null) {
            map.setFeatureState(
              { source: 'slope-units-source', id: hoveredFeatureIdRef.current },
              { hover: false }
            );
            hoveredFeatureIdRef.current = null;
          }
          if (onHoverSlopeUnit) {
            onHoverSlopeUnit(null);
          }
        });
      } else {
        source.setData(geoJsonData as any);
      }
    } catch (err) {
      console.warn('Error setting map layer:', err);
    }
  }, [geoJsonData, mapLoaded]);

  // Adjust layer coloration dynamically when activeLayer changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.getLayer('slope-units-fill')) return;

    try {
      if (activeLayer === 'susceptibility') {
        map.setPaintProperty('slope-units-fill', 'fill-color', [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'susceptibility_score'], 0],
          0.0, '#10b981',
          0.35, '#84cc16',
          0.6, '#eab308',
          0.75, '#f97316',
          0.9, '#ef4444',
        ]);
      } else if (activeLayer === 'rainfall') {
        map.setPaintProperty('slope-units-fill', 'fill-color', [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'rainfall_intensity_mm_hr'], 0],
          0, '#bae6fd',
          15, '#38bdf8',
          30, '#0284c7',
          45, '#1d4ed8',
          60, '#1e1b4b',
        ]);
      } else if (activeLayer === 'swi') {
        map.setPaintProperty('slope-units-fill', 'fill-color', [
          'interpolate',
          ['linear'],
          ['coalesce', ['get', 'soil_water_index'], 0],
          0, '#93c5fd',
          50, '#3b82f6',
          100, '#eab308',
          140, '#ef4444',
        ]);
      } else {
        // Default 'risk' layer: HIGH=red, MEDIUM=orange, LOW=green, unassessed=slate
        map.setPaintProperty('slope-units-fill', 'fill-color', [
          'case',
          ['==', ['get', 'risk_level'], 'HIGH'],
          '#ef4444',
          ['==', ['get', 'risk_level'], 'MEDIUM'],
          '#f97316',
          ['==', ['get', 'risk_level'], 'LOW'],
          '#10b981',
          '#64748b',
        ]);
      }
    } catch (e) {
      console.warn('Error updating layer paint:', e);
    }
  }, [activeLayer, mapLoaded]);

  // Highlight selected slope unit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !geoJsonData) return;

    geoJsonData.features.forEach((feature) => {
      const id = feature.id ?? feature.properties?.slope_unit_id;
      if (id !== undefined) {
        const isSelected = feature.properties?.slope_unit_id === selectedSlopeUnitId;
        try {
          map.setFeatureState(
            { source: 'slope-units-source', id: feature.id || 0 },
            { selected: isSelected }
          );
        } catch (_) {}
      }
    });
  }, [selectedSlopeUnitId, geoJsonData, mapLoaded]);

  // Center/Fly to selected slope unit
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !selectedSlopeUnitId || !geoJsonData) return;

    const feature = geoJsonData.features.find(
      (f) => f.properties.slope_unit_id === selectedSlopeUnitId
    );

    if (feature && feature.geometry) {
      try {
        let center: [number, number] | null = null;
        if (feature.geometry.type === 'Polygon') {
          const coords = feature.geometry.coordinates[0];
          let sumLon = 0;
          let sumLat = 0;
          coords.forEach(([lon, lat]) => {
            sumLon += lon;
            sumLat += lat;
          });
          center = [sumLon / coords.length, sumLat / coords.length];
        } else if (feature.geometry.type === 'MultiPolygon') {
          const coords = feature.geometry.coordinates[0][0];
          let sumLon = 0;
          let sumLat = 0;
          coords.forEach(([lon, lat]) => {
            sumLon += lon;
            sumLat += lat;
          });
          center = [sumLon / coords.length, sumLat / coords.length];
        }

        if (center) {
          map.flyTo({
            center,
            zoom: 13.5,
            duration: 1200,
            essential: true,
          });
        }
      } catch (e) {
        console.warn('FlyTo error:', e);
      }
    }
  }, [selectedSlopeUnitId, geoJsonData, mapLoaded]);

  // Zoom controls
  const handleZoomIn = () => mapRef.current?.zoomIn();
  const handleZoomOut = () => mapRef.current?.zoomOut();
  const handleResetAizawl = () => {
    mapRef.current?.flyTo({
      center: AIZAWL_CENTER,
      zoom: AIZAWL_ZOOM,
      pitch: 30,
      bearing: 0,
      duration: 1000,
    });
  };

  return (
    <div className="relative w-full h-full min-h-[500px] lg:min-h-[580px] bg-slate-900 overflow-hidden rounded-2xl border border-slate-200 shadow-md flex flex-col">
      {/* WebGL Error / Fallback */}
      {webGlError && (
        <div className="absolute inset-0 z-30 bg-slate-900/95 backdrop-blur-md p-6 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 text-white flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h4 className="text-base font-bold text-white">Geospatial Canvas Notice</h4>
          <p className="text-xs text-slate-300 max-w-sm mt-1 mb-4 leading-relaxed">
            {webGlError}. Hardware acceleration may be restricted in sandbox mode. Slope-unit terrain data and hydrologic attribution remain fully interactive via inspector panels.
          </p>
        </div>
      )}

      {/* Main Map Canvas - COLOR UNTOUCHED */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[500px] lg:min-h-[580px] relative z-10" />

      {/* Quick Aizawl Locator Header: Top Left */}
      <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 p-2.5 px-3.5 flex items-center gap-3 shadow-md">
        <div className="w-8 h-8 rounded-lg bg-[#0f2942] text-white flex items-center justify-center shrink-0">
          <Compass className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-900 block leading-tight">
              Aizawl Slope-Unit Delineation
            </span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#0f2942] text-white font-bold uppercase">
              {activeLayer.toUpperCase()}
            </span>
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {geoJsonData?.features?.length || 5} Delineated Units • 11,778 Monitored Grid
          </span>
        </div>
      </div>

      {/* Map Control Buttons: Top Right */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        {/* Map Legend */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-3 shadow-md w-44">
          <div className="flex justify-between items-center mb-2 pb-1.5 border-b border-slate-200">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Classification</p>
            <span className="text-[9px] font-mono text-[#0f2942] font-bold">Risk Matrix</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-xs shrink-0 border border-red-600" />
                <span className="text-slate-900 font-bold">HIGH</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">P &gt; 0.6 + Pop</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-amber-500 rounded-xs shrink-0 border border-amber-600" />
                <span className="text-slate-800 font-medium">MEDIUM</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Elevated</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-emerald-500 rounded-xs shrink-0 border border-emerald-600" />
                <span className="text-slate-800 font-medium">LOW</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">Safe / 0 Pop</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-slate-400 rounded-xs shrink-0 border border-slate-500" />
                <span className="text-slate-600 font-medium">Unassessed</span>
              </div>
              <span className="text-[10px] font-mono text-slate-400">Base</span>
            </div>
            <div className="pt-1 mt-1 border-t border-slate-200 flex items-center gap-2 text-[10px] text-slate-600 font-mono">
              <span className="w-3 h-1 border-t-2 border-dashed border-rose-500 shrink-0" />
              <span>Runout Envelope</span>
            </div>
          </div>
        </div>

        {/* Zoom & Recenter Controls */}
        <div className="bg-white/95 backdrop-blur-md border border-slate-200 rounded-xl p-1.5 shadow-md flex flex-col gap-1 items-center">
          <button
            onClick={handleZoomIn}
            className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg font-bold cursor-pointer transition-colors border border-slate-200 shadow-2xs"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4 text-slate-700" />
          </button>
          <button
            onClick={handleZoomOut}
            className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg font-bold cursor-pointer transition-colors border border-slate-200 shadow-2xs"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4 text-slate-700" />
          </button>
          <button
            onClick={handleResetAizawl}
            className="w-8 h-8 flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-800 rounded-lg cursor-pointer transition-colors border border-slate-200 shadow-2xs"
            title="Recenter on Aizawl District"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-700" />
          </button>
        </div>

        {/* Tile Style Switcher */}
        <div className="bg-white/95 backdrop-blur-md rounded-xl border border-slate-200 p-1 shadow-md flex flex-col gap-1">
          {(['dark', 'satellite', 'voyager', 'light'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setTileMode(mode)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer text-left ${
                tileMode === mode
                  ? 'bg-[#0f2942] text-white font-bold'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Coordinates Telemetry Strip: Bottom Left */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 text-slate-800 px-3 py-1.5 rounded-lg text-[10px] font-mono backdrop-blur-md border border-slate-200 shadow-md flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
        <span className="font-semibold text-slate-700">RADAR: {currentCoords} | ELEVATION: 1,132 m MSL</span>
      </div>
    </div>
  );
};
