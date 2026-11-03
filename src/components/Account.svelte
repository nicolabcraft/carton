<script lang="ts">
  /* One subscription account and its limit windows, folding on its header. */
  import type { AccountQuota } from '../lib/types';
  import { providerName } from '../lib/format';
  import Icon from './Icon.svelte';
  import LimitBar from './LimitBar.svelte';

  let { account, now }: { account: AccountQuota; now: number } = $props();
  let open = $state(true);
  const plan = $derived(account.gateway?.plan?.replace(new RegExp(`^${providerName(account.providerId)}\\s*`, 'i'), '') ?? '');
</script>

<section class="account" class:closed={!open}>
  <button class="header" aria-expanded={open} onclick={() => (open = !open)}>
    <Icon name="chevron" class="chevron" />
    <span class="name">{providerName(account.providerId)}{plan ? ` (${plan})` : ''}</span>
    <span class="label">{account.label}</span>
  </button>
  {#if open}
    <div class="windows">
      {#each account.windows as window (window.id)}
        <LimitBar {window} {now} />
      {/each}
      {#if account.error}<p class="error">Dernière lecture réussie seulement : {account.error}</p>{/if}
    </div>
  {/if}
</section>

<style>
  .account { padding: 0; overflow: hidden; }
  .header {
    all: unset; box-sizing: border-box; width: 100%; display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; cursor: pointer; border-bottom: 1px solid var(--border);
  }
  .closed .header { border-bottom-color: transparent; }
  .header:hover { background: var(--hover); }
  .header:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  .header :global(.chevron) { color: var(--text-secondary); transition: transform 0.15s; flex: none; }
  .closed .header :global(.chevron) { transform: rotate(-90deg); }
  .name { font-weight: 600; font-size: 15px; white-space: nowrap; }
  .label { margin-left: auto; color: var(--text-secondary); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .windows { display: flex; flex-direction: column; gap: 16px; padding: 14px 16px 16px; }
  .error { margin: 0; font-size: 12px; color: var(--red); }
  @media (prefers-reduced-motion: reduce) { .header :global(.chevron) { transition: none; } }
</style>
