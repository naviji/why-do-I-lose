import { mount } from 'svelte'
import './app.css'
import App from './App.svelte'
import { loadEngine } from './engine/loadEngine'
import { fetchHttpClient } from './import/sources'
import { IdbAnalysisRepo, IdbGameRepo, openAppDb } from './storage/indexedDb'
import { createAppController, type LabelStore } from './ui/appController'

// Games and analyses live in IndexedDB; removed labels in localStorage.
const KEY = 'removedLabels'
const labels: LabelStore = {
  load() {
    try { return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]')) } catch { return new Set() }
  },
  save(ids) {
    try { localStorage.setItem(KEY, JSON.stringify([...ids])) } catch { /* private mode */ }
  },
}

const db = await openAppDb()
const controller = createAppController({
  http: fetchHttpClient,
  games: new IdbGameRepo(db),
  analyses: new IdbAnalysisRepo(db),
  engine: () => loadEngine().catch(e => e),
  labels,
})

// Show what an earlier visit already imported and analyzed.
void controller.restore()

const app = mount(App, { target: document.getElementById('app')!, props: { controller } })

export default app
