// Utility for logging errors to Convex for debugging
import { ConvexHttpClient } from "convex/browser";
import { api } from 'convex/_generated/api';
import type { Id } from 'convex/_generated/dataModel';

const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export type ErrorCategory =
  | "corti-stream"
  | "corti-facts"
  | "corti-document"
  | "corti-agent"
  | "corti-auth"
  | "websocket"
  | "client-error"
  | "other";

export type ErrorSeverity = "error" | "warning" | "info";

export interface LogErrorParams {
  category: ErrorCategory;
  severity: ErrorSeverity;
  message: string;
  error?: Error;
  interactionId?: string;
  endpoint?: string;
  requestPayload?: any; // Will be sanitized and stringified
  userId?: string;
  orgId?: string | Id<"organizations">;
  metadata?: Record<string, any>;
}

/**
 * Log an error to Convex for debugging
 * Sanitizes sensitive data before logging
 */
export async function logError(params: LogErrorParams): Promise<void> {
  try {
    // Sanitize request payload - remove sensitive fields
    let sanitizedPayload: string | undefined;
    if (params.requestPayload) {
      const payload = { ...params.requestPayload };
      // Remove sensitive fields
      delete payload.password;
      delete payload.apiKey;
      delete payload.token;
      delete payload.secret;
      sanitizedPayload = JSON.stringify(payload);
    }

    // Sanitize metadata
    let sanitizedMetadata: string | undefined;
    if (params.metadata) {
      sanitizedMetadata = JSON.stringify(params.metadata);
    }

    await convexClient.mutation(api.errorLogs.logError, {
      category: params.category,
      severity: params.severity,
      message: params.message,
      stack: params.error?.stack,
      interactionId: params.interactionId,
      endpoint: params.endpoint,
      requestPayload: sanitizedPayload,
      userId: params.userId,
      orgId: params.orgId as Id<"organizations"> | undefined,
      metadata: sanitizedMetadata,
    });
  } catch (err) {
    // Don't let logging errors break the app
    console.error("Failed to log error to Convex:", err);
  }
}

/**
 * Wrapper for API route error handling with automatic logging
 */
export function withErrorLogging<T>(
  category: ErrorCategory,
  endpoint: string,
  fn: () => Promise<T>
): Promise<T> {
  return fn().catch(async (error) => {
    await logError({
      category,
      severity: "error",
      message: error.message || "Unknown error",
      error,
      endpoint,
    });
    throw error;
  });
}
