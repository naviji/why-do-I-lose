// Port of lichess-puzzler tagger/util.py (AGPL-3.0).
import { Board, opposite, squareDistance, squareFile, squareRank, type Color, type Piece, type Role, type Square } from './board'
import type { ChildNode } from './puzzle'

export function movedPieceType(node: ChildNode): Role {
  const piece = node.board().pieceAt(node.move.to)
  if (!piece) throw new Error('no moved piece')
  return piece.role
}

export function isAdvancedPawnMove(node: ChildNode): boolean {
  if (node.move.promotion) return true
  if (movedPieceType(node) !== 'pawn') return false
  const toRank = squareRank(node.move.to)
  // node.turn() is the side to move next, i.e. not the mover
  return node.turn() === 'white' ? toRank < 3 : toRank > 4
}

export function isVeryAdvancedPawnMove(node: ChildNode): boolean {
  if (!isAdvancedPawnMove(node)) return false
  const toRank = squareRank(node.move.to)
  return node.turn() === 'white' ? toRank < 2 : toRank > 5
}

export const isKingMove = (node: ChildNode): boolean => movedPieceType(node) === 'king'

export const isCastling = (node: ChildNode): boolean =>
  isKingMove(node) && squareDistance(node.move.from, node.move.to) > 1

export const isCapture = (node: ChildNode): boolean => node.parent.board().isCapture(node.move)

export const nextNode = (node: ChildNode): ChildNode | undefined => node.next

export const nextNextNode = (node: ChildNode): ChildNode | undefined => node.next?.next

export const values: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 0 }
export const kingValues: Record<Role, number> = { pawn: 1, knight: 3, bishop: 3, rook: 5, queen: 9, king: 99 }
export const rayPieceTypes: Role[] = ['queen', 'rook', 'bishop']

export const pieceValue = (role: Role): number => values[role]

export function materialCount(board: Board, side: Color): number {
  let sum = 0
  for (const role of ['pawn', 'knight', 'bishop', 'rook', 'queen'] as Role[]) sum += board.pieces(role, side).size() * values[role]
  return sum
}

export const materialDiff = (board: Board, side: Color): number =>
  materialCount(board, side) - materialCount(board, opposite(side))

export function attackedOpponentSquares(board: Board, fromSquare: Square, pov: Color): [Piece, Square][] {
  const pieces: [Piece, Square][] = []
  for (const sq of board.attacks(fromSquare)) {
    const piece = board.pieceAt(sq)
    if (piece && piece.color !== pov) pieces.push([piece, sq])
  }
  return pieces
}

export const attackedOpponentPieces = (board: Board, fromSquare: Square, pov: Color): Piece[] =>
  attackedOpponentSquares(board, fromSquare, pov).map(([p]) => p)

export function isDefended(board: Board, piece: Piece, square: Square): boolean {
  if (board.attackers(piece.color, square).nonEmpty()) return true
  // ray defense https://lichess.org/editor/6k1/3q1pbp/2b1p1p1/1BPp4/rp1PnP2/4PRNP/4Q1P1/4B1K1_w_-_-_0_1
  for (const attacker of board.attackers(opposite(piece.color), square)) {
    const attackerPiece = board.pieceAt(attacker)!
    if (rayPieceTypes.includes(attackerPiece.role)) {
      const bc = board.copy()
      bc.removePieceAt(attacker)
      if (bc.attackers(piece.color, square).nonEmpty()) return true
    }
  }
  return false
}

export const isHanging = (board: Board, piece: Piece, square: Square): boolean => !isDefended(board, piece, square)

export function canBeTakenByLowerPiece(board: Board, piece: Piece, square: Square): boolean {
  for (const attackerSquare of board.attackers(opposite(piece.color), square)) {
    const attacker = board.pieceAt(attackerSquare)!
    if (attacker.role !== 'king' && values[attacker.role] < values[piece.role]) return true
  }
  return false
}

/** Hanging or takeable by a lower piece. */
export function isInBadSpot(board: Board, square: Square): boolean {
  const piece = board.pieceAt(square)
  if (!piece) throw new Error('no piece')
  return (
    board.attackers(opposite(piece.color), square).nonEmpty() &&
    (isHanging(board, piece, square) || canBeTakenByLowerPiece(board, piece, square))
  )
}

export function isTrapped(board: Board, square: Square): boolean {
  if (board.isCheck() || board.isPinned(board.turn, square)) return false
  const piece = board.pieceAt(square)!
  if (piece.role === 'pawn' || piece.role === 'king') return false
  if (!isInBadSpot(board, square)) return false
  for (const escape of board.legalMoves()) {
    if (escape.from === square) {
      const capturing = board.pieceAt(escape.to)
      if (capturing && values[capturing.role] >= values[piece.role]) return false
      // python-chess pushes and only pops on the fall-through path; a copy keeps the board intact
      const after = board.copy()
      after.push(escape)
      if (!isInBadSpot(after, escape.to)) return false
    }
  }
  return true
}

export function attackerPieces(board: Board, color: Color, square: Square): Piece[] {
  return [...board.attackers(color, square)].map(s => board.pieceAt(s)).filter((p): p is Piece => !!p)
}

export function squaresAreCollinear(sq1: Square, sq2: Square, sq3: Square): boolean {
  const [r1, f1, r2, f2, r3, f3] = [squareRank(sq1), squareFile(sq1), squareRank(sq2), squareFile(sq2), squareRank(sq3), squareFile(sq3)]
  if (r1 === r2 && r2 === r3) return true
  if (f1 === f2 && f2 === f3) return true
  if (r1 - f1 === r2 - f2 && r2 - f2 === r3 - f3) return true
  if (r1 + f1 === r2 + f2 && r2 + f2 === r3 + f3) return true
  return false
}
