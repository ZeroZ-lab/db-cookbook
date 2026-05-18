<template>
  <div class="dfs-container">
    <h3 class="dfs-title">{{ config?.title || 'Loading...' }}</h3>
    <p class="dfs-subtitle">{{ config?.subtitle }}</p>

    <!-- T3+T4: SVG Canvas with nodes and edges -->
    <svg
      class="dfs-canvas"
      viewBox="0 0 800 400"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" :fill="'var(--dfs-edge-default, #94a3b8)'" />
        </marker>
        <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" :fill="'var(--dfs-edge-active, var(--vp-c-brand-1, #3451b2))'" />
        </marker>
      </defs>

      <!-- T4: Edges -->
      <TransitionGroup name="dfs-edge">
        <g v-for="edge in visibleEdges" :key="edge.id">
          <path
            :d="edgePath(edge)"
            :class="['dfs-edge-path', { 'dfs-edge-active': highlightEdges.has(edge.id) }]"
            :marker-end="highlightEdges.has(edge.id) ? 'url(#arrowhead-active)' : 'url(#arrowhead)'"
            fill="none"
          />
          <text
            :x="edgeMidpoint(edge).x"
            :y="edgeMidpoint(edge).y - 8"
            class="dfs-edge-label"
            text-anchor="middle"
          >{{ edge.label }}</text>
        </g>
      </TransitionGroup>

      <!-- T3: Nodes -->
      <TransitionGroup name="dfs-node">
        <g
          v-for="node in visibleNodes"
          :key="node.id"
          :class="['dfs-node', { 'dfs-node-highlight': highlightNodes.has(node.id), 'dfs-node-selected': selectedNode === node.id }]"
          :transform="`translate(${node.x}, ${node.y})`"
          @click="selectNode(node.id)"
          role="button"
          :aria-label="`${node.label} 节点，点击查看详情`"
          tabindex="0"
          @keydown.enter="selectNode(node.id)"
        >
          <rect
            :width="node.width"
            :height="node.height"
            rx="8"
            ry="8"
            :fill="nodeColorBg(node.color)"
            :stroke="node.color"
            :stroke-width="selectedNode === node.id ? 3 : 2"
            class="dfs-node-rect"
          />
          <text
            :x="node.width / 2"
            :y="22"
            class="dfs-node-icon"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ node.icon || '' }}</text>
          <text
            :x="node.width / 2"
            :y="38"
            class="dfs-node-label"
            text-anchor="middle"
            dominant-baseline="middle"
          >{{ node.label }}</text>
        </g>
      </TransitionGroup>
    </svg>

    <!-- T5: Step Panel -->
    <div v-if="currentStepConfig" class="dfs-step-panel">
      <div class="dfs-step-header">
        <span class="dfs-step-title">{{ currentStepConfig.title }}</span>
        <div class="dfs-progress">
          <span
            v-for="(_, i) in config!.steps"
            :key="i"
            :class="['dfs-dot', { 'dfs-dot-active': i === currentStep, 'dfs-dot-done': i < currentStep }]"
            @click="goToStep(i)"
            role="button"
            :aria-label="`步骤 ${i + 1}`"
          />
        </div>
      </div>

      <p class="dfs-explanation">{{ currentStepConfig.explanation }}</p>

      <p class="dfs-mechanism">
        <span class="dfs-mechanism-icon">&#128161;</span>
        {{ currentStepConfig.mechanismFocus }}
      </p>

      <div class="dfs-nav">
        <button
          class="dfs-btn dfs-btn-prev"
          :disabled="currentStep === 0"
          @click="prevStep"
          aria-label="上一步"
        >&#9664; 上一步</button>
        <button
          v-if="!isComplete"
          class="dfs-btn dfs-btn-next"
          @click="nextStep"
          aria-label="下一步"
        >下一步 &#9654;</button>
        <button
          v-else
          class="dfs-btn dfs-btn-validate"
          @click="showValidation = true"
        >查看验收</button>
      </div>

      <!-- Validation -->
      <div v-if="showValidation && isComplete" class="dfs-validation">
        <p class="dfs-validation-q">{{ config?.validationQuestion }}</p>
      </div>
    </div>

    <!-- T6: Node Detail Panel -->
    <Transition name="dfs-detail">
      <div
        v-if="selectedNode && selectedNodeData"
        class="dfs-detail-panel"
        role="dialog"
        aria-modal="true"
      >
        <button class="dfs-detail-close" @click="selectedNode = null" aria-label="关闭">&times;</button>
        <h4 class="dfs-detail-title">{{ selectedNodeData.label }}</h4>
        <pre class="dfs-detail-content">{{ selectedNodeData.detail }}</pre>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// --- Types ---
interface NodeConfig {
  id: string
  label: string
  icon?: string
  x: number
  y: number
  width: number
  height: number
  detail: string
  color: string
  isCenter?: boolean
}

interface EdgeConfig {
  id: string
  from: string
  to: string
  label: string
  color: string
  animated: boolean
}

interface StepConfig {
  title: string
  showNodes: string[]
  showEdges: string[]
  highlightNodes: string[]
  highlightEdges: string[]
  explanation: string
  mechanismFocus: string
}

interface MilestoneConfig {
  id: string
  title: string
  subtitle: string
  layout: 'horizontal' | 'radial'
  nodes: NodeConfig[]
  edges: EdgeConfig[]
  steps: StepConfig[]
  validationQuestion: string
  nextMilestone: string
}

// --- Props ---
const props = defineProps<{ milestone: 1 | 2 | 3 | 4 | 5 | 6 }>()

// --- Load configs via Vite import.meta.glob (SSG safe) ---
const configModules = import.meta.glob<{ default: MilestoneConfig }>(
  '../data/milestones/*.json',
  { eager: true }
)

const config = computed(() => {
  const key = Object.keys(configModules).find(k =>
    k.includes(`m${props.milestone}-`)
  )
  return key ? configModules[key].default : null
})

// --- Reactive state ---
const currentStep = ref(0)
const selectedNode = ref<string | null>(null)
const showValidation = ref(false)

// --- Computed ---
const visibleNodeIds = computed(() => {
  if (!config.value) return new Set<string>()
  const ids = new Set<string>()
  for (let i = 0; i <= currentStep.value; i++) {
    for (const id of config.value.steps[i]?.showNodes || []) {
      ids.add(id)
    }
  }
  return ids
})

const visibleEdgeIds = computed(() => {
  if (!config.value) return new Set<string>()
  const ids = new Set<string>()
  for (let i = 0; i <= currentStep.value; i++) {
    for (const id of config.value.steps[i]?.showEdges || []) {
      ids.add(id)
    }
  }
  return ids
})

const visibleNodes = computed(() => {
  if (!config.value) return []
  return config.value.nodes.filter(n => visibleNodeIds.value.has(n.id)).map(n => ({
    ...n,
    ...computeNodePosition(n)
  }))
})

const visibleEdges = computed(() => {
  if (!config.value) return []
  return config.value.edges.filter(e => visibleEdgeIds.value.has(e.id))
})

const currentStepConfig = computed(() => {
  if (!config.value) return null
  return config.value.steps[currentStep.value] || null
})

const isComplete = computed(() => {
  if (!config.value) return false
  return currentStep.value === config.value.steps.length - 1
})

const highlightNodes = computed(() => {
  return new Set(currentStepConfig.value?.highlightNodes || [])
})

const highlightEdges = computed(() => {
  return new Set(currentStepConfig.value?.highlightEdges || [])
})

const selectedNodeData = computed(() => {
  if (!selectedNode.value || !config.value) return null
  return config.value.nodes.find(n => n.id === selectedNode.value) || null
})

// --- Layout computation ---
function computeNodePosition(node: NodeConfig): { x: number; y: number } {
  if (!config.value) return { x: node.x, y: node.y }
  if (config.value.layout === 'horizontal') {
    return { x: node.x, y: node.y }
  }

  // Radial layout: center node at (400, 200), others at radius 160 evenly spaced
  if (node.isCenter) {
    return { x: 400, y: 200 }
  }

  const nonCenterNodes = config.value.nodes.filter(n => !n.isCenter)
  const idx = nonCenterNodes.findIndex(n => n.id === node.id)
  const total = nonCenterNodes.length
  const minAngle = 30 // degrees minimum spacing
  const angleStep = Math.max(minAngle, 360 / total)

  // Start from top (-90°) and distribute clockwise
  const angle = (-90 + idx * angleStep) * (Math.PI / 180)
  const radius = total > 10 ? 120 : 160

  // Center offset accounting for center node dimensions
  const cx = 400 - (node.width / 2)
  const cy = 200 - (node.height / 2)

  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  }
}

function getNodePosition(nodeId: string): { x: number; y: number } {
  const node = nodeById(nodeId)
  if (!node) return { x: 0, y: 0 }
  return computeNodePosition(node)
}

// --- Helpers ---
function nodeById(id: string): NodeConfig | undefined {
  return config.value?.nodes.find(n => n.id === id)
}

function nodeColorBg(color: string): string {
  // 10% opacity fill
  return color + '1a'
}

function edgePath(edge: EdgeConfig): string {
  const from = nodeById(edge.from)
  const to = nodeById(edge.to)
  if (!from || !to) return ''
  const fromPos = getNodePosition(edge.from)
  const toPos = getNodePosition(edge.to)

  // Calculate exit/entry points based on relative positions
  const fromCx = fromPos.x + from.width / 2
  const fromCy = fromPos.y + from.height / 2
  const toCx = toPos.x + to.width / 2
  const toCy = toPos.y + to.height / 2
  const dx = toCx - fromCx
  const dy = toCy - fromCy

  if (config.value?.layout === 'radial') {
    // Radial: edges exit/enter from the side facing the other node
    let x1: number, y1: number, x2: number, y2: number

    // Exit point on from node — pick the side facing the target
    if (Math.abs(dx) > Math.abs(dy)) {
      // Mostly horizontal connection
      x1 = dx > 0 ? fromPos.x + from.width : fromPos.x
      y1 = fromCy
      x2 = dx > 0 ? toPos.x : toPos.x + to.width
      y2 = toCy
    } else {
      // Mostly vertical connection
      x1 = fromCx
      y1 = dy > 0 ? fromPos.y + from.height : fromPos.y
      x2 = toCx
      y2 = dy > 0 ? toPos.y : toPos.y + to.height
    }

    // Quadratic bezier with slight arc
    const midX = (x1 + x2) / 2
    const midY = (y1 + y2) / 2
    // Arc offset perpendicular to the line
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const offset = Math.min(30, len * 0.15)
    const nx = -dy / len
    const ny = dx / len
    const ctrlX = midX + nx * offset
    const ctrlY = midY + ny * offset

    return `M ${x1} ${y1} Q ${ctrlX} ${ctrlY}, ${x2} ${y2}`
  }

  // Horizontal: cubic bezier left-to-right
  const x1 = fromPos.x + from.width
  const y1 = fromPos.y + from.height / 2
  const x2 = toPos.x
  const y2 = toPos.y + to.height / 2
  const cx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${cx} ${y1}, ${cx} ${y2}, ${x2} ${y2}`
}

function edgeMidpoint(edge: EdgeConfig): { x: number; y: number } {
  const from = nodeById(edge.from)
  const to = nodeById(edge.to)
  if (!from || !to) return { x: 0, y: 0 }
  const fromPos = getNodePosition(edge.from)
  const toPos = getNodePosition(edge.to)
  return {
    x: (fromPos.x + from.width / 2 + toPos.x + to.width / 2) / 2,
    y: (fromPos.y + from.height / 2 + toPos.y + to.height / 2) / 2
  }
}

// --- State machine ---
function nextStep() {
  if (!config.value) return
  if (currentStep.value < config.value.steps.length - 1) {
    currentStep.value++
    showValidation.value = false
  }
}

function prevStep() {
  if (currentStep.value > 0) {
    currentStep.value--
    showValidation.value = false
  }
}

function goToStep(n: number) {
  if (!config.value) return
  if (n >= 0 && n <= currentStep.value) {
    currentStep.value = n
    showValidation.value = false
  }
}

function selectNode(id: string | null) {
  selectedNode.value = selectedNode.value === id ? null : id
}
</script>

<style scoped>
/* --- Container --- */
.dfs-container {
  max-width: 860px;
  margin: 1.5rem auto;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 12px;
  background: var(--vp-c-bg-soft, #f6f6f7);
}

.dfs-title {
  margin: 0 0 0.25rem;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.dfs-subtitle {
  margin: 0 0 1rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-2);
}

/* --- SVG Canvas --- */
.dfs-canvas {
  width: 100%;
  height: auto;
  display: block;
  background: var(--vp-c-bg, #fff);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}

/* --- T3: Node styles --- */
.dfs-node {
  cursor: pointer;
  transition: opacity 0.3s ease;
}

.dfs-node-rect {
  transition: stroke-width 0.2s ease, filter 0.2s ease;
}

.dfs-node-highlight .dfs-node-rect {
  filter: drop-shadow(0 0 6px rgba(52, 81, 178, 0.3));
}

.dfs-node-selected .dfs-node-rect {
  filter: drop-shadow(0 0 8px rgba(52, 81, 178, 0.5));
}

.dfs-node:hover .dfs-node-rect {
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.15));
}

.dfs-node-icon {
  font-size: 16px;
}

.dfs-node-label {
  font-size: 13px;
  font-weight: 600;
  fill: var(--vp-c-text-1, #213547);
}

/* Node enter/leave transitions */
.dfs-node-enter-active {
  transition: all 0.4s ease;
}
.dfs-node-leave-active {
  transition: all 0.2s ease;
}
.dfs-node-enter-from {
  opacity: 0;
  transform: scale(0.8);
}
.dfs-node-leave-to {
  opacity: 0;
}

/* --- T4: Edge styles --- */
.dfs-edge-path {
  stroke: var(--dfs-edge-default, #94a3b8);
  stroke-width: 2;
  fill: none;
  stroke-dasharray: 6 4;
  transition: stroke 0.3s ease, stroke-width 0.3s ease;
}

.dfs-edge-active {
  stroke: var(--dfs-edge-active, var(--vp-c-brand-1, #3451b2));
  stroke-width: 3;
  stroke-dasharray: 8 4;
  animation: dfs-flow 2s linear infinite;
}

@keyframes dfs-flow {
  to {
    stroke-dashoffset: -24;
  }
}

.dfs-edge-label {
  font-size: 11px;
  fill: var(--vp-c-text-2, #64748b);
  pointer-events: none;
}

.dfs-edge-active + .dfs-edge-label,
.dfs-edge-active ~ .dfs-edge-label {
  fill: var(--dfs-edge-active, var(--vp-c-brand-1, #3451b2));
}

/* Edge enter/leave transitions */
.dfs-edge-enter-active {
  transition: all 0.4s ease;
}
.dfs-edge-leave-active {
  transition: all 0.2s ease;
}
.dfs-edge-enter-from {
  opacity: 0;
}
.dfs-edge-leave-to {
  opacity: 0;
}

/* --- T5: Step Panel --- */
.dfs-step-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--vp-c-bg, #fff);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
}

.dfs-step-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.dfs-step-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.dfs-progress {
  display: flex;
  gap: 6px;
}

.dfs-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--vp-c-divider, #e2e2e3);
  cursor: pointer;
  transition: background 0.2s ease;
}

.dfs-dot-done {
  background: var(--vp-c-brand-1, #3451b2);
}

.dfs-dot-active {
  background: var(--vp-c-brand-1, #3451b2);
  box-shadow: 0 0 0 3px rgba(52, 81, 178, 0.2);
}

.dfs-explanation {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-line;
  margin: 0 0 0.5rem;
}

.dfs-mechanism {
  font-size: 0.85rem;
  color: var(--vp-c-brand-1, #3451b2);
  background: rgba(52, 81, 178, 0.08);
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  margin: 0 0 0.75rem;
}

.dfs-mechanism-icon {
  margin-right: 4px;
}

.dfs-nav {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
}

.dfs-btn {
  padding: 0.5rem 1rem;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-radius: 6px;
  background: var(--vp-c-bg-soft, #f6f6f7);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.2s ease;
}

.dfs-btn:hover:not(:disabled) {
  background: var(--vp-c-brand-1, #3451b2);
  color: #fff;
  border-color: var(--vp-c-brand-1, #3451b2);
}

.dfs-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.dfs-btn-next,
.dfs-btn-validate {
  margin-left: auto;
  background: var(--vp-c-brand-1, #3451b2);
  color: #fff;
  border-color: var(--vp-c-brand-1, #3451b2);
}

.dfs-btn-next:hover,
.dfs-btn-validate:hover {
  opacity: 0.9;
}

.dfs-validation {
  margin-top: 0.75rem;
  padding: 0.75rem;
  background: rgba(52, 81, 178, 0.06);
  border-radius: 6px;
  border-left: 3px solid var(--vp-c-brand-1, #3451b2);
}

.dfs-validation-q {
  margin: 0;
  font-size: 0.85rem;
  color: var(--vp-c-text-1);
  font-weight: 500;
}

/* --- T6: Node Detail Panel --- */
.dfs-detail-panel {
  margin-top: 1rem;
  padding: 1rem;
  background: var(--vp-c-bg, #fff);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider, #e2e2e3);
  border-left: 3px solid var(--vp-c-brand-1, #3451b2);
  position: relative;
}

.dfs-detail-close {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: var(--vp-c-text-2);
  line-height: 1;
  padding: 0.25rem;
}

.dfs-detail-close:hover {
  color: var(--vp-c-text-1);
}

.dfs-detail-title {
  margin: 0 0 0.5rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--vp-c-brand-1, #3451b2);
}

.dfs-detail-content {
  margin: 0;
  font-size: 0.85rem;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-line;
  font-family: inherit;
}

/* Detail panel transition */
.dfs-detail-enter-active {
  transition: all 0.3s ease;
}
.dfs-detail-leave-active {
  transition: all 0.2s ease;
}
.dfs-detail-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.dfs-detail-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* --- Accessibility: reduced motion --- */
@media (prefers-reduced-motion: reduce) {
  .dfs-edge-active {
    animation: none;
  }
  .dfs-node-enter-active,
  .dfs-node-leave-active,
  .dfs-edge-enter-active,
  .dfs-edge-leave-active,
  .dfs-detail-enter-active,
  .dfs-detail-leave-active {
    transition: none;
  }
}

/* --- Dark mode --- */
:root {
  --dfs-edge-default: #94a3b8;
  --dfs-edge-active: var(--vp-c-brand-1, #3451b2);
}
</style>
