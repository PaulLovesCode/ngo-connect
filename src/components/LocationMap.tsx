import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
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
            src={`https://maps.google.com/maps?q=${encodeURIComponent(location)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
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
// Shows map preview as location is typed.
// =============================================
interface LocationInputMapProps {
  value: string;
  onChange: (location: string) => void;
  onCoordsChange?: (lat: number, lon: number) => void;
  fillHeight?: boolean;
}

export function LocationInputMap({ value, onChange, onCoordsChange, fillHeight = false }: LocationInputMapProps) {
  const [showMap, setShowMap] = useState(false);
  const [debouncedValue, setDebouncedValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced geocoding as user types
  useEffect(() => {
    if (!value || value.trim().length < 3) {
      setShowMap(false);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      setDebouncedValue(value);
      setShowMap(true);
    }, 800);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

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
            <div className={`relative ${fillHeight ? 'h-full' : 'h-[180px]'} bg-gray-50`}>
              <iframe
                width="100%"
                height="100%"
                style={{ border: 0 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(debouncedValue)}&t=&z=14&ie=UTF8&iwloc=&output=embed`}
              ></iframe>
              <div className="absolute bottom-2 left-2 z-[10] pointer-events-none">
                <div className="bg-white/90 backdrop-blur rounded-lg px-2 py-1 text-[10px] text-gray-600 font-medium shadow-sm border border-gray-100 flex items-center">
                  <Navigation size={10} className="inline mr-1 text-emerald-500" />
                  Google Maps Location Preview
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
