'use client';

import { useMemo, useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { useOrgCtx } from '@/app/providers/org-context-provider';
import { Layout } from '@/components/layout/Layout';
import { BillingGuard } from '@/components/billing/BillingGuard';
import { ClinicalChat } from '@/components/case-reasoning/ClinicalChat';
import { CaseReasoningSidebar } from '@/components/case-reasoning/CaseReasoningSidebar';
import { Loader2, PanelRightOpen } from 'lucide-react';

function CaseReasoningInner() {
  const { user } = useUser();
  const { orgContext } = useOrgCtx();
  const searchParams = useSearchParams();

  // Only read URL param once on mount, then ignore it
  const initializedRef = useRef(false);
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      return searchParams.get('encounterId');
    }
    return null;
  });

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Fetch encounters (org-scoped, fallback to provider)
  const orgConsultations = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext?.orgId
      ? { orgId: orgContext.orgId as Id<'organizations'> }
      : 'skip'
  );

  const vetConsultations = useQuery(
    api.encounters.getDraftConsultations,
    !orgContext?.orgId && user?.id
      ? { providerId: user.id }
      : 'skip'
  );

  const allConsultations = orgConsultations || vetConsultations;

  // Fetch patients for name lookup
  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext?.orgId
      ? { orgId: orgContext.orgId as Id<'organizations'> }
      : 'skip'
  );

  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext?.orgId && user?.id
      ? { providerId: user.id }
      : 'skip'
  );

  const patientMap = useMemo(() => {
    const patients = orgPatients || vetPatients;
    if (!patients) return new Map<string, { name: string; age?: string }>();
    const map = new Map<string, { name: string; age?: string }>();
    for (const p of patients) {
      map.set(p._id, { name: p.name, age: p.age });
    }
    return map;
  }, [orgPatients, vetPatients]);

  // Fetch detail for the selected encounter (for fact count + patient name)
  const selectedConsultation = useQuery(
    api.encounters.getById,
    selectedId ? { id: selectedId as Id<'encounters'> } : 'skip'
  );

  const selectedPatient = useQuery(
    api.patients.getPatientById,
    selectedConsultation?.patientId
      ? { id: selectedConsultation.patientId as Id<'patients'> }
      : 'skip'
  );

  const detail = useQuery(
    api.encounters.getConsultationDetail,
    selectedId ? { encounterId: selectedId as Id<'encounters'> } : 'skip'
  );

  const factCount = useMemo(() => {
    if (!detail?.recordings) return 0;
    const seenTexts = new Set<string>();
    if (detail.factReconciliation) {
      for (const rf of detail.factReconciliation.reconciledFacts) {
        const text = rf.resolution === 'keep-old' && rf.priorText ? rf.priorText : rf.text;
        seenTexts.add(text.toLowerCase().trim());
      }
    } else {
      for (const rec of detail.recordings) {
        if (rec.facts) {
          for (const fact of rec.facts) {
            seenTexts.add(fact.text.toLowerCase().trim());
          }
        }
      }
    }
    return seenTexts.size;
  }, [detail?.recordings, detail?.factReconciliation]);

  const patientName = selectedPatient?.name;
  const isLoading = allConsultations === undefined;

  // When a encounter is selected from sidebar, clear active session to start fresh
  const handleSelectConsultation = useCallback((id: string) => {
    console.log('[CaseReasoning] Switching to encounter:', id);
    setSelectedId(id);
    setActiveSessionId(null); // Clear active session when switching encounters
  }, []);

  // When a session is selected from sidebar, load it and optionally switch encounter
  const handleSelectSession = useCallback((sessionId: string, encounterId?: string) => {
    console.log('[CaseReasoning] Loading session:', sessionId, 'for encounter:', encounterId);
    setActiveSessionId(sessionId);
    if (encounterId !== undefined && encounterId !== selectedId) {
      setSelectedId(encounterId); // Switch encounter if different
    }
  }, [selectedId]);

  const handleNewSession = useCallback(() => {
    console.log('[CaseReasoning] Starting new session');
    setActiveSessionId(null);
  }, []);

  const handleSessionCreated = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
  }, []);

  return (
    <div className="fixed inset-0 left-0 sm:left-[60px] flex overflow-hidden bg-background">
      {/* Chat area — full height, scrollable */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {/* Floating sidebar toggle (only when sidebar is closed) */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-md border bg-background/80 backdrop-blur-sm hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shadow-sm"
            title="Open sidebar"
          >
            <PanelRightOpen className="h-4 w-4" />
          </button>
        )}

        {/* Centered chat container with max-width */}
        <div className="flex-1 flex justify-center min-h-0">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center max-w-3xl">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <div className="flex-1 w-full max-w-3xl min-h-0 flex flex-col">
              <ClinicalChat
                key={`consult-${selectedId ?? 'none'}`}
                encounterId={selectedId || undefined}
                patientName={patientName}
                factCount={factCount || undefined}
                sessionId={activeSessionId}
                onSessionCreated={handleSessionCreated}
                providerId={user?.id || ''}
                orgId={orgContext?.orgId as Id<'organizations'> | undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar — sticky, always mounted, animated open/close */}
      <CaseReasoningSidebar
        encounters={allConsultations as Array<{ _id: string; patientId: string; createdAt: string; interactionId?: string; status?: string }>}
        patientMap={patientMap}
        selectedConsultationId={selectedId}
        activeSessionId={activeSessionId}
        onSelectConsultation={handleSelectConsultation}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
        onClose={() => setSidebarOpen(false)}
        isOpen={sidebarOpen}
        providerId={user?.id || ''}
      />
    </div>
  );
}

export default function CaseReasoningPage() {
  return (
    <Layout>
      <BillingGuard feature="Case Reasoning">
        <Suspense fallback={
          <div className="flex justify-center items-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        }>
          <CaseReasoningInner />
        </Suspense>
      </BillingGuard>
    </Layout>
  );
}
