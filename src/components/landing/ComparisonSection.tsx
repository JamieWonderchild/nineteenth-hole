'use client';

import { Check, Minus, X, Sparkles } from 'lucide-react';

// ─── Data types ───────────────────────────────────────────────────────────────

type CellValue = 'yes' | 'partial' | 'no' | string; // string = custom label

type ComparisonRow = {
  feature: string;
  tooltip?: string;
  vetaiOnly?: boolean; // shows "Only [PRODUCT_NAME]" badge
  vetai: CellValue;
  scribenote: CellValue;
  vetrec: CellValue;
  talkatoo: CellValue;
  digitail: CellValue;
};

type Category = {
  name: string;
  rows: ComparisonRow[];
};

// ─── Comparison data ──────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  {
    name: 'AI Documentation',
    rows: [
      {
        feature: 'AI-generated SOAP notes',
        vetai: 'yes', scribenote: 'yes', vetrec: 'yes', talkatoo: 'yes', digitail: 'yes',
      },
      {
        feature: 'Real-time fact extraction',
        vetai: 'yes', scribenote: 'yes', vetrec: 'yes', talkatoo: 'partial', digitail: 'yes',
      },
      {
        feature: 'Multiple recordings per visit',
        tooltip: 'Record pre-consult, during exam, and follow-up — all merged into one encounter',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Cross-recording fact reconciliation',
        tooltip: 'AI detects contradictions across recordings and lets you resolve them before generating documents',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Prior encounter context',
        tooltip: 'Inject a patient\'s history from past visits into the current document generation',
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'partial',
      },
    ],
  },
  {
    name: 'Generated Documents',
    rows: [
      {
        feature: 'SOAP note',
        vetai: 'yes', scribenote: 'yes', vetrec: 'yes', talkatoo: 'yes', digitail: 'yes',
      },
      {
        feature: 'Patient summary & discharge instructions',
        vetai: 'yes', scribenote: 'yes', vetrec: 'yes', talkatoo: 'yes', digitail: 'yes',
      },
      {
        feature: 'Prescription document',
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'yes',
      },
      {
        feature: 'Referral letter',
        vetai: 'yes', scribenote: 'no', vetrec: 'yes', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Lab order',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Follow-up plan',
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'partial',
      },
      {
        feature: 'Total document types',
        vetai: '7 types', scribenote: '3–4', vetrec: '6+', talkatoo: '3', digitail: '4',
      },
    ],
  },
  {
    name: 'Clinical AI',
    rows: [
      {
        feature: 'Differential diagnosis support',
        vetai: 'yes', scribenote: 'partial', vetrec: 'yes', talkatoo: 'partial', digitail: 'partial',
      },
      {
        feature: 'Drug interaction checking',
        tooltip: 'Powered by DrugBank — flags contraindications and patient-specific dosing concerns',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Multi-turn AI clinical chat',
        vetai: 'yes', scribenote: 'partial', vetrec: 'yes', talkatoo: 'partial', digitail: 'partial',
      },
      {
        feature: 'Medical literature references',
        tooltip: 'Surfaces relevant PubMed studies with PMID links during case reasoning',
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
    ],
  },
  {
    name: 'Patient Communication',
    rows: [
      {
        feature: 'Patient summary (text / PDF)',
        vetai: 'yes', scribenote: 'yes', vetrec: 'yes', talkatoo: 'yes', digitail: 'yes',
      },
      {
        feature: 'Interactive AI companion for patients',
        tooltip: 'A shareable AI the patient can actually chat with — answers questions about medications, care, and warning signs',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Shareable visit link (no app download)',
        vetaiOnly: true,
        vetai: 'yes', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Patient mobile app',
        vetai: 'no', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'yes',
      },
    ],
  },
  {
    name: 'Practice Management',
    rows: [
      {
        feature: 'Multi-provider team management',
        vetai: 'yes', scribenote: 'partial', vetrec: 'yes', talkatoo: 'no', digitail: 'yes',
      },
      {
        feature: 'Multi-location support',
        vetai: 'yes', scribenote: 'partial', vetrec: 'partial', talkatoo: 'no', digitail: 'yes',
      },
      {
        feature: 'Role-based permissions',
        vetai: 'yes', scribenote: 'partial', vetrec: 'no', talkatoo: 'no', digitail: 'yes',
      },
      {
        feature: 'Billing catalog',
        vetai: 'yes', scribenote: 'no', vetrec: 'partial', talkatoo: 'no', digitail: 'yes',
      },
      {
        feature: 'PIMS / EMR integration',
        vetai: 'no', scribenote: 'yes', vetrec: 'yes', talkatoo: 'yes', digitail: 'partial',
      },
      {
        feature: 'Scheduling & full PIMS',
        vetai: 'no', scribenote: 'no', vetrec: 'no', talkatoo: 'no', digitail: 'yes',
      },
    ],
  },
  {
    name: 'Pricing',
    rows: [
      {
        feature: 'Free plan',
        vetai: 'no', scribenote: 'yes', vetrec: 'no', talkatoo: 'no', digitail: 'no',
      },
      {
        feature: 'Starting price (per provider / month)',
        vetai: '$79', scribenote: 'Free', vetrec: '$99', talkatoo: '~$117', digitail: '$300+',
      },
    ],
  },
];

const COMPETITORS: { key: CompetitorKey; label: string; isUs?: boolean }[] = [
  { key: 'vetai', label: '[PRODUCT_NAME]', isUs: true },
  { key: 'scribenote', label: 'Scribenote' },
  { key: 'vetrec', label: 'VetRec' },
  { key: 'talkatoo', label: 'Talkatoo' },
  { key: 'digitail', label: 'Digitail' },
];

type CompetitorKey = 'vetai' | 'scribenote' | 'vetrec' | 'talkatoo' | 'digitail';

// ─── Cell renderer ─────────────────────────────────────────────────────────────

function Cell({ value, isUs }: { value: CellValue; isUs?: boolean }) {
  if (value === 'yes') {
    return (
      <div className="flex justify-center">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center ${isUs ? 'bg-primary' : 'bg-primary/15'}`}>
          <Check className={`h-3.5 w-3.5 ${isUs ? 'text-primary-foreground' : 'text-primary'}`} strokeWidth={2.5} />
        </div>
      </div>
    );
  }
  if (value === 'partial') {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-amber-100 flex items-center justify-center">
          <Minus className="h-3.5 w-3.5 text-amber-600" strokeWidth={2.5} />
        </div>
      </div>
    );
  }
  if (value === 'no') {
    return (
      <div className="flex justify-center">
        <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center">
          <X className="h-3.5 w-3.5 text-muted-foreground/40" strokeWidth={2.5} />
        </div>
      </div>
    );
  }
  // Custom text (e.g. pricing, counts)
  return (
    <div className={`text-center text-sm font-medium ${isUs ? 'text-primary' : 'text-foreground'}`}>
      {value}
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function ComparisonSection() {
  return (
    <section id="compare" className="py-20 px-4 sm:px-6">
      <div className="max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">How [PRODUCT_NAME] Compares</h2>
          <p className="mt-4 text-muted-foreground max-w-2xl mx-auto">
            Purpose-built for clinical workflows — not a generic medical AI with a provider skin.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center justify-center gap-5 mb-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
              <Check className="h-3 w-3 text-primary-foreground" strokeWidth={2.5} />
            </div>
            Included
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-amber-100 flex items-center justify-center">
              <Minus className="h-3 w-3 text-amber-600" strokeWidth={2.5} />
            </div>
            Partial / add-on
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
              <X className="h-3 w-3 text-muted-foreground/40" strokeWidth={2.5} />
            </div>
            Not available
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-0.5 rounded-full">
              <Sparkles className="h-2.5 w-2.5" />
              Only [PRODUCT_NAME]
            </div>
            Unique to [PRODUCT_NAME]
          </div>
        </div>

        {/* Table wrapper — horizontal scroll on mobile */}
        <div className="overflow-x-auto rounded-xl border shadow-sm">
          <table className="w-full min-w-[640px] border-collapse">
            {/* Column headers */}
            <thead>
              <tr>
                <th className="text-left px-5 py-4 text-sm font-semibold w-[280px] bg-muted/40">
                  Feature
                </th>
                {COMPETITORS.map((c) => (
                  <th
                    key={c.key}
                    className={`px-4 py-4 text-center text-sm font-semibold w-[110px] ${
                      c.isUs
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted/40 text-foreground'
                    }`}
                  >
                    {c.label}
                    {c.isUs && (
                      <div className="text-xs font-normal text-primary-foreground/80 mt-0.5">
                        ← You&apos;re here
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {CATEGORIES.map((category, catIdx) => (
                <>
                  {/* Category divider row */}
                  <tr key={`cat-${catIdx}`}>
                    <td
                      colSpan={6}
                      className="px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground bg-muted/50 border-t"
                    >
                      {category.name}
                    </td>
                  </tr>

                  {/* Feature rows */}
                  {category.rows.map((row, rowIdx) => (
                    <tr
                      key={`${catIdx}-${rowIdx}`}
                      className="border-t hover:bg-muted/20 transition-colors"
                    >
                      {/* Feature name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-start gap-2">
                          <span className="text-sm text-foreground leading-snug">{row.feature}</span>
                          {row.vetaiOnly && (
                            <span className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[10px] font-medium px-1.5 py-0.5 rounded-full whitespace-nowrap shrink-0 mt-0.5">
                              <Sparkles className="h-2 w-2" />
                              Only [PRODUCT_NAME]
                            </span>
                          )}
                        </div>
                        {row.tooltip && (
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{row.tooltip}</p>
                        )}
                      </td>

                      {/* Competitor cells */}
                      {COMPETITORS.map((c) => (
                        <td
                          key={c.key}
                          className={`px-4 py-3.5 ${c.isUs ? 'bg-primary/[0.04]' : ''}`}
                        >
                          <Cell value={row[c.key as CompetitorKey] as CellValue} isUs={c.isUs} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <p className="text-xs text-muted-foreground text-center mt-4">
          Feature data based on publicly available information as of Q1 2026. &ldquo;Partial&rdquo; indicates the feature is available on higher tiers, as a paid add-on, or in limited beta.
          [PRODUCT_NAME] does not offer scheduling or full PIMS replacement — it integrates into your existing workflow.
        </p>
      </div>
    </section>
  );
}
