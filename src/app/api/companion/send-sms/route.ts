// Send Companion Link via SMS
// POST /api/companion/send-sms
//
// Sends the patient companion URL via SMS using Twilio.
// The physician provides the patient's mobile number; Twilio sends a message
// containing the companion link so the patient doesn't need to scan a QR code.

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveOrg, isAuthError } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 15;

// Lazy-require Twilio so the route doesn't crash when Twilio env vars aren't set
// (it'll just return a 503 with a helpful message).
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const twilio = require('twilio');
  return twilio(accountSid, authToken) as {
    messages: {
      create: (opts: { body: string; from: string; to: string }) => Promise<{ sid: string }>;
    };
  };
}

// Basic E.164 phone normaliser — strips spaces/dashes/parens and prepends +1 if needed
function normalisePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.startsWith('+')) return `+${digits}`;
  // Assume US if 10 digits without country code
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireActiveOrg();
    if (isAuthError(authResult)) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await request.json();
    const { toPhone, companionUrl, patientName, clinicName } = body as {
      toPhone: string;
      companionUrl: string;
      patientName?: string;
      clinicName?: string;
    };

    if (!toPhone || !companionUrl) {
      return NextResponse.json(
        { error: 'toPhone and companionUrl are required' },
        { status: 400 }
      );
    }

    if (!companionUrl.startsWith('https://') && !companionUrl.startsWith('http://')) {
      return NextResponse.json({ error: 'companionUrl must be a valid URL' }, { status: 400 });
    }

    const fromNumber = process.env.TWILIO_FROM_NUMBER;
    const client = getTwilioClient();

    if (!client || !fromNumber) {
      return NextResponse.json(
        {
          error: 'SMS delivery not configured',
          details:
            'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_FROM_NUMBER environment variables to enable SMS.',
        },
        { status: 503 }
      );
    }

    const normalised = normalisePhone(toPhone);
    const practiceTag = clinicName ? ` from ${clinicName}` : '';
    const greeting = patientName ? `Hi ${patientName},` : 'Hi,';

    const messageBody = [
      `${greeting} your care team${practiceTag} has shared an AI health companion with you.`,
      '',
      'You can ask it questions about your visit, medications, and follow-up care anytime:',
      companionUrl,
      '',
      'Reply STOP to opt out.',
    ].join('\n');

    const message = await client.messages.create({
      body: messageBody,
      from: fromNumber,
      to: normalised,
    });

    return NextResponse.json({ success: true, sid: message.sid, to: normalised });
  } catch (error) {
    console.error('[send-sms] Error:', error);
    return NextResponse.json(
      {
        error: 'Failed to send SMS',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
