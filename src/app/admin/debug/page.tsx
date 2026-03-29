'use client';

import { useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation } from 'convex/react';
import { api } from 'convex/_generated/api';
import { Layout } from '@/components/layout/Layout';
import { isSuperadmin } from '@/lib/superadmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Bug,
  Download,
  CheckCircle2,
  AlertCircle,
  Info,
  RefreshCw,
} from 'lucide-react';
import type { Id } from 'convex/_generated/dataModel';

export default function DebugPage() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = isSuperadmin(email);

  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const logs = useQuery(
    api.errorLogs.getErrorLogs,
    isAdmin ? { limit: 100, category: categoryFilter === 'all' ? undefined : categoryFilter } : 'skip'
  );

  const stats = useQuery(api.errorLogs.getErrorStats, isAdmin ? {} : 'skip');
  const markResolved = useMutation(api.errorLogs.markErrorResolved);

  if (!isAdmin) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center space-y-2">
            <Bug className="h-12 w-12 text-muted-foreground/40 mx-auto" />
            <h2 className="text-lg font-semibold">Access Denied</h2>
            <p className="text-sm text-muted-foreground">
              This page is restricted to superadmins.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  const handleExport = () => {
    if (!logs) return;

    const data = logs.map(log => ({
      timestamp: log.createdAt,
      category: log.category,
      severity: log.severity,
      message: log.message,
      interactionId: log.interactionId || 'N/A',
      endpoint: log.endpoint || 'N/A',
      userId: log.userId || 'N/A',
      orgId: log.orgId || 'N/A',
      stack: log.stack || '',
      payload: log.requestPayload || '',
      metadata: log.metadata || '',
      resolved: log.resolved,
    }));

    const csv = [
      Object.keys(data[0]).join(','),
      ...data.map(row => Object.values(row).map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vetai-error-logs-${new Date().toISOString()}.csv`;
    a.click();
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-amber-600" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-700';
      case 'warning':
        return 'bg-amber-100 text-amber-700';
      case 'info':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-red-100 rounded-lg">
              <Bug className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">Debug Logs</h1>
              <p className="text-sm text-muted-foreground">
                Error tracking for Corti integration and system issues
              </p>
            </div>
          </div>
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">Total Errors</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold text-red-600">{stats.unresolved}</div>
                <div className="text-xs text-muted-foreground">Unresolved</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.bySeverity.error || 0}</div>
                <div className="text-xs text-muted-foreground">Errors</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{stats.bySeverity.warning || 0}</div>
                <div className="text-xs text-muted-foreground">Warnings</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Category:</span>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="corti-stream">Corti Stream</SelectItem>
                    <SelectItem value="corti-facts">Corti Facts</SelectItem>
                    <SelectItem value="corti-document">Corti Document</SelectItem>
                    <SelectItem value="corti-agent">Corti Agent</SelectItem>
                    <SelectItem value="corti-auth">Corti Auth</SelectItem>
                    <SelectItem value="websocket">WebSocket</SelectItem>
                    <SelectItem value="client-error">Client Error</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Logs */}
        <div className="space-y-2">
          {logs && logs.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-600" />
                <p>No errors logged yet. System is running smoothly!</p>
              </CardContent>
            </Card>
          ) : (
            logs?.map((log) => (
              <Card key={log._id} className={log.resolved ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(log.severity)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={getSeverityColor(log.severity)}>
                            {log.severity}
                          </Badge>
                          <Badge variant="outline">{log.category}</Badge>
                          {log.interactionId && (
                            <Badge variant="outline" className="font-mono text-xs">
                              {log.interactionId}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(log.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-sm font-medium mt-1">{log.message}</p>
                        {log.endpoint && (
                          <p className="text-xs text-muted-foreground font-mono">{log.endpoint}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}
                        >
                          {expandedId === log._id ? 'Hide' : 'Details'}
                        </Button>
                        <Button
                          size="sm"
                          variant={log.resolved ? 'outline' : 'default'}
                          onClick={() =>
                            markResolved({
                              errorId: log._id as Id<'errorLogs'>,
                              resolved: !log.resolved,
                            })
                          }
                        >
                          {log.resolved ? <RefreshCw className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {expandedId === log._id && (
                      <div className="space-y-2 pt-2 border-t text-xs">
                        {log.stack && (
                          <div>
                            <p className="font-medium mb-1">Stack Trace:</p>
                            <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
                              {log.stack}
                            </pre>
                          </div>
                        )}
                        {log.requestPayload && (
                          <div>
                            <p className="font-medium mb-1">Request Payload:</p>
                            <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.requestPayload), null, 2)}
                            </pre>
                          </div>
                        )}
                        {log.metadata && (
                          <div>
                            <p className="font-medium mb-1">Metadata:</p>
                            <pre className="bg-muted p-2 rounded text-[10px] overflow-x-auto">
                              {JSON.stringify(JSON.parse(log.metadata), null, 2)}
                            </pre>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                          {log.userId && (
                            <div>
                              <span className="font-medium">User ID:</span> {log.userId}
                            </div>
                          )}
                          {log.orgId && (
                            <div>
                              <span className="font-medium">Org ID:</span> {log.orgId}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}
