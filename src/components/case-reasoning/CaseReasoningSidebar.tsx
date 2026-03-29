'use client';

import * as React from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { X, Search, Plus, MessageSquare, Trash2, BrainCircuit } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConsultationItem {
  _id: string;
  patientId: string;
  createdAt: string;
  interactionId?: string;
  status?: string;
}

interface PatientInfo {
  name: string;
  age?: string;
  sex?: string;
}

export interface CaseReasoningSidebarProps {
  encounters: ConsultationItem[] | undefined;
  patientMap: Map<string, PatientInfo>;
  selectedConsultationId: string | null;
  activeSessionId: string | null;
  onSelectConsultation: (id: string) => void;
  onSelectSession: (sessionId: string, encounterId?: string) => void;
  onNewSession: () => void;
  onClose: () => void;
  isOpen: boolean;
  providerId: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CaseReasoningSidebar({
  encounters,
  patientMap,
  selectedConsultationId,
  activeSessionId,
  onSelectConsultation,
  onSelectSession,
  onNewSession,
  onClose,
  isOpen,
  providerId,
}: CaseReasoningSidebarProps) {
  const [search, setSearch] = React.useState('');

  // Fetch sessions for the selected encounter
  const consultationSessions = useQuery(
    api.caseReasoningSessions.getByConsultation,
    selectedConsultationId
      ? { encounterId: selectedConsultationId as Id<'encounters'> }
      : 'skip'
  );

  // Fetch general sessions (no encounter linked)
  const generalSessions = useQuery(
    api.caseReasoningSessions.getByVet,
    providerId ? { providerId } : 'skip'
  );

  const deleteSession = useMutation(api.caseReasoningSessions.deleteSession);

  // Filter encounters to those with recordings
  const filteredConsultations = React.useMemo(() => {
    if (!encounters) return [];
    const withRecordings = encounters
      .filter(c => c.interactionId && c.status !== 'draft')
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    if (!search.trim()) return withRecordings;
    const q = search.toLowerCase();
    return withRecordings.filter(c => {
      const p = patientMap.get(c.patientId);
      return p?.name.toLowerCase().includes(q);
    });
  }, [encounters, patientMap, search]);

  const selectedPatient = selectedConsultationId
    ? (() => {
        const c = encounters?.find(x => x._id === selectedConsultationId);
        return c ? patientMap.get(c.patientId) : null;
      })()
    : null;

  // ---------------------------------------------------------------------------
  // Session list renderer
  // ---------------------------------------------------------------------------

  const renderSessionList = (
    sessions: Array<{ _id: string; title?: string; updatedAt: string; encounterId?: string }> | undefined,
    label: string
  ) => (
    <>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <button
          onClick={onNewSession}
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
        {!sessions ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">Loading...</div>
        ) : sessions.length === 0 ? (
          <div className="px-2 py-1 text-xs text-muted-foreground">No sessions yet</div>
        ) : (
          sessions.map(s => {
            const isActive = activeSessionId === s._id;
            return (
              <div
                key={s._id}
                className={`
                  group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer
                  ${isActive
                    ? 'bg-primary/10 text-primary border border-primary/20'
                    : 'hover:bg-muted text-foreground border border-transparent'
                  }
                `}
                onClick={() => onSelectSession(s._id, s.encounterId || undefined)}
              >
                <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">
                  {s.title || 'New session'}
                </span>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {formatRelativeTime(s.updatedAt)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession({ sessionId: s._id as Id<'caseReasoningSessions'> });
                  }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  const sidebarContent = (
    <div className="flex flex-col h-full bg-background border-l w-[320px] overflow-hidden">
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b">
        <span className="text-sm font-semibold">Context</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-muted transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* General sessions section */}
      {generalSessions && generalSessions.length > 0 && (
        <div className="shrink-0 border-b max-h-[25%] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-1.5">
              <BrainCircuit className="h-3 w-3 text-muted-foreground" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                General
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-1.5 pb-2 space-y-0.5">
            {generalSessions.map(s => {
              const isActive = activeSessionId === s._id;
              return (
                <div
                  key={s._id}
                  className={`
                    group flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors cursor-pointer
                    ${isActive
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted text-foreground border border-transparent'
                    }
                  `}
                  onClick={() => onSelectSession(s._id)}
                >
                  <MessageSquare className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {s.title || 'General chat'}
                  </span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {formatRelativeTime(s.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession({ sessionId: s._id as Id<'caseReasoningSessions'> });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="shrink-0 px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search encounters..."
            className="w-full rounded-md border bg-background pl-8 pr-3 py-1.5 text-xs placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Encounters list */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="px-3 pt-2 pb-1">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Encounters
          </span>
        </div>
        {!encounters ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
        ) : filteredConsultations.length === 0 ? (
          <div className="px-3 py-2 text-xs text-muted-foreground">
            {search ? 'No matches' : 'No encounters with recordings'}
          </div>
        ) : (
          <div className="space-y-0.5 px-1.5 pb-2">
            {filteredConsultations.map(c => {
              const p = patientMap.get(c.patientId);
              const name = p?.name || 'Unknown';
              const date = formatShortDate(c.createdAt);
              const isSelected = selectedConsultationId === c._id;

              return (
                <button
                  key={c._id}
                  onClick={() => onSelectConsultation(c._id)}
                  className={`
                    w-full text-left rounded-md px-2.5 py-2 text-xs transition-colors
                    ${isSelected
                      ? 'bg-primary/10 text-primary border border-primary/20'
                      : 'hover:bg-muted text-foreground border border-transparent'
                    }
                  `}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{date}</span>
                  </div>
                  {(p?.age || p?.sex) && (
                    <span className="text-[10px] text-muted-foreground">
                      {p.age || ''}{p.sex ? ` · ${p.sex}` : ''}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sessions section for selected encounter */}
      {selectedConsultationId && (
        <div className="shrink-0 border-t max-h-[40%] flex flex-col">
          {renderSessionList(
            consultationSessions as Array<{ _id: string; title?: string; updatedAt: string; encounterId?: string }>,
            `Sessions${selectedPatient ? ` (${selectedPatient.name})` : ''}`
          )}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile backdrop — fades in/out */}
      <div
        className={`
          fixed inset-0 bg-black/30 z-40 lg:hidden
          transition-opacity duration-200
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
      />

      {/* Desktop: inline collapsible panel with width transition — sticky to viewport */}
      <div
        className={`
          hidden lg:block shrink-0 overflow-hidden h-screen sticky top-0
          transition-[width] duration-200 ease-in-out
          ${isOpen ? 'w-[320px]' : 'w-0'}
        `}
      >
        {sidebarContent}
      </div>

      {/* Mobile: slide-in overlay */}
      <div
        className={`
          lg:hidden fixed top-0 bottom-0 right-0 z-50
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        {sidebarContent}
      </div>
    </>
  );
}
