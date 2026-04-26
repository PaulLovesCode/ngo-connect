import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Loader2, MousePointerClick } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet's default icon paths for React/Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Helper component to center map
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

// Helper component to handle map clicks
function MapClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
    }
  }, [isOpen, location]);

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
        <div className="h-[400px] relative bg-gray-50">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10 pointer-events-none">
              <Loader2 className="animate-spin text-emerald-500 mb-2" size={32} />
              <p className="text-sm text-gray-500 font-medium">Loading Google Map...</p>
            </div>
          )}
          <iframe
            width="100%"
            height="100%"
            style={{ border: 0, borderRadius: '0 0 24px 24px' }}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            src={`https://maps.google.com/maps?q=${encodeURIComponent(location)}&t=&z=14&ie=UTF8&output=embed`}
            onLoad={() => setLoading(false)}
          ></iframe>
        </div>

        {/* Footer */}
        <div className="p-3 bg-gray-50 border-t border-gray-100 flex items-center justify-end">
          <a
            href={`https://www.google.com/maps?q=${encodeURIComponent(location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
          >
            Open in Google Maps ↗
          </a>
        </div>
      </motion.div>
    </div>
  );
}

// =============================================
// LocationInputMap: Inline map for the Report Emergency form
// Shows map preview and allows placing a pin via Leaflet
// =============================================
interface LocationInputMapProps {
  value: string;
  onChange: (location: string) => void;
  onCoordsChange?: (lat: number, lon: number) => void;
  fillHeight?: boolean;
}

export function LocationInputMap({ value, onChange, onCoordsChange, fillHeight = false }: LocationInputMapProps) {
  const [showMap, setShowMap] = useState(false);
  const [coords, setCoords] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([20.5937, 78.9629]); // Default to India
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSettingFromMap = useRef(false);

  // Debounced geocoding as user types
  useEffect(() => {
    if (isSettingFromMap.current) {
      isSettingFromMap.current = false;
      return;
    }

    if (!value || value.trim().length < 3) {
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      // Check if value is already coordinates
      const latLngMatch = value.match(/Lat:\s*([-\d.]+),\s*Lng:\s*([-\d.]+)/i);
      if (latLngMatch) {
          const lat = parseFloat(latLngMatch[1]);
          const lng = parseFloat(latLngMatch[2]);
          setCoords([lat, lng]);
          setMapCenter([lat, lng]);
          setShowMap(true);
          return;
      }

      fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) {
            const newLat = parseFloat(data[0].lat);
            const newLon = parseFloat(data[0].lon);
            setCoords([newLat, newLon]);
            setMapCenter([newLat, newLon]);
            if (onCoordsChange) onCoordsChange(newLat, newLon);
            setShowMap(true);
          }
        })
        .catch(err => console.error("Geocoding error:", err));
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value, onCoordsChange]);

  const handleMapClick = async (lat: number, lng: number) => {
    setCoords([lat, lng]);
    isSettingFromMap.current = true;
    if (onCoordsChange) onCoordsChange(lat, lng);
    
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
            onChange(data.display_name);
        } else {
            onChange(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
        }
    } catch (err) {
        onChange(`Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`);
    }
  };

  return (
    <div className={`space-y-2 ${fillHeight ? 'flex flex-col h-full flex-1' : ''}`}>
      {/* Location Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <MapPin
            size={16}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-500"
          />
          <input
            type="text"
            placeholder="Address or coordinates..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2 pl-8 pr-8 border border-gray-300 bg-white rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            required
          />
        </div>
        <button
          type="button"
          onClick={() => setShowMap(!showMap)}
          className={`p-2 rounded-lg border transition-colors flex items-center gap-1 ${showMap ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
          title="Drop Pin on Map"
        >
          <MousePointerClick size={16} />
          <span className="text-xs font-medium hidden sm:inline">Map</span>
        </button>
      </div>

      {/* Map Preview */}
      <AnimatePresence>
        {showMap && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: fillHeight ? "100%" : 220 }}
            exit={{ opacity: 0, height: 0 }}
            className={`overflow-hidden rounded-xl border border-gray-200 shadow-sm ${fillHeight ? 'flex-1 min-h-[200px]' : ''}`}
          >
            <div className={`relative ${fillHeight ? 'h-full' : 'h-[220px]'} bg-gray-50 z-0`}>
              <MapContainer center={mapCenter} zoom={13} style={{ height: '100%', width: '100%', zIndex: 0 }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {coords && <Marker position={coords} />}
                <MapUpdater center={mapCenter} />
                <MapClickHandler onLocationSelect={handleMapClick} />
              </MapContainer>
              <div className="absolute bottom-2 left-2 z-[400] pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-gray-600 font-medium shadow-sm border border-gray-100 flex items-center">
                  <Navigation size={10} className="inline mr-1 text-emerald-500" />
                  Click anywhere to place a pin
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
