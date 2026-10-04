<script lang="ts">
  import { boardSquares, type Side } from '../viewModel'
  let { fen, orientation }: { fen: string; orientation: Side } = $props()
  const GLYPH: Record<string, string> = { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' }
  let squares = $derived(boardSquares(fen, orientation))
</script>

<div class="board" role="img" aria-label="Position before your move">
  {#each squares as s (s.square)}
    <div class="sq" class:light={s.light}>
      {#if s.piece}<span class={s.piece.color}>{GLYPH[s.piece.role]}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .board { display: grid; grid-template-columns: repeat(8, minmax(0, 1fr)); aspect-ratio: 1; border-radius: 4px; overflow: hidden; width: 100%; container-type: inline-size; }
  .sq { background: var(--dark); display: flex; align-items: center; justify-content: center; font-size: 10cqi; line-height: 1; }
  .sq.light { background: var(--light); }
  .white { color: #fff; text-shadow: 0 0 2px #000, 0 0 1px #000; }
  .black { color: #000; }
</style>
