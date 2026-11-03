<script lang="ts">
  /*
   * One limit window: green up to the pace, red beyond it, a hatched gap for
   * what is left to use to keep the pace, a mark at the pace.
   */
  import type { QuotaWindow } from '../lib/types';
  import { paceOf } from '../lib/pace';
  import { PERIOD_NAMES, at, inTime, percent, signed, verdict } from '../lib/format';

  let { window, now }: { window: QuotaWindow; now: number } = $props();

  const pace = $derived(paceOf(window, now));
  const name = $derived(pace.period === 'other' ? window.label : PERIOD_NAMES[pace.period]);
  const green = $derived(Math.min(pace.used, pace.pace ?? pace.used));
  const red = $derived(pace.pace !== null && pace.used > pace.pace ? pace.used - pace.pace : 0);
  const gap = $derived(pace.pace !== null && pace.used < pace.pace ? pace.pace - pace.used : 0);
  const tone = $derived(pace.state === 'over' || pace.state === 'exhausted' ? 'tone-red' : pace.state === 'onPace' ? 'tone-green' : '');
  const detail = $derived(
    [
      `Utilisé : ${percent(pace.used)}`,
      pace.pace !== null ? `Rythme : ${percent(pace.pace)}` : null,
      pace.delta !== null ? `Écart : ${signed(pace.delta)}` : null,
      pace.resetsAt ? `Reset : ${at(pace.resetsAt, now)} (${inTime(pace.resetsAt - now)})` : null
    ]
      .filter(Boolean)
      .join('\n')
  );
</script>

<div class="limit">
  <div class="head">
    <span class="name">{name}</span>
    <span class="value">
      {percent(pace.used)} utilisé{#if pace.pace !== null}, rythme {percent(pace.pace)}{/if}
    </span>
  </div>
  <!-- Focusable so the keyboard reaches the same details the pointer shows. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="bar" role="img" tabindex="0" aria-label={`${name}. ${detail.replaceAll('\n', '. ')}`}>
    <div class="fill">
      <span class="green" style:width="{green}%"></span>
      {#if gap > 0}<span class="gap" style:width="{gap}%"></span>{/if}
      {#if red > 0}<span class="red" style:width="{red}%"></span>{/if}
    </div>
    {#if pace.pace !== null}<span class="mark" style:left="{pace.pace}%"></span>{/if}
    <span class="tip" role="tooltip">{detail}</span>
  </div>
  <p class="status {tone}">
    {verdict(pace, now)}
    {#if pace.resetsAt && pace.state !== 'exhausted'}<span class="reset">Reset {at(pace.resetsAt, now)}.</span>{/if}
  </p>
</div>

<style>
  .limit { display: flex; flex-direction: column; gap: 6px; }
  .head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 13px; }
  .name { font-weight: 600; }
  .value { color: var(--text-secondary); font-size: 12px; font-variant-numeric: tabular-nums; }
  .bar { position: relative; height: 8px; background: var(--bar-bg); border-radius: 4px; cursor: help; }
  .bar:focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; }
  .fill { position: absolute; inset: 0; display: flex; border-radius: 4px; overflow: hidden; }
  .green { background: var(--green); }
  .red { background: var(--red); }
  .gap {
    background: repeating-linear-gradient(45deg, transparent 0 2px, var(--hatch) 2px 4px);
  }
  .mark { position: absolute; top: -3px; width: 2px; height: 14px; background: var(--mark); border-radius: 1px; transform: translateX(-1px); }
  .tip {
    position: absolute; z-index: 2; left: 0; top: 16px; white-space: pre; pointer-events: none;
    background: var(--surface); color: var(--text); border: 1px solid var(--border); border-radius: 6px;
    padding: 6px 8px; font-size: 12px; line-height: 1.5; box-shadow: 0 4px 12px var(--shadow);
    opacity: 0; transform: translateY(-2px); transition: opacity 0.12s, transform 0.12s;
  }
  .bar:hover .tip, .bar:focus-visible .tip { opacity: 1; transform: none; }
  .status { margin: 0; font-size: 12px; line-height: 1.4; color: var(--text-secondary); }
  .status.tone-green { color: var(--green); }
  .status.tone-red { color: var(--red); }
  .reset { color: var(--text-secondary); margin-left: 4px; }
  @media (prefers-reduced-motion: reduce) { .tip { transition: none; } }
</style>
