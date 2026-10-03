// Port of lichess-puzzler tagger/model.py: a puzzle is "the move before the puzzle"
// followed by the solution. `pov` is the side solving it (not the side moving first).
//
// For this app: `fen` is the position before the player's move m, `line` is
// [m, ...opponent's best line], and `pov` is the opponent.
import { parseUci } from 'chessops/util'
import { Board, opposite, type Color, type Move } from './board'

export interface GameNode {
  board(): Board
  parent?: GameNode
}

export interface ChildNode extends GameNode {
  move: Move
  parent: GameNode
  /** Side to move after this move. */
  turn(): Color
  isEnd(): boolean
  next?: ChildNode
}

export interface Puzzle {
  pov: Color
  /** Root node (python-chess `Game`). */
  game: GameNode & { end(): ChildNode }
  mainline: ChildNode[]
  cp: number
}

export function make(fen: string, line: string | string[], cp = 999999998): Puzzle {
  const start = Board.fromFen(fen)
  const root: GameNode = { board: () => start.copy() }
  const mainline: ChildNode[] = []
  const board = start.copy()
  let parent: GameNode = root
  for (const uci of typeof line === 'string' ? line.split(' ') : line) {
    const m = parseUci(uci)
    if (!m || !('from' in m)) throw new Error(`bad uci ${uci}`)
    const move: Move = m.promotion ? { from: m.from, to: m.to, promotion: m.promotion } : { from: m.from, to: m.to }
    board.push(move)
    const after = board.copy()
    const node: ChildNode = {
      move,
      parent,
      board: () => after.copy(),
      turn: () => after.turn,
      isEnd: () => node.next === undefined,
    }
    if (parent !== root) (parent as ChildNode).next = node
    mainline.push(node)
    parent = node
  }
  if (!mainline.length) throw new Error('empty line')
  return {
    pov: opposite(start.turn),
    game: { ...root, end: () => mainline[mainline.length - 1]! },
    mainline,
    cp,
  }
}
