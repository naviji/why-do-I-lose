<script lang="ts">
  import type { AppState, GameRow } from '../appController'
  import { SPEED_NAMES } from '../viewModel'
  let { app }: { app: AppState } = $props()
  let showAll = $state(false)
  let rows = $derived(app.queue)
  let current = $derived(rows.find(r => r.status === 'analyzing'))
  let counts = $derived({
    done: rows.filter(r => r.status === 'done').length,
    failed: rows.filter(r => r.status === 'failed').length,
    queued: rows.filter(r => r.status === 'queued').length,
  })
  // Analyzed and in-progress games first, then the next few in line.
  let shown = $derived(showAll ? rows : [...rows.filter(r => r.status !== 'queued'), ...rows.filter(r => r.status === 'queued').slice(0, 3)].slice(0, 12))
  let step = $derived(app.progress?.step)
  const day = (t: number) => new Date(t).toLocaleDateString()
  const label = (r: GameRow) => `${day(r.playedAt)} · ${SPEED_NAMES[r.speed]} · ${r.player} · ${r.result}`
  function stepText() {
    if (!step) return 'Starting…'
    return step.stage === 'scan'
      ? `Scoring positions ${step.done} / ${step.total}`
      : `Classifying critical moves ${step.done} / ${step.total}`
  }
</script>

{#if rows.length}
  <section class="queue">
    <div class="head">
      <b>Games</b>
      <span class="muted">{counts.done} analyzed · {counts.queued} queued{counts.failed ? ` · ${counts.failed} failed` : ''}</span>
      {#if app.phase !== 'analyzing' && counts.queued}<span class="muted">· paused</span>{/if}
    </div>
    {#if current && app.phase === 'analyzing'}
      <div class="now">
        <span class="dot" aria-hidden="true"></span>
        <span>{label(current)}</span>
        <span class="muted">{stepText()}</span>
        {#if step}<span class="track"><span style:width="{(step.done / Math.max(1, step.total)) * 100}%"></span></span>{/if}
      </div>
    {/if}
    <ul>
      {#each shown as r (r.id)}
        <li class={r.status}>
          <span class="badge">{r.status === 'done' ? '✓' : r.status === 'analyzing' ? '…' : r.status === 'failed' ? '!' : '·'}</span>
          {#if r.url}<a href={r.url} target="_blank" rel="noreferrer">{label(r)}</a>{:else}<span>{label(r)}</span>{/if}
          <span class="muted right">{r.status === 'queued' ? 'queued' : r.status === 'failed' ? 'failed' : `${r.mistakes} ${r.mistakes === 1 ? 'mistake' : 'mistakes'}${r.status === 'analyzing' ? ' so far' : ''}`}</span>
        </li>
      {/each}
    </ul>
    {#if rows.length > shown.length || showAll}
      <button class="more" onclick={() => (showAll = !showAll)}>{showAll ? 'Show fewer' : `Show all ${rows.length} games`}</button>
    {/if}
  </section>
{/if}

<style>
  .queue { background: var(--panel); border-radius: 8px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; font-size: 14px; }
  .head { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; }
  .now { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 8px 10px; background: var(--panel-dark); border-radius: 6px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--green); animation: pulse 1.2s infinite; }
  @keyframes pulse { 50% { opacity: .3; } }
  .track { flex: 1 1 100%; height: 4px; background: var(--line); border-radius: 2px; overflow: hidden; }
  .track span { display: block; height: 4px; background: var(--green); transition: width .3s; }
  ul { list-style: none; margin: 0; padding: 0; max-height: 320px; overflow-y: auto; }
  li { display: flex; gap: 8px; align-items: center; padding: 4px 0; border-bottom: 1px solid var(--line); }
  li.queued { opacity: .55; }
  li.failed .badge { color: #e07a5f; }
  li.done .badge { color: var(--green); }
  .badge { width: 14px; text-align: center; font-weight: 800; }
  a { color: inherit; }
  .right { margin-left: auto; text-align: right; white-space: nowrap; }
  .more { align-self: flex-start; background: none; border: 0; color: var(--muted); text-decoration: underline; cursor: pointer; min-height: 32px; padding: 0; }
</style>
