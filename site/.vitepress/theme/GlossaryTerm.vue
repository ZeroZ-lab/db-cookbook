<template>
  <span class="glossary-term" @mouseenter="show = true" @mouseleave="show = false" @focus="show = true" @blur="show = false">
    <slot />
    <span class="glossary-term__indicator" aria-hidden="true"></span>
    <Transition name="tooltip">
      <span v-if="show && definition" class="glossary-term__tooltip" role="tooltip">
        <strong>{{ term }}</strong>
        <span class="glossary-term__def">{{ definition }}</span>
      </span>
    </Transition>
  </span>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import glossary from '../glossary.json'

const props = defineProps<{ term: string }>()
const show = ref(false)

const definition = computed(() => {
  for (const category of Object.values(glossary)) {
    if (props.term in (category as Record<string, string>)) {
      return (category as Record<string, string>)[props.term]
    }
  }
  return null
})
</script>

<style scoped>
.glossary-term {
  position: relative;
  cursor: help;
  border-bottom: 1px dashed var(--vp-c-brand-1, #3451b2);
  color: var(--vp-c-brand-1, #3451b2);
}

.glossary-term__indicator {
  display: none;
}

.glossary-term__tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  background: var(--vp-c-bg-soft, #f6f6f7);
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 8px;
  padding: 8px 12px;
  max-width: 320px;
  min-width: 180px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--vp-c-text-1, #213547);
  text-align: left;
  pointer-events: none;
  white-space: normal;
}

.glossary-term__tooltip strong {
  display: block;
  margin-bottom: 4px;
  color: var(--vp-c-brand-1, #3451b2);
}

.glossary-term__def {
  opacity: 0.85;
}

.tooltip-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.tooltip-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.tooltip-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}

.tooltip-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(2px);
}

/* Dark mode */
html.dark .glossary-term__tooltip {
  background: var(--vp-c-bg-soft, #252529);
  border-color: var(--vp-c-divider, #3c3c3f);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}
</style>
