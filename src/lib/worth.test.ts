import { describe, expect, it } from 'vitest';
import { defaultPrice } from './plans';
import { costByProvider, monthEdges, subscriptionOf, worthOf } from './worth';

const row = (providerId: string, model: string | null, cost: number | null) => ({
  bucket: 0,
  providerId,
  model,
  turns: 1,
  reported: 1,
  priced: 1,
  usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsdEquivalent: cost }
});

describe('defaultPrice', () => {
  it.each([
    ['claude', 'Claude Max x5', 100],
    ['claude', 'Claude Max x20', 200],
    ['claude', 'Claude Pro', 20],
    ['claude', 'Claude Team', null],
    ['codex', 'Codex Go', null],
    ['copilot', 'Copilot Student', 0],
    ['copilot', 'Copilot Pro+', 39],
    ['claude', null, null]
  ] as const)('%s %s costs %s', (provider, plan, usd) => {
    expect(defaultPrice(provider, plan)).toBe(usd);
  });
});

describe('subscriptionOf', () => {
  it('keeps plain and self-prefixed models on their provider', () => {
    expect(subscriptionOf('claude', 'claude-opus-5-5')).toBe('claude');
    expect(subscriptionOf('claude', null)).toBe('claude');
    expect(subscriptionOf('claude', 'claude/claude-opus-5-5')).toBe('claude');
  });
  it('moves a routed model to its subscription, or drops it', () => {
    expect(subscriptionOf('claude', 'copilot/gpt-6')).toBe('copilot');
    expect(subscriptionOf('claude', 'omniroute/kr/claude-sonnet-4.5')).toBeNull();
    expect(subscriptionOf('claude', 'ollama/qwen3-coder:30b')).toBeNull();
  });
});

describe('costByProvider', () => {
  it('sums the API-equivalent cost of each subscription', () => {
    const costs = costByProvider({
      edges: [0, 1],
      rows: [
        row('claude', 'claude-opus-5-5', 31.5),
        row('claude', 'claude-sonnet-5-5', 57.9),
        row('claude', 'omniroute/kr/claude-sonnet-4.5', 16),
        row('codex', null, null)
      ]
    });
    expect(costs.get('claude')).toBeCloseTo(89.4, 5);
    expect(costs.get('codex')).toBe(0);
  });
});

describe('worthOf', () => {
  const now = new Date(2026, 10, 16, 0, 0, 0).getTime(); // 15 of 30 days elapsed

  it('weighs the cost against the price', () => {
    const worth = worthOf('claude', 60, 100, now);
    expect(worth.percent).toBeCloseTo(60, 5);
    expect(worth.missing).toBeCloseTo(40, 5);
    expect(worth.projected).toBeCloseTo(120, 5);
  });
  it('has no percentage without a price', () => {
    expect(worthOf('codex', 10, null, now).percent).toBeNull();
    expect(worthOf('copilot', 10, 0, now).percent).toBeNull();
  });
  it('starts the month at local midnight on the first', () => {
    const [start] = monthEdges(now);
    expect(new Date(start).getDate()).toBe(1);
    expect(new Date(start).getHours()).toBe(0);
  });
});
