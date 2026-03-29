'use client';

import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DraftConsultationCard } from '@/components/encounter/DraftConsultationCard';
import { PublishedConsultationCard } from '@/components/encounter/PublishedConsultationCard';
import { CreateDraftDialog } from '@/components/encounter/CreateDraftDialog';
import { AddAddendumDialog } from '@/components/encounter/AddAddendumDialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Stethoscope, Plus, Mic, Loader2, FileCheck, Search } from 'lucide-react';
import { useAppRouter } from '@/hooks/useAppRouter';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { toast } from '@/hooks/use-toast';
import type { Id } from 'convex/_generated/dataModel';

const PUBLISHED_PAGE_SIZE = 10;

export default function ConsultationPage() {
  const { user } = useUser();
  const { orgContext } = useOrgCtx();
  const router = useAppRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDraft, setShowCreateDraft] = useState(false);
  const [showQuickRecord, setShowQuickRecord] = useState(false);
  const [addendumConsultationId, setAddendumConsultationId] = useState<string | null>(null);
  const [publishedLimit, setPublishedLimit] = useState(PUBLISHED_PAGE_SIZE);

  const deleteDraft = useMutation(api.encounters.deleteDraftConsultation);

  const drafts = useQuery(
    api.encounters.getDraftConsultations,
    user?.id
      ? { providerId: user.id, orgId: orgContext?.orgId as Id<'organizations'> | undefined }
      : 'skip'
  );

  const published = useQuery(
    api.encounters.getPublishedConsultations,
    user?.id
      ? { providerId: user.id, orgId: orgContext?.orgId as Id<'organizations'> | undefined, limit: publishedLimit }
      : 'skip'
  );

  const handleDeleteDraft = async (encounterId: string) => {
    try {
      await deleteDraft({ encounterId: encounterId as Id<'encounters'> });
      toast({ title: 'Draft deleted' });
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete draft',
        variant: 'destructive',
      });
    }
  };

  // Client-side search across both sections
  const query = searchQuery.toLowerCase();
  const filteredDrafts = drafts?.filter(d =>
    !query ||
    d.patientName?.toLowerCase().includes(query) ||
    d.reasonForVisit?.toLowerCase().includes(query)
  );
  const filteredPublished = published?.filter(p =>
    !query ||
    p.patientName?.toLowerCase().includes(query) ||
    p.reasonForVisit?.toLowerCase().includes(query)
  );

  const hasResults = (filteredDrafts?.length ?? 0) + (filteredPublished?.length ?? 0) > 0;
  const isSearching = !!searchQuery;
  const canShowMore = published?.length === publishedLimit;

  return (
    <Layout>
      <BillingGuard feature="Encounters">
        <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Encounters</h1>
                <p className="text-sm text-muted-foreground">
                  Record, document, and share encounters
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setShowCreateDraft(true)}>
                <Plus className="h-4 w-4" />
                New Draft
              </Button>
              <Button
                className="gap-2"
                onClick={() => {
                  if (drafts && drafts.length > 0) {
                    setShowQuickRecord(true);
                  } else {
                    router.push('/encounter/new');
                  }
                }}
              >
                <Mic className="h-4 w-4" />
                Quick Record
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by patient or visit reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* No results state */}
          {isSearching && drafts !== undefined && published !== undefined && !hasResults && (
            <div className="text-center py-10 text-sm text-muted-foreground">
              No encounters found for &ldquo;{searchQuery}&rdquo;
            </div>
          )}

          {/* Section 1: Drafts & In Progress */}
          {(!isSearching || (filteredDrafts?.length ?? 0) > 0) && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Drafts & In Progress
                {filteredDrafts && filteredDrafts.length > 0 && (
                  <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                    {filteredDrafts.length}
                  </span>
                )}
              </h2>

              {drafts === undefined ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : filteredDrafts && filteredDrafts.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredDrafts.map((draft) => (
                    <DraftConsultationCard
                      key={draft._id}
                      encounterId={draft._id}
                      patientName={draft.patientName}
                      patientAge={draft.patientAge}
                      recordingCount={draft.recordingCount}
                      factCount={draft.factCount}
                      evidenceCount={draft.evidenceCount}
                      reasonForVisit={draft.reasonForVisit}
                      appointmentTime={draft.appointmentTime}
                      status={draft.status}
                      createdAt={draft.createdAt}
                      updatedAt={draft.updatedAt}
                      onDelete={handleDeleteDraft}
                    />
                  ))}
                </div>
              ) : !isSearching ? (
                <div className="text-center py-8 space-y-2">
                  <p className="text-sm text-muted-foreground">
                    No upcoming encounters. Create a draft to prep your next appointment.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => setShowCreateDraft(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create Draft
                  </Button>
                </div>
              ) : null}
            </div>
          )}

          {/* Section 2: Recent Published */}
          {(!isSearching || (filteredPublished?.length ?? 0) > 0) && (
            <div className="space-y-3">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileCheck className="h-3.5 w-3.5" />
                Recent Published
                {filteredPublished && filteredPublished.length > 0 && (
                  <span className="ml-1 text-xs bg-muted px-1.5 py-0.5 rounded-full normal-case tracking-normal">
                    {filteredPublished.length}
                  </span>
                )}
              </h2>

              {published === undefined ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPublished && filteredPublished.length > 0 ? (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {filteredPublished.map((pub) => (
                      <PublishedConsultationCard
                        key={pub._id}
                        encounterId={pub._id}
                        patientId={pub.patientId}
                        patientName={pub.patientName}
                        date={pub.date}
                        publishedAt={pub.publishedAt}
                        recordingCount={pub.recordingCount}
                        factCount={pub.factCount}
                        documentCount={pub.documentCount}
                        hasCompanion={pub.hasCompanion}
                        companionActive={pub.companionActive}
                        companionAccessToken={pub.companionAccessToken}
                        addendaCount={pub.addendaCount}
                        reasonForVisit={pub.reasonForVisit}
                        onAddAddendum={(id) => setAddendumConsultationId(id)}
                      />
                    ))}
                  </div>
                  {!isSearching && canShowMore && (
                    <div className="text-center pt-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-muted-foreground"
                        onClick={() => setPublishedLimit(l => l + PUBLISHED_PAGE_SIZE)}
                      >
                        Show more
                      </Button>
                    </div>
                  )}
                </>
              ) : !isSearching ? (
                <div className="text-center py-6">
                  <p className="text-sm text-muted-foreground">No published encounters yet.</p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <CreateDraftDialog open={showCreateDraft} onOpenChange={setShowCreateDraft} />

        {addendumConsultationId && (
          <AddAddendumDialog
            open={!!addendumConsultationId}
            onOpenChange={(open) => { if (!open) setAddendumConsultationId(null) }}
            encounterId={addendumConsultationId}
          />
        )}

        <Dialog open={showQuickRecord} onOpenChange={setShowQuickRecord}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Mic className="h-5 w-5 text-primary" />
                Quick Record
              </DialogTitle>
              <DialogDescription>
                Add a recording to an existing draft, or start fresh.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-2">
              {drafts?.map((draft) => (
                <button
                  key={draft._id}
                  className="w-full text-left px-3 py-2.5 rounded-lg border hover:bg-accent transition-colors"
                  onClick={() => {
                    setShowQuickRecord(false);
                    router.push(`/encounter/new?encounterId=${draft._id}`);
                  }}
                >
                  <span className="text-sm font-medium">
                    {draft.patientName || 'No patient'}
                  </span>
                  {draft.reasonForVisit && (
                    <p className="text-xs text-muted-foreground truncate">{draft.reasonForVisit}</p>
                  )}
                </button>
              ))}
              <div className="pt-1 border-t">
                <button
                  className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-accent transition-colors flex items-center gap-2 text-sm text-muted-foreground"
                  onClick={() => {
                    setShowQuickRecord(false);
                    router.push('/encounter/new');
                  }}
                >
                  <Plus className="h-4 w-4" />
                  New encounter
                </button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </BillingGuard>
    </Layout>
  );
}
