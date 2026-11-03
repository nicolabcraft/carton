<script lang="ts">
  /* Boite in a web browser: here, or on another device with a one-time link. */
  import type { CartonStore } from '../lib/store.svelte';
  import { secondsLeft } from '../lib/web-access';
  import Icon from './Icon.svelte';

  let { store }: { store: CartonStore } = $props();
  let copied = $state(false);
  let clock = $state(Date.now());

  $effect(() => {
    if (!store.deviceLink) return;
    const timer = setInterval(() => (clock = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const left = $derived(store.deviceLink ? secondsLeft(store.deviceLink, clock) : 0);
  const ready = $derived(store.connection === 'ready');

  async function copy() {
    if (!store.deviceLink) return;
    await navigator.clipboard.writeText(store.deviceLink.url);
    copied = true;
    setTimeout(() => (copied = false), 1500);
  }
</script>

<section aria-labelledby="web-title">
  <h2 id="web-title">Boite dans un navigateur</h2>
  <div class="actions">
    <button class="action" disabled={!ready} onclick={() => store.openInBrowser()}>
      <Icon name="globe" />
      Ouvrir sur ce PC
    </button>
    <button class="action" disabled={!ready} onclick={() => store.makeDeviceLink()}>
      <Icon name="phone" />
      Lien pour un autre appareil
    </button>
  </div>
  {#if store.deviceLink && left > 0}
    <div class="link">
      <code>{store.deviceLink.url}</code>
      <button class="copy" onclick={copy} aria-label="Copier le lien">
        <Icon name="copy" />{copied ? 'Copié' : 'Copier'}
      </button>
    </div>
    <p class="note">
      Valable {Math.floor(left / 60)} min {String(left % 60).padStart(2, '0')} s, une seule fois. L'appareil doit joindre ce PC sur le réseau
      (Réglages de Boite, « Accessible sur le réseau local »).
    </p>
  {:else if store.deviceLink}
    <p class="note">Lien expiré : en demander un autre.</p>
  {:else}
    <p class="note">Chaque ouverture crée un lien à usage unique, valable 10 minutes. Le jeton de Boite ne quitte jamais ce PC.</p>
  {/if}
  {#if store.webError}<p class="error">{store.webError}</p>{/if}
</section>

<style>
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .action, .copy {
    display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 13px; color: var(--text);
    background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 6px 10px; cursor: pointer;
  }
  .action:hover:not(:disabled), .copy:hover { background: var(--hover); }
  .action:focus-visible, .copy:focus-visible { outline: 2px solid var(--focus); outline-offset: 2px; }
  .action:disabled { opacity: 0.5; cursor: default; }
  .link { display: flex; gap: 8px; align-items: center; margin-top: 10px; }
  code {
    flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 12px;
    background: var(--bar-bg); border-radius: 4px; padding: 6px 8px; user-select: all;
  }
  .note { margin: 8px 0 0; font-size: 12px; color: var(--text-secondary); }
  .error { margin: 8px 0 0; font-size: 12px; color: var(--red); }
</style>
