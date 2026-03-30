'use client';

import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/EmptyState';
import {
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Users,
  Activity,
  Calendar,
  TrendingUp,
  TrendingDown,
  Loader2,
  Stethoscope,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "convex/react";
import { api } from 'convex/_generated/api';
import { useAuth } from "@clerk/nextjs";
import { Id } from 'convex/_generated/dataModel';
import { useOrgCtx } from "@/app/providers/org-context-provider";
import { BillingGuard } from "@/components/billing/BillingGuard";
import { LocationFilter } from "@/components/locations/LocationFilter";
import { useLocationFilter } from "@/hooks/useLocationFilter";

// ---------------------------------------------------------------------------
// useChartColors — reads CSS custom properties, re-reads on dark-mode toggle
// ---------------------------------------------------------------------------
function useChartColors() {
  const read = () => {
    const style = getComputedStyle(document.documentElement);
    const hsl = (v: string) => {
      const raw = style.getPropertyValue(v).trim();
      return raw ? `hsl(${raw})` : '';
    };
    return {
      chart: [
        hsl('--chart-1'),
        hsl('--chart-2'),
        hsl('--chart-3'),
        hsl('--chart-4'),
        hsl('--chart-5'),
      ],
      foreground: hsl('--foreground'),
      mutedForeground: hsl('--muted-foreground'),
      border: hsl('--border'),
      card: hsl('--card'),
    };
  };

  const [colors, setColors] = useState({
    chart: ['', '', '', '', ''],
    foreground: '',
    mutedForeground: '',
    border: '',
    card: '',
  });

  useEffect(() => {
    setColors(read());
    const observer = new MutationObserver(() => setColors(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return colors;
}

// ---------------------------------------------------------------------------
// Doc type labels for the Document Generation chart
// ---------------------------------------------------------------------------
const DOC_LABELS: Record<string, string> = {
  soapNote: 'SOAP',
  afterVisitSummary: 'After-Visit Summary',
  dischargeInstructions: 'Discharge',
  referralLetter: 'Referral',
  prescription: 'Prescription',
  followUpPlan: 'Follow-Up',
  labOrder: 'Lab Order',
  shiftHandoff: 'Shift Handoff',
};

// ---------------------------------------------------------------------------
// Small empty-state component
// ---------------------------------------------------------------------------
function EmptyChart({ message = 'No data yet' }: { message?: string }) {
  return (
    <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AnalyticsPage() {
  const { userId } = useAuth();
  const { orgContext } = useOrgCtx();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const colors = useChartColors();
  const { locations, selectedLocationId, setSelectedLocationId } = useLocationFilter(orgContext?.orgId);

  // ---------- Data queries (org-scoped with provider fallback) ------------------
  const orgPatients = useQuery(
    api.patients.getPatientsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetPatients = useQuery(
    api.patients.getPatientsByVet,
    !orgContext ? { providerId: userId ?? "" } : 'skip'
  );
  const patients = orgPatients ?? vetPatients;

  const orgConsultations = useQuery(
    api.encounters.getConsultationsByOrg,
    orgContext ? { orgId: orgContext.orgId as Id<"organizations"> } : 'skip'
  );
  const vetConsultations = useQuery(
    api.encounters.getVetConsultations,
    !orgContext ? { userId: userId ?? "" } : 'skip'
  );
  const encounters = orgConsultations ?? vetConsultations;

  const isLoading = patients === undefined || encounters === undefined;

  // ---------- Stat cards ---------------------------------------------------
  const totalPatients = patients?.length ?? 0;
  const newPatientsThisMonth = useMemo(() => {
    if (!patients) return 0;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    return patients.filter(p => new Date(p.createdAt || '') > cutoff).length;
  }, [patients]);

  const totalConsultations = encounters?.length ?? 0;
  const consultationsThisMonth = useMemo(() => {
    if (!encounters) return 0;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 1);
    return encounters.filter(c => new Date(c.date) > cutoff).length;
  }, [encounters]);

  const monthlyGrowthRate = ((newPatientsThisMonth / (totalPatients || 1)) * 100).toFixed(1);
  const growthPositive = parseFloat(monthlyGrowthRate) > 0;

  // ---------- Chart 1: Encounter Frequency (line) -----------------------
  const visitData = useMemo(() => {
    if (!encounters) return [];
    const today = new Date();
    const start = new Date();
    if (timeRange === 'week') start.setDate(today.getDate() - 7);
    else if (timeRange === 'month') start.setMonth(today.getMonth() - 1);
    else if (timeRange === 'quarter') start.setMonth(today.getMonth() - 3);
    else start.setFullYear(today.getFullYear() - 1);

    const map = new Map<string, number>();
    const cur = new Date(start);
    while (cur <= today) {
      map.set(cur.toISOString().split('T')[0], 0);
      cur.setDate(cur.getDate() + 1);
    }
    encounters.forEach(c => {
      const d = new Date(c.date).toISOString().split('T')[0];
      if (map.has(d)) map.set(d, map.get(d)! + 1);
    });
    return Array.from(map.entries())
      .map(([date, visits]) => ({ date, visits }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [encounters, timeRange]);

  // ---------- Chart 2: Sex Distribution (pie) --------------------------
  const sexData = useMemo(() => {
    if (!patients) return [];
    const counts: Record<string, number> = {};
    patients.forEach(p => {
      const key = p.sex || 'Unknown';
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [patients]);

  // ---------- Chart 3: Encounter Status (pie) ---------------------------
  const statusData = useMemo(() => {
    if (!encounters) return [];
    const counts: Record<string, number> = {};
    encounters.forEach(c => {
      const s = c.status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    const labels: Record<string, string> = {
      draft: 'Draft',
      'in-progress': 'In Progress',
      review: 'Review',
      published: 'Published',
      unknown: 'Unknown',
    };
    return Object.entries(counts).map(([key, value]) => ({
      name: labels[key] || key,
      value,
    }));
  }, [encounters]);

  // ---------- Chart 4: Patient Growth (bar by month) -----------------------
  const patientGrowthData = useMemo(() => {
    if (!patients) return [];
    const counts: Record<string, number> = {};
    patients.forEach(p => {
      if (!p.createdAt) return;
      const d = new Date(p.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12) // last 12 months
      .map(([month, count]) => {
        const [y, m] = month.split('-');
        const label = new Date(Number(y), Number(m) - 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
        return { month: label, count };
      });
  }, [patients]);

  // ---------- Chart 5: Document Generation (bar by type) -------------------
  const docGenData = useMemo(() => {
    if (!encounters) return [];
    const counts: Record<string, number> = {};
    encounters.forEach(c => {
      const docs = c.generatedDocuments;
      if (!docs) return;
      for (const key of Object.keys(docs)) {
        if ((docs as Record<string, unknown>)[key]) counts[key] = (counts[key] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .map(([key, count]) => ({ name: DOC_LABELS[key] || key, count }))
      .sort((a, b) => b.count - a.count);
  }, [encounters]);

  // ---------- Recharts shared props ----------------------------------------
  const axisTickStyle = { fill: colors.mutedForeground, fontSize: 12 };
  const tooltipStyle = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.foreground,
  };

  // ---------- Render -------------------------------------------------------
  if (isLoading) {
    return (
      <Layout>
        <BillingGuard feature="Analytics">
          <div className="flex items-center justify-center h-[60vh]">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </BillingGuard>
      </Layout>
    );
  }

  return (
    <Layout>
      <BillingGuard feature="Analytics">
        <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Practice Analytics</h1>
            </div>
            <div className="flex gap-2">
              {locations.length > 1 && (
                <LocationFilter
                  locations={locations}
                  selectedLocationId={selectedLocationId}
                  onLocationChange={setSelectedLocationId}
                />
              )}
              <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Time Range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Empty State - No Encounters */}
          {totalConsultations === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Start encounters to see analytics"
              description="Your analytics dashboard will come to life once you begin recording encounters with [PRODUCT_NAME]."
              features={[
                'Track encounter trends over time',
                'View patient demographics and visit patterns',
                'Analyze document generation usage',
                'Monitor practice growth and performance',
              ]}
              size="large"
            />
          ) : (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Patients</p>
                    <p className="text-3xl font-bold">{totalPatients}</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded-full">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <div className={`flex items-center ${growthPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {growthPositive ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
                    <span>{monthlyGrowthRate}%</span>
                  </div>
                  <span className="ml-2 text-sm text-muted-foreground">from last month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">New Patients</p>
                    <p className="text-3xl font-bold">{newPatientsThisMonth}</p>
                  </div>
                  <div className="p-2 bg-[hsl(var(--chart-2)/.1)] rounded-full">
                    <Users className="h-6 w-6 text-[hsl(var(--chart-2))]" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">This Month</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total Encounters</p>
                    <p className="text-3xl font-bold">{totalConsultations}</p>
                  </div>
                  <div className="p-2 bg-[hsl(var(--chart-4)/.1)] rounded-full">
                    <Activity className="h-6 w-6 text-[hsl(var(--chart-4))]" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">All Time</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">This Month</p>
                    <p className="text-3xl font-bold">{consultationsThisMonth}</p>
                  </div>
                  <div className="p-2 bg-[hsl(var(--chart-5)/.1)] rounded-full">
                    <Calendar className="h-6 w-6 text-[hsl(var(--chart-5))]" />
                  </div>
                </div>
                <div className="mt-4">
                  <span className="text-sm text-muted-foreground">Encounters</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Encounter Frequency — full width line chart */}
          <Card>
            <CardHeader>
              <CardTitle>Encounter Frequency</CardTitle>
              <CardDescription>Number of encounters over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                {visitData.length === 0 ? (
                  <EmptyChart />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visitData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                      <XAxis
                        dataKey="date"
                        tick={axisTickStyle}
                        tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      />
                      <YAxis tick={axisTickStyle} allowDecimals={false} />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        formatter={(value) => [value, 'Encounters']}
                        labelFormatter={(l) => new Date(l).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      />
                      <Line
                        type="monotone"
                        dataKey="visits"
                        name="Encounters"
                        stroke={colors.chart[0]}
                        strokeWidth={2}
                        activeDot={{ r: 6 }}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Row: Patient Type Distribution + Encounter Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Sex Distribution</CardTitle>
                <CardDescription>Breakdown of patients by sex</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {sexData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sexData}
                          cx="50%"
                          cy="50%"
                          outerRadius={90}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {sexData.map((_entry, i) => (
                            <Cell key={i} fill={colors.chart[i % colors.chart.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, name]} />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          formatter={(value) => <span style={{ color: colors.foreground }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Encounter Status</CardTitle>
                <CardDescription>Current status of all encounters</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {statusData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={85}
                          paddingAngle={4}
                          dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {statusData.map((_entry, i) => (
                            <Cell key={i} fill={colors.chart[i % colors.chart.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} formatter={(value, name) => [value, name]} />
                        <Legend
                          layout="horizontal"
                          verticalAlign="bottom"
                          align="center"
                          formatter={(value) => <span style={{ color: colors.foreground }}>{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row: Patient Growth + Document Generation */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Patient Growth</CardTitle>
                <CardDescription>New patients registered per month</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {patientGrowthData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={patientGrowthData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                        <XAxis dataKey="month" tick={axisTickStyle} />
                        <YAxis tick={axisTickStyle} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Patients']} />
                        <Bar dataKey="count" name="Patients" fill={colors.chart[1]} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Document Generation</CardTitle>
                <CardDescription>Documents generated by type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {docGenData.length === 0 ? (
                    <EmptyChart />
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={docGenData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                        <XAxis dataKey="name" tick={axisTickStyle} />
                        <YAxis tick={axisTickStyle} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, 'Documents']} />
                        <Bar dataKey="count" name="Documents" radius={[4, 4, 0, 0]}>
                          {docGenData.map((_entry, i) => (
                            <Cell key={i} fill={colors.chart[i % colors.chart.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          </>
          )}
        </div>
      </BillingGuard>
    </Layout>
  );
}
