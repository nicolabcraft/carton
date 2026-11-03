/*
 * Carton's state: the core connection, the limit windows `quotas.list`
 * answers, the month's API-equivalent cost from `usage.history`, and the
 * subscription prices the owner set. The page draws from it and nothing else.
 */
import { CoreClient, type ConnectionState } from './core-client';
import { findCore, inShell } from './endpoint';
import { defaultPrice } from './plans';
import { costByProvider, monthEdges, worthOf, type Worth } from './worth';
import type { AccountQuota, UsageHistory } from './types';
import { localLink, type PairingGrant } from './web-access';

async function appVersion(): Promise<string> {
  if (!inShell()) return 'dev';
  const { getVersion } = await import('@tauri-apps/api/app');
  return getVersion().catch(() => 'dev');
}

const PRICES_KEY = 'carton.prices.v1';
const LOOK_EVERY_MS = 3_000;
const TICK_MS = 30_000;
const REREAD_MS = 5 * 60_000;
const USAGE_DEBOUNCE_MS = 10_000;

function loadPrices(): Record<string, number | null> {
  try {
    const raw = JSON.parse(localStorage.getItem(PRICES_KEY) ?? '{}') as Record<string, unknown>;
    const prices: Record<string, number | null> = {};
    for (const [key, value] of Object.entries(raw)) {
      if (value === null || (typeof value === 'number' && Number.isFinite(value) && value >= 0)) prices[key] = value;
    }
    return prices;
  } catch {
    return {};
  }
}

export class CartonStore {
  connection = $state<ConnectionState>('connecting');
  connectionError = $state<string | null>(null);
  waitingForBoite = $state(false);
  accounts = $state<AccountQuota[]>([]);
  costs = $state<Map<string, number>>(new Map());
  readAt = $state<number | null>(null);
  reading = $state(false);
  readError = $state<string | null>(null);
  now = $state(Date.now());
  /** Price overrides per account id; null means "not counted". */
  prices = $state<Record<string, number | null>>(loadPrices());

  /** The last link minted for another device, until it expires. */
  deviceLink = $state<PairingGrant | null>(null);
  webError = $state<string | null>(null);

  #client: CoreClient | null = null;
  #coreUrl: string | null = null;
  #timers: ReturnType<typeof setInterval>[] = [];
  #usageTimer: ReturnType<typeof setTimeout> | null = null;
  #stopped = false;

  /** Accounts that report at least one window. */
  tracked = $derived(this.accounts.filter((account) => account.enabled && account.windows.length > 0));
  /** Accounts that report none: shown folded. */
  untracked = $derived(this.accounts.filter((account) => !account.enabled || account.windows.length === 0));

  priceOf(account: AccountQuota): number | null {
    if (account.accountId in this.prices) return this.prices[account.accountId] ?? null;
    return defaultPrice(account.providerId, account.gateway?.plan);
  }

  setPrice(accountId: string, usd: number | null): void {
    this.prices = { ...this.prices, [accountId]: usd };
    localStorage.setItem(PRICES_KEY, JSON.stringify(this.prices));
  }

  /** The month's worth per provider that has a tracked account. */
  worth = $derived.by((): Worth[] => {
    const providers = [...new Set(this.tracked.map((account) => account.providerId))];
    return providers.map((provider) => {
      const prices = this.tracked.filter((account) => account.providerId === provider).map((account) => this.priceOf(account));
      const priced = prices.filter((price): price is number => price !== null);
      const price = priced.length ? priced.reduce((sum, value) => sum + value, 0) : null;
      return worthOf(provider, this.costs.get(provider) ?? 0, price, this.now);
    });
  });

  async start(): Promise<void> {
    this.#timers.push(setInterval(() => (this.now = Date.now()), TICK_MS));
    let endpoint = await findCore();
    while (!endpoint && !this.#stopped) {
      this.waitingForBoite = true;
      await new Promise((resolve) => setTimeout(resolve, LOOK_EVERY_MS));
      endpoint = await findCore();
    }
    if (!endpoint || this.#stopped) return;
    this.waitingForBoite = false;
    this.#coreUrl = endpoint.url;
    const client = new CoreClient({ url: endpoint.url, token: endpoint.token, version: await appVersion() });
    this.#client = client;
    client.onState((state, error) => {
      this.connection = state;
      this.connectionError = error ?? null;
      if (state === 'ready') void this.refresh(false);
    });
    client.on('quotas.updated', (params) => {
      if (Array.isArray(params)) {
        this.accounts = params as AccountQuota[];
        this.readAt = Date.now();
      }
    });
    client.on('turn.finished', () => this.#readUsageSoon());
    this.#timers.push(setInterval(() => void this.refresh(false), REREAD_MS));
    client.start();
  }

  stop(): void {
    this.#stopped = true;
    for (const timer of this.#timers) clearInterval(timer);
    if (this.#usageTimer) clearTimeout(this.#usageTimer);
    this.#client?.stop();
  }

  /** Reads the limits (asking the providers again when `fresh`) and the month's usage. */
  async refresh(fresh = true): Promise<void> {
    const client = this.#client;
    if (!client || client.state !== 'ready' || this.reading) return;
    this.reading = true;
    this.readError = null;
    try {
      const [accounts] = await Promise.all([
        client.call<AccountQuota[]>('quotas.list', { refresh: fresh }),
        this.#readUsage()
      ]);
      this.accounts = accounts;
      this.readAt = Date.now();
      this.now = Date.now();
    } catch (error) {
      this.readError = error instanceof Error ? error.message : String(error);
    } finally {
      this.reading = false;
    }
  }

  /** Opens Boite's web app on this computer, signed in as the owner by a one-time grant. */
  async openInBrowser(): Promise<void> {
    const client = this.#client;
    if (!client || !this.#coreUrl) return;
    this.webError = null;
    try {
      const grant = await client.call<PairingGrant>('pairing.grant', { role: 'owner' });
      const link = localLink(this.#coreUrl, grant.grant);
      if (inShell()) {
        const { openUrl } = await import('@tauri-apps/plugin-opener');
        await openUrl(link);
      } else {
        window.open(link, '_blank', 'noopener');
      }
    } catch (error) {
      this.webError = error instanceof Error ? error.message : String(error);
    }
  }

  /** A one-time link for a phone or another computer, as a paired device. */
  async makeDeviceLink(): Promise<void> {
    const client = this.#client;
    if (!client) return;
    this.webError = null;
    try {
      this.deviceLink = await client.call<PairingGrant>('pairing.grant', { role: 'device' });
    } catch (error) {
      this.webError = error instanceof Error ? error.message : String(error);
    }
  }

  async #readUsage(): Promise<void> {
    const client = this.#client;
    if (!client) return;
    const history = await client.call<UsageHistory>('usage.history', { edges: monthEdges(Date.now()) });
    this.costs = costByProvider(history);
  }

  #readUsageSoon(): void {
    if (this.#usageTimer) return;
    this.#usageTimer = setTimeout(() => {
      this.#usageTimer = null;
      this.#readUsage().catch(() => {});
    }, USAGE_DEBOUNCE_MS);
  }
}
