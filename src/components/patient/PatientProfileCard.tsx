'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Brain, AlertTriangle, ChevronDown, ChevronUp, Clock, RotateCw } from 'lucide-react';
import { useState } from 'react';

interface PatientProfileCardProps {
  patientId: Id<'patients'>;
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
  medium: 'bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  low: 'bg-gray-100 dark:bg-muted/40 text-gray-600 dark:text-muted-foreground border-gray-200 dark:border-border',
};

const PROBLEM_CHIP: Record<string, string> = {
  active: 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',
  chronic: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300',
  resolved: 'border-gray-300 dark:border-border bg-gray-50 dark:bg-muted/20 text-gray-400 dark:text-muted-foreground line-through',
};

export function PatientProfileCard({ patientId }: PatientProfileCardProps) {
  const profile = useQuery(api.patientProfiles.getByPatient, { patientId });
  const latestEncounter = useQuery(api.encounters.getLatestPublishedByPatient, { patientId });
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);
  const [careGapsExpanded, setCareGapsExpanded] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  const markProcessing = useMutation(api.patientProfiles.markProcessing);
  const buildProfile = useAction(api.patientProfiles.buildPatientProfile);

  async function handleRerun() {
    const enc = profile ?? null;
    const encounterId = enc ? enc.triggerEncounterId : latestEncounter?._id;
    const orgId = enc ? enc.orgId : latestEncounter?.orgId;
    if (!encounterId || !orgId || isRerunning) return;
    setIsRerunning(true);
    try {
      await markProcessing({ patientId, orgId, encounterId });
      await buildProfile({ patientId, orgId, encounterId });
    } finally {
      setIsRerunning(false);
    }
  }

  // Still loading from Convex
  if (profile === undefined) return null;

  // No profile yet
  if (profile === null) {
    const canGenerate = !!latestEncounter;
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
        <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">
          No clinical profile yet — will be generated after the first published encounter.
        </p>
        {canGenerate && (
          <button
            onClick={handleRerun}
            disabled={isRerunning}
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline disabled:opacity-50"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
            {isRerunning ? 'Generating…' : 'Generate now'}
          </button>
        )}
      </div>
    );
  }

  // Processing / loading state
  if (profile.buildStatus === 'processing') {
    return (
      <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm text-blue-700 dark:text-blue-400 font-medium">Updating clinical profile…</p>
        </div>
        <div className="mt-4 space-y-2">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className="h-3 rounded bg-blue-100 dark:bg-blue-900/40 animate-pulse" style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  const hasProblems = profile.activeProblems.length > 0;
  const hasMeds = profile.currentMedications.length > 0;
  const hasCareGaps = profile.careGaps.length > 0;
  const hasRiskFactors = profile.riskFactors.length > 0;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Clinical Profile</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Built from {profile.encounterCount} encounter{profile.encounterCount !== 1 ? 's' : ''}
          </span>
          {profile.buildStatus !== 'processing' && (
            <button
              onClick={handleRerun}
              disabled={isRerunning}
              className="text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
              title="Regenerate profile"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      <div className="divide-y divide-border">
        {/* Zone 1 — Narrative */}
        {profile.clinicalNarrative && (
          <div className="px-5 py-4">
            <button
              onClick={() => setNarrativeExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 hover:text-foreground transition-colors"
            >
              Summary
              {narrativeExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {narrativeExpanded && (
              <p className="text-sm text-foreground leading-relaxed">{profile.clinicalNarrative}</p>
            )}
          </div>
        )}

        {/* Zone 2 — Active Problems */}
        {hasProblems && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Active Problems</p>
            <div className="flex flex-wrap gap-2">
              {profile.activeProblems.map((p, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${PROBLEM_CHIP[p.status] ?? PROBLEM_CHIP.active}`}
                >
                  {p.condition}
                  {p.icd10Code && (
                    <span className="opacity-60 font-normal">· {p.icd10Code}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Zone 3 — Medications */}
        {hasMeds && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Current Medications</p>
            <ul className="space-y-1.5">
              {profile.currentMedications.map((m, i) => (
                <li key={i} className="text-sm text-foreground">
                  <span className="font-medium">{m.drug}</span>
                  {(m.dose || m.frequency) && (
                    <span className="text-muted-foreground">
                      {m.dose ? ` ${m.dose}` : ''}{m.frequency ? ` · ${m.frequency}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Zone 4 — Care Gaps (collapsed by default) */}
        {hasCareGaps && (
          <div className="px-5 py-3">
            <button
              onClick={() => setCareGapsExpanded(v => !v)}
              className="flex items-center justify-between w-full group"
            >
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide group-hover:text-foreground transition-colors">
                Care Gaps
              </span>
              <span className="flex items-center gap-1.5">
                <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold tabular-nums">
                  {profile.careGaps.length}
                </span>
                {careGapsExpanded ? (
                  <ChevronUp className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </span>
            </button>
            {careGapsExpanded && (
              <ul className="mt-3 space-y-1.5">
                {profile.careGaps.map((g, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${PRIORITY_BADGE[g.priority] ?? PRIORITY_BADGE.low}`}>
                      {g.priority}
                    </span>
                    <span className="text-sm text-foreground">{g.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Zone 5 — Footer */}
        <div className="px-5 py-3 bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Updated {new Date(profile.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
          {hasRiskFactors && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-3 w-3 text-amber-500" />
              <span>Risk factors: {profile.riskFactors.join(', ')}</span>
            </div>
          )}
          {profile.allergies.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <span className="font-medium">Allergies:</span>
              {profile.allergies.map(a => a.allergen).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
