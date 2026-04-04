'use client';

import { useState, useMemo } from 'react';
import { useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import {
  Sparkles,
  Check,
  X,
  FlaskConical,
  Pill,
  UserCheck,
  Calendar,
  Scan,
  Loader2,
  ChevronDown,
  ChevronUp,
  RotateCw,
} from 'lucide-react';

interface SuggestedOrder {
  id: string;
  type: string;
  title: string;
  detail: string;
  sourceText: string;
  accepted?: boolean;
  acceptedAt?: string;
}

interface SuggestedOrders {
  orders: SuggestedOrder[];
  extractedAt: string;
  planSectionContent: string;
}

interface OrderSuggestionsPanelProps {
  encounterId: Id<'encounters'>;
  suggestedOrders?: SuggestedOrders;
  orderExtractionStatus?: string;
  isEditable?: boolean;
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  lab:       { icon: FlaskConical, label: 'Lab',       color: 'text-blue-600 bg-blue-50 border-blue-200' },
  medication:{ icon: Pill,         label: 'Medication', color: 'text-purple-600 bg-purple-50 border-purple-200' },
  referral:  { icon: UserCheck,    label: 'Referral',  color: 'text-green-600 bg-green-50 border-green-200' },
  'follow-up': { icon: Calendar,   label: 'Follow-up', color: 'text-amber-600 bg-amber-50 border-amber-200' },
  imaging:   { icon: Scan,         label: 'Imaging',   color: 'text-rose-600 bg-rose-50 border-rose-200' },
};

function getTypeConfig(type: string) {
  return TYPE_CONFIG[type] ?? { icon: Sparkles, label: type, color: 'text-gray-600 bg-gray-50 border-gray-200' };
}

export function OrderSuggestionsPanel({
  encounterId,
  suggestedOrders,
  orderExtractionStatus,
  isEditable = true,
}: OrderSuggestionsPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isRerunning, setIsRerunning] = useState(false);

  const rerun = useMutation(api.orderOrchestration.rerunExtraction);
  const acceptOrder = useMutation(api.orderOrchestration.acceptOrder);
  const dismissOrder = useMutation(api.orderOrchestration.dismissOrder);
  const acceptAllOrders = useMutation(api.orderOrchestration.acceptAllOrders);

  const orders = suggestedOrders?.orders ?? [];
  const pendingOrders = orders.filter(o => o.accepted === undefined || o.accepted === null);
  const acceptedOrders = orders.filter(o => o.accepted === true);
  const dismissedOrders = orders.filter(o => o.accepted === false);

  const groupedPending = useMemo(() => {
    const groups: Record<string, SuggestedOrder[]> = {};
    for (const order of pendingOrders) {
      if (!groups[order.type]) groups[order.type] = [];
      groups[order.type].push(order);
    }
    return groups;
  }, [pendingOrders]);

  const isProcessing = orderExtractionStatus === 'processing';

  async function handleRerun() {
    if (isRerunning) return;
    setIsRerunning(true);
    try {
      await rerun({ encounterId });
    } finally {
      setIsRerunning(false);
    }
  }

  if (!isEditable && !isProcessing && orders.length === 0) return null;

  async function handleAccept(orderId: string) {
    try {
      await acceptOrder({ encounterId, orderId });
    } catch {
      toast({ title: 'Failed to accept order', variant: 'destructive' });
    }
  }

  async function handleDismiss(orderId: string) {
    try {
      await dismissOrder({ encounterId, orderId });
    } catch {
      toast({ title: 'Failed to dismiss order', variant: 'destructive' });
    }
  }

  async function handleAcceptAll() {
    try {
      await acceptAllOrders({ encounterId });
      toast({ title: `Accepted ${pendingOrders.length} orders` });
    } catch {
      toast({ title: 'Failed to accept orders', variant: 'destructive' });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer select-none"
        onClick={() => setIsCollapsed(c => !c)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-800">Suggested Orders</span>
          {isProcessing ? (
            <Badge variant="outline" className="text-xs text-gray-500 gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              Analyzing plan…
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {pendingOrders.length} pending
              {acceptedOrders.length > 0 && ` · ${acceptedOrders.length} accepted`}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isProcessing && pendingOrders.length > 0 && isEditable && (
            <button
              onClick={e => { e.stopPropagation(); handleAcceptAll(); }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Accept all
            </button>
          )}
          {isEditable && !isProcessing && (
            <button
              onClick={e => { e.stopPropagation(); handleRerun(); }}
              disabled={isRerunning}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-40 transition-colors"
              title="Re-extract orders"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isRerunning ? 'animate-spin' : ''}`} />
            </button>
          )}
          {isCollapsed ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Body */}
      {!isCollapsed && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {isProcessing && (
            <div className="px-4 py-6 flex flex-col items-center gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p className="text-xs">Extracting orders from the plan section…</p>
            </div>
          )}

          {/* Empty state */}
          {!isProcessing && orders.length === 0 && (
            <div className="px-4 py-4 text-center text-xs text-gray-400 dark:text-muted-foreground">
              No orders extracted.{' '}
              {isEditable && (
                <button onClick={handleRerun} className="text-indigo-600 dark:text-indigo-400 hover:underline">
                  Run extraction
                </button>
              )}
            </div>
          )}

          {/* Pending orders grouped by type */}
          {!isProcessing && Object.entries(groupedPending).map(([type, typeOrders]) => {
            const cfg = getTypeConfig(type);
            const Icon = cfg.icon;
            return (
              <div key={type} className="px-4 py-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={`h-3.5 w-3.5 ${cfg.color.split(' ')[0]}`} />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cfg.label}</span>
                </div>
                <div className="space-y-2">
                  {typeOrders.map(order => (
                    <div key={order.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{order.title}</p>
                        {order.detail && (
                          <p className="text-xs text-gray-500 mt-0.5">{order.detail}</p>
                        )}
                        {order.sourceText && (
                          <p className="text-xs text-gray-400 italic mt-0.5 truncate" title={order.sourceText}>
                            "{order.sourceText}"
                          </p>
                        )}
                      </div>
                      {isEditable && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleAccept(order.id)}
                            className="p-1 rounded hover:bg-green-50 text-gray-400 hover:text-green-600 transition-colors"
                            title="Accept"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDismiss(order.id)}
                            className="p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Dismiss"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Accepted orders summary */}
          {!isProcessing && acceptedOrders.length > 0 && (
            <div className="px-4 py-2.5 bg-green-50">
              <p className="text-xs text-green-700 font-medium">
                <Check className="inline h-3 w-3 mr-1" />
                {acceptedOrders.length} order{acceptedOrders.length !== 1 ? 's' : ''} accepted:{' '}
                {acceptedOrders.map(o => o.title).join(', ')}
              </p>
            </div>
          )}

          {/* All dismissed */}
          {!isProcessing && pendingOrders.length === 0 && acceptedOrders.length === 0 && dismissedOrders.length > 0 && (
            <div className="px-4 py-3 text-xs text-gray-400 text-center">
              All suggestions dismissed.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
