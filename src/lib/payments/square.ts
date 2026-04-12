import type {
  PaymentProvider,
  CreateIntentOpts,
  CreateIntentResult,
  SendToTerminalOpts,
  WebhookEvent,
} from "./types";

// Square integration — stub (swap in when ready)
// Docs: https://developer.squareup.com/docs/payments-api/overview
// SDK:  npm install square

export class SquareProvider implements PaymentProvider {
  readonly name = "square";

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async createIntent(_opts: CreateIntentOpts): Promise<CreateIntentResult> {
    throw new Error("Square integration not yet configured. Set PAYMENT_PROVIDER=dojo or implement SquareProvider.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async sendToTerminal(_opts: SendToTerminalOpts): Promise<void> {
    throw new Error("Square integration not yet configured.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async refund(_providerIntentId: string, _amountPence?: number): Promise<void> {
    throw new Error("Square integration not yet configured.");
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  verifyWebhook(_payload: string, _signature: string): WebhookEvent {
    throw new Error("Square integration not yet configured.");
  }
}
