/*
 * What a subscription costs a month, to weigh it against the API-equivalent
 * cost of the turns Boite ran on it. The defaults are the public list prices
 * in US dollars as of 2026-11; the owner corrects any of them in the app, and
 * an unknown plan stays unpriced until they do.
 */

interface PlanPrice {
  provider: string;
  pattern: RegExp;
  usd: number;
}

const PLAN_PRICES: readonly PlanPrice[] = [
  { provider: 'claude', pattern: /max\s*(x\s*)?20/i, usd: 200 },
  { provider: 'claude', pattern: /max/i, usd: 100 },
  { provider: 'claude', pattern: /pro/i, usd: 20 },
  { provider: 'codex', pattern: /pro/i, usd: 200 },
  { provider: 'codex', pattern: /plus/i, usd: 20 },
  { provider: 'copilot', pattern: /pro\s*\+|pro\s*plus/i, usd: 39 },
  { provider: 'copilot', pattern: /pro/i, usd: 10 },
  { provider: 'copilot', pattern: /student|free|gratuit/i, usd: 0 }
];

/** The list price of `plan` at `providerId`, or null when Carton does not know it. */
export function defaultPrice(providerId: string, plan: string | null | undefined): number | null {
  if (!plan) return null;
  const found = PLAN_PRICES.find((entry) => entry.provider === providerId && entry.pattern.test(plan));
  return found ? found.usd : null;
}
