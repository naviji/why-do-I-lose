// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/svelte'
import { describe, expect, it } from 'vitest'
import App from '../App.svelte'
import { MemoryAnalysisRepo } from '../analysis/job'
import { EngineLoadError } from '../engine/engine'
import { MemoryGameRepo } from '../import/importGames'
import lichessPgn from '../../test/fixtures/api/lichess-kramford.pgn?raw'
import { createAppController } from './appController'

const pgn = lichessPgn.split(/\n\n\n/).slice(0, 5).join('\n\n\n')
const controller = () => createAppController({
  http: { async *stream() { yield pgn }, json: async () => ({}) as never },
  games: new MemoryGameRepo(),
  analyses: new MemoryAnalysisRepo(),
  engine: async () => new EngineLoadError('Stockfish is not available in tests'),
  labels: { load: () => new Set(), save() {} },
})

describe('App', () => {
  it('shows the empty state and the import form on a first visit', () => {
    render(App, { controller: controller() })
    expect(screen.getByText('Your results will appear here')).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Import and analyze' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('imports a user and shows their games in the panel header', async () => {
    render(App, { controller: controller() })
    await fireEvent.input(screen.getByLabelText(/Lichess username/), { target: { value: 'kramford' } })
    await fireEvent.click(screen.getByRole('button', { name: 'Import and analyze' }))
    expect(await screen.findByText('kramford · 5 games')).toBeTruthy()
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('offers Chess.com time controls when Chess.com is picked', async () => {
    render(App, { controller: controller() })
    await fireEvent.click(screen.getByRole('button', { name: /Which games/ }))
    await fireEvent.click(screen.getByRole('button', { name: 'Chess.com' }))
    expect(screen.getByRole('button', { name: 'Daily' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'UltraBullet' })).toBeNull()
  })
})
