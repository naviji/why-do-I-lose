<script lang="ts">
  // Lichess's own board (chessground) with its brown board and cburnett pieces.
  import { Chessground } from '@lichess-org/chessground'
  import type { Api } from '@lichess-org/chessground/api'
  import type { Key } from '@lichess-org/chessground/types'
  import '@lichess-org/chessground/assets/chessground.base.css'
  import '@lichess-org/chessground/assets/chessground.brown.css'
  import '@lichess-org/chessground/assets/chessground.cburnett.css'
  import type { Side } from '../viewModel'
  let { fen, orientation, lastMove = null }: { fen: string; orientation: Side; lastMove?: [string, string] | null } = $props()
  let el: HTMLElement
  let cg: Api | undefined

  $effect(() => {
    const config = {
      fen,
      orientation,
      viewOnly: true,
      coordinates: false,
      lastMove: (lastMove ?? undefined) as Key[] | undefined,
      drawable: { enabled: false, autoShapes: lastMove ? [{ orig: lastMove[0] as Key, dest: lastMove[1] as Key, brush: 'paleBlue' }] : [] },
    }
    if (cg) cg.set(config)
    else cg = Chessground(el, config)
  })
  $effect(() => () => cg?.destroy())
</script>

<div class="wrap" role="img" aria-label="Position before your move"><div class="cg" bind:this={el}></div></div>

<style>
  .wrap { width: 100%; aspect-ratio: 1; position: relative; border-radius: 4px; overflow: hidden; }
  .cg { position: absolute; inset: 0; }
</style>
