'use client';

import { useQuery } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Brain, AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { useState } from 'react';

interface PatientProfileCardProps {
  patientId: Id<'patients'>;
}

const PRIORITY_BADGE: Record<string, string> = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-gray-100 text-gray-600 border-gray-200',
};

const PROBLEM_CHIP: Record<string, string> = {
  active: 'border-amber-400 bg-amber-50 text-amber-800',
  chronic: 'border-blue-400 bg-blue-50 text-blue-800',
  resolved: 'border-gray-300 bg-gray-50 text-gray-400 line-through',
};

export function PatientProfileCard({ patientId }: PatientProfileCardProps) {
  const profile = useQuery(api.patientProfiles.getByPatient, { patientId });
  const [narrativeExpanded, setNarrativeExpanded] = useState(true);

  // Still loading from Convex
  if (profile === undefined) return null;

  // No profile yet
  if (profile === null) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <Brain className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">
          No clinical profile yet — will be generated after the first published encounter.
        </p>
      </div>
    );
  }

  // Processing / loading state
  if (profile.buildStatus === 'processing') {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-6">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
          <p className="text-sm text-blue-700 font-medium">Updating clinical profile…</p>
        </div>
        <div className="mt-4 space-y-2">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className={`h-3 rounded bg-blue-100 animate-pulse`} style={{ width: `${w}%` }} />
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
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-gray-50/60">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold text-gray-800">Clinical Profile</span>
        </div>
        <span className="text-xs text-muted-foreground">
          Built from {profile.encounterCount} encounter{profile.encounterCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="divide-y divide-gray-100">
        {/* Zone 1 — Narrative */}
        {profile.clinicalNarrative && (
          <div className="px-5 py-4">
            <button
              onClick={() => setNarrativeExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 hover:text-gray-700 transition-colors"
            >
              Summary
              {narrativeExpanded ? (
                <ChevronUp className="h-3 w-3" />
              ) : (
                <ChevronDown className="h-3 w-3" />
              )}
            </button>
            {narrativeExpanded && (
              <p className="text-sm text-gray-700 leading-relaxed">{profile.clinicalNarrative}</p>
            )}
          </div>
        )}

        {/* Zone 2 — Active Problems */}
        {hasProblems && (
          <div className="px-5 py-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Active Problems</p>
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

        {/* Zone 3 — Medications + Care Gaps */}
        {(hasMeds || hasCareGaps) && (
          <div className="px-5 py-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Medications */}
            {hasMeds && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Current Medications</p>
                <ul className="space-y-1.5">
                  {profile.currentMedications.map((m, i) => (
                    <li key={i} className="text-sm text-gray-700">
                      <span className="font-medium">{m.drug}</span>
                      {(m.dose || m.frequency) && (
                        <span className="text-gray-500">
                          {m.dose ? ` ${m.dose}` : ''}{m.frequency ? ` · ${m.frequency}` : ''}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Care Gaps */}
            {hasCareGaps && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Care Gaps</p>
                <ul className="space-y-1.5">
                  {profile.careGaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={`mt-0.5 inline-flex px-1.5 py-0.5 rounded border text-[10px] font-semibold uppercase ${PRIORITY_BADGE[g.priority] ?? PRIORITY_BADGE.low}`}>
                        {g.priority}
                      </span>
                      <span className="text-sm text-gray-700">{g.description}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Zone 4 — Footer */}
        <div className="px-5 py-3 bg-gray-50/60 flex flex-wrap items-center gap-x-4 gap-y-1">
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
            <div className="flex items-center gap-1.5 text-xs text-red-600">
              <span className="font-medium">Allergies:</span>
              {profile.allergies.map(a => a.allergen).join(', ')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
