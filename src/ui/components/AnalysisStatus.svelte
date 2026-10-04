<script lang="ts">
  import type { AppState } from '../appController'
  import { SPEED_NAMES } from '../viewModel'
  let { app, onstop, onresume }: { app: AppState; onstop: () => void; onresume: () => void } = $props()
  let p = $derived(app.progress)
  let g = $derived(app.currentGame)
  let step = $derived(p?.step)
  // From saved analyses, not the job's position in its queue, which skips earlier work in its own order.
  let total = $derived(app.stats.analyzed + app.stats.pending)
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  const RESULT = { win: 'won', loss: 'lost', draw: 'drew' }
</script>

{#if app.phase === 'analyzing' && p}
  <div class="status" role="status">
    <div class="line">
      <b>Analyzed {app.stats.analyzed} / {total}</b>
      {#if g}<span class="muted">{SPEED_NAMES[g.speed]} as {cap(g.player)}, {RESULT[g.result]} · {new Date(g.playedAt).toLocaleDateString()}</span>{/if}
      {#if step}<span class="muted">· {step.stage === 'scan' ? 'scoring positions' : 'classifying mistakes'} {step.done}/{step.total}</span>{/if}
      {#if p.failed}<span class="error">· {p.failed} failed</span>{/if}
      <button onclick={onstop}>Stop</button>
    </div>
    <span class="track"><span style:width="{(app.stats.analyzed / Math.max(1, total)) * 100}%"></span></span>
  </div>
{:else if app.stats.pending > 0 && app.phase === 'done'}
  <div class="line muted">Analysis stopped · {app.stats.pending} games left <button onclick={onresume}>Resume</button></div>
{/if}

<style>
  .line.muted { font-size: 14px; }
  .status { display: flex; flex-direction: column; gap: 6px; font-size: 14px; }
  .line { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
  button { margin-left: auto; min-height: 32px; padding: 0 12px; border: 0; border-radius: 6px; background: var(--line); cursor: pointer; }
  .track { height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
  .track span { display: block; height: 6px; background: var(--green); transition: width .3s; }
  .error { color: #e07a5f; }
</style>
