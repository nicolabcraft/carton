/*
 * The slice of Boite's core contract Carton reads. Copied by hand from
 * `packages/contracts/src/accounts.ts` and `usage.ts` of
 * https://github.com/beboite/boite (protocol 2), keeping only the fields used.
 */

export interface QuotaWindow {
  id: string;
  label: string;
  /** 0 to 100. */
  usedPercent: number;
  /** Epoch milliseconds, null when the provider gave none. */
  resetsAt: number | null;
  primary?: true;
}

export interface AccountQuota {
  /** Account id, or `proxy:<provider>:<entry>` for a Douane entry. */
  accountId: string;
  providerId: string;
  providerName: string;
  label: string;
  enabled: boolean;
  status: 'ready' | 'unavailable' | 'unsupported' | 'disabled';
  checkedAt: number | null;
  error: string | null;
  windows: QuotaWindow[];
  gateway?: { plan: string | null };
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** API-equivalent cost in US dollars; on a subscription this is not money spent. */
  costUsdEquivalent: number | null;
}

export interface UsageHistoryRow {
  bucket: number;
  providerId: string;
  /** Null when the turn ran on the provider's default model. */
  model: string | null;
  turns: number;
  reported: number;
  priced: number;
  usage: Usage;
}

export interface UsageHistory {
  edges: number[];
  rows: UsageHistoryRow[];
}
