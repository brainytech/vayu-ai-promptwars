import React, { useEffect, useRef, useState } from 'react';
import { MapPin, RefreshCw, Search, X } from 'lucide-react';
import type { CityLocation } from '../types';
import { PRESET_CITIES } from '../utils/airQuality';
import { searchCities } from '../services/api';

interface CitySearchBarProps {
  selectedCity: CityLocation;
  onSelectCity: (city: CityLocation) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

export const CitySearchBar: React.FC<CitySearchBarProps> = ({
  selectedCity,
  onSelectCity,
  onRefresh,
  isLoading,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CityLocation[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      const found = await searchCities(trimmed);
      if (!cancelled) {
        setResults(found);
        setIsOpen(true);
        setIsSearching(false);
      }
    }, 260);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleChoose = (city: CityLocation) => {
    onSelectCity(city);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 py-3 border-b border-slate-200">
      {/* Quick-Switch Preset Cities */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-medium text-slate-500 mr-1 whitespace-nowrap">
          Monitor City:
        </span>
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto max-w-full">
          {PRESET_CITIES.map((city) => {
            const isActive =
              city.name.toLowerCase() === selectedCity.name.toLowerCase() &&
              Math.abs(city.latitude - selectedCity.latitude) < 0.2;
            return (
              <button
                key={city.name}
                type="button"
                onClick={() => handleChoose(city)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {city.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live City Search + Refresh */}
      <div className="flex items-center gap-2 w-full lg:w-auto">
        <div ref={containerRef} className="relative flex-1 lg:w-80">
          <div className="relative flex items-center">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => {
                if (results.length > 0) setIsOpen(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setIsOpen(false);
                } else if (e.key === 'Enter' && results.length > 0) {
                  handleChoose(results[0]);
                }
              }}
              placeholder="Search any city worldwide (e.g., Lahore, London)"
              aria-label="Search any city worldwide"
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600 transition-colors"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setResults([]);
                  setIsOpen(false);
                }}
                aria-label="Clear city search"
                className="absolute right-2.5 text-slate-400 hover:text-slate-700 p-0.5 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {isOpen && (
            <div className="absolute z-40 mt-1.5 w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
              {isSearching ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  Searching Open-Meteo global stations...
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-3 text-xs text-slate-500">
                  No matching cities found for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                <ul role="listbox" className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                  {results.map((item, idx) => (
                    <li key={`${item.name}-${item.latitude}-${idx}`}>
                      <button
                        type="button"
                        onClick={() => handleChoose(item)}
                        className="w-full text-left px-3.5 py-2.5 hover:bg-slate-50 flex items-center justify-between gap-2 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                          <span className="text-sm font-medium text-slate-900 truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-slate-500 truncate">
                            {[item.admin1, item.country].filter(Boolean).join(', ')}
                          </span>
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                          {item.latitude.toFixed(2)}, {item.longitude.toFixed(2)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          title="Refresh live air quality telemetry"
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Sync Live</span>
        </button>
      </div>
    </div>
  );
};
