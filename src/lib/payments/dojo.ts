import crypto from "crypto";
import type {
  PaymentProvider,
  CreateIntentOpts,
  CreateIntentResult,
  SendToTerminalOpts,
  WebhookEvent,
} from "./types";

// Dojo API docs: https://docs.dojo.tech/payments/api
// Auth: Basic HTTP auth — base64(apiKey)
// Base URL: https://api.dojo.tech

const BASE_URL = "https://api.dojo.tech";
const API_VERSION = "2022-04-07";

export class DojoProvider implements PaymentProvider {
  readonly name = "dojo";

  private readonly apiKey: string;
  private readonly webhookSecret: string;

  constructor(apiKey: string, webhookSecret: string) {
    this.apiKey = apiKey;
    this.webhookSecret = webhookSecret;
  }

  private authHeader(): string {
    return "Basic " + Buffer.from(this.apiKey).toString("base64");
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: this.authHeader(),
        version: API_VERSION,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => res.statusText);
      throw new Error(`Dojo ${method} ${path} → ${res.status}: ${text}`);
    }

    return res.json() as Promise<T>;
  }

  async createIntent(opts: CreateIntentOpts): Promise<CreateIntentResult> {
    // https://docs.dojo.tech/api#tag/Payment-Intents/operation/PaymentIntents_Create
    const body = {
      amount: {
        value: opts.amount,
        currencyCode: opts.currency,
      },
      reference: opts.description,
      paymentMethods: ["Card"],
      config: {
        redirectUrl: opts.returnUrl ?? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/manage/wallet/confirm`,
        title: opts.description,
      },
      metadata: opts.metadata ?? {},
    };

    const data = await this.request<{ id: string; _links?: { checkout?: { href: string } } }>(
      "POST",
      "/payment-intents",
      body
    );

    return {
      providerIntentId: data.id,
      checkoutUrl: data._links?.checkout?.href,
    };
  }

  async sendToTerminal(opts: SendToTerminalOpts): Promise<void> {
    // https://docs.dojo.tech/payments/accept-payments/in-person-payments/pay-at-counter
    await this.request(
      "POST",
      `/payment-intents/${opts.providerIntentId}/sessions`,
      { terminalId: opts.terminalId }
    );
  }

  async cancelIntent(providerIntentId: string): Promise<void> {
    // Dojo: DELETE /payment-intents/{id}
    await this.request("DELETE", `/payment-intents/${providerIntentId}`);
  }

  async refund(providerIntentId: string, amountPence?: number): Promise<void> {
    const body = amountPence ? { amount: { value: amountPence } } : {};
    await this.request("POST", `/payment-intents/${providerIntentId}/refunds`, body);
  }

  verifyWebhook(payload: string, signature: string): WebhookEvent {
    // Dojo signs with HMAC-SHA256; signature is in the `dojo-signature` header
    const expected = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      throw new Error("Invalid Dojo webhook signature");
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const event = JSON.parse(payload) as any;

    // Map Dojo status → our event type
    // Dojo status values: Created, Authorized, Captured, Reversed, Refunded, Canceled
    const statusMap: Record<string, WebhookEvent["type"]> = {
      Captured: "payment.captured",
      Refunded: "payment.refunded",
      Reversed: "payment.refunded",
      Canceled: "payment.failed",
    };

    const dojoStatus: string = event.status ?? event.data?.status ?? "";
    const type = statusMap[dojoStatus] ?? "payment.failed";

    const intentId: string =
      event.id ?? event.data?.id ?? event.paymentIntentId ?? "";

    const amount: number =
      event.amount?.value ??
      event.data?.amount?.value ??
      0;

    return {
      type,
      providerIntentId: intentId,
      amount,
      currency: event.amount?.currencyCode ?? event.data?.amount?.currencyCode,
      metadata: event.metadata ?? event.data?.metadata ?? {},
    };
  }
}
