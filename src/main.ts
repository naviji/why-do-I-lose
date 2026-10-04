import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { MemoryAnalysisRepo } from './analysis/job'
import { loadEngine } from './engine/loadEngine'
import { MemoryGameRepo } from './import/importGames'
import { fetchHttpClient } from './import/sources'
import { createAppController, type LabelStore } from './ui/appController'

// Removed labels survive a reload; games and analyses wait for the IndexedDB repos.
const KEY = 'removedLabels'
const labels: LabelStore = {
  load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return new Set() }
  },
  save(ids) {
    try { localStorage.setItem(KEY, JSON.stringify([...ids])) } catch { /* private mode */ }
  },
}

const controller = createAppController({
  http: fetchHttpClient,
  games: new MemoryGameRepo(),
  analyses: new MemoryAnalysisRepo(),
  engine: () => loadEngine().catch(e => e),
  labels,
})

const app = mount(App, { target: document.getElementById('app')!, props: { controller } })

export default app
