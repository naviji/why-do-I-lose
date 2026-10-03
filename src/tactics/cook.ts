// Port of lichess-puzzler tagger/cook.py (AGPL-3.0, https://github.com/ornicar/lichess-puzzler).
// Kept close to the original so fixes there can be carried over. Zugzwang needs an
// engine and lives elsewhere.
import { ALL, Board, between, opposite, squareDistance, squareFile, squareRank, SquareSet, type Role, type Square } from './board'
import type { ChildNode, Puzzle } from './puzzle'
import * as util from './util'
import { materialDiff, squaresAreCollinear } from './util'

export type TagKind =
  | 'advancedPawn' | 'advantage' | 'anastasiaMate' | 'arabianMate' | 'attackingF2F7' | 'attraction'
  | 'backRankMate' | 'bishopEndgame' | 'bodenMate' | 'capturingDefender' | 'castling' | 'clearance'
  | 'collinearMove' | 'crushing' | 'defensiveMove' | 'discoveredAttack' | 'deflection' | 'doubleBishopMate'
  | 'doubleCheck' | 'dovetailMate' | 'equality' | 'enPassant' | 'exposedKing' | 'fork' | 'hangingPiece'
  | 'hookMate' | 'interference' | 'intermezzo' | 'kingsideAttack' | 'knightEndgame' | 'long' | 'mate'
  | 'mateIn5' | 'mateIn4' | 'mateIn3' | 'mateIn2' | 'mateIn1' | 'oneMove' | 'overloading' | 'pawnEndgame'
  | 'pin' | 'promotion' | 'queenEndgame' | 'queensideAttack' | 'quietMove' | 'rookEndgame'
  | 'queenRookEndgame' | 'sacrifice' | 'short' | 'skewer' | 'smotheredMate' | 'trappedPiece'
  | 'underPromotion' | 'veryLong' | 'xRayAttack' | 'zugzwang'

// python slices over the mainline
const odd = (p: Puzzle) => p.mainline.filter((_, i) => i % 2 === 1) // [1::2]
const oddFromSecond = (p: Puzzle) => odd(p).slice(1) // [1::2][1:]
const sq = (name: string): Square => {
  const f = name.charCodeAt(0) - 97
  const r = Number(name[1]) - 1
  return r * 8 + f
}
const child = (n: unknown): ChildNode => n as ChildNode

export function cook(puzzle: Puzzle): TagKind[] {
  const tags: TagKind[] = []

  const mateTag = mateIn(puzzle)
  if (mateTag) {
    tags.push(mateTag, 'mate')
    if (smotheredMate(puzzle)) tags.push('smotheredMate')
    else if (backRankMate(puzzle)) tags.push('backRankMate')
    else if (anastasiaMate(puzzle)) tags.push('anastasiaMate')
    else if (hookMate(puzzle)) tags.push('hookMate')
    else if (arabianMate(puzzle)) tags.push('arabianMate')
    else {
      const found = bodenOrDoubleBishopMate(puzzle)
      if (found) tags.push(found)
      else if (dovetailMate(puzzle)) tags.push('dovetailMate')
    }
  } else if (puzzle.cp > 600) tags.push('crushing')
  else if (puzzle.cp > 200) tags.push('advantage')
  else tags.push('equality')

  if (attraction(puzzle)) tags.push('attraction')
  if (deflection(puzzle)) tags.push('deflection')
  else if (overloading(puzzle)) tags.push('overloading')
  if (advancedPawn(puzzle)) tags.push('advancedPawn')
  if (doubleCheck(puzzle)) tags.push('doubleCheck')
  if (quietMove(puzzle)) tags.push('quietMove')
  if (defensiveMove(puzzle) || checkEscape(puzzle)) tags.push('defensiveMove')
  if (sacrifice(puzzle)) tags.push('sacrifice')
  if (xRay(puzzle)) tags.push('xRayAttack')
  if (fork(puzzle)) tags.push('fork')
  if (hangingPiece(puzzle)) tags.push('hangingPiece')
  if (trappedPiece(puzzle)) tags.push('trappedPiece')
  if (discoveredAttack(puzzle)) tags.push('discoveredAttack')
  if (exposedKing(puzzle)) tags.push('exposedKing')
  if (skewer(puzzle)) tags.push('skewer')
  if (collinear(puzzle)) tags.push('collinearMove')
  if (selfInterference(puzzle) || interference(puzzle)) tags.push('interference')
  if (intermezzo(puzzle)) tags.push('intermezzo')
  if (pinPreventsAttack(puzzle) || pinPreventsEscape(puzzle)) tags.push('pin')
  if (attackingF2F7(puzzle)) tags.push('attackingF2F7')
  if (clearance(puzzle)) tags.push('clearance')
  if (enPassant(puzzle)) tags.push('enPassant')
  if (castling(puzzle)) tags.push('castling')
  if (promotion(puzzle)) tags.push('promotion')
  if (underPromotion(puzzle)) tags.push('underPromotion')
  if (capturingDefender(puzzle)) tags.push('capturingDefender')

  if (pieceEndgame(puzzle, 'pawn')) tags.push('pawnEndgame')
  else if (pieceEndgame(puzzle, 'queen')) tags.push('queenEndgame')
  else if (pieceEndgame(puzzle, 'rook')) tags.push('rookEndgame')
  else if (pieceEndgame(puzzle, 'bishop')) tags.push('bishopEndgame')
  else if (pieceEndgame(puzzle, 'knight')) tags.push('knightEndgame')
  else if (queenRookEndgame(puzzle)) tags.push('queenRookEndgame')

  if (!tags.includes('backRankMate') && !tags.includes('fork')) {
    if (kingsideAttack(puzzle)) tags.push('kingsideAttack')
    else if (queensideAttack(puzzle)) tags.push('queensideAttack')
  }

  const n = puzzle.mainline.length
  if (n === 2) tags.push('oneMove')
  else if (n === 4) tags.push('short')
  else if (n >= 8) tags.push('veryLong')
  else tags.push('long')

  return tags
}

export function advancedPawn(puzzle: Puzzle): boolean {
  return odd(puzzle).some(node => util.isVeryAdvancedPawnMove(node))
}

export function doubleCheck(puzzle: Puzzle): boolean {
  return odd(puzzle).some(node => node.board().checkers().size() > 1)
}

export function sacrifice(puzzle: Puzzle): boolean {
  // down in material compared to initial position, after moving
  const diffs = puzzle.mainline.map(n => materialDiff(n.board(), puzzle.pov))
  const initial = diffs[0]!
  for (const d of diffs.filter((_, i) => i % 2 === 1).slice(1)) {
    if (d - initial <= -2) return !puzzle.mainline.filter((_, i) => i % 2 === 0).slice(1).some(n => n.move.promotion)
  }
  return false
}

export function xRay(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    if (!util.isCapture(node)) continue
    const prevOpNode = child(node.parent)
    if (prevOpNode.move.to !== node.move.to || util.movedPieceType(prevOpNode) === 'king') continue
    const prevPlNode = child(prevOpNode.parent)
    if (prevPlNode.move.to !== prevOpNode.move.to) continue
    if (between(node.move.from, node.move.to).has(prevOpNode.move.from)) return true
  }
  return false
}

export function fork(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle).slice(0, -1)) {
    if (util.movedPieceType(node) !== 'king') {
      const board = node.board()
      if (util.isInBadSpot(board, node.move.to)) continue
      let nb = 0
      for (const [piece, square] of util.attackedOpponentSquares(board, node.move.to, puzzle.pov)) {
        if (piece.role === 'pawn') continue
        if (
          util.kingValues[piece.role] > util.kingValues[util.movedPieceType(node)] ||
          (util.isHanging(board, piece, square) && !board.attackers(opposite(puzzle.pov), node.move.to).has(square))
        )
          nb += 1
      }
      if (nb > 1) return true
    }
  }
  return false
}

export function hangingPiece(puzzle: Puzzle): boolean {
  const to = puzzle.mainline[1]!.move.to
  const first = puzzle.mainline[0]!.board()
  const captured = first.pieceAt(to)
  if (first.isCheck() && (!captured || captured.role === 'pawn')) return false
  if (captured && captured.role !== 'pawn') {
    if (util.isHanging(first, captured, to)) {
      const opMove = puzzle.mainline[0]!.move
      const opCapture = puzzle.game.board().pieceAt(opMove.to)
      if (opCapture && util.values[opCapture.role] >= util.values[captured.role] && opMove.to === to) return false
      if (puzzle.mainline.length < 4) return true
      if (materialDiff(puzzle.mainline[3]!.board(), puzzle.pov) >= materialDiff(puzzle.mainline[1]!.board(), puzzle.pov))
        return true
    }
  }
  return false
}

export function trappedPiece(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    let square = node.move.to
    const captured = node.parent.board().pieceAt(square)
    if (captured && captured.role !== 'pawn') {
      const prev = child(node.parent)
      if (prev.move.to === square) square = prev.move.from
      if (util.isTrapped(prev.parent.board(), square)) return true
    }
  }
  return false
}

export function overloading(_puzzle: Puzzle): boolean {
  return false
}

export function discoveredAttack(puzzle: Puzzle): boolean {
  if (discoveredCheck(puzzle)) return true
  for (const node of oddFromSecond(puzzle)) {
    if (util.isCapture(node)) {
      const betweenSquares = between(node.move.from, node.move.to)
      if (child(node.parent).move.to === node.move.to) return false
      const prev = child(node.parent.parent)
      if (
        betweenSquares.has(prev.move.from) &&
        node.move.to !== prev.move.to &&
        node.move.from !== prev.move.to &&
        !util.isCastling(prev)
      )
        return true
    }
  }
  return false
}

export function discoveredCheck(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    const checkers = node.board().checkers()
    if (checkers.nonEmpty() && !checkers.has(node.move.to)) return true
  }
  return false
}

export function quietMove(puzzle: Puzzle): boolean {
  for (const node of puzzle.mainline) {
    if (
      // on player move, not the last move of the puzzle
      node.turn() !== puzzle.pov &&
      !node.isEnd() &&
      // no check given or escaped
      !node.board().isCheck() &&
      !node.parent.board().isCheck() &&
      // no capture made or threatened
      !util.isCapture(node) &&
      util.attackedOpponentPieces(node.board(), node.move.to, puzzle.pov).length === 0 &&
      // no advanced pawn push
      !util.isAdvancedPawnMove(node) &&
      util.movedPieceType(node) !== 'king'
    )
      return true
  }
  return false
}

export function defensiveMove(puzzle: Puzzle): boolean {
  // like quiet_move, but on last move; at least 3 legal moves
  const ml = puzzle.mainline
  if (ml.length < 2 || ml[ml.length - 2]!.board().legalMoves().length < 3) return false
  const node = ml[ml.length - 1]!
  // no check given, no piece taken
  if (node.board().isCheck() || util.isCapture(node)) return false
  // no piece attacked
  if (util.attackedOpponentPieces(node.board(), node.move.to, puzzle.pov).length) return false
  // no advanced pawn push
  return !util.isAdvancedPawnMove(node)
}

export function checkEscape(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    if (node.board().isCheck() || util.isCapture(node)) return false
    if (node.parent.board().legalMoves().length < 3) return false
    if (node.parent.board().isCheck()) return true
  }
  return false
}

export function attraction(puzzle: Puzzle): boolean {
  for (const node of puzzle.mainline.slice(1)) {
    if (node.turn() === puzzle.pov) continue
    // 1. player moves to a square
    const firstMoveTo = node.move.to
    const opponentReply = util.nextNode(node)
    // 2. opponent captures on that square
    if (opponentReply && opponentReply.move.to === firstMoveTo) {
      const attractedPiece = util.movedPieceType(opponentReply)
      if (attractedPiece === 'king' || attractedPiece === 'queen' || attractedPiece === 'rook') {
        const attractedToSquare = opponentReply.move.to
        const next = util.nextNode(opponentReply)
        if (next) {
          const attackers = next.board().attackers(puzzle.pov, attractedToSquare)
          // 3. player attacks that square
          if (attackers.has(next.move.to)) {
            // 4. player checks on that square
            if (attractedPiece === 'king') return true
            const n3 = util.nextNextNode(next)
            // 4. or player later captures on that square
            if (n3 && n3.move.to === attractedToSquare) return true
          }
        }
      }
    }
  }
  return false
}

export function deflection(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    const capturedPiece = node.parent.board().pieceAt(node.move.to)
    if (capturedPiece || node.move.promotion) {
      const capturingPiece = util.movedPieceType(node)
      if (capturedPiece && util.kingValues[capturedPiece.role] > util.kingValues[capturingPiece]) continue
      const square = node.move.to
      const prevOpMove = child(node.parent).move
      const grandpa = child(node.parent.parent)
      const prevPlayerMove = grandpa.move
      const prevPlayerCapture = grandpa.parent.board().pieceAt(prevPlayerMove.to)
      const grandpaBoard = grandpa.board()
      if (
        // python compares a value to a PieceType int here; kept as-is (knight=2 ... king=6)
        (!prevPlayerCapture || util.values[prevPlayerCapture.role] < pieceTypeIndex(util.movedPieceType(grandpa))) &&
        square !== prevOpMove.to &&
        square !== prevPlayerMove.to &&
        (prevOpMove.to === prevPlayerMove.to || grandpaBoard.isCheck()) &&
        (grandpaBoard.attacks(prevOpMove.from).has(square) ||
          (!!node.move.promotion &&
            squareFile(node.move.to) === squareFile(prevOpMove.from) &&
            grandpaBoard.attacks(prevOpMove.from).has(node.move.from))) &&
        !node.parent.board().attacks(prevOpMove.to).has(square)
      )
        return true
    }
  }
  return false
}

const PIECE_TYPE_INDEX: Record<Role, number> = { pawn: 1, knight: 2, bishop: 3, rook: 4, queen: 5, king: 6 }
const pieceTypeIndex = (role: Role): number => PIECE_TYPE_INDEX[role]

export function exposedKing(puzzle: Puzzle): boolean {
  let board: Board
  let pov = puzzle.pov
  if (puzzle.pov === 'white') board = puzzle.mainline[0]!.board()
  else {
    pov = opposite(puzzle.pov)
    board = puzzle.mainline[0]!.board().mirror()
  }
  const king = board.king(opposite(pov))!
  if (squareRank(king) < 5) return false
  const squares = [king - 8]
  if (squareFile(king) > 0) squares.push(king - 1, king - 9)
  if (squareFile(king) < 7) squares.push(king + 1, king - 7)
  for (const s of squares) {
    const p = board.pieceAt(s)
    if (p && p.role === 'pawn' && p.color === opposite(pov)) return false
  }
  for (const node of oddFromSecond(puzzle).slice(0, -1)) {
    if (node.board().isCheck()) return true
  }
  return false
}

export function skewer(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    const prev = child(node.parent)
    const capture = prev.board().pieceAt(node.move.to)
    if (capture && util.rayPieceTypes.includes(util.movedPieceType(node)) && !node.board().isCheckmate()) {
      const betweenSquares = between(node.move.from, node.move.to)
      const opMove = prev.move
      if (opMove.to === node.move.to || !betweenSquares.has(opMove.from)) continue
      if (
        util.kingValues[util.movedPieceType(prev)] > util.kingValues[capture.role] &&
        util.isInBadSpot(prev.board(), node.move.to)
      )
        return true
    }
  }
  return false
}

// python-chess SquareSet.pop() removes the lowest square
const popLowest = (set: SquareSet): Square | undefined => set.first()

export function selfInterference(puzzle: Puzzle): boolean {
  // interference by opponent piece
  for (const node of oddFromSecond(puzzle)) {
    const prevBoard = node.parent.board()
    const square = node.move.to
    const capture = prevBoard.pieceAt(square)
    if (capture && util.isHanging(prevBoard, capture, square)) {
      const grandpa = node.parent.parent!
      const initBoard = grandpa.board()
      const defender = popLowest(initBoard.attackers(capture.color, square))
      const defenderPiece = defender !== undefined ? initBoard.pieceAt(defender) : undefined
      if (defender && defenderPiece && util.rayPieceTypes.includes(defenderPiece.role)) {
        if (between(square, defender).has(child(node.parent).move.to)) return true
      }
    }
  }
  return false
}

export function interference(puzzle: Puzzle): boolean {
  // interference by player piece
  for (const node of oddFromSecond(puzzle)) {
    const prevBoard = node.parent.board()
    const square = node.move.to
    const capture = prevBoard.pieceAt(square)
    if (capture && square !== child(node.parent).move.to && util.isHanging(prevBoard, capture, square)) {
      const initBoard = node.parent.parent!.parent!.board()
      const defender = popLowest(initBoard.attackers(capture.color, square))
      const defenderPiece = defender !== undefined ? initBoard.pieceAt(defender) : undefined
      if (defender && defenderPiece && util.rayPieceTypes.includes(defenderPiece.role)) {
        const interfering = child(node.parent.parent)
        if (between(square, defender).has(interfering.move.to)) return true
      }
    }
  }
  return false
}

export function intermezzo(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    if (util.isCapture(node)) {
      const captureMove = node.move
      const captureSquare = node.move.to
      const opNode = child(node.parent)
      const prevPovNode = child(node.parent.parent)
      if (!prevPovNode.board().attackers(opposite(puzzle.pov), captureSquare).has(opNode.move.from)) {
        if (prevPovNode.move.to !== captureSquare) {
          const prevOpNode = child(prevPovNode.parent)
          return (
            prevOpNode.move.to === captureSquare &&
            util.isCapture(prevOpNode) &&
            prevOpNode
              .board()
              .legalMoves()
              .some(m => m.from === captureMove.from && m.to === captureMove.to && m.promotion === captureMove.promotion)
          )
        }
      }
    }
  }
  return false
}

// the pinned piece can't attack a player piece
export function pinPreventsAttack(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    const board = node.board()
    for (const [square, piece] of board.pieceMap()) {
      if (piece.color === puzzle.pov) continue
      const pinDir = board.pin(piece.color, square)
      if (pinDir.equals(ALL)) continue
      for (const attack of board.attacks(square)) {
        const attacked = board.pieceAt(attack)
        if (
          attacked &&
          attacked.color === puzzle.pov &&
          !pinDir.has(attack) &&
          (util.values[attacked.role] > util.values[piece.role] || util.isHanging(board, attacked, attack))
        )
          return true
      }
    }
  }
  return false
}

// the pinned piece can't escape the attack
export function pinPreventsEscape(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    const board = node.board()
    for (const [pinnedSquare, pinnedPiece] of board.pieceMap()) {
      if (pinnedPiece.color === puzzle.pov) continue
      const pinDir = board.pin(pinnedPiece.color, pinnedSquare)
      if (pinDir.equals(ALL)) continue
      for (const attackerSquare of board.attackers(puzzle.pov, pinnedSquare)) {
        if (pinDir.has(attackerSquare)) {
          const attacker = board.pieceAt(attackerSquare)!
          if (util.values[pinnedPiece.role] > util.values[attacker.role]) return true
          if (
            util.isHanging(board, pinnedPiece, pinnedSquare) &&
            !board.attackers(opposite(puzzle.pov), attackerSquare).has(pinnedSquare) &&
            board.pseudoLegalDests(pinnedSquare).diff(pinDir).nonEmpty()
          )
            return true
        }
      }
    }
  }
  return false
}

export function attackingF2F7(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    const square = node.move.to
    if (node.parent.board().pieceAt(node.move.to) && (square === sq('f2') || square === sq('f7'))) {
      const king = node.board().pieceAt(square === sq('f7') ? sq('e8') : sq('e1'))
      return king !== undefined && king.role === 'king' && king.color !== puzzle.pov
    }
  }
  return false
}

export const kingsideAttack = (puzzle: Puzzle): boolean => sideAttack(puzzle, 7, [6, 7], 20)
export const queensideAttack = (puzzle: Puzzle): boolean => sideAttack(puzzle, 0, [0, 1, 2], 18)

function sideAttack(puzzle: Puzzle, cornerFile: number, kingFiles: number[], nbPieces: number): boolean {
  const backRank = puzzle.pov === 'white' ? 7 : 0
  const initBoard = puzzle.mainline[0]!.board()
  const kingSquare = initBoard.king(opposite(puzzle.pov))
  if (
    !kingSquare || // python treats a1 (0) as falsy too
    squareRank(kingSquare) !== backRank ||
    !kingFiles.includes(squareFile(kingSquare)) ||
    initBoard.pieceMap().length < nbPieces || // no endgames
    !odd(puzzle).some(node => node.board().isCheck())
  )
    return false
  let score = 0
  const corner = backRank * 8 + cornerFile
  for (const node of odd(puzzle)) {
    const cornerDist = squareDistance(corner, node.move.to)
    if (node.board().isCheck()) score += 1
    if (util.isCapture(node) && cornerDist <= 3) score += 1
    else if (cornerDist >= 5) score -= 1
  }
  return score >= 2
}

export function clearance(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    const board = node.board()
    if (!node.parent.board().pieceAt(node.move.to)) {
      const piece = board.pieceAt(node.move.to)
      if (piece && util.rayPieceTypes.includes(piece.role)) {
        const prev = child(node.parent.parent)
        const prevMove = prev.move
        if (
          !prevMove.promotion &&
          prevMove.to !== node.move.from &&
          prevMove.to !== node.move.to &&
          !node.parent.board().isCheck() &&
          (!board.isCheck() || util.movedPieceType(child(node.parent)) !== 'king')
        ) {
          if (prevMove.from === node.move.to || between(node.move.from, node.move.to).has(prevMove.from)) {
            if ((prev.parent && !prev.parent.board().pieceAt(prevMove.to)) || util.isInBadSpot(prev.board(), prevMove.to))
              return true
          }
        }
      }
    }
  }
  return false
}

export function enPassant(puzzle: Puzzle): boolean {
  return odd(puzzle).some(
    node =>
      util.movedPieceType(node) === 'pawn' &&
      squareFile(node.move.from) !== squareFile(node.move.to) &&
      !node.parent.board().pieceAt(node.move.to),
  )
}

export function collinear(puzzle: Puzzle): boolean {
  // 1. player moves a ray piece without capturing
  for (const node of odd(puzzle)) {
    const movingPiece = util.movedPieceType(node)
    if (!util.rayPieceTypes.includes(movingPiece)) continue
    const prevBoard = node.parent.board()
    if (util.isCapture(node)) continue
    const fromSq = node.move.from
    const toSq = node.move.to
    for (const square of prevBoard.attacks(fromSq)) {
      const piece = prevBoard.pieceAt(square)
      if (!piece || piece.color === puzzle.pov || !util.rayPieceTypes.includes(piece.role)) continue
      // 2. from, opponent piece, and destination are all on the same line
      if (!squaresAreCollinear(fromSq, square, toSq)) continue
      // 3. opponent piece can also move along this line type
      const isOrthogonal = squareRank(fromSq) === squareRank(square) || squareFile(fromSq) === squareFile(square)
      if (isOrthogonal && piece.role === 'bishop') continue
      if (!isOrthogonal && piece.role === 'rook') continue
      // 4. capture was legal but player chose to stay on the line
      if (prevBoard.legalMoves().some(m => m.from === fromSq && m.to === square && !m.promotion)) return true
    }
  }
  return false
}

export const castling = (puzzle: Puzzle): boolean => odd(puzzle).some(node => util.isCastling(node))

export const promotion = (puzzle: Puzzle): boolean => odd(puzzle).some(node => !!node.move.promotion)

export function underPromotion(puzzle: Puzzle): boolean {
  for (const node of odd(puzzle)) {
    if (node.board().isCheckmate()) return node.move.promotion === 'knight'
    else if (node.move.promotion && node.move.promotion !== 'queen') return true
  }
  return false
}

export function capturingDefender(puzzle: Puzzle): boolean {
  for (const node of oddFromSecond(puzzle)) {
    const board = node.board()
    const capture = node.parent.board().pieceAt(node.move.to)
    if (
      board.isCheckmate() ||
      (capture &&
        util.movedPieceType(node) !== 'king' &&
        util.values[capture.role] <= util.values[util.movedPieceType(node)] &&
        util.isHanging(node.parent.board(), capture, node.move.to) &&
        child(node.parent).move.to !== node.move.to)
    ) {
      const prev = child(node.parent.parent)
      if (!prev.board().isCheck() && prev.move.to !== node.move.from) {
        const initBoard = prev.parent.board()
        const defenderSquare = prev.move.to
        const defender = initBoard.pieceAt(defenderSquare)
        if (defender && initBoard.attackers(defender.color, node.move.to).has(defenderSquare) && !initBoard.isCheck())
          return true
      }
    }
  }
  return false
}

export function backRankMate(puzzle: Puzzle): boolean {
  const board = puzzle.game.end().board()
  const king = board.king(opposite(puzzle.pov))!
  const white = puzzle.pov === 'white'
  const backRank = white ? 7 : 0
  if (board.isCheckmate() && squareRank(king) === backRank) {
    const squares = [king + (white ? -8 : 8)]
    if (white) {
      if (squareFile(king) < 7) squares.push(king - 7)
      if (squareFile(king) > 0) squares.push(king - 9)
    } else {
      if (squareFile(king) < 7) squares.push(king + 9)
      if (squareFile(king) > 0) squares.push(king + 7)
    }
    for (const s of squares) {
      const piece = board.pieceAt(s)
      if (!piece || piece.color === puzzle.pov || board.attackers(puzzle.pov, s).nonEmpty()) return false
    }
    return [...board.checkers()].some(checker => squareRank(checker) === backRank)
  }
  return false
}

export function anastasiaMate(puzzle: Puzzle): boolean {
  const node = puzzle.game.end()
  let board = node.board()
  let king = board.king(opposite(puzzle.pov))!
  if ([0, 7].includes(squareFile(king)) && ![0, 7].includes(squareRank(king))) {
    const moved = util.movedPieceType(node)
    if (squareFile(node.move.to) === squareFile(king) && (moved === 'queen' || moved === 'rook')) {
      if (squareFile(king) !== 0) board = board.flipHorizontal()
      king = board.king(opposite(puzzle.pov))!
      const blocker = board.pieceAt(king + 1)
      if (blocker && blocker.color !== puzzle.pov) {
        const knight = board.pieceAt(king + 3)
        if (knight && knight.color === puzzle.pov && knight.role === 'knight') return true
      }
    }
  }
  return false
}

export function hookMate(puzzle: Puzzle): boolean {
  const node = puzzle.game.end()
  const board = node.board()
  const king = board.king(opposite(puzzle.pov))!
  if (util.movedPieceType(node) === 'rook' && squareDistance(node.move.to, king) === 1) {
    for (const rookDefenderSquare of board.attackers(puzzle.pov, node.move.to)) {
      const defender = board.pieceAt(rookDefenderSquare)
      if (defender && defender.role === 'knight' && squareDistance(rookDefenderSquare, king) === 1) {
        for (const knightDefenderSquare of board.attackers(puzzle.pov, rookDefenderSquare)) {
          const pawn = board.pieceAt(knightDefenderSquare)
          if (pawn && pawn.role === 'pawn') return true
        }
      }
    }
  }
  return false
}

export function arabianMate(puzzle: Puzzle): boolean {
  const node = puzzle.game.end()
  const board = node.board()
  const king = board.king(opposite(puzzle.pov))!
  if (
    [0, 7].includes(squareFile(king)) &&
    [0, 7].includes(squareRank(king)) &&
    util.movedPieceType(node) === 'rook' &&
    squareDistance(node.move.to, king) === 1
  ) {
    for (const knightSquare of board.attackers(puzzle.pov, node.move.to)) {
      const knight = board.pieceAt(knightSquare)
      if (
        knight &&
        knight.role === 'knight' &&
        Math.abs(squareRank(knightSquare) - squareRank(king)) === 2 &&
        Math.abs(squareFile(knightSquare) - squareFile(king)) === 2
      )
        return true
    }
  }
  return false
}

export function bodenOrDoubleBishopMate(puzzle: Puzzle): 'bodenMate' | 'doubleBishopMate' | undefined {
  const board = puzzle.game.end().board()
  const king = board.king(opposite(puzzle.pov))!
  const bishopSquares = [...board.pieces('bishop', puzzle.pov)]
  if (bishopSquares.length < 2) return undefined
  for (let s = 0; s < 64; s++) {
    if (squareDistance(s, king) >= 2) continue
    if (!util.attackerPieces(board, puzzle.pov, s).every(p => p.role === 'bishop')) return undefined
  }
  if ((squareFile(bishopSquares[0]!) < squareFile(king)) === (squareFile(bishopSquares[1]!) > squareFile(king)))
    return 'bodenMate'
  return 'doubleBishopMate'
}

export function dovetailMate(puzzle: Puzzle): boolean {
  const node = puzzle.game.end()
  const board = node.board()
  const king = board.king(opposite(puzzle.pov))!
  if ([0, 7].includes(squareFile(king)) || [0, 7].includes(squareRank(king))) return false
  const queenSquare = node.move.to
  if (
    util.movedPieceType(node) !== 'queen' ||
    squareFile(queenSquare) === squareFile(king) ||
    squareRank(queenSquare) === squareRank(king) ||
    squareDistance(queenSquare, king) > 1
  )
    return false
  for (let s = 0; s < 64; s++) {
    if (squareDistance(s, king) !== 1 || s === queenSquare) continue
    const attackers = [...board.attackers(puzzle.pov, s)]
    if (attackers.length === 1 && attackers[0] === queenSquare) {
      if (board.pieceAt(s)) return false
    } else if (attackers.length) return false
  }
  return true
}

export function pieceEndgame(puzzle: Puzzle, role: Role): boolean {
  for (const board of [0, 1].map(i => puzzle.mainline[i]!.board())) {
    if (board.pieces(role, 'white').isEmpty() && board.pieces(role, 'black').isEmpty()) return false
    for (const [, piece] of board.pieceMap()) {
      if (!['king', 'pawn', role].includes(piece.role)) return false
    }
  }
  return true
}

export function queenRookEndgame(puzzle: Puzzle): boolean {
  const test = (board: Board): boolean => {
    const pieces = board.pieceMap().map(([, p]) => p)
    return (
      pieces.filter(p => p.role === 'queen').length === 1 &&
      pieces.some(p => p.role === 'rook') &&
      pieces.every(p => ['queen', 'rook', 'pawn', 'king'].includes(p.role))
    )
  }
  return [0, 1].every(i => test(puzzle.mainline[i]!.board()))
}

export function smotheredMate(puzzle: Puzzle): boolean {
  const board = puzzle.game.end().board()
  const kingSquare = board.king(opposite(puzzle.pov))!
  for (const checkerSquare of board.checkers()) {
    const piece = board.pieceAt(checkerSquare)!
    if (piece.role === 'knight') {
      for (let s = 0; s < 64; s++) {
        if (squareDistance(s, kingSquare) !== 1) continue
        const blocker = board.pieceAt(s)
        if (!blocker || blocker.color === puzzle.pov) return false
      }
      return true
    }
  }
  return false
}

export function mateIn(puzzle: Puzzle): 'mateIn1' | 'mateIn2' | 'mateIn3' | 'mateIn4' | 'mateIn5' | undefined {
  if (!puzzle.game.end().board().isCheckmate()) return undefined
  const movesToMate = Math.floor(puzzle.mainline.length / 2)
  if (movesToMate === 1) return 'mateIn1'
  if (movesToMate === 2) return 'mateIn2'
  if (movesToMate === 3) return 'mateIn3'
  if (movesToMate === 4) return 'mateIn4'
  return 'mateIn5'
}

// re-exported for tests that mirror python's module layout
export { squareDistance }
