const CURRENCY_SYMBOLS: Record<string, string> = {
  GBP: "£",
  EUR: "€",
  USD: "$",
};

export function formatCurrency(amountInPence: number, currency: string): string {
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const amount = amountInPence / 100;
  return `${symbol}${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}
