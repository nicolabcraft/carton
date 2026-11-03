<script lang="ts">
  /* The month's worth per subscription, with its price editable in place. */
  import type { CartonStore } from '../lib/store.svelte';
  import { percent, providerName, usd } from '../lib/format';

  let { store }: { store: CartonStore } = $props();
  let editing = $state<string | null>(null);

  const accountsOf = (provider: string) => store.tracked.filter((account) => account.providerId === provider);

  function save(provider: string, value: string) {
    const trimmed = value.trim().replace(',', '.');
    const usdValue = trimmed === '' ? null : Math.max(0, Number(trimmed) || 0);
    // The price sits on the provider's first account; the others are left out.
    const [first, ...rest] = accountsOf(provider);
    if (first) store.setPrice(first.accountId, usdValue);
    for (const account of rest) store.setPrice(account.accountId, null);
    editing = null;
  }

  function keydown(event: KeyboardEvent, provider: string) {
    if (event.key === 'Enter') save(provider, (event.currentTarget as HTMLInputElement).value);
    if (event.key === 'Escape') editing = null;
  }
</script>

<section aria-labelledby="month-title">
  <h2 id="month-title">Ce mois-ci</h2>
  <p class="note">Équivalent API des tours passés par Boite depuis le 1er, comparé au prix de l'abonnement.</p>
  {#each store.worth as worth (worth.provider)}
    <div class="row">
      <span class="provider">{providerName(worth.provider)}</span>
      <span class="money">
        {usd(worth.cost)} /
        {#if editing === worth.provider}
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="price"
            type="number"
            min="0"
            step="1"
            autofocus
            aria-label="Prix mensuel en dollars"
            value={worth.price ?? ''}
            onkeydown={(event) => keydown(event, worth.provider)}
            onblur={(event) => save(worth.provider, event.currentTarget.value)} />
        {:else}
          <button class="price-button" onclick={() => (editing = worth.provider)} title="Modifier le prix mensuel">
            {worth.price === null ? 'prix ?' : usd(worth.price)}
          </button>
        {/if}
      </span>
      {#if worth.percent !== null}
        <span class="percent" class:good={worth.percent >= 100} class:bad={worth.percent < 100}>{percent(worth.percent)}</span>
      {:else}
        <span class="percent muted">{worth.price === 0 ? 'gratuit' : 'à remplir'}</span>
      {/if}
    </div>
    {#if worth.percent !== null}
      <p class="detail">
        {#if worth.missing}Encore {usd(worth.missing)} à consommer pour être rentable.{:else}Rentabilisé.{/if}
        Projection fin de mois : {usd(worth.projected)}.
      </p>
    {/if}
  {:else}
    <p class="note">Aucun abonnement avec des limites lues pour l'instant.</p>
  {/each}
</section>

<style>
  .note { margin: -4px 0 8px; font-size: 12px; color: var(--text-secondary); }
  .row { display: grid; grid-template-columns: 1fr auto 56px; align-items: center; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); }
  .row:first-of-type { border-top: none; }
  .provider { font-weight: 600; }
  .money { color: var(--text-secondary); font-variant-numeric: tabular-nums; display: flex; align-items: center; gap: 4px; }
  .price-button { all: unset; cursor: pointer; border-bottom: 1px dashed var(--mark); padding: 0 2px; color: var(--text); }
  .price-button:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .price { width: 64px; font: inherit; color: var(--text); background: transparent; border: none; border-bottom: 1px solid var(--text); padding: 0 2px; text-align: right; }
  .price:focus { outline: none; }
  .percent { text-align: right; font-weight: 600; font-variant-numeric: tabular-nums; }
  .good { color: var(--green); }
  .bad { color: var(--red); }
  .muted { color: var(--text-secondary); font-weight: 400; font-size: 12px; }
  .detail { margin: -2px 0 6px; font-size: 12px; color: var(--text-secondary); }
</style>
