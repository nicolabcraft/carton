/* French wording of Carton's numbers and times. */
import type { Pace, Period } from './pace';

const percent = (value: number) => `${Math.round(value)} %`;
const signed = (value: number) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${Math.abs(Math.round(value))} %`;

export const usd = (value: number) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', currencyDisplay: 'narrowSymbol', maximumFractionDigits: value >= 100 ? 0 : 2 }).format(value);

export const PERIOD_NAMES: Record<Period, string> = {
  fiveHour: '5 heures',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  other: 'Autre'
};

export const PROVIDER_NAMES: Record<string, string> = {
  claude: 'Claude',
  codex: 'Codex',
  copilot: 'Copilot',
  grok: 'Grok',
  antigravity: 'Antigravity'
};

export const providerName = (id: string) => PROVIDER_NAMES[id] ?? id;

/** « dans 3 h 20 », « dans 6 j », « à l'instant ». */
export function inTime(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes <= 0) return "à l'instant";
  if (minutes < 60) return `dans ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `dans ${hours} h${minutes % 60 ? ` ${String(minutes % 60).padStart(2, '0')}` : ''}`;
  return `dans ${Math.round(hours / 24)} j`;
}

/** « 19:50 » today, « lun. 9 nov. 05:00 » later. */
export function at(time: number, now: number): string {
  const date = new Date(time);
  const clock = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  if (new Date(now).toDateString() === date.toDateString()) return clock;
  return `${date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} ${clock}`;
}

export function ago(time: number, now: number): string {
  const seconds = Math.round((now - time) / 1000);
  if (seconds < 10) return "lu à l'instant";
  if (seconds < 60) return `lu il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `lu il y a ${minutes} min` : `lu il y a ${Math.round(minutes / 60)} h`;
}

/** The sentence under a window's bar. */
export function verdict(pace: Pace, now: number): string {
  switch (pace.state) {
    case 'exhausted':
      return `Limite atteinte${pace.resetsAt ? `, reset ${inTime(pace.resetsAt - now)}` : ''}.`;
    case 'over':
      return `Trop rapide : ${signed(pace.delta!)} au-dessus du rythme${pace.limitAt ? `, limite ${inTime(pace.limitAt - now)}` : ''}.`;
    case 'under':
      return `Encore ${percent(-pace.delta!)} à consommer pour tenir le rythme (${percent(pace.leftToUse)} avant le reset).`;
    case 'onPace':
      return 'Dans le rythme.';
    default:
      return `${percent(pace.used)} utilisé.`;
  }
}

export { percent, signed };
