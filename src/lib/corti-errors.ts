// Shared error handling for Corti API routes
import { NextResponse } from 'next/server';

/**
 * Handles errors from Corti API calls and returns an appropriate NextResponse.
 * Covers: DocumentGenerationError (with details), credential errors, auth errors, and generic errors.
 */
export function handleCortiApiError(error: unknown, context: string): NextResponse {
  console.error(`[${context}] Error:`, error);

  // Handle DocumentGenerationError with full Corti error details
  if (error && typeof error === 'object' && 'details' in error) {
    const docError = error as { message: string; status: number; details: unknown };
    console.error(`[${context}] Corti API error details:`, JSON.stringify(docError.details, null, 2));
    return NextResponse.json(
      {
        error: 'Document generation failed',
        details: docError.message,
        cortiError: docError.details,
      },
      { status: docError.status || 500 }
    );
  }

  if (error instanceof Error) {
    if (error.message.includes('Missing Corti credentials') || error.message.includes('Missing required Corti environment')) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing Corti API credentials' },
        { status: 500 }
      );
    }

    if (error.message.includes('Authentication failed')) {
      return NextResponse.json(
        { error: 'Corti authentication failed. Check API credentials.' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: `${context} failed`, details: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { error: 'An unexpected error occurred' },
    { status: 500 }
  );
}
