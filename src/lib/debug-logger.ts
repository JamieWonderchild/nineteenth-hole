// Client-side debug logger that sends logs to API endpoint for file writing
// Use this when browser console is inaccessible

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  component: string;
  message: string;
  data?: any;
}

class DebugLogger {
  private enabled = process.env.NODE_ENV === 'development';
  private buffer: LogEntry[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window !== 'undefined' && this.enabled) {
      // Flush logs every 2 seconds
      this.flushInterval = setInterval(() => this.flush(), 2000);

      // Flush on page unload
      window.addEventListener('beforeunload', () => this.flush());
    }
  }

  private createEntry(
    level: LogEntry['level'],
    component: string,
    message: string,
    data?: any
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      component,
      message,
      data: data ? JSON.parse(JSON.stringify(data, this.getCircularReplacer())) : undefined,
    };
  }

  // Handle circular references in data
  private getCircularReplacer() {
    const seen = new WeakSet();
    return (_key: string, value: any) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    };
  }

  info(component: string, message: string, data?: any) {
    if (!this.enabled) return;
    const entry = this.createEntry('info', component, message, data);
    this.buffer.push(entry);
    console.log(`[${component}]`, message, data);
  }

  warn(component: string, message: string, data?: any) {
    if (!this.enabled) return;
    const entry = this.createEntry('warn', component, message, data);
    this.buffer.push(entry);
    console.warn(`[${component}]`, message, data);
  }

  error(component: string, message: string, data?: any) {
    if (!this.enabled) return;
    const entry = this.createEntry('error', component, message, data);
    this.buffer.push(entry);
    console.error(`[${component}]`, message, data);
  }

  debug(component: string, message: string, data?: any) {
    if (!this.enabled) return;
    const entry = this.createEntry('debug', component, message, data);
    this.buffer.push(entry);
    console.debug(`[${component}]`, message, data);
  }

  private async flush() {
    if (this.buffer.length === 0) return;

    const logsToSend = [...this.buffer];
    this.buffer = [];

    try {
      await fetch('/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logs: logsToSend }),
      });
    } catch (error) {
      // Silently fail - don't want logging to break the app
      console.error('Failed to send debug logs:', error);
    }
  }

  cleanup() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush();
  }
}

export const debugLog = new DebugLogger();
