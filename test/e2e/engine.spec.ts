import { expect, test } from '@playwright/test'

const settings = { depth: 10, nodes: 200_000, hashMb: 16 }

test('real Stockfish finds a back-rank mate in the browser', async ({ page }) => {
  await page.goto('/test/e2e/engine.html')
  await page.waitForFunction(() => (window as any).ready)
  const result = await page.evaluate(async s => {
    const engine = await (window as any).loadEngine()
    const r = await engine.evaluate('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', s, new AbortController().signal)
    return { info: engine.info(), ...r }
  }, settings)
  expect(result.score).toEqual({ mate: 1 })
  expect(result.pv[0]).toBe('a1a8')
  expect(result.info.version).toBe('stockfish-19-lite-single')
})

test('a missing engine is reported as a load error', async ({ page }) => {
  await page.route('**/stockfish/**', route => route.abort())
  await page.goto('/test/e2e/engine.html')
  await page.waitForFunction(() => (window as any).ready)
  const error = await page.evaluate(() => (window as any).loadEngine().then(() => 'loaded', (e: Error) => e.constructor.name + ': ' + e.message))
  expect(error).toMatch(/^EngineLoadError/)
})
