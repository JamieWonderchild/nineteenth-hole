'use client';

import { Check, Stethoscope, Users, MapPin } from 'lucide-react';
import { PLAN_CONFIGS } from '@/types/billing';
import type { PlanTier } from '@/types/billing';

interface PricingTableProps {
  currentPlan?: PlanTier;
  onSelectPlan?: (plan: PlanTier) => void;
  loading?: boolean;
}

const PLAN_ICONS: Record<PlanTier, typeof Stethoscope> = {
  solo: Stethoscope,
  practice: Users,
  'multi-location': MapPin,
};

export function PricingTable({ currentPlan, onSelectPlan, loading }: PricingTableProps) {
  return (
    <div className="grid md:grid-cols-3 gap-4">
      {(Object.entries(PLAN_CONFIGS) as [PlanTier, typeof PLAN_CONFIGS[PlanTier]][]).map(
        ([tier, config]) => {
          const Icon = PLAN_ICONS[tier];
          const isCurrent = currentPlan === tier;

          return (
            <div
              key={tier}
              className={`relative p-6 rounded-xl border-2 transition-all ${
                isCurrent
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/30'
              }`}
            >
              {isCurrent && (
                <div className="absolute top-3 right-3 text-xs font-medium bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                  Current
                </div>
              )}

              <div className="flex items-center gap-2 mb-3">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{config.name}</h3>
              </div>

              <div className="mb-4">
                <span className="text-3xl font-bold">${config.price}</span>
                <span className="text-muted-foreground">/mo</span>
              </div>

              {tier === 'practice' && !isCurrent && (
                <div className="mb-3 text-xs font-medium text-green-600 bg-green-50 rounded-full px-2 py-1 inline-block">
                  14-day free trial
                </div>
              )}

              <ul className="space-y-2 mb-6">
                {config.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {onSelectPlan && !isCurrent && (
                <button
                  onClick={() => onSelectPlan(tier)}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Loading...' : `Switch to ${config.name}`}
                </button>
              )}
            </div>
          );
        }
      )}
    </div>
  );
}
