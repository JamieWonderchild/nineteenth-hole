'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, MapPin } from 'lucide-react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

interface LocationSetupStepProps {
  onNext: () => void;
  onBack: () => void;
  data: any;
  setData: (data: any) => void;
}

interface Location {
  _id?: Id<'locations'>;
  id: string;
  name: string;
  address?: string;
  phone?: string;
  isDefault?: boolean;
  isNew?: boolean;
}

export function LocationSetupStep({
  onNext,
  data,
  setData,
}: LocationSetupStepProps) {
  const { user } = useUser();
  const [locations, setLocations] = useState<Location[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const orgId = data.orgId as Id<'organizations'> | undefined;

  // Load existing locations
  const existingLocations = useQuery(
    api.locations.getByOrg,
    orgId ? { orgId } : 'skip'
  );

  const createLocation = useMutation(api.locations.create);
  const updateLocation = useMutation(api.locations.update);

  // Initialize locations from existing data
  useEffect(() => {
    if (existingLocations && locations.length === 0) {
      setLocations(
        existingLocations.map((loc) => ({
          _id: loc._id,
          id: loc._id,
          name: loc.name,
          address: loc.address,
          phone: loc.phone,
          isDefault: loc.isDefault,
          isNew: false,
        }))
      );
    }
  }, [existingLocations, locations.length]);

  const handleNext = async () => {
    if (!orgId || !user?.id) return;

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

    try {
      // Save all locations (create new ones, update existing)
      for (const loc of locations) {
        if (loc.isNew) {
          // Create new location
          await createLocation({
            userId: user.id,
            orgId,
            name: loc.name,
            address: loc.address,
            phone: loc.phone,
            isDefault: false,
          });
        } else if (loc._id) {
          // Update existing location
          await updateLocation({
            userId: user.id,
            id: loc._id,
            name: loc.name,
            address: loc.address,
            phone: loc.phone,
          });
        }
      }

      setData({ ...data, locationsUpdated: true });
      onNext();
    } catch (error) {
      console.error('Failed to save locations:', error);
      setErrors({ general: 'Failed to save locations. Please try again.' });
    }
  };

  const addLocation = () => {
    const newId = `new-${Date.now()}`;
    setLocations([
      ...locations,
      {
        id: newId,
        name: '',
        address: '',
        phone: '',
        isNew: true,
      },
    ]);
  };

  const removeLocation = (id: string) => {
    setLocations(locations.filter((loc) => loc.id !== id));
  };

  const updateLocationField = (
    id: string,
    field: keyof Location,
    value: string
  ) => {
    setLocations(
      locations.map((loc) =>
        loc.id === id ? { ...loc, [field]: value } : loc
      )
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-6 w-6 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold mb-2">Set Up Your Locations</h1>
          <p className="text-muted-foreground">
            Review and add practice locations for your multi-location setup
          </p>
        </div>

        {errors.general && (
          <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm">
            {errors.general}
          </div>
        )}

        <div className="space-y-6">
          {locations.map((location, index) => (
            <div
              key={location.id}
              className="border rounded-lg p-6 space-y-4 relative"
            >
              {/* Remove button (except default location) */}
              {!location.isDefault && (
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
                <div>
                  <h3 className="font-semibold">
                    {location.isDefault ? 'Main Location' : `Location ${index + 1}`}
                  </h3>
                  {location.isDefault && (
                    <p className="text-xs text-muted-foreground">Default</p>
                  )}
                </div>
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
                      updateLocationField(location.id, 'name', e.target.value)
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
                        updateLocationField(location.id, 'address', e.target.value)
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
                        updateLocationField(location.id, 'phone', e.target.value)
                      }
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}

          <Button variant="outline" onClick={addLocation} className="w-full">
            <Plus className="h-4 w-4 mr-2" />
            Add Another Location
          </Button>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleNext} size="lg">
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}
