import { describe, expect, it } from 'vitest'
import { Board } from './board'
import { nullMove, winningCaptures } from './threat'

describe('threat', () => {
  it('passes the move to the other side', () => {
    expect(nullMove(Board.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1'))!.turn).toBe('black')
  })

  it('cannot pass while in check', () => {
    expect(nullMove(Board.fromFen('4k3/8/8/8/8/8/8/4R1K1 b - - 0 1'))).toBeUndefined()
  })

  it('finds a capture that wins on the count, even when it is not that side to move', () => {
    // black to move, but white threatens Nxd5
    const board = Board.fromFen('4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1')
    expect(winningCaptures(board, 'white').map(m => m.to)).toEqual([35])
  })

  it('ignores an even trade', () => {
    expect(winningCaptures(Board.fromFen('4k3/8/4p3/3n4/8/2N5/8/4K3 w - - 0 1'), 'white')).toEqual([])
  })
})
