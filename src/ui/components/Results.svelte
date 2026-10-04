<script lang="ts">
  import type { AppState } from '../appController'
  import type { ResultFilter } from '../examples'
  import { categoryName, headline } from '../viewModel'
  import ExampleView from './ExampleView.svelte'
  let { app, onremove, onfilter }: { app: AppState; onremove: (id: string) => void; onfilter: (f: ResultFilter) => void } = $props()
  let open = $state<string | null>(null)
  let max = $derived(Math.max(1, ...app.ranked.map(r => r.games)))
  let title = $derived(headline(app.ranked, app.stats.analyzed))
  let progress = $derived(app.progress && app.progress.eligible ? app.progress.done / app.progress.eligible : 0)
  const GHOST = ['Hanging piece', 'Defensive move', 'Fork', 'Hanging pawn', 'Discovered attack', 'Pin']
</script>

<section class="results">
  {#if !app.stats.games}
    <h1>Which mistakes do you keep making?</h1>
    <p class="muted intro">Import your games in the Games panel. Stockfish checks your moves in your browser and ranks the tactics you keep allowing. Nothing is uploaded.</p>
    <div class="list ghost">
      {#each GHOST as g, i}<div class="row"><b>{g}</b><span class="bar" style:width="{90 - i * 12}%"></span><span class="muted">– games</span></div>{/each}
      <div class="empty">{#if app.error}<b class="error" role="alert">{app.error}</b>{/if}<b>Your results will appear here</b><span class="muted">Enter your username and press Import. First results show after a few games.</span></div>
    </div>
  {:else}
    <h1>{title ?? (app.phase === 'done' ? 'No mistakes found in the analyzed games.' : 'Analyzing your games…')}</h1>
    <div class="meta muted">
      <span>Categories overlap.</span>
      <select aria-label="Result" value={app.resultFilter} onchange={e => onfilter((e.currentTarget as HTMLSelectElement).value as ResultFilter)}>
        <option value="all">All results</option><option value="loss">Losses</option><option value="win">Wins</option><option value="draw">Draws</option>
      </select>
      {#if app.phase === 'analyzing' && app.progress}
        <span class="progress"><span class="track"><span style:width="{progress * 100}%"></span></span>{app.progress.done} / {app.progress.eligible}</span>
      {/if}
    </div>
    {#if app.error}<p class="error" role="alert">{app.error}</p>{/if}
    <div class="list">
      {#each app.ranked as r (r.category)}
        <div class="item">
          <button class="row" class:active={open === r.category} aria-expanded={open === r.category} onclick={() => (open = open === r.category ? null : r.category)}>
            <b>{categoryName(r.category)}</b><span class="bar" style:width="{(r.games / max) * 100}%"></span><span class="mono muted">{r.games} {r.games === 1 ? 'game' : 'games'}</span>
          </button>
          {#if open === r.category}
            <ExampleView examples={r.examples} {onremove} onclose={() => (open = null)} />
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</section>

<style>
  .results { display: flex; flex-direction: column; gap: 16px; min-width: 0; }
  h1 { margin: 0; font-size: 24px; line-height: 1.25; font-weight: 800; }
  .intro { margin: 0; }
  .meta { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; font-size: 14px; }
  select { min-height: 36px; padding: 0 8px; border: 1px solid var(--input-line); border-radius: 6px; background: var(--input); font-size: 16px; }
  .progress { flex: 1 1 160px; display: flex; gap: 8px; align-items: center; }
  .track { flex: 1; height: 6px; background: var(--line); border-radius: 3px; overflow: hidden; }
  .track span { display: block; height: 6px; background: var(--green); }
  .list { background: var(--panel); border-radius: 8px; overflow: hidden; position: relative; }
  .item { border-bottom: 1px solid var(--line); }
  .row { width: 100%; min-height: 52px; display: grid; grid-template-columns: minmax(120px, 1fr) minmax(40px, 2fr) 80px; gap: 12px; align-items: center; padding: 8px 16px; border: 0; background: none; text-align: left; cursor: pointer; }
  .row.active { background: #2b2926; }
  .row .mono { text-align: right; font-size: 14px; }
  .bar { height: 10px; border-radius: 5px; background: var(--green); }
  .ghost .row { opacity: .35; border-bottom: 1px solid var(--line); cursor: default; }
  .ghost .bar { background: #5a5856; }
  .empty { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 6px; margin: auto; width: min(360px, 90%); height: fit-content; background: var(--bg); border-radius: 8px; padding: 18px 22px; box-shadow: 0 8px 24px rgba(0, 0, 0, .35); }
  .error { margin: 0; color: #e07a5f; }
  @media (min-width: 720px) { h1 { font-size: 30px; } }
</style>
