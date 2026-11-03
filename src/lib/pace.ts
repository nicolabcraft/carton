/*
 * The pace of a limit window: how much of it should be used by now for the
 * subscription to pay for itself, against how much is used.
 *
 * A window that resets every N hours gives back its whole allowance at each
 * reset. Using it evenly means being at `elapsed / length` of it at any time:
 * that share is the pace. Below it, part of the allowance will be lost at the
 * reset (the subscription is under-used). Above it, the limit comes before the
 * reset (the subscription is over-used).
 */
import type { QuotaWindow } from './types';

export type Period = 'fiveHour' | 'weekly' | 'monthly' | 'other';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Points of difference with the pace still read as on pace. */
export const TOLERANCE = 2;

/**
 * The window's length, read from its id and label as providers name them:
 * Claude `five_hour` / `seven_day`, Douane `five-hour` / `seven-day` /
 * `window-18000s`, Codex `5 hours` / `Weekly` / `Codex Monthly`, Copilot
 * `premium` (monthly requests). Anything else has no known length.
 */
export function periodOf(window: Pick<QuotaWindow, 'id' | 'label'>): Period {
  const text = `${window.id} ${window.label}`.toLowerCase();
  if (/five[-_ ]?hour|\b5\s*h(ours?)?\b|window-18000s/.test(text)) return 'fiveHour';
  if (/seven[-_ ]?day|week|hebdo|window-604800s/.test(text)) return 'weekly';
  if (/month|mensuel|premium/.test(text)) return 'monthly';
  return 'other';
}

/** When the window that resets at `resetsAt` began, or null for an unknown length. */
export function windowStart(period: Period, resetsAt: number): number | null {
  if (period === 'fiveHour') return resetsAt - 5 * HOUR;
  if (period === 'weekly') return resetsAt - 7 * DAY;
  if (period === 'monthly') {
    const start = new Date(resetsAt);
    start.setMonth(start.getMonth() - 1);
    return start.getTime();
  }
  return null;
}

export type PaceState =
  /** Used less than the pace: some allowance will be lost at the reset. */
  | 'under'
  /** Within `TOLERANCE` of the pace. */
  | 'onPace'
  /** Used more than the pace: the limit will come before the reset. */
  | 'over'
  /** The whole window is used. */
  | 'exhausted'
  /** No reset time or unknown length: only the used share is known. */
  | 'unknown';

export interface Pace {
  period: Period;
  used: number;
  /** Share of the window's time already elapsed, 0 to 100; null when unknown. */
  pace: number | null;
  /** `used - pace`, in points; null when the pace is unknown. */
  delta: number | null;
  state: PaceState;
  /** Points to use before the reset to get the whole allowance's worth. */
  leftToUse: number;
  /** When the limit is reached at the current rate, if before the reset. */
  limitAt: number | null;
  resetsAt: number | null;
  start: number | null;
}

const clamp = (value: number, min = 0, max = 100) => Math.min(max, Math.max(min, value));

export function paceOf(window: QuotaWindow, now: number): Pace {
  const period = periodOf(window);
  const used = clamp(window.usedPercent);
  const resetsAt = window.resetsAt;
  const start = resetsAt === null ? null : windowStart(period, resetsAt);
  const base = { period, used, leftToUse: 100 - used, resetsAt, start };
  if (used >= 100) {
    const pace = start !== null && resetsAt !== null ? clamp(((now - start) / (resetsAt - start)) * 100) : null;
    return { ...base, pace, delta: pace === null ? null : used - pace, state: 'exhausted', limitAt: null };
  }
  if (start === null || resetsAt === null || resetsAt <= start) {
    return { ...base, pace: null, delta: null, state: 'unknown', limitAt: null };
  }
  const pace = clamp(((now - start) / (resetsAt - start)) * 100);
  const delta = used - pace;
  const state: PaceState = Math.abs(delta) <= TOLERANCE ? 'onPace' : delta < 0 ? 'under' : 'over';
  let limitAt: number | null = null;
  const elapsed = now - start;
  if (used > 0 && elapsed > 0) {
    const at = start + (elapsed * 100) / used;
    if (at < resetsAt) limitAt = at;
  }
  return { ...base, pace, delta, state, limitAt };
}
