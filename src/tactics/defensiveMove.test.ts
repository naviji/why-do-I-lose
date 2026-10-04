import { describe, expect, it } from 'vitest'
import { defensiveMove } from './defensiveMove'

describe('defensiveMove (the threat was already there and the move did not meet it)', () => {
  it('flags a move that ignores a threat already on the board', () => {
    // kramford game pW60Sss4, move 18: Nc4 Ra8 Nxb6 worked before Re8 too; d5 was needed
    const fen = '2b2rk1/1p1p1pbp/1p2pnp1/rB6/3NP3/N1P2P2/PP4PP/R2R2K1 b - - 4 18'
    const line = ['a3c4', 'a5a8', 'c4b6', 'a8b8', 'a2a4', 'e8d8', 'a4a5', 'd7d5', 'e4d5', 'f6d5']
    expect(defensiveMove({ fen, move: 'f8e8', line, better: 'd7d5' })).toBe(true)
  })

  it('flags leaving an attacked piece where it is', () => {
    // Nd5 is already attacked and undefended; Ke7 ignores it
    expect(defensiveMove({ fen: '4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1', move: 'e8e7', line: ['c3d5', 'e7d6'] })).toBe(true)
  })

  it('ignores a threat the move itself created', () => {
    // kramford, move 12: Nef3 opens d6-f4; before it Bxf4 was blocked by the e5 knight
    const fen = 'r2qk2r/ppp3pp/3bpp2/3pNn2/3P1P2/2P5/PP1NKPPP/R2Q3R w kq - 0 12'
    expect(defensiveMove({ fen, move: 'e5f3', line: ['d6f4', 'h1e1', 'd8d7', 'e2f1', 'e8g8', 'f1g1'] })).toBe(false)
  })

  it('ignores a line opened by the move', () => {
    // kramford game 97VVp2iX, move 16: exd5 opens the e-file that Rxe8+ needs
    const fen = 'r1bqr1k1/pn3pbp/1p2pnp1/3P4/1P1P1B2/3B1N2/P1QN1PPP/4RRK1 b - - 0 16'
    expect(defensiveMove({ fen, move: 'e6d5', line: ['c2c6', 'a7a6', 'e1e8', 'd8e8', 'c6b6', 'b7d8', 'd2b3'] })).toBe(false)
  })

  it('ignores a line that loses nothing', () => {
    expect(defensiveMove({ fen: '4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1', move: 'd5e3', line: ['e1e2', 'e3g4'] })).toBe(false)
  })

  it('ignores a move made while in check', () => {
    expect(defensiveMove({ fen: '4k3/8/8/3n4/8/2N5/8/4R1K1 b - - 0 1', move: 'e8d7', line: ['c3d5', 'd7d6'] })).toBe(false)
  })

  it('ignores a defender the move took away', () => {
    // kramford game L4uuQv4z, move 18: with the pawn still on e7, Bxf6 exf6 wins nothing
    const fen = '2r1r1k1/3qppbp/p1n2np1/1p4B1/1N1P4/P1P2Q1P/BP3PP1/R3R1K1 b - - 1 18'
    expect(defensiveMove({ fen, move: 'e7e6', line: ['g5f6', 'g7f6', 'f3f6', 'a6a5', 'b4d3', 'b5b4', 'd3c5'] })).toBe(false)
  })

  it('ignores a threat the best move could not stop either', () => {
    // Nd5 is attacked; the best move (here Ke7, standing in for any) leaves it en prise too
    expect(defensiveMove({ fen: '4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1', move: 'e8e7', line: ['c3d5', 'e7d6'], better: 'e8d8' })).toBe(false)
  })

  it('flags it when the best move does stop the threat', () => {
    expect(defensiveMove({ fen: '4k3/8/8/3n4/8/2N5/8/4K3 b - - 0 1', move: 'e8e7', line: ['c3d5', 'e7d6'], better: 'd5e7' })).toBe(true)
  })
})
