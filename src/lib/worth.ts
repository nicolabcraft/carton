/*
 * The month's worth: the API-equivalent cost of the turns Boite ran on each
 * subscription since the first of the month, against what the subscriptions
 * cost. Above 100 % the subscription paid for itself; below, it did not yet.
 */
import type { UsageHistory } from './types';

/** Subscription providers whose turns can also run under another harness (`claude/copilot/...`). */
const SUBSCRIPTIONS = new Set(['claude', 'codex', 'copilot', 'grok', 'antigravity']);

/** The local first of the month and now: the edges `usage.history` takes. */
export function monthEdges(now: number): [number, number] {
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return [start.getTime(), now];
}

/** The share of the calendar month elapsed at `now`, 0 to 1. */
export function monthElapsed(now: number): number {
  const [start] = monthEdges(now);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return Math.min(1, Math.max(0, (now - start) / (end.getTime() - start)));
}

/**
 * The subscription a usage row spent, or null when it ran elsewhere. A model
 * with a provider prefix ran through that route: `claude/claude-opus-5-5` is
 * Claude, `copilot/gpt-6` under the Claude harness is Copilot, and
 * `ollama/...` or `omniroute/...` is no subscription Carton weighs.
 */
export function subscriptionOf(providerId: string, model: string | null): string | null {
  if (model === null || !model.includes('/')) return providerId;
  const prefix = model.slice(0, model.indexOf('/'));
  return SUBSCRIPTIONS.has(prefix) ? prefix : null;
}

/** API-equivalent dollars per subscription provider. */
export function costByProvider(history: UsageHistory): Map<string, number> {
  const costs = new Map<string, number>();
  for (const row of history.rows) {
    const provider = subscriptionOf(row.providerId, row.model);
    if (provider === null) continue;
    costs.set(provider, (costs.get(provider) ?? 0) + (row.usage.costUsdEquivalent ?? 0));
  }
  return costs;
}

export interface Worth {
  provider: string;
  /** API-equivalent dollars since the first of the month. */
  cost: number;
  /** Monthly price of the subscriptions counted, null when none is priced. */
  price: number | null;
  /** `cost / price` in percent, null without a positive price. */
  percent: number | null;
  /** The cost at the end of the month at the current rate. */
  projected: number;
  /** Dollars still to use this month to reach the price, 0 once reached. */
  missing: number | null;
}

export function worthOf(provider: string, cost: number, price: number | null, now: number): Worth {
  const elapsed = monthElapsed(now);
  const projected = elapsed > 0 ? cost / elapsed : cost;
  if (price === null || price <= 0) return { provider, cost, price, percent: null, projected, missing: null };
  return { provider, cost, price, percent: (cost / price) * 100, projected, missing: Math.max(0, price - cost) };
}
