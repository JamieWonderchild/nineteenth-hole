'use client';

import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PlusCircle, Users, ChevronRight, ArrowUpDown } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from 'convex/_generated/api';
import { useAuth } from "@clerk/nextjs";
import { useAppRouter } from '@/hooks/useAppRouter';
import { toast } from "@/hooks/use-toast";
import { useOrgCtx } from "@/app/providers/org-context-provider";
import { ConvexPatient, transformPatientData } from '@/lib/types/patient';
import { SearchBar } from './components/SearchBar';
import { PatientDetailsDialog } from './components/PatientDetailsDialog';
import { Id } from 'convex/_generated/dataModel';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { cn } from '@/lib/utils';

export default function PatientRecordsPage() {
  const router = useAppRouter();
  const { userId } = useAuth();
  const { orgContext } = useOrgCtx();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'alpha'>('recent');
  const [selectedPatientId, setSelectedPatientId] = useState<Id<"patients"> | null>(null);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const createPatient = useMutation(api.patients.createPatient);
  const catchUp = useAction(api.patientProfiles.catchUpPatientProfiles);

  // Once per session (6h cooldown): catch up any patients missing or with stale profiles
  useEffect(() => {
    if (!orgContext?.orgId) return;
    const key = `profile_catchup_${orgContext.orgId}`;
    const last = localStorage.getItem(key);
    if (last && Date.now() - Number(last) < 6 * 60 * 60 * 1000) return;
    localStorage.setItem(key, Date.now().toString());
    catchUp({ orgId: orgContext.orgId as Id<"organizations"> }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgContext?.orgId]);

  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext ? { providerId: userId ?? "" } : 'skip'
  );
  const patients = orgPatients ?? vetPatients;

  const filteredPatients = (patients as ConvexPatient[] | undefined)?.filter(patient => {
    return patient.name.toLowerCase().includes(searchQuery.toLowerCase());
  }) ?? [];

  const sortedPatients = [...filteredPatients]
    .map(transformPatientData)
    .sort((a, b) => {
      if (sortBy === 'alpha') return a.name.localeCompare(b.name);
      if (!a.lastVisit && !b.lastVisit) return a.name.localeCompare(b.name);
      if (!a.lastVisit) return 1;
      if (!b.lastVisit) return -1;
      return new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime();
    });

  const handleCreatePatient = async () => {
    if (!newName.trim() || !userId) return;
    setCreating(true);
    try {
      const id = await createPatient({
        name: newName.trim(),
        providerId: userId,
        orgId: orgContext?.orgId as Id<"organizations"> | undefined,
      });
      setNewPatientOpen(false);
      setNewName('');
      toast({ title: 'Patient created', description: `${newName.trim()} has been added.` });
      router.push(`/patient-records/${id}`);
    } catch (error) {
      console.error('Create patient error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create patient.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const formatLastVisit = (lastVisit?: string) => {
    if (!lastVisit) return null;
    const date = new Date(lastVisit);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 30) return `${diffDays}d ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  return (
    <Layout>
      <BillingGuard feature="Patient Records">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold leading-none">Patient Records</h1>
                {patients !== undefined && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {sortedPatients.length}{' '}
                    {sortedPatients.length === 1 ? 'patient' : 'patients'}
                    {searchQuery && patients.length !== sortedPatients.length
                      ? ` of ${patients.length}`
                      : ''}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={() => setNewPatientOpen(true)} className="w-full sm:w-auto">
              <PlusCircle className="w-4 h-4 mr-2" />
              New Patient
            </Button>
          </div>

          {/* Search + sort */}
          <div className="flex gap-2">
            <SearchBar searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 gap-1.5 text-xs h-10 px-3"
              onClick={() => setSortBy(s => s === 'recent' ? 'alpha' : 'recent')}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === 'recent' ? 'Recent' : 'A–Z'}
            </Button>
          </div>

          {/* List */}
          <div>
            {patients === undefined ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-gray-200 rounded-full border-t-primary" />
              </div>
            ) : sortedPatients.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <Users className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                <p className="text-muted-foreground">No patients found</p>
                {searchQuery && (
                  <p className="text-sm text-muted-foreground/60">Try adjusting your search</p>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="p-0">
                  {sortedPatients.map((patient, idx) => {
                    const subline = [patient.age, patient.sex].filter(Boolean).join(' · ');
                    const lastVisit = formatLastVisit(patient.lastVisit);

                    return (
                      <div
                        key={patient._id}
                        className={cn(
                          'flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-muted/50 transition-colors',
                          idx > 0 && 'border-t'
                        )}
                        onClick={() => router.push(`/patient-records/${patient._id}`)}
                      >
                        {/* Avatar initials */}
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {patient.name.charAt(0).toUpperCase()}
                          </span>
                        </div>

                        {/* Name + demographics */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{patient.name}</p>
                          {subline && (
                            <p className="text-xs text-muted-foreground truncate">{subline}</p>
                          )}
                        </div>

                        {/* Last visit + chevron */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {lastVisit && (
                            <span className="text-xs text-muted-foreground tabular-nums">{lastVisit}</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>

          <PatientDetailsDialog
            patientId={selectedPatientId}
            onClose={() => setSelectedPatientId(null)}
          />

          {/* New patient dialog */}
          <Dialog open={newPatientOpen} onOpenChange={setNewPatientOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>New Patient</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="Patient name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreatePatient()}
                    autoFocus
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={handleCreatePatient}
                  disabled={!newName.trim() || creating}
                >
                  {creating ? 'Creating...' : 'Create Patient'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

        </div>
      </BillingGuard>
    </Layout>
  );
}
