import { DojoProvider } from "./dojo";
import { SquareProvider } from "./square";
import type { PaymentProvider } from "./types";

export * from "./types";

let _provider: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  if (_provider) return _provider;

  const name = (process.env.PAYMENT_PROVIDER ?? "dojo").toLowerCase();

  if (name === "square") {
    _provider = new SquareProvider();
    return _provider;
  }

  // Default: Dojo
  const apiKey = process.env.DOJO_API_KEY ?? "";
  const webhookSecret = process.env.DOJO_WEBHOOK_SECRET ?? "";

  if (!apiKey) {
    console.warn("[payments] DOJO_API_KEY not set — payment calls will fail");
  }

  _provider = new DojoProvider(apiKey, webhookSecret);
  return _provider;
}
