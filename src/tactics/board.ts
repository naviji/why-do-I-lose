// A small python-chess-style board over chessops, so the lichess-puzzler tagger
// (tagger/cook.py, tagger/util.py) can be ported nearly line by line.
import { Castles, Chess, castlingSide, normalizeMove } from 'chessops/chess'
import { parseFen, makeFen } from 'chessops/fen'
import { attacks, between, ray } from 'chessops/attacks'
import { SquareSet } from 'chessops/squareSet'
import { opposite, squareFile, squareRank } from 'chessops/util'
import type { Color, Role, Square } from 'chessops/types'

export type { Color, Role, Square }

/** A move with castling written king-two-squares (e1g1), like python-chess. */
export interface Move {
  from: Square
  to: Square
  promotion?: Role
}

export interface Piece {
  role: Role
  color: Color
}

export const ALL = SquareSet.full()

export class Board {
  private constructor(readonly pos: Chess) {}

  /** Like python-chess, accepts positions chessops rejects (e.g. a missing king). */
  static fromFen(fen: string): Board {
    const setup = parseFen(fen).unwrap()
    const result = Chess.fromSetup(setup)
    if (result.isOk) return new Board(result.value)
    const pos = Chess.default()
    pos.board = setup.board.clone()
    pos.turn = setup.turn
    pos.castles = Castles.fromSetup(setup)
    pos.epSquare = setup.epSquare
    pos.halfmoves = setup.halfmoves
    pos.fullmoves = setup.fullmoves
    return new Board(pos)
  }

  static fromChess(pos: Chess): Board {
    return new Board(pos)
  }

  get turn(): Color {
    return this.pos.turn
  }

  fen(): string {
    return makeFen(this.pos.toSetup())
  }

  copy(): Board {
    return new Board(this.pos.clone())
  }

  pieceAt(sq: Square): Piece | undefined {
    return this.pos.board.get(sq)
  }

  removePieceAt(sq: Square): void {
    this.pos.board.take(sq)
  }

  pieceMap(): [Square, Piece][] {
    return [...this.pos.board]
  }

  pieces(role: Role, color: Color): SquareSet {
    return this.pos.board.pieces(color, role)
  }

  king(color: Color): Square | undefined {
    return this.pos.board.kingOf(color)
  }

  /** Squares attacked by the piece on `sq` (empty if none). */
  attacks(sq: Square): SquareSet {
    const piece = this.pieceAt(sq)
    return piece ? attacks(piece, sq, this.pos.board.occupied) : SquareSet.empty()
  }

  /** Pieces of `color` attacking `sq`, ignoring pins. */
  attackers(color: Color, sq: Square): SquareSet {
    return this.pos.kingAttackers(sq, color, this.pos.board.occupied)
  }

  isCheck(): boolean {
    return this.pos.isCheck()
  }

  checkers(): SquareSet {
    const king = this.king(this.turn)
    return king === undefined ? SquareSet.empty() : this.attackers(opposite(this.turn), king)
  }

  isCheckmate(): boolean {
    return this.pos.isCheckmate()
  }

  /** python-chess `Board.pin`: the full line through king and pinner if pinned, else ALL. */
  pin(color: Color, sq: Square): SquareSet {
    const king = this.king(color)
    if (king === undefined) return ALL
    const occupied = this.pos.board.occupied
    const enemy = this.pos.board[opposite(color)]
    const b = this.pos.board
    const snipers = attacks({ role: 'rook', color }, king, SquareSet.empty())
      .intersect(b.rook.union(b.queen))
      .union(attacks({ role: 'bishop', color }, king, SquareSet.empty()).intersect(b.bishop.union(b.queen)))
      .intersect(enemy)
    for (const sniper of snipers) {
      const blockers = between(king, sniper).intersect(occupied)
      if (blockers.size() === 1 && blockers.has(sq)) return ray(king, sniper)
    }
    return ALL
  }

  isPinned(color: Color, sq: Square): boolean {
    return !this.pin(color, sq).equals(ALL)
  }

  isCapture(move: Move): boolean {
    const target = this.pieceAt(move.to)
    if (target && target.color !== this.turn) return true
    return this.isEnPassant(move)
  }

  isEnPassant(move: Move): boolean {
    const piece = this.pieceAt(move.from)
    return piece?.role === 'pawn' && squareFile(move.from) !== squareFile(move.to) && !this.pieceAt(move.to)
  }

  legalMoves(): Move[] {
    const moves: Move[] = []
    for (const [from, dests] of this.pos.allDests()) {
      const piece = this.pieceAt(from)!
      const seen = new Set<Square>()
      for (const d of dests) {
        let to = d
        if (piece.role === 'king' && castlingSide(this.pos, { from, to: d })) {
          to = (from & ~7) | (d > from ? 6 : 2)
        }
        if (seen.has(to)) continue
        seen.add(to)
        if (piece.role === 'pawn' && (squareRank(to) === 0 || squareRank(to) === 7)) {
          for (const promotion of ['queen', 'rook', 'bishop', 'knight'] as Role[]) moves.push({ from, to, promotion })
        } else moves.push({ from, to })
      }
    }
    return moves
  }

  /** Pseudo-legal destinations for the piece on `sq` (pins and checks ignored). */
  pseudoLegalDests(sq: Square): SquareSet {
    const piece = this.pieceAt(sq)
    if (!piece) return SquareSet.empty()
    const own = this.pos.board[piece.color]
    if (piece.role !== 'pawn') return this.attacks(sq).diff(own)
    const occupied = this.pos.board.occupied
    let dests = this.attacks(sq).intersect(this.pos.board[opposite(piece.color)])
    if (this.pos.epSquare !== undefined && this.attacks(sq).has(this.pos.epSquare)) dests = dests.with(this.pos.epSquare)
    const step = piece.color === 'white' ? 8 : -8
    const one = sq + step
    if (one >= 0 && one < 64 && !occupied.has(one)) {
      dests = dests.with(one)
      const startRank = piece.color === 'white' ? 1 : 6
      if (squareRank(sq) === startRank && !occupied.has(one + step)) dests = dests.with(one + step)
    }
    return dests
  }

  /** Plays a move (castling as e1g1 or e1h1). Throws if illegal. */
  push(move: Move): void {
    const m = normalizeMove(this.pos, move)
    if (!this.pos.isLegal(m)) throw new Error(`illegal move ${JSON.stringify(move)} in ${this.fen()}`)
    this.pos.play(m)
  }

  /** python-chess `Board.mirror`: flip vertically and swap colours. */
  mirror(): Board {
    const fen = this.fen().split(' ')
    const rows = fen[0]!.split('/').reverse().map(r => [...r].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).join(''))
    const castling = fen[2] === '-' ? '-' : [...fen[2]!].map(c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase())).sort().join('')
    const ep = fen[3] === '-' ? '-' : fen[3]![0] + (9 - Number(fen[3]![1]))
    return Board.fromFen([rows.join('/'), fen[1] === 'w' ? 'b' : 'w', castling, ep, fen[4], fen[5]].join(' '))
  }

  /** Mirror left-right (python-chess `flip_horizontal`); castling rights dropped. */
  flipHorizontal(): Board {
    const fen = this.fen().split(' ')
    const rows = fen[0]!.split('/').map(r => {
      let s = ''
      for (const c of r) s += /\d/.test(c) ? '.'.repeat(Number(c)) : c
      return [...s].reverse().join('').replace(/\.+/g, m => String(m.length))
    })
    return Board.fromFen([rows.join('/'), fen[1], '-', '-', fen[4], fen[5]].join(' '))
  }
}

export const squareDistance = (a: Square, b: Square): number =>
  Math.max(Math.abs(squareFile(a) - squareFile(b)), Math.abs(squareRank(a) - squareRank(b)))

export { between, squareFile, squareRank, SquareSet, opposite }
