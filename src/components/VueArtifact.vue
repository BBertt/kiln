<script setup lang="ts">
import { onErrorCaptured, onMounted, shallowRef, ref, type Component } from 'vue';

const props = defineProps<{ source: string }>();
const sources = import.meta.glob<{ default: Component }>('/artifacts/**/source.vue');
const artifact = shallowRef<Component | null>(null);
const error = ref<string | null>(null);

onErrorCaptured((reason) => {
  error.value = reason instanceof Error ? reason.message : String(reason);
  return false;
});

onMounted(async () => {
  try {
    const load = sources[props.source];
    if (!load) throw new Error('The source module is missing.');
    artifact.value = (await load()).default;
  } catch (reason) {
    error.value = reason instanceof Error ? reason.message : String(reason);
  }
});
</script>

<template>
  <div v-if="error" class="artifact-status artifact-status--error" role="alert">
    <strong>This artifact could not render.</strong><pre>{{ error }}</pre>
  </div>
  <component :is="artifact" v-else-if="artifact" />
  <div v-else class="artifact-status" role="status"><span class="artifact-spinner" />Loading artifact…</div>
</template>
