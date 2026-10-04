<script lang="ts">
  import type { AppController } from './ui/appController'
  import GamesPanel from './ui/components/GamesPanel.svelte'
  import Results from './ui/components/Results.svelte'
  let { controller }: { controller: AppController } = $props()
  const view = $derived(controller.state)
</script>

<header>
  <div class="name">Why Do I Lose?</div>
  {#if $view.stats.games}
    <button class="who" onclick={() => controller.setPanelOpen(!$view.panelOpen)}>{$view.user?.username ?? 'Games'} · {$view.stats.games} ▾</button>
  {/if}
</header>
{#if $view.phase === 'analyzing' && $view.progress?.eligible}
  <div class="thin"><span style:width="{($view.progress.done / $view.progress.eligible) * 100}%"></span></div>
{/if}
<main class:first={!$view.stats.games}>
  <div class="results"><Results app={$view} onremove={id => controller.removeLabel(id)} onfilter={f => controller.setResultFilter(f)} /></div>
  <div class="side">
    <GamesPanel app={$view} onimport={(s, u, f) => controller.importAndAnalyze(s, u, f)} onstop={() => controller.stop()} ontoggle={() => controller.setPanelOpen(!$view.panelOpen)} />
  </div>
</main>

<style>
  header { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 16px; background: var(--panel); position: sticky; top: 0; z-index: 10; }
  .name { font-weight: 800; font-size: 20px; }
  .who { min-height: 40px; padding: 0 12px; border: 0; border-radius: 6px; background: var(--line); cursor: pointer; }
  .thin { height: 3px; background: var(--line); }
  .thin span { display: block; height: 3px; background: var(--green); }
  main { max-width: 1360px; margin: 0 auto; padding: 16px 16px 64px; display: flex; flex-direction: column; gap: 20px; }
  /* Phone first visit: the import card comes first. */
  main.first .side { order: -1; }
  @media (min-width: 720px) {
    .who { display: none; }
    main, main.first { flex-direction: row; align-items: flex-start; padding: 24px 20px 64px; }
    main.first .side { order: 0; }
    .results { flex: 1 1 560px; min-width: 0; }
    .side { flex: 0 0 340px; position: sticky; top: 72px; }
  }
</style>
