<script lang="ts">
  /* Carton's window: the month's worth, each account's limit windows, Boite in a browser. */
  import { onDestroy, onMount } from 'svelte';
  import { CartonStore } from './lib/store.svelte';
  import { ago } from './lib/format';
  import Account from './components/Account.svelte';
  import Icon from './components/Icon.svelte';
  import Month from './components/Month.svelte';
  import WebAccess from './components/WebAccess.svelte';

  const store = new CartonStore();
  onMount(() => void store.start());
  onDestroy(() => store.stop());

  let showUntracked = $state(false);

  const status = $derived(
    store.waitingForBoite
      ? 'En attente de Boite'
      : store.connection !== 'ready'
        ? 'Connexion à Boite'
        : store.reading
          ? 'Lecture'
          : store.readAt
            ? ago(store.readAt, store.now)
            : ''
  );
</script>

<main>
  <header>
    <h1>Carton</h1>
    <span class="status" aria-live="polite">{status}</span>
    <button
      class="refresh"
      onclick={() => store.refresh(true)}
      disabled={store.connection !== 'ready' || store.reading}
      aria-label="Actualiser">
      <Icon name="refresh" class={store.reading ? 'spinning' : ''} />
    </button>
  </header>

  {#if store.readError}<p class="error">{store.readError}</p>{/if}
  {#if store.connectionError && store.connection !== 'ready'}<p class="error">{store.connectionError}</p>{/if}

  <Month {store} />

  {#each store.tracked as account (account.accountId)}
    <Account {account} now={store.now} />
  {/each}

  {#if store.untracked.length}
    <section class="untracked">
      <button class="fold" aria-expanded={showUntracked} onclick={() => (showUntracked = !showUntracked)}>
        {store.untracked.length} compte{store.untracked.length > 1 ? 's' : ''} sans limite lue
      </button>
      {#if showUntracked}
        <ul>
          {#each store.untracked as account (account.accountId)}
            <li>{account.gateway?.plan ?? account.providerName}, {account.label}</li>
          {/each}
        </ul>
      {/if}
    </section>
  {/if}

  <WebAccess {store} />
</main>

<style>
  :global(:root) {
    --bg: #fafafa; --surface: #ffffff; --text: #0a0a0a; --text-secondary: #5f5f5f; --border: #e0e0e0;
    --green: #2e7d32; --red: #c62828; --mark: #616161; --bar-bg: #ededed; --hatch: #bdbdbd;
    --hover: #f2f2f2; --focus: #616161; --shadow: rgba(0, 0, 0, 0.12);
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :global(:root) {
      --bg: #1a1a1a; --surface: #252525; --text: #e8e8e8; --text-secondary: #a3a3a3; --border: #3a3a3a;
      --green: #66bb6a; --red: #ef5350; --mark: #bdbdbd; --bar-bg: #333333; --hatch: #6b6b6b;
      --hover: #2e2e2e; --focus: #bdbdbd; --shadow: rgba(0, 0, 0, 0.5);
    }
  }
  :global(*) { box-sizing: border-box; }
  :global(body) {
    margin: 0; background: var(--bg); color: var(--text);
    font: 14px/1.5 'Segoe UI Variable Text', 'Segoe UI', system-ui, -apple-system, sans-serif;
  }
  :global(section) { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; margin-bottom: 12px; }
  :global(h2) { font-size: 15px; font-weight: 600; margin: 0 0 8px; }
  main { max-width: 600px; margin: 0 auto; padding: 16px; }
  header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  h1 { font-size: 22px; font-weight: 600; margin: 0; flex: 1; }
  .status { font-size: 12px; color: var(--text-secondary); }
  .refresh {
    display: flex; padding: 6px; color: var(--text); background: none; border: 1px solid var(--border);
    border-radius: 6px; cursor: pointer;
  }
  .refresh:hover:not(:disabled) { background: var(--surface); }
  .refresh:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .refresh:disabled { opacity: 0.5; cursor: default; }
  .refresh :global(.spinning) { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .refresh :global(.spinning) { animation: none; } }
  .error { color: var(--red); font-size: 13px; margin: 0 0 12px; }
  .untracked { padding: 0; }
  .fold { all: unset; box-sizing: border-box; width: 100%; padding: 12px 16px; cursor: pointer; color: var(--text-secondary); font-size: 13px; }
  .fold:hover { background: var(--hover); }
  .fold:focus-visible { outline: 2px solid var(--focus); outline-offset: -2px; }
  ul { margin: 0; padding: 0 16px 12px 32px; font-size: 13px; color: var(--text-secondary); }
</style>
