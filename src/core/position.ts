import { Chess } from 'chessops/chess'
import { parseFen } from 'chessops/fen'

export function positionFromFen(fen: string): Chess {
  return Chess.fromSetup(parseFen(fen).unwrap()).unwrap()
}
