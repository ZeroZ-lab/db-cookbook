<template>
  <div ref="container" class="mermaid-block" />
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const container = ref(null)

async function renderDiagram() {
  if (!container.value) return
  const { default: mermaid } = await import('mermaid')
  const source = decodeURIComponent(props.code)
  const id = 'mermaid-' + Math.random().toString(36).slice(2)
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
  })
  const result = await mermaid.render(id, source)
  container.value.innerHTML = result.svg
}

onMounted(renderDiagram)
watch(() => props.code, renderDiagram)
</script>
