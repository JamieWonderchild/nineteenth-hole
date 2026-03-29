'use client';

import * as React from 'react';
import { MapPin, Check } from 'lucide-react';

interface LocationFilterProps {
  locations: Array<{ _id: string; name: string }>;
  selectedLocationId: string | null;
  onLocationChange: (locationId: string | null) => void;
  showAllOption?: boolean;
}

export function LocationFilter({
  locations,
  selectedLocationId,
  onLocationChange,
  showAllOption = true,
}: LocationFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedLocation = locations.find((l) => l._id === selectedLocationId);

  if (locations.length <= 1 && !showAllOption) {
    return null; // Don't show filter if only one location
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background hover:bg-accent transition-colors text-sm"
      >
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span>{selectedLocation?.name || 'All Locations'}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute top-full mt-1 left-0 bg-background border border-border rounded-lg shadow-lg min-w-[200px] z-20">
            {showAllOption && (
              <button
                onClick={() => {
                  onLocationChange(null);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors text-sm"
              >
                <span>All Locations</span>
                {!selectedLocationId && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            )}

            {locations.map((location) => (
              <button
                key={location._id}
                onClick={() => {
                  onLocationChange(location._id);
                  setIsOpen(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-accent transition-colors text-sm"
              >
                <span>{location.name}</span>
                {selectedLocationId === location._id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
