'use client';

import { useMemo, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  Clock,
  Package,
  ChevronRight,
} from 'lucide-react';
import { useQuery } from "convex/react";
import { api } from 'convex/_generated/api';
import { Id } from 'convex/_generated/dataModel';
import { AppLink } from '@/components/navigation/AppLink';
import { InvoiceCreationModal } from '@/components/billing/InvoiceCreationModal';
import type { OrgContext } from '@/types/billing';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(dateStr));
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
  color?: 'green' | 'amber' | 'blue';
}

function StatCard({ title, value, icon: Icon, sub, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    green: 'bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400',
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400',
  };

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-semibold mt-2">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`flex h-12 w-12 items-center justify-center rounded-lg flex-shrink-0 ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface OverviewTabProps {
  orgContext: OrgContext | null;
  isLoading: boolean;
  onSwitchToCatalog: () => void;
  onSwitchToInvoices: () => void;
}

export function OverviewTab({ orgContext, isLoading, onSwitchToCatalog, onSwitchToInvoices }: OverviewTabProps) {
  const orgId = orgContext?.orgId as Id<"organizations">;

  const [invoicingEncounter, setInvoicingEncounter] = useState<{
    id: Id<'encounters'>;
    interactionId: string;
  } | null>(null);

  const encounters = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext ? { orgId } : 'skip'
  );

  const patients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId } : 'skip'
  );

  const patientNameMap = useMemo(() => {
    const map = new Map<string, string>();
    patients?.forEach(p => { if (p.name) map.set(p._id, p.name); });
    return map;
  }, [patients]);

  const catalogStats = useQuery(
    api.billingDashboard.getCatalogStats,
    orgContext ? { orgId } : 'skip'
  );

  const revenueTrend = useQuery(
    api.billingDashboard.getRevenueTrend,
    orgContext ? { orgId, days: 30 } : 'skip'
  );

  const queriesLoading = encounters === undefined || catalogStats === undefined || revenueTrend === undefined;

  // Derived invoice metrics
  const metrics = useMemo(() => {
    if (!encounters) return null;
    const invoiced = encounters.filter(c => c.invoiceMetadata?.status === 'finalized');
    const readyToInvoice = encounters.filter(c => c.publishedAt && !c.invoiceMetadata);
    const totalRevenue = invoiced.reduce((sum, c) => sum + (c.invoiceMetadata?.grandTotal ?? 0), 0);
    const avgInvoice = invoiced.length > 0 ? totalRevenue / invoiced.length : 0;
    return { invoiced, readyToInvoice, totalRevenue, avgInvoice };
  }, [encounters]);

  // Chart data — use invoiced revenue trend (bucketed by finalized date)
  const chartData = useMemo(() => {
    if (!encounters) return [];
    const invoiced = encounters.filter(c => c.invoiceMetadata?.status === 'finalized' && c.invoiceMetadata.finalizedAt);
    // Build daily buckets for last 30 days
    const buckets: Record<string, number> = {};
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      buckets[d.toISOString().slice(0, 10)] = 0;
    }
    invoiced.forEach(c => {
      const key = new Date(c.invoiceMetadata!.finalizedAt!).toISOString().slice(0, 10);
      if (key in buckets) {
        buckets[key] = (buckets[key] ?? 0) + (c.invoiceMetadata!.grandTotal ?? 0);
      }
    });
    return Object.entries(buckets).map(([date, amount]) => ({
      date: formatDate(date + 'T12:00:00'),
      revenue: amount / 100,
    }));
  }, [encounters]);

  const hasBillingData = !queriesLoading && (
    (metrics?.invoiced.length ?? 0) > 0 ||
    (catalogStats?.totalItems ?? 0) > 0
  );

  if (!queriesLoading && !hasBillingData) {
    return (
      <div className="flex items-center justify-center py-12">
        <EmptyState
          icon={DollarSign}
          title="Start using billing"
          description="Set up your billing catalog and start invoicing encounters to track your revenue."
          features={[
            'AI automatically extracts billable services from encounters',
            'Review and confirm services before generating invoices',
            'Track total revenue and invoice history',
            'Manage your billing catalog with custom codes and pricing',
          ]}
        >
          <Button onClick={onSwitchToCatalog}>
            <Package className="h-4 w-4 mr-2" />
            Set Up Catalog
          </Button>
        </EmptyState>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Invoiced Revenue"
          value={queriesLoading ? '…' : formatCurrency(metrics?.totalRevenue ?? 0)}
          icon={DollarSign}
          color="green"
          sub={!queriesLoading ? `${metrics?.invoiced.length ?? 0} invoice${metrics?.invoiced.length !== 1 ? 's' : ''}` : undefined}
        />
        <StatCard
          title="Ready to Invoice"
          value={queriesLoading ? '…' : metrics?.readyToInvoice.length ?? 0}
          icon={Clock}
          color="amber"
          sub="Published encounters"
        />
        <StatCard
          title="Average Invoice Value"
          value={queriesLoading ? '…' : metrics?.avgInvoice ? formatCurrency(metrics.avgInvoice) : '—'}
          icon={TrendingUp}
          color="blue"
        />
        <StatCard
          title="Catalog Items"
          value={queriesLoading ? '…' : catalogStats?.totalItems ?? 0}
          icon={Package}
          color="blue"
          sub="Active services"
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>Invoice Revenue (Last 30 Days)</CardTitle>
          <CardDescription>Revenue from finalized invoices by day</CardDescription>
        </CardHeader>
        <CardContent>
          {queriesLoading ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">Loading chart…</p>
            </div>
          ) : chartData.every(d => d.revenue === 0) ? (
            <div className="h-64 flex items-center justify-center">
              <p className="text-muted-foreground text-sm">No invoices in the last 30 days</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(v: number) => [`$${v.toFixed(2)}`, 'Invoiced']}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Ready to Invoice action list */}
      {!queriesLoading && (metrics?.readyToInvoice.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Ready to Invoice</CardTitle>
                <CardDescription>
                  {metrics!.readyToInvoice.length} published encounter{metrics!.readyToInvoice.length !== 1 ? 's' : ''} awaiting an invoice
                </CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={onSwitchToInvoices}>
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="divide-y divide-border">
              {metrics!.readyToInvoice.slice(0, 5).map(c => {
                const patientName =
                  c.extractedPatientInfo?.name ||
                  patientNameMap.get(c.patientId as string) ||
                  'Patient';
                return (
                  <div key={c._id} className="flex items-center gap-3 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{patientName}</p>
                      {c.reasonForVisit && (
                        <p className="text-xs text-muted-foreground truncate">{c.reasonForVisit}</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground flex-shrink-0">
                      {c.publishedAt ? formatRelativeDate(c.publishedAt) : '—'}
                    </p>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <AppLink href={`/encounter/${c._id}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
                          View
                        </Button>
                      </AppLink>
                      {c.interactionId && (
                        <Button
                          size="sm"
                          className="h-7 px-3 text-xs"
                          onClick={() => setInvoicingEncounter({ id: c._id, interactionId: c.interactionId! })}
                        >
                          <DollarSign className="h-3.5 w-3.5 mr-1" />
                          Invoice
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {metrics!.readyToInvoice.length > 5 && (
              <button
                onClick={onSwitchToInvoices}
                className="w-full text-xs text-muted-foreground hover:text-foreground text-center pt-3 transition-colors"
              >
                +{metrics!.readyToInvoice.length - 5} more
              </button>
            )}
          </CardContent>
        </Card>
      )}

      {invoicingEncounter && orgContext && (
        <InvoiceCreationModal
          isOpen={!!invoicingEncounter}
          onClose={() => setInvoicingEncounter(null)}
          encounterId={invoicingEncounter.id}
          interactionId={invoicingEncounter.interactionId}
          orgId={orgId}
        />
      )}
    </div>
  );
}
