<script lang="ts">
  import type { AppState } from '../appController'
  import { defaultFilters, filterSummary, SPEED_NAMES, speedsFor, type ImportFilters, type Site, type Speed } from '../viewModel'
  let { app, onimport, onstop, ontoggle }: {
    app: AppState
    onimport: (site: Site, username: string, filters: ImportFilters) => void
    onstop: () => void
    ontoggle: () => void
  } = $props()

  let site = $state<Site>('lichess')
  let username = $state('')
  let filters = $state<ImportFilters>(defaultFilters())
  let from = $state('')
  let to = $state('')
  let minElo = $state('')
  let maxElo = $state('')
  let showFilters = $state(false)
  let busy = $derived(app.phase === 'importing' || app.phase === 'analyzing')
  const day = (t?: number) => (t ? new Date(t).toLocaleDateString() : '–')

  function pickSite(s: Site) {
    site = s
    filters.speeds = filters.speeds.filter(x => speedsFor(s).includes(x))
  }
  function toggle(s: Speed) {
    filters.speeds = filters.speeds.includes(s) ? filters.speeds.filter(x => x !== s) : [...filters.speeds, s]
  }
  function submit(e: Event) {
    e.preventDefault()
    if (!username.trim()) return
    const f: ImportFilters = { ...$state.snapshot(filters) }
    if (from) f.from = Date.parse(from)
    if (to) f.to = Date.parse(to) + 86_400_000 - 1
    if (minElo || maxElo) f.eloRange = [Number(minElo) || 0, maxElo ? Number(maxElo) : null]
    onimport(site, username.trim(), f)
  }
</script>

<aside class="panel" class:sheet={app.panelOpen && app.stats.games > 0}>
  <button class="head" onclick={ontoggle} aria-expanded={app.panelOpen}>
    <span>{app.user ? `${app.user.username} · ${app.stats.games} games` : 'Games'}</span><span aria-hidden="true">{app.panelOpen ? '▴' : '▾'}</span>
  </button>
  {#if app.panelOpen}
    <form class="body" onsubmit={submit}>
      <div class="step">1 · Site</div>
      <div class="row">
        <button type="button" class="seg" class:on={site === 'lichess'} onclick={() => pickSite('lichess')}>Lichess</button>
        <button type="button" class="seg" class:on={site === 'chesscom'} onclick={() => pickSite('chesscom')}>Chess.com</button>
      </div>
      <label class="step" for="username">2 · {site === 'lichess' ? 'Lichess' : 'Chess.com'} username</label>
      <input id="username" bind:value={username} placeholder="e.g. kramford" autocomplete="username" autocapitalize="none" spellcheck="false" />
      <button type="button" class="step fold" onclick={() => (showFilters = !showFilters)} aria-expanded={showFilters}>
        <span>3 · Which games</span><span class="muted">{showFilters ? '▴' : filterSummary(filters) + ' ▾'}</span>
      </button>
      {#if showFilters}
        <div class="muted">Time control</div>
        <div class="row wrap">
          {#each speedsFor(site) as s}
            <button type="button" class="chip" class:on={filters.speeds.includes(s)} aria-pressed={filters.speeds.includes(s)} onclick={() => toggle(s)}>{SPEED_NAMES[s]}</button>
          {/each}
        </div>
        <label class="field"><span class="muted">Mode</span>
          <select bind:value={filters.rated}><option value="all">Rated and casual</option><option value="rated">Rated</option><option value="casual">Casual</option></select></label>
        <label class="field"><span class="muted">From</span><input type="date" bind:value={from} /></label>
        <label class="field"><span class="muted">To</span><input type="date" bind:value={to} /></label>
        <div class="field"><span class="muted">Opponent rating</span>
          <span class="row"><input aria-label="Lowest opponent rating" inputmode="numeric" placeholder="Any" bind:value={minElo} /><input aria-label="Highest opponent rating" inputmode="numeric" placeholder="Any" bind:value={maxElo} /></span></div>
        <label class="field"><span class="muted">Max games</span>
          <select bind:value={filters.max}><option value={100}>100 newest</option><option value={500}>500 newest</option><option value={1000}>1000 newest</option><option value={null}>All</option></select></label>
      {/if}
      {#if busy}
        <button type="button" class="btn" onclick={onstop}>Stop</button>
        <div class="muted small">{app.phase === 'importing' ? `Downloaded ${app.downloaded} games…` : `Analyzing ${app.progress?.done ?? 0} of ${app.progress?.eligible ?? '…'}…`}</div>
      {:else}
        <button type="submit" class="btn primary" disabled={!username.trim()}>{app.stats.games ? 'Sync' : 'Import and analyze'}</button>
      {/if}
      <div class="muted small">Standard chess only. Both colors are imported. Everything stays in your browser.</div>
      {#if app.stats.games}
        <div class="stats">
          <div class="step">Imported games</div>
          <dl>
            <dt>Games</dt><dd>{app.stats.games}</dd>
            <dt>Won · drawn · lost</dt><dd>{app.stats.wins} · {app.stats.draws} · {app.stats.losses}</dd>
            <dt>Analyzed</dt><dd>{app.stats.analyzed}</dd>
            <dt>Date range</dt><dd>{day(app.stats.first)} – {day(app.stats.last)}</dd>
            <dt>Skipped (variants)</dt><dd>{app.stats.skipped}</dd>
            <dt>Couldn't read</dt><dd>{app.stats.unreadable}</dd>
            <dt>Last sync</dt><dd>{app.stats.lastSync ? new Date(app.stats.lastSync).toLocaleString() : '–'}</dd>
          </dl>
        </div>
      {/if}
    </form>
  {/if}
</aside>

<style>
  .panel { background: var(--panel); border-radius: 8px; overflow: hidden; }
  .head { width: 100%; min-height: 48px; display: flex; justify-content: space-between; align-items: center; padding: 0 16px; border: 0; background: var(--panel-dark); font-weight: 800; cursor: pointer; }
  .body { padding: 16px; display: flex; flex-direction: column; gap: 10px; font-size: 15px; }
  .step { font-weight: 800; padding-top: 10px; border-top: 1px solid var(--line); }
  .step:first-child { border-top: 0; padding-top: 0; }
  .fold { display: flex; justify-content: space-between; gap: 8px; background: none; border: 0; border-top: 1px solid var(--line); text-align: left; min-height: 44px; padding: 10px 0 0; cursor: pointer; }
  .fold .muted { font-weight: 400; font-size: 14px; }
  .row { display: flex; gap: 6px; }
  .wrap { flex-wrap: wrap; }
  .seg { flex: 1; min-height: 44px; border: 0; border-radius: 6px; background: var(--line); cursor: pointer; }
  .seg.on, .chip.on { background: var(--green); color: #fff; font-weight: 800; }
  .chip { min-height: 40px; padding: 0 14px; border: 0; border-radius: 20px; background: var(--line); cursor: pointer; }
  input, select { min-height: 44px; padding: 0 10px; border: 1px solid var(--input-line); background: var(--input); border-radius: 6px; font-size: 16px; min-width: 0; width: 100%; }
  .field { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
  .field > :last-child { max-width: 60%; }
  .small { font-size: 13px; }
  .stats { display: flex; flex-direction: column; gap: 8px; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0; color: var(--muted); font-size: 14px; }
  dd { margin: 0; color: var(--text); text-align: right; }
  /* Phone, after the first import: the panel is a bottom sheet opened from the header. */
  @media (max-width: 719px) {
    .panel.sheet { position: fixed; left: 0; right: 0; bottom: 0; max-height: 88vh; overflow-y: auto; z-index: 30; border-radius: 12px 12px 0 0; box-shadow: 0 -8px 24px rgba(0, 0, 0, .5); }
  }
</style>
