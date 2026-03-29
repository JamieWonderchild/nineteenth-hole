'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { debugLog } from '@/lib/debug-logger';

interface LocationSetupStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

interface Location {
  id: string;
  name: string;
  address?: string;
  phone?: string;
}

export function LocationSetupStep({
  onNext,
  onBack,
  data,
  setData,
}: LocationSetupStepProps) {
  debugLog.info('LocationSetupStep', 'Component rendered', data);
  const [locationCount, setLocationCount] = useState<number | null>(null);
  const [locations, setLocations] = useState<Location[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Smart branching based on provider count
  const vetCount = data.vetCount || 1;
  const isSolo = vetCount === 1;
  const isSmallPractice = vetCount >= 2 && vetCount <= 3;
  const isLargePractice = vetCount >= 4;

  // Auto-skip for solo providers (1 location auto-created)
  useEffect(() => {
    if (isSolo) {
      debugLog.info('LocationSetupStep', 'Solo mode detected, auto-skipping', { hasLocations: !!data.locations });

      // Ensure location exists
      if (!data.locations || data.locations.length === 0) {
        const autoLocation: Location = {
          id: '1',
          name: data.practiceName || 'Main Location',
          address: data.address,
          phone: data.phone,
        };
        setData({ ...data, locations: [autoLocation] });
      }

      // Auto-advance to next step
      debugLog.info('LocationSetupStep', 'Auto-advancing in 100ms');
      const timer = setTimeout(() => {
        debugLog.info('LocationSetupStep', 'Calling onNext() from auto-skip');
        onNext();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [isSolo]); // Only depend on isSolo to avoid infinite loops

  // Initialize locations array if needed
  useEffect(() => {
    // For large practices (4+ providers), initialize with one location immediately
    if (!data.locations && isLargePractice) {
      const initialLocation: Location = {
        id: '1',
        name: data.practiceName || 'Main Location',
        address: data.address,
        phone: data.phone,
      };
      setLocations([initialLocation]);
      return;
    }

    // For small practices, wait until locationCount is selected
    if (!data.locations && locationCount !== null) {
      const count = locationCount || 1;
      const initialLocations: Location[] = [
        {
          id: '1',
          name: data.practiceName || 'Main Location',
          address: data.address,
          phone: data.phone,
        },
      ];

      // Add additional empty locations
      for (let i = 2; i <= count; i++) {
        initialLocations.push({
          id: i.toString(),
          name: '',
          address: '',
          phone: '',
        });
      }

      setLocations(initialLocations);
    } else if (data.locations) {
      setLocations(data.locations);
    }
  }, [locationCount, data, isLargePractice]);

  const handleNext = () => {
    if (locationCount === null && isSmallPractice) {
      setErrors({ locationCount: 'Please select number of locations' });
      return;
    }

    // Validate location names
    const newErrors: Record<string, string> = {};
    locations.forEach((loc, idx) => {
      if (!loc.name?.trim()) {
        newErrors[`location-${idx}`] = 'Location name is required';
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setData({ ...data, locations });
    onNext();
  };

  const addLocation = () => {
    setLocations([
      ...locations,
      {
        id: (locations.length + 1).toString(),
        name: '',
        address: '',
        phone: '',
      },
    ]);
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter((loc) => loc.id !== id));
  };

  const updateLocation = (id: string, field: keyof Location, value: string) => {
    setLocations(
      locations.map((loc) =>
        loc.id === id ? { ...loc, [field]: value } : loc
      )
    );
  };

  // Small practice: ask how many locations
  if (isSmallPractice && locationCount === null) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-12">
        <div className="space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-2">Location Setup</h1>
            <p className="text-muted-foreground">
              How many practice locations do you have?
            </p>
          </div>

          <div>
            <Label htmlFor="locationCount">Number of Locations</Label>
            <Select
              value={locationCount !== null ? String(locationCount) : undefined}
              onValueChange={(value) => setLocationCount(parseInt(value))}
            >
              <SelectTrigger
                id="locationCount"
                className={errors.locationCount ? 'border-destructive' : ''}
              >
                <SelectValue placeholder="Select number of locations" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 location</SelectItem>
                <SelectItem value="2">2 locations</SelectItem>
                <SelectItem value="3">3 locations</SelectItem>
                <SelectItem value="4">4+ locations</SelectItem>
              </SelectContent>
            </Select>
            {errors.locationCount && (
              <p className="text-sm text-destructive mt-1">
                {errors.locationCount}
              </p>
            )}
          </div>

          <div className="flex justify-between">
            <Button onClick={onBack} variant="outline">
              Back
            </Button>
            <Button
              onClick={() => {
                if (!locationCount) {
                  setErrors({
                    locationCount: 'Please select number of locations',
                  });
                  return;
                }
                setErrors({});
              }}
            >
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Single location auto-skip already handled by useEffect
  if (isSolo) {
    return null;
  }

  // Multi-location form
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Set Up Your Locations</h1>
          <p className="text-muted-foreground">
            Add details for each practice location
          </p>
        </div>

        <div className="space-y-6">
          {locations.map((location, index) => (
            <div
              key={location.id}
              className="border rounded-lg p-6 space-y-4 relative"
            >
              {/* Remove button (except first location) */}
              {index > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2"
                  onClick={() => removeLocation(location.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}

              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium">
                  {index + 1}
                </div>
                <h3 className="font-semibold">
                  {index === 0 ? 'Main Location' : `Location ${index + 1}`}
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor={`location-name-${location.id}`}>
                    Location Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id={`location-name-${location.id}`}
                    placeholder="e.g., Downtown Clinic"
                    value={location.name}
                    onChange={(e) =>
                      updateLocation(location.id, 'name', e.target.value)
                    }
                    className={
                      errors[`location-${index}`] ? 'border-destructive' : ''
                    }
                  />
                  {errors[`location-${index}`] && (
                    <p className="text-sm text-destructive mt-1">
                      {errors[`location-${index}`]}
                    </p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor={`location-address-${location.id}`}>
                      Address
                    </Label>
                    <Input
                      id={`location-address-${location.id}`}
                      placeholder="123 Main St"
                      value={location.address || ''}
                      onChange={(e) =>
                        updateLocation(location.id, 'address', e.target.value)
                      }
                    />
                  </div>

                  <div>
                    <Label htmlFor={`location-phone-${location.id}`}>
                      Phone
                    </Label>
                    <Input
                      id={`location-phone-${location.id}`}
                      placeholder="(555) 123-4567"
                      value={location.phone || ''}
                      onChange={(e) =>
                        updateLocation(location.id, 'phone', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            onClick={addLocation}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Location
          </Button>
        </div>

        <div className="flex justify-between">
          <Button onClick={onBack} variant="outline">
            Back
          </Button>
          <Button onClick={handleNext}>Continue</Button>
        </div>
      </div>
    </div>
  );
}
