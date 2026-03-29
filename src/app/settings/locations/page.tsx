'use client';

import * as React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { useUser } from '@clerk/nextjs';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Layout } from '@/components/layout/Layout';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { LocationDialog } from '@/components/locations/LocationDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  ArrowLeft,
  Star,
  Users,
  Stethoscope,
  CheckCircle2,
  X,
  Phone,
  MapPinIcon,
} from 'lucide-react';
import { AppLink } from '@/components/navigation/AppLink';
import { useSearchParams } from 'next/navigation';

export default function LocationsPage() {
  const { user } = useUser();
  const { orgContext, isLoading: orgLoading } = useOrgCtx();
  const searchParams = useSearchParams();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<any>(null);
  const [locationToDelete, setLocationToDelete] = React.useState<{ id: Id<'locations'>; name: string } | null>(null);
  const [deletingId, setDeletingId] = React.useState<Id<'locations'> | null>(null);
  const [showSuccessBanner, setShowSuccessBanner] = React.useState(
    searchParams.get('setup') === 'complete'
  );

  const locations = useQuery(
    api.locations.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const memberships = useQuery(
    api.memberships.getByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const patients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<'organizations'> } : 'skip'
  );

  const deleteLocation = useMutation(api.locations.remove);

  const locationStats = React.useMemo(() => {
    if (!locations || !memberships || !patients) return new Map();
    const statsMap = new Map();
    locations.forEach((location) => {
      const teamCount = memberships.filter(
        (m) => m.status === 'active' && m.locationIds?.includes(location._id)
      ).length;
      const patientCount = patients.filter(
        (p) => p.locationId === location._id && p.isActive
      ).length;
      statsMap.set(location._id, { teamCount, patientCount });
    });
    return statsMap;
  }, [locations, memberships, patients]);

  const handleDelete = async (id: Id<'locations'>) => {
    if (!user?.id) return;
    setDeletingId(id);
    try {
      await deleteLocation({ userId: user.id, id });
    } catch (err) {
      console.error(err instanceof Error ? err.message : 'Failed to delete location');
    } finally {
      setDeletingId(null);
      setLocationToDelete(null);
    }
  };

  const handleEdit = (location: any) => {
    setEditingLocation(location);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingLocation(null);
    setDialogOpen(true);
  };

  if (orgLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Success Banner */}
        {showSuccessBanner && (
          <div className="mb-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 border border-green-200/50 dark:border-green-800/50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-900 dark:text-green-100">Setup Complete! 🎉</p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">
                  Your multi-location practice is ready. You can now manage locations, assign team members, and track performance across all your clinics.
                </p>
              </div>
              <button
                onClick={() => setShowSuccessBanner(false)}
                className="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <AppLink
            href="/settings"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Settings
          </AppLink>

          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">Practice Locations</h1>
              <p className="text-muted-foreground mt-2">
                Manage your practice locations, view stats, and organise your team
              </p>
            </div>
            {orgContext?.canManageTeam && (
              <button
                onClick={handleAdd}
                className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors shadow-sm flex-shrink-0"
              >
                <Plus className="h-4 w-4" />
                Add Location
              </button>
            )}
          </div>

          {/* Summary Stats */}
          {locations && locations.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{locations.length}</p>
                    <p className="text-xs text-muted-foreground">Active Locations</p>
                  </div>
                </div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{memberships?.filter((m) => m.status === 'active').length || 0}</p>
                    <p className="text-xs text-muted-foreground">Team Members</p>
                  </div>
                </div>
              </div>
              <div className="border border-border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Stethoscope className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{patients?.filter((p) => p.isActive).length || 0}</p>
                    <p className="text-xs text-muted-foreground">Active Patients</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Locations List */}
        <div className="space-y-4">
          {!locations || locations.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="Set up your locations"
              description="Manage multiple practice locations to organise your team and track data by clinic."
              features={[
                'Track patients and encounters by location',
                'Assign team members to specific locations',
                'View location-specific analytics and performance',
                'Manage location details and contact information',
              ]}
              action={
                orgContext?.canManageTeam
                  ? { label: 'Create First Location', onClick: handleAdd }
                  : undefined
              }
              size="large"
            />
          ) : (
            locations.map((location) => {
              const stats = locationStats.get(location._id);
              const isDeleting = deletingId === location._id;

              return (
                <AppLink key={location._id} href={`/settings/locations/${location._id}`} className="block">
                  <div className="group relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer">
                    {/* Hover gradient */}
                    <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div className="relative p-6">
                      <div className="flex items-start justify-between gap-4">
                        {/* Main Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <MapPin className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-lg font-semibold truncate">{location.name}</h3>
                                {location.isDefault && (
                                  <span className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 px-2 py-1 rounded-md font-medium flex-shrink-0">
                                    <Star className="h-3 w-3 fill-current" />
                                    Default
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                                {location.address && (
                                  <div className="flex items-center gap-1.5">
                                    <MapPinIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span className="truncate">{location.address}</span>
                                  </div>
                                )}
                                {location.phone && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3.5 w-3.5 flex-shrink-0" />
                                    <span>{location.phone}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="flex items-center gap-6 mt-4 pt-4 border-t">
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                <Users className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{stats?.teamCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  Team {stats?.teamCount === 1 ? 'Member' : 'Members'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold">{stats?.patientCount || 0}</p>
                                <p className="text-xs text-muted-foreground">
                                  {stats?.patientCount === 1 ? 'Patient' : 'Patients'}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Actions — always visible, not hover-only */}
                        {orgContext?.canManageTeam && (
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleEdit(location); }}
                              className="p-2.5 hover:bg-accent rounded-lg transition-colors"
                              title="Edit location"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            {!location.isDefault && (
                              <button
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setLocationToDelete({ id: location._id, name: location.name }); }}
                                disabled={isDeleting}
                                className="p-2.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-colors disabled:opacity-50"
                                title="Delete location"
                              >
                                {isDeleting
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <Trash2 className="h-4 w-4" />
                                }
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AppLink>
              );
            })
          )}
        </div>

        {/* Location Dialog */}
        {dialogOpen && orgContext && (
          <LocationDialog
            orgId={orgContext.orgId}
            location={editingLocation}
            onClose={() => { setDialogOpen(false); setEditingLocation(null); }}
            onSuccess={() => {}}
          />
        )}

        {/* Delete confirmation */}
        <AlertDialog open={!!locationToDelete} onOpenChange={(open) => { if (!open) setLocationToDelete(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete location?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{locationToDelete?.name}</strong> will be permanently deleted. Team members assigned here will need to be reassigned. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => locationToDelete && handleDelete(locationToDelete.id)}
              >
                Delete location
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
