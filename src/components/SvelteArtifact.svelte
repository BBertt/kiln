<script lang="ts">
  import { onMount, type Component } from 'svelte';

  let { source }: { source: string } = $props();
  const sources = import.meta.glob<{ default: Component }>('/artifacts/**/source.svelte');
  let artifact = $state<Component | null>(null);
  let error = $state<string | null>(null);

  onMount(() => {
    const load = sources[source];
    if (!load) {
      error = 'The source module is missing.';
      return;
    }
    load().then((module) => { artifact = module.default; }).catch((reason: unknown) => {
      error = reason instanceof Error ? reason.message : String(reason);
    });
  });
</script>

<svelte:boundary>
  {#if error}
    <div class="artifact-status artifact-status--error" role="alert"><strong>This artifact could not load.</strong><pre>{error}</pre></div>
  {:else if artifact}
    {@const Artifact = artifact}
    <Artifact />
  {:else}
    <div class="artifact-status" role="status"><span class="artifact-spinner"></span>Loading artifact…</div>
  {/if}
  {#snippet failed(reason)}
    <div class="artifact-status artifact-status--error" role="alert"><strong>This artifact could not render.</strong><pre>{reason instanceof Error ? reason.message : String(reason)}</pre></div>
  {/snippet}
</svelte:boundary>
