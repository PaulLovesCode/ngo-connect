import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, Search, Loader2, AlertTriangle, Navigation, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Fix default marker icon issue with Leaflet + bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Custom emerald marker icon
const emergencyIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

// Custom pin icon for manual placement (red tint via CSS filter)
const manualPinIcon = new L.DivIcon({
  html: `<div style="display:flex;align-items:center;justify-content:center;width:32px;height:42px;">
    <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 24 24" fill="#059669" stroke="#065f46" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
      <circle cx="12" cy="10" r="3" fill="white" stroke="#065f46"/>
    </svg>
  </div>`,
  iconSize: [32, 42],
  iconAnchor: [16, 42],
  popupAnchor: [0, -42],
  className: '',
});

interface GeocodingResult {
  lat: number;
  lon: number;
  displayName: string;
}

// Geocode using OpenStreetMap Nominatim (free, no API key)
async function geocodeLocation(query: string): Promise<GeocodingResult | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'User-Agent': 'NGOConnect/1.0' } }
    );
    const data = await res.json();
    if (data && data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
        displayName: data[0].display_name,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// Reverse geocode lat/lon to address
async function reverseGeocode(lat: number, lon: number): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`,
      { headers: { 'User-Agent': 'NGOConnect/1.0' } }
    );
    const data = await res.json();
    return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  } catch {
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  }
}

// ---- Sub-components for map interactions ----

function FlyToLocation({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lon], 14, { duration: 1.2 });
  }, [lat, lon, map]);
  return null;
}

function ClickableMap({ onLocationSelect }: { onLocationSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// =============================================
// LocationMapModal: Click on location text to open a full map view
// =============================================
interface LocationMapModalProps {
  location: string;
  isOpen: boolean;
  onClose: () => void;
}

export function LocationMapModal({ location, isOpen, onClose }: LocationMapModalProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [resolvedName, setResolvedName] = useState('');

  useEffect(() => {
    if (!isOpen || !location) return;
    setLoading(true);
    setError(false);
    geocodeLocation(location).then((result) => {
      if (result) {
        setCoords({ lat: result.lat, lon: result.lon });
        setResolvedName(result.displayName);
        setError(false);
      } else {
        setCoords(null);
        setError(true);
      }
      setLoading(false);
    });
  }, [location, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-2xl bg-white rounded-[24px] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <MapPin size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900">Emergency Location</h3>
              <p className="text-xs text-gray-500 truncate max-w-[300px]">{location}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 bg-gray-100 rounded-full text-gray-500 hover:text-gray-900 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Map */}
        <div className="h-[400px] relative">
          {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
              <p className="text-sm text-gray-500 font-medium">Locating on map...</p>
            </div>
          ) : error || !coords ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
              <AlertTriangle className="text-amber-500 mb-2" size={32} />
              <p className="text-sm text-gray-600 font-medium">Could not pinpoint this location</p>
              <p className="text-xs text-gray-400 mt-1">"{location}" could not be geocoded</p>
            </div>
          ) : (
            <MapContainer
              center={[coords.lat, coords.lon]}
              zoom={14}
              className="h-full w-full z-0"
              scrollWheelZoom={true}
              style={{ borderRadius: '0 0 24px 24px' }}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyToLocation lat={coords.lat} lon={coords.lon} />
              <Marker position={[coords.lat, coords.lon]} icon={manualPinIcon}>
                <Popup>
                  <div className="text-sm">
                    <p className="font-bold text-gray-900 mb-1">{location}</p>
                    <p className="text-xs text-gray-500">{resolvedName}</p>
                  </div>
                </Popup>
              </Marker>
            </MapContainer>
          )}
        </div>

        {/* Footer with coordinates */}
        {coords && !loading && (
          <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <div className="flex items-center space-x-2 text-xs text-gray-500">
              <Navigation size={12} className="text-emerald-500" />
              <span>
                {coords.lat.toFixed(5)}, {coords.lon.toFixed(5)}
              </span>
            </div>
            <a
              href={`https://www.google.com/maps?q=${coords.lat},${coords.lon}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
            >
              Open in Google Maps ↗
            </a>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// =============================================
// LocationInputMap: Inline map for the Report Emergency form
// Shows map preview as location is typed. Fallback: click to place pin.
// =============================================
interface LocationInputMapProps {
  value: string;
  onChange: (location: string) => void;
  onCoordsChange?: (lat: number, lon: number) => void;
  fillHeight?: boolean;
}

export function LocationInputMap({ value, onChange, onCoordsChange, fillHeight = false }: LocationInputMapProps) {
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [manualPin, setManualPin] = useState<{ lat: number; lon: number } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocoding as user types
  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setCoords(null);
      setGeocodeFailed(false);
      setShowMap(false);
      setManualPin(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setGeocodeFailed(false);
      const result = await geocodeLocation(value);
      if (result) {
        setCoords({ lat: result.lat, lon: result.lon });
        setGeocodeFailed(false);
        setShowMap(true);
        setManualPin(null);
        onCoordsChange?.(result.lat, result.lon);
      } else {
        setCoords(null);
        setGeocodeFailed(true);
        setShowMap(true);
        setManualPin(null);
      }
      setLoading(false);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  // Handle manual pin placement
  const handleManualPinPlace = useCallback(
    async (lat: number, lon: number) => {
      setManualPin({ lat, lon });
      setGeocodeFailed(false);
      onCoordsChange?.(lat, lon);
      // Reverse geocode to fill in location name
      const address = await reverseGeocode(lat, lon);
      onChange(address);
    },
    [onChange, onCoordsChange]
  );

  const displayCoords = manualPin || coords;

  return (
    <div className={`space-y-2 ${fillHeight ? 'flex flex-col h-full flex-1' : ''}`}>
      {/* Location Input */}
      <div className="relative">
        <MapPin
          size={16}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500"
        />
        <input
          type="text"
          placeholder="Location"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full p-2 pl-8 pr-8 border border-gray-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          required
        />
        {loading && (
          <Loader2
            size={14}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 animate-spin text-emerald-500"
          />
        )}
      </div>

      {/* Map Preview */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: fillHeight ? "100%" : 180 }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-xl border border-gray-200 shadow-sm ${fillHeight ? 'flex-1 min-h-[200px]' : ''}`}
          >
            {geocodeFailed && !manualPin ? (
              // Geocode failed: show interactive map for manual pin
              <div className={`relative ${fillHeight ? 'h-full' : 'h-[180px]'}`}>
                <MapContainer
                  center={[20.5937, 78.9629]}
                  zoom={5}
                  className="h-full w-full z-0"
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <ClickableMap onLocationSelect={handleManualPinPlace} />
                </MapContainer>
                <div className="absolute top-2 left-2 right-2 z-[1000]">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center space-x-2 shadow-md">
                    <AlertTriangle size={14} className="text-amber-500 flex-shrink-0" />
                    <span className="text-[11px] text-amber-700 font-medium">
                      Location not found — click the map to place a pin
                    </span>
                  </div>
                </div>
              </div>
            ) : displayCoords ? (
              // Geocode succeeded or manual pin placed: show pin on map
              <div className={`relative ${fillHeight ? 'h-full' : 'h-[180px]'}`}>
                <MapContainer
                  center={[displayCoords.lat, displayCoords.lon]}
                  zoom={13}
                  className="h-full w-full z-0"
                  scrollWheelZoom={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <FlyToLocation lat={displayCoords.lat} lon={displayCoords.lon} />
                  <Marker position={[displayCoords.lat, displayCoords.lon]} icon={manualPinIcon}>
                    <Popup>
                      <span className="text-xs font-medium">{value || 'Selected Location'}</span>
                    </Popup>
                  </Marker>
                  <ClickableMap onLocationSelect={handleManualPinPlace} />
                </MapContainer>
                <div className="absolute bottom-2 left-2 z-[1000]">
                  <div className="bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-gray-600 font-medium shadow-sm border border-gray-100">
                    <Navigation size={10} className="inline mr-1 text-emerald-500" />
                    {displayCoords.lat.toFixed(4)}, {displayCoords.lon.toFixed(4)}
                  </div>
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
