// ── Shared payment provider interface ────────────────────────────────────────

export interface CreateIntentOpts {
  amount: number;        // pence
  currency: string;      // 'GBP' | 'USD' | 'EUR'
  description: string;
  returnUrl?: string;    // redirect after hosted checkout
  metadata?: Record<string, string>;
}

export interface CreateIntentResult {
  providerIntentId: string;
  checkoutUrl?: string;  // hosted checkout — open in new tab
  clientSecret?: string; // for embedded flows
}

export interface SendToTerminalOpts {
  providerIntentId: string;
  terminalId: string;    // provider's terminal / device ID
}

export type WebhookEventType = "payment.captured" | "payment.failed" | "payment.refunded";

export interface WebhookEvent {
  type: WebhookEventType;
  providerIntentId: string;
  amount: number;
  currency?: string;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  readonly name: string; // 'dojo' | 'square'

  /** Create a new payment intent (online or to-be-sent-to-terminal) */
  createIntent(opts: CreateIntentOpts): Promise<CreateIntentResult>;

  /** Initiate a session on a physical terminal */
  sendToTerminal(opts: SendToTerminalOpts): Promise<void>;

  /** Cancel a pending intent (before capture) */
  cancelIntent(providerIntentId: string): Promise<void>;

  /** Full or partial refund */
  refund(providerIntentId: string, amountPence?: number): Promise<void>;

  /** Verify and parse an inbound webhook payload */
  verifyWebhook(payload: string, signature: string): WebhookEvent;
}
