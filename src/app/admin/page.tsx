'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useMutation, useQuery, useAction } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Layout } from '@/components/layout/Layout';
import { isSuperadmin } from '@/lib/superadmin';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Shield,
  Search,
  Building2,
  Users,
  ArrowRight,
  Unlock,
  Trash2,
  DollarSign,
  Activity,
  Stethoscope,
  PawPrint,
  TrendingUp,
  AlertTriangle,
  CreditCard,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
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
} from 'recharts';
import type { Id } from 'convex/_generated/dataModel';

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
// Status colour helper
// ---------------------------------------------------------------------------
const statusColor: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400',
  trialing: 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400',
  trial_expired: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400',
  past_due: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
  canceled: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  unpaid: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400',
  incomplete: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

const PLAN_SEAT_LABELS: Record<string, string> = {
  solo: '1 seat',
  practice: '2 seats',
  'multi-location': '5 seats',
};

type Tab = 'orgs' | 'users' | 'attention' | 'tools';

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminPage() {
  const { user } = useUser();
  const colors = useChartColors();

  // Tab + selection state
  const [activeTab, setActiveTab] = useState<Tab>('orgs');
  const [selectedOrgId, setSelectedOrgId] = useState<Id<'organizations'> | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Search state per tab
  const [orgSearch, setOrgSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');

  // Attention section collapse
  const [attentionOpen, setAttentionOpen] = useState(true);

  // Dialog targets
  const [grantTarget, setGrantTarget] = useState<{ id: Id<'organizations'>; name: string; plan: string } | null>(null);
  const [deleteOrgTarget, setDeleteOrgTarget] = useState<{ id: Id<'organizations'>; name: string } | null>(null);

  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = isSuperadmin(email);

  // Core queries
  const allOrgs = useQuery(api.admin.listAllOrgs, isAdmin && email ? { callerEmail: email } : 'skip');
  const metrics = useQuery(api.admin.getPlatformMetrics, isAdmin && email ? { callerEmail: email } : 'skip');
  const attention = useQuery(api.admin.getAttentionItems, isAdmin && email ? { callerEmail: email } : 'skip');

  // Drill-down queries
  const orgMembers = useQuery(
    api.admin.getOrgMembers,
    isAdmin && email && selectedOrgId ? { orgId: selectedOrgId, callerEmail: email } : 'skip'
  );
  const userOrgs = useQuery(
    api.admin.getUserOrgs,
    isAdmin && email && selectedUserId ? { userId: selectedUserId, callerEmail: email } : 'skip'
  );

  // Mutations / actions
  const grantAccess = useMutation(api.admin.grantAccess);
  const deleteOrganization = useAction(api.admin.deleteOrganization);
  const listAllUsersAction = useAction(api.admin.listAllUsers);
  const resetUserAccount = useAction(api.admin.resetUserAccount);
  const updateOrgPlan = useMutation(api.admin.updateOrgPlan);
  const updateMemberRole = useMutation(api.memberships.updateRole);

  // Users (action — not a reactive query)
  const [allUsers, setAllUsers] = useState<Array<{
    userId: string;
    name: string;
    email: string;
    orgCount: number;
    source: 'vet_record' | 'clerk' | 'unknown';
  }> | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (isAdmin && email) {
      setLoadingUsers(true);
      listAllUsersAction({ callerEmail: email })
        .then(setAllUsers)
        .catch(() => setAllUsers([]))
        .finally(() => setLoadingUsers(false));
    }
  }, [isAdmin, email, listAllUsersAction]);

  // ---------------------------------------------------------------------------
  // Derived data
  // ---------------------------------------------------------------------------
  const selectedOrg = allOrgs?.find((o) => o._id === selectedOrgId) ?? null;
  const selectedUser = allUsers?.find((u) => u.userId === selectedUserId) ?? null;

  const filteredOrgs = allOrgs?.filter((org) => {
    if (!orgSearch.trim()) return true;
    const q = orgSearch.toLowerCase();
    return org.name.toLowerCase().includes(q) || org.slug.toLowerCase().includes(q) || org.plan.toLowerCase().includes(q);
  });

  const filteredUsers = allUsers?.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const totalAttentionCount = attention
    ? attention.expiringTrials.length + attention.paymentIssues.length + attention.approachingLimits.length
    : 0;

  const axisTickStyle = { fill: colors.mutedForeground, fontSize: 11 };
  const tooltipStyle = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    color: colors.foreground,
    fontSize: 12,
  };

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  const handleGrantAccess = async () => {
    if (!email || !grantTarget) return;
    await grantAccess({ orgId: grantTarget.id, callerEmail: email });
    setGrantTarget(null);
  };

  const handleDeleteOrg = async () => {
    if (!email || !deleteOrgTarget) return;
    try {
      await deleteOrganization({ orgId: deleteOrgTarget.id, cascade: true, callerEmail: email });
      setDeleteOrgTarget(null);
      if (selectedOrgId === deleteOrgTarget.id) setSelectedOrgId(null);
      window.location.reload();
    } catch (error) {
      alert(`Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setDeleteOrgTarget(null);
    }
  };

  const handleResetMyAccount = async () => {
    if (!email || !user) return;
    const confirmed = window.confirm(
      `⚠️ RESET YOUR ACCOUNT FOR TESTING?\n\nThis will DELETE all your organizations and data.\n\nThis cannot be undone!\n\nContinue?`
    );
    if (!confirmed) return;
    try {
      const result = await resetUserAccount({ userId: user.id, callerEmail: email, skipClerk: false });
      alert(`✅ ${result.message}\n\nDeleted ${result.orgsDeleted} organization(s)`);
      window.location.href = '/onboarding';
    } catch (error) {
      alert(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleResetUserAccount = async (userId: string, userName: string, userEmail: string) => {
    if (!email) return;
    const confirmed = window.confirm(
      `⚠️ RESET USER ACCOUNT?\n\nUser: ${userName} (${userEmail})\n\nThis will DELETE all their organizations and data.\n\nThis cannot be undone!\n\nContinue?`
    );
    if (!confirmed) return;
    try {
      const result = await resetUserAccount({ userId, callerEmail: email, skipClerk: false });
      alert(`✅ ${result.message}\n\nDeleted ${result.orgsDeleted} organization(s):\n${result.organizations.map((o: { name: string; plan: string }) => `• ${o.name} (${o.plan})`).join('\n')}`);
      window.location.reload();
    } catch (error) {
      alert(`Reset failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Cross-navigation helpers
  const goToOrg = (orgId: Id<'organizations'>) => {
    setSelectedOrgId(orgId);
    setActiveTab('orgs');
  };
  const goToUser = (userId: string) => {
    setSelectedUserId(userId);
    setActiveTab('users');
  };

  // ---------------------------------------------------------------------------
  // Access denied
  // ---------------------------------------------------------------------------
  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <Shield className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">This page is restricted to superadmins.</p>
          </div>
        </div>
      </Layout>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-100 dark:bg-amber-950/30 rounded-lg shrink-0">
            <Shield className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Superadmin</h1>
            <p className="text-sm text-muted-foreground">Platform management</p>
          </div>
        </div>

        {/* ── Metrics strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          {[
            { label: 'Total Orgs', value: metrics?.totalOrgs, icon: Building2, color: 'text-muted-foreground' },
            { label: 'Active Orgs', value: metrics?.activeOrgs, icon: CheckCircle2, color: 'text-green-600' },
            { label: 'MRR', value: metrics ? `$${metrics.mrr.toLocaleString()}` : undefined, icon: DollarSign, color: 'text-green-600' },
            { label: 'Encounters', value: metrics?.totalConsultations.toLocaleString(), icon: Stethoscope, color: 'text-muted-foreground' },
            { label: 'This Month', value: metrics?.consultationsThisMonth.toLocaleString(), icon: Activity, color: 'text-blue-600' },
            { label: 'Patients', value: metrics?.totalPatients.toLocaleString(), icon: PawPrint, color: 'text-muted-foreground' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className={`h-3.5 w-3.5 ${color}`} />
                  <span className="text-xs text-muted-foreground">{label}</span>
                </div>
                {value !== undefined ? (
                  <div className="text-xl font-bold">{value}</div>
                ) : (
                  <div className="h-7 w-12 bg-muted animate-pulse rounded" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Tab bar ────────────────────────────────────────────────────── */}
        <div className="flex gap-0 border-b">
          {(([
            { key: 'orgs', label: 'Orgs', count: allOrgs?.length, alert: false },
            { key: 'users', label: 'Users', count: allUsers?.length, alert: false },
            { key: 'attention', label: 'Attention', count: totalAttentionCount || undefined, alert: totalAttentionCount > 0 },
            { key: 'tools', label: 'Tools', count: undefined, alert: false },
          ]) as Array<{ key: Tab; label: string; count: number | undefined; alert: boolean }>).map(({ key, label, count, alert }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 -mb-px
                ${activeTab === key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
            >
              {label}
              {count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-normal
                  ${alert ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            ORGS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'orgs' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 520 }}>

            {/* Left: org list */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search orgs…"
                  value={orgSearch}
                  onChange={(e) => setOrgSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 520 }}>
                {!allOrgs ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredOrgs?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No orgs found</p>
                ) : filteredOrgs?.map((org) => (
                  <button
                    key={org._id}
                    onClick={() => setSelectedOrgId(org._id)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors
                      ${selectedOrgId === org._id
                        ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50 border-transparent hover:border-border'
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{org.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium ${statusColor[org.billingStatus] || statusColor.incomplete}`}>
                        {org.billingStatus}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                      <span className="capitalize">{org.plan}</span>
                      <span>·</span>
                      <span>{org.activeSeats}/{org.maxProviderSeats} seats</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: org detail */}
            <div className="lg:col-span-3">
              {!selectedOrg ? (
                <div className="h-full min-h-[300px] flex items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Building2 className="h-8 w-8 mx-auto opacity-25" />
                    <p className="text-sm">Select an org to view details</p>
                  </div>
                </div>
              ) : (
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="text-base">{selectedOrg.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">
                          <span className="font-mono">/{selectedOrg.slug}</span>
                          <span className="mx-1">·</span>
                          <span className="capitalize">{selectedOrg.plan}</span>
                          <span className="mx-1">·</span>
                          <span>Created {new Date(selectedOrg.createdAt).toLocaleDateString()}</span>
                        </CardDescription>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusColor[selectedOrg.billingStatus] || statusColor.incomplete}`}>
                        {selectedOrg.billingStatus}
                      </span>
                    </div>

                    {/* Quick stats */}
                    <div className="grid grid-cols-2 gap-2 mt-3">
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <div className="text-lg font-bold">{selectedOrg.activeSeats}/{selectedOrg.maxProviderSeats}</div>
                        <div className="text-xs text-muted-foreground">Seats used</div>
                      </div>
                      <div className="p-2.5 bg-muted/40 rounded-lg">
                        <div className="text-xs font-mono text-muted-foreground/70 truncate pt-1">{selectedOrg.clerkOrgId}</div>
                        <div className="text-xs text-muted-foreground">Clerk ID</div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-2 flex-wrap mt-3">
                      <Button
                        size="sm"
                        className="gap-1.5"
                        onClick={() => { window.location.href = `/?assume=${selectedOrg._id}`; }}
                      >
                        Assume
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                      {selectedOrg.billingStatus !== 'active' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-900 dark:hover:bg-green-950/30"
                          onClick={() => setGrantTarget({ id: selectedOrg._id, name: selectedOrg.name, plan: selectedOrg.plan })}
                        >
                          <Unlock className="h-3.5 w-3.5" />
                          Grant Access
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                        onClick={() => setDeleteOrgTarget({ id: selectedOrg._id, name: selectedOrg.name })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>

                    {/* Plan selector */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <span className="text-xs text-muted-foreground shrink-0">Plan</span>
                      <Select
                        value={selectedOrg.plan}
                        onValueChange={async (plan) => {
                          if (!email) return;
                          try {
                            await updateOrgPlan({ orgId: selectedOrg._id, plan, callerEmail: email });
                          } catch (e) {
                            alert(`Failed to update plan: ${e instanceof Error ? e.message : e}`);
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs w-40">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="solo">Solo</SelectItem>
                          <SelectItem value="practice">Practice</SelectItem>
                          <SelectItem value="multi-location">Multi-location</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Members</div>
                    {orgMembers === undefined ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : orgMembers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No members</p>
                    ) : (
                      <div className="space-y-1">
                        {orgMembers.map((member) => (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <span className="text-sm font-medium">{member.name}</span>
                              <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                            </div>
                            <Select
                              value={member.role}
                              onValueChange={async (role) => {
                                try {
                                  await updateMemberRole({ membershipId: member.membershipId, role });
                                } catch (e) {
                                  alert(`Failed to update role: ${e instanceof Error ? e.message : e}`);
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 text-xs w-32 shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="owner">Owner</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="practice-admin">Practice Admin</SelectItem>
                                <SelectItem value="provider">Provider</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 h-7 text-xs gap-1"
                              onClick={() => goToUser(member.userId)}
                            >
                              View
                              <ChevronRight className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            USERS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4" style={{ minHeight: 520 }}>

            {/* Left: user list */}
            <div className="lg:col-span-2 flex flex-col gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search users…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-9 h-9"
                />
              </div>

              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: 520 }}>
                {loadingUsers ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredUsers?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No users found</p>
                ) : filteredUsers?.map((u) => (
                  <button
                    key={u.userId}
                    onClick={() => setSelectedUserId(u.userId)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors
                      ${selectedUserId === u.userId
                        ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/20'
                        : 'hover:bg-muted/50 border-transparent hover:border-border'
                      }`}
                  >
                    <div className="font-medium text-sm truncate">{u.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Building2 className="h-3 w-3" />
                      {u.orgCount} {u.orgCount === 1 ? 'org' : 'orgs'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: user detail */}
            <div className="lg:col-span-3">
              {!selectedUser ? (
                <div className="h-full min-h-[300px] flex items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                  <div className="text-center space-y-2">
                    <Users className="h-8 w-8 mx-auto opacity-25" />
                    <p className="text-sm">Select a user to view details</p>
                  </div>
                </div>
              ) : (
                <Card className="h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{selectedUser.name}</CardTitle>
                        <CardDescription className="text-xs mt-0.5">{selectedUser.email}</CardDescription>
                        <div className="text-xs font-mono text-muted-foreground/60 mt-1">{selectedUser.userId}</div>
                      </div>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {selectedUser.source === 'vet_record' ? 'Profile complete' : selectedUser.source === 'clerk' ? 'From Clerk' : 'Incomplete'}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30 w-fit mt-2"
                      onClick={() => handleResetUserAccount(selectedUser.userId, selectedUser.name, selectedUser.email)}
                      disabled={selectedUser.orgCount === 0}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Reset Account
                    </Button>
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Organizations &amp; Activity
                    </div>
                    {userOrgs === undefined ? (
                      <div className="flex justify-center py-6">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : userOrgs.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">No organizations</p>
                    ) : (
                      <div className="space-y-1">
                        {userOrgs.map((org) => (
                          <div
                            key={org.orgId}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg border hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium">{org.orgName}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColor[org.billingStatus] || statusColor.incomplete}`}>
                                  {org.billingStatus}
                                </span>
                                <Badge variant="outline" className="text-xs capitalize">{org.role}</Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                                <span className="capitalize">{org.plan}</span>
                                <span>·</span>
                                <span>{org.consultationCount} encounter{org.consultationCount !== 1 ? 's' : ''}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => goToOrg(org.orgId)}
                              >
                                Org
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => { window.location.href = `/?assume=${org.orgId}`; }}
                              >
                                Assume
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            ATTENTION TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'attention' && (
          <div className="space-y-4">
            {!attention ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : totalAttentionCount === 0 ? (
              <div className="flex items-center gap-2 text-sm text-green-600 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-900">
                <CheckCircle2 className="h-4 w-4" />
                No organizations need attention right now.
              </div>
            ) : (
              <>
                {/* Expiring trials */}
                {attention.expiringTrials.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      <Clock className="h-3.5 w-3.5" />
                      Expiring Trials ({attention.expiringTrials.length})
                    </div>
                    {attention.expiringTrials.map((org) => (
                      <div key={org._id} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                        <div className="flex-1 min-w-0">
                          <button className="font-medium text-sm hover:underline" onClick={() => goToOrg(org._id)}>{org.name}</button>
                          <div className="text-xs text-muted-foreground">
                            <span className="capitalize">{org.plan}</span>
                            {' · '}
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {org.daysRemaining === 0 ? 'Expires today' : `${org.daysRemaining} day${org.daysRemaining !== 1 ? 's' : ''} remaining`}
                            </span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => { window.location.href = `/?assume=${org._id}`; }}>
                          Assume <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Payment issues */}
                {attention.paymentIssues.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wider">
                      <CreditCard className="h-3.5 w-3.5" />
                      Payment Issues ({attention.paymentIssues.length})
                    </div>
                    {attention.paymentIssues.map((org) => (
                      <div key={org._id} className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                        <div className="flex-1 min-w-0">
                          <button className="font-medium text-sm hover:underline" onClick={() => goToOrg(org._id)}>{org.name}</button>
                          <div className="text-xs text-muted-foreground">
                            <span className="capitalize">{org.plan}</span>
                            {' · '}
                            <span className="text-red-600 dark:text-red-400 font-medium">{org.billingStatus.replace('_', ' ')}</span>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => { window.location.href = `/?assume=${org._id}`; }}>
                          Assume <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Approaching limits */}
                {attention.approachingLimits.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Approaching Limits ({attention.approachingLimits.length})
                    </div>
                    {attention.approachingLimits.map((org) => (
                      <div key={org._id} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-900">
                        <div className="flex-1 min-w-0">
                          <button className="font-medium text-sm hover:underline" onClick={() => goToOrg(org._id)}>{org.name}</button>
                          <div className="text-xs text-muted-foreground">
                            <span className="capitalize">{org.plan}</span>
                            {' · '}
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              {org.usage}/{org.limit} encounters ({org.percentUsed}%)
                            </span>
                          </div>
                        </div>
                        <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${org.percentUsed >= 100 ? 'bg-red-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(org.percentUsed, 100)}%` }}
                          />
                        </div>
                        <Button variant="outline" size="sm" className="gap-1 shrink-0" onClick={() => { window.location.href = `/?assume=${org._id}`; }}>
                          Assume <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* Charts (collapsed by default) */}
            {metrics && (
              <div className="pt-2">
                <button
                  className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground mb-3"
                  onClick={() => setAttentionOpen(!attentionOpen)}
                >
                  {attentionOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  Platform Charts
                </button>
                {attentionOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Daily Encounters (30d)</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          {metrics.consultationTrend.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={metrics.consultationTrend} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                                <XAxis dataKey="date" tick={axisTickStyle} tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} interval="preserveStartEnd" />
                                <YAxis tick={axisTickStyle} allowDecimals={false} width={28} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Encounters']} labelFormatter={(l) => new Date(l).toLocaleDateString(undefined, { weekday: 'short', month: 'long', day: 'numeric' })} />
                                <Line type="monotone" dataKey="count" stroke={colors.chart[0]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                              </LineChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Org Signups by Month</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="h-48">
                          {metrics.orgSignupsByMonth.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No data yet</div>
                          ) : (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={metrics.orgSignupsByMonth} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                                <XAxis dataKey="month" tick={axisTickStyle} tickFormatter={(m) => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1).toLocaleDateString(undefined, { month: 'short' }); }} />
                                <YAxis tick={axisTickStyle} allowDecimals={false} width={28} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, 'Signups']} labelFormatter={(m) => { const [y, mo] = m.split('-'); return new Date(Number(y), Number(mo) - 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }); }} />
                                <Bar dataKey="count" fill={colors.chart[1]} radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            TOOLS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tools' && (
          <div className="space-y-4 max-w-xl">
            <Card className="border-2 border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Testing Tools
                </CardTitle>
                <CardDescription>Rapid testing utilities for development</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-card rounded-lg border space-y-2">
                  <h3 className="font-semibold text-sm">Reset My Account</h3>
                  <p className="text-sm text-muted-foreground">
                    Delete all your organizations and data to test onboarding flows.
                  </p>
                  <Button onClick={handleResetMyAccount} variant="destructive" size="sm" className="gap-1.5 mt-1">
                    <Trash2 className="h-4 w-4" />
                    Reset My Account
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

      </div>

      {/* ── Grant Access Confirmation ─────────────────────────────────────── */}
      <AlertDialog open={!!grantTarget} onOpenChange={(open) => !open && setGrantTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Grant Access</AlertDialogTitle>
            <AlertDialogDescription>
              This will activate billing for <span className="font-medium text-foreground">{grantTarget?.name}</span> on
              the <span className="font-medium text-foreground capitalize">{grantTarget?.plan}</span> plan
              with {PLAN_SEAT_LABELS[grantTarget?.plan ?? ''] ?? '1 seat'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-green-600 hover:bg-green-700" onClick={handleGrantAccess}>
              Grant Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Org Confirmation ───────────────────────────────────────── */}
      <AlertDialog open={!!deleteOrgTarget} onOpenChange={(open) => !open && setDeleteOrgTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <span className="font-medium text-foreground">{deleteOrgTarget?.name}</span> and
              all associated data including memberships, patients, encounters, companion sessions, follow-ups, usage records, and locations.
              <p className="mt-2 font-semibold text-red-600">This cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDeleteOrg}>
              Delete Organization
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}
