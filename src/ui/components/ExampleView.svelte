<script lang="ts">
  import type { Example } from '../examples'
  import { analysisUrl, categoryName, notALabel, puzzleUrl } from '../viewModel'
  import Board from './Board.svelte'
  let { examples, onremove, onclose }: { examples: Example[]; onremove: (id: string) => void; onclose: () => void } = $props()
  let index = $state(0)
  let ex = $derived(examples[Math.min(index, examples.length - 1)])
  let name = $derived(ex ? categoryName(ex.category).toLowerCase() : '')
  const moveNo = (ply: number) => Math.ceil(ply / 2)
</script>

{#if ex}
  <div class="example">
    <div class="top">
      <button class="btn ghost back" onclick={onclose} aria-label="Back to results">← {categoryName(ex.category)}</button>
    </div>
    <div class="board"><Board fen={ex.fen} orientation={ex.side} /></div>
    <div class="text">
      <div class="muted small">Example {index + 1} of {examples.length} · move {moveNo(ex.ply)} as {ex.side === 'white' ? 'White' : 'Black'} · {ex.result}
        {#if ex.gameUrl}· <a href={ex.gameUrl} target="_blank" rel="noopener">game</a>{/if}</div>
      <p class="line">{ex.explanation}</p>
      <div class="actions">
        <a class="btn primary" href={analysisUrl(ex.fen, ex.side)} target="_blank" rel="noopener">Analyze on Lichess</a>
        {#if examples.length > 1}<button class="btn" onclick={() => (index = (index + 1) % examples.length)}>Next example</button>{/if}
        <button class="btn ghost" onclick={() => onremove(ex.id)}>{notALabel(ex.category)}</button>
      </div>
      {#if puzzleUrl(ex.category)}<a class="small" href={puzzleUrl(ex.category)} target="_blank" rel="noopener">Practice {name} puzzles</a>{/if}
    </div>
  </div>
{/if}

<style>
  .example { display: flex; flex-direction: column; gap: 16px; padding: 16px; background: #2b2926; }
  .top { display: flex; }
  .back { padding: 0; font-weight: 800; color: var(--text); }
  .text { display: flex; flex-direction: column; gap: 12px; }
  .line { margin: 0; font-size: 17px; line-height: 1.5; }
  .small { font-size: 14px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  /* Phone: the example takes the whole screen, actions at the bottom. */
  @media (max-width: 719px) {
    .example { position: fixed; inset: 0; z-index: 20; overflow-y: auto; }
    .actions { margin-top: auto; }
    .actions .btn { flex: 1 1 auto; }
  }
  @media (min-width: 720px) {
    .example { flex-direction: row; flex-wrap: wrap; }
    .top { display: none; }
    .board { flex: 0 0 260px; }
    .text { flex: 1 1 260px; }
  }
</style>
