'use client';

import { useQuery, useMutation, useAction } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Brain, RotateCw, Clock } from 'lucide-react';
import { useState } from 'react';

interface PatientProfileCardProps {
  patientId: Id<'patients'>;
  embedded?: boolean; // strips outer card chrome when rendered inside PatientHeader
}

const PROBLEM_CHIP: Record<string, string> = {
  active: 'border-amber-400 dark:border-amber-600 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',
  chronic: 'border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300',
  resolved: 'border-gray-300 dark:border-border bg-gray-50 dark:bg-muted/20 text-gray-400 dark:text-muted-foreground line-through',
};

export function PatientProfileCard({ patientId, embedded = false }: PatientProfileCardProps) {
  const profile = useQuery(api.patientProfiles.getByPatient, { patientId });
  const latestEncounter = useQuery(api.encounters.getLatestPublishedByPatient, { patientId });
  const [isRerunning, setIsRerunning] = useState(false);

  const markProcessing = useMutation(api.patientProfiles.markProcessing);
  const buildProfile = useAction(api.patientProfiles.buildPatientProfile);

  async function handleRerun() {
    const encounterId = profile?.triggerEncounterId ?? latestEncounter?._id;
    const orgId = profile?.orgId ?? latestEncounter?.orgId;
    if (!encounterId || !orgId || isRerunning) return;
    setIsRerunning(true);
    try {
      await markProcessing({ patientId, orgId, encounterId });
      await buildProfile({ patientId, orgId, encounterId });
    } finally {
      setIsRerunning(false);
    }
  }

  if (profile === undefined) return null;

  if (profile === null) {
    const canGenerate = !!latestEncounter;
    return (
      <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-3">
        <Brain className="h-8 w-8 text-muted-foreground/30 mx-auto" />
        <p className="text-sm text-muted-foreground">
          No clinical profile yet — generated after the first published encounter.
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
  const hasSections = profile.summarySections && profile.summarySections.length > 0;

  const profileMeta = (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-1.5">
        <Clock className="h-3 w-3" />
        {new Date(profile.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
      </div>
      <span>{profile.encounterCount} encounter{profile.encounterCount !== 1 ? 's' : ''}</span>
      {profile.buildStatus !== 'processing' && (
        <button onClick={handleRerun} disabled={isRerunning}
          className="text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
          title="Regenerate profile">
          <RotateCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
        </button>
      )}
    </div>
  );

  const content = (
    <div className="divide-y divide-border">
      {/* Profile meta row — only shown when not embedded (embedded header handles spacing) */}
      {!embedded && (
        <div className="flex items-center justify-between px-5 py-3 bg-muted/40">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Clinical Profile</span>
          </div>
          {profileMeta}
        </div>
      )}
        {/* Summary sections (structured) */}
        {hasSections && (
          <div className="px-5 py-4 space-y-3">
            {profile.summarySections!.map((section, i) => (
              <div key={i}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                  {section.title}
                </p>
                <p className="text-sm text-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        )}

        {/* Fallback: legacy clinicalNarrative */}
        {!hasSections && profile.clinicalNarrative && (
          <div className="px-5 py-4">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Summary</p>
            <p className="text-sm text-foreground leading-relaxed">{profile.clinicalNarrative}</p>
          </div>
        )}

        {/* Active Problems */}
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

        {/* Medications */}
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

        {/* Allergies + risk factors footer */}
        <div className="px-5 py-3 bg-muted/40 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {profile.allergies.length > 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                <span className="font-medium">Allergies:</span>
                {profile.allergies.map(a => a.allergen).join(', ')}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">No known allergies</span>
            )}
            {profile.riskFactors.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Risk: {profile.riskFactors.join(', ')}
              </span>
            )}
          </div>
          {embedded && profileMeta}
        </div>
      </div>
  );

  if (embedded) return content;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {content}
    </div>
  );
}
