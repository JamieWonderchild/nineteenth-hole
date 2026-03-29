'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Trash2 } from 'lucide-react';

export default function DebugLogsPage() {
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/debug/log');
      if (response.ok) {
        const text = await response.text();
        setLogs(text);
      } else {
        setLogs('No logs found');
      }
    } catch (error) {
      setLogs(`Error loading logs: ${error}`);
    }
    setLoading(false);
  };

  const clearLogs = async () => {
    if (!confirm('Clear all debug logs?')) return;

    try {
      await fetch('/api/debug/log', { method: 'DELETE' });
      setLogs('');
      alert('Logs cleared');
    } catch (error) {
      alert(`Error clearing logs: ${error}`);
    }
  };

  const downloadLogs = () => {
    const blob = new Blob([logs], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.log`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 3 seconds
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Debug Logs</h1>
          <div className="flex gap-2">
            <Button
              onClick={fetchLogs}
              disabled={loading}
              variant="outline"
              size="sm"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              onClick={downloadLogs}
              disabled={!logs}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button
              onClick={clearLogs}
              disabled={!logs}
              variant="destructive"
              size="sm"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
          </div>
        </div>

        <div className="bg-card border rounded-lg p-4">
          <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-[calc(100vh-200px)]">
            {logs || 'No logs yet. Logs will appear here as you navigate the app.'}
          </pre>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Logs auto-refresh every 3 seconds</p>
          <p>Log file location: <code>debug-logs/client-debug.log</code></p>
        </div>
      </div>
    </div>
  );
}
