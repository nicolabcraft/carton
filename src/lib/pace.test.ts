import { describe, expect, it } from 'vitest';
import { paceOf, periodOf, TOLERANCE } from './pace';

const HOUR = 3_600_000;
const now = new Date('2026-11-02T16:30:00Z').getTime();

describe('periodOf', () => {
  it.each([
    [{ id: 'five-hour', label: '5 hours' }, 'fiveHour'],
    [{ id: 'five_hour', label: 'Session' }, 'fiveHour'],
    [{ id: 'window-18000s', label: 'x' }, 'fiveHour'],
    [{ id: 'seven-day', label: 'Weekly' }, 'weekly'],
    [{ id: 'seven_day_opus', label: 'Weekly · Opus' }, 'weekly'],
    [{ id: 'monthly', label: 'Codex Monthly' }, 'monthly'],
    [{ id: 'premium', label: 'Premium requests' }, 'monthly'],
    [{ id: 'rolling', label: 'Rolling' }, 'other']
  ] as const)('%j is %s', (window, period) => {
    expect(periodOf(window)).toBe(period);
  });
});

describe('paceOf', () => {
  it('reads an under-used five-hour window', () => {
    // Reset in 3 h 20: 1 h 40 of 5 h elapsed, a third.
    const pace = paceOf({ id: 'five-hour', label: '5 hours', usedPercent: 28, resetsAt: now + 3 * HOUR + 20 * 60_000 }, now);
    expect(pace.state).toBe('under');
    expect(pace.pace).toBeCloseTo(33.33, 1);
    expect(pace.delta).toBeCloseTo(-5.33, 1);
    expect(pace.leftToUse).toBe(72);
    expect(pace.limitAt).toBeNull();
  });

  it('reads an over-used window and when its limit comes', () => {
    // 1 h of 5 h elapsed (20 %) and 40 % used: the limit comes at 2 h 30 in.
    const resetsAt = now + 4 * HOUR;
    const pace = paceOf({ id: 'five-hour', label: '5 hours', usedPercent: 40, resetsAt }, now);
    expect(pace.state).toBe('over');
    expect(pace.delta).toBeCloseTo(20, 5);
    expect(pace.limitAt).toBe(now - HOUR + 2.5 * HOUR);
  });

  it(`counts ${TOLERANCE} points around the pace as on pace`, () => {
    const pace = paceOf({ id: 'seven-day', label: 'Weekly', usedPercent: 6, resetsAt: now + 156.5 * HOUR }, now);
    expect(pace.state).toBe('onPace');
  });

  it('marks a used-up window exhausted', () => {
    const pace = paceOf({ id: 'monthly', label: 'Codex Monthly', usedPercent: 100, resetsAt: now + 23 * 24 * HOUR }, now);
    expect(pace.state).toBe('exhausted');
    expect(pace.leftToUse).toBe(0);
  });

  it('has no pace without a reset or a known length', () => {
    expect(paceOf({ id: 'five-hour', label: '5 hours', usedPercent: 10, resetsAt: null }, now).state).toBe('unknown');
    expect(paceOf({ id: 'rolling', label: 'Rolling', usedPercent: 10, resetsAt: now + HOUR }, now).state).toBe('unknown');
  });

  it('clamps what the provider reports', () => {
    expect(paceOf({ id: 'five-hour', label: '5 hours', usedPercent: 140, resetsAt: now + HOUR }, now).used).toBe(100);
    expect(paceOf({ id: 'five-hour', label: '5 hours', usedPercent: -3, resetsAt: now + HOUR }, now).used).toBe(0);
  });
});
