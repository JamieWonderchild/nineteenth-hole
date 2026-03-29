import { NextRequest, NextResponse } from 'next/server';
import { writeFile, appendFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Use /tmp on Vercel (serverless), otherwise use cwd for local dev
const LOG_DIR = process.env.VERCEL
  ? '/tmp/debug-logs'
  : path.join(process.cwd(), 'debug-logs');
const LOG_FILE = path.join(LOG_DIR, 'client-debug.log');

export async function POST(request: NextRequest) {
  try {
    const { logs } = await request.json();

    if (!logs || !Array.isArray(logs)) {
      return NextResponse.json({ error: 'Invalid logs format' }, { status: 400 });
    }

    // Ensure log directory exists
    if (!existsSync(LOG_DIR)) {
      await mkdir(LOG_DIR, { recursive: true });
    }

    // Format logs
    const formattedLogs = logs.map((log: any) => {
      const dataStr = log.data ? `\n  Data: ${JSON.stringify(log.data, null, 2)}` : '';
      return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.component}] ${log.message}${dataStr}\n`;
    }).join('');

    // Append to log file
    await appendFile(LOG_FILE, formattedLogs);

    return NextResponse.json({ success: true, count: logs.length });
  } catch (error) {
    console.error('Failed to write debug logs:', error);
    return NextResponse.json(
      { error: 'Failed to write logs' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve logs
export async function GET() {
  try {
    if (!existsSync(LOG_FILE)) {
      return new NextResponse('No logs found', { status: 404 });
    }

    const { readFile } = await import('fs/promises');
    const logs = await readFile(LOG_FILE, 'utf-8');

    return new NextResponse(logs, {
      headers: {
        'Content-Type': 'text/plain',
        'Content-Disposition': 'attachment; filename="client-debug.log"',
      },
    });
  } catch (error) {
    console.error('Failed to read debug logs:', error);
    return NextResponse.json(
      { error: 'Failed to read logs' },
      { status: 500 }
    );
  }
}

// DELETE endpoint to clear logs
export async function DELETE() {
  try {
    if (existsSync(LOG_FILE)) {
      await writeFile(LOG_FILE, '');
    }
    return NextResponse.json({ success: true, message: 'Logs cleared' });
  } catch (error) {
    console.error('Failed to clear debug logs:', error);
    return NextResponse.json(
      { error: 'Failed to clear logs' },
      { status: 500 }
    );
  }
}
