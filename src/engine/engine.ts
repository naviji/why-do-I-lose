// Engine port. Detectors never call it; the analysis job does.
export interface EngineSettings {
  depth: number
  /** Node cap per search: the single-threaded WASM build can't react to `stop` mid-search. */
  nodes: number
  hashMb: number
}

export interface EngineInfo {
  name: string
  version: string
}

/** A finished search. The score is from the side to move's point of view. */
export interface EvalResult {
  score: { cp: number } | { mate: number }
  pv: string[]
  depth: number
}

export interface Engine {
  info(): EngineInfo
  evaluate(fen: string, settings: EngineSettings, signal: AbortSignal): Promise<EvalResult>
  dispose(): void
}

export class EngineLoadError extends Error {}

export const DEFAULT_SETTINGS: EngineSettings = { depth: 18, nodes: 2_000_000, hashMb: 64 }
