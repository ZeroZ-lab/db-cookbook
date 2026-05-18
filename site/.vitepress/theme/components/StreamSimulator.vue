<template>
  <div class="stream-container">
    <div class="stream-header">
      <span class="stream-badge">实时流模拟</span>
      <button class="stream-toggle" @click="running = !running">
        {{ running ? '⏸ 暂停' : '▶ 开始' }}
      </button>
    </div>

    <svg class="stream-canvas" viewBox="0 0 700 280" preserveAspectRatio="xMidYMid meet">
      <!-- Pipeline stages -->
      <g v-for="(stage, i) in stages" :key="i">
        <rect :x="stage.x" y="20" width="90" height="50" rx="10"
          :fill="stage.fill" :stroke="stage.stroke" stroke-width="2"
        />
        <text :x="stage.x + 45" y="40" text-anchor="middle" dominant-baseline="middle"
          fill="#fff" font-size="12" font-weight="600">{{ stage.icon }}</text>
        <text :x="stage.x + 45" y="58" text-anchor="middle" dominant-baseline="middle"
          fill="#fff" font-size="10">{{ stage.label }}</text>
      </g>

      <!-- Connection lines -->
      <line v-for="(conn, i) in connections" :key="'l'+i"
        :x1="conn.x1" y1="45" :x2="conn.x2" y2="45"
        stroke="var(--vp-c-divider)" stroke-width="2" stroke-dasharray="6 3"
      />

      <!-- Flowing messages -->
      <g v-for="msg in messages" :key="msg.id">
        <rect :x="msg.x - 28" :y="msg.y - 10" width="56" height="20" rx="4"
          :fill="msg.color" opacity="0.9"
        />
        <text :x="msg.x" :y="msg.y + 1" text-anchor="middle" dominant-baseline="middle"
          fill="#fff" font-size="9">{{ msg.text }}</text>
      </g>

      <!-- Window aggregation box -->
      <rect x="380" y="100" width="240" height="70" rx="8"
        fill="var(--vp-c-bg-soft)" stroke="var(--vp-c-divider)" stroke-width="1" stroke-dasharray="4 2"
      />
      <text x="400" y="120" font-size="11" font-weight="600" fill="var(--vp-c-text-1)">窗口聚合 (1min)</text>
      <text v-for="(line, i) in windowLines" :key="'w'+i"
        x="400" :y="138 + i * 14" font-size="10" fill="var(--vp-c-text-2)"
      >{{ line }}</text>

      <!-- Metrics -->
      <text x="30" y="200" font-size="11" fill="var(--vp-c-text-3)">总事件数: {{ totalEvents }}</text>
      <text x="30" y="218" font-size="11" fill="var(--vp-c-text-3)">TPS: {{ tps }}</text>
      <text x="250" y="200" font-size="11" fill="var(--vp-c-text-3)">窗口: 60s 滚动</text>
      <text x="250" y="218" font-size="11" fill="var(--vp-c-text-3)">水位线: {{ watermark }}</text>
    </svg>

    <div class="stream-legend">
      <span><span class="stream-dot" style="background:#3b82f6"></span> 订单事件</span>
      <span><span class="stream-dot" style="background:#10b981"></span> 支付事件</span>
      <span><span class="stream-dot" style="background:#f59e0b"></span> 浏览事件</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const running = ref(false)
const messages = ref([])
const totalEvents = ref(0)
const windowData = ref({ orders: 0, payments: 0, views: 0, gmv: 0 })
let msgId = 0
let intervalId = null

const stages = [
  { x: 20, icon: 'PG', label: 'CDC', fill: '#2563eb', stroke: '#1d4ed8' },
  { x: 150, icon: 'Kafka', label: 'Topic', fill: '#1f2937', stroke: '#374151' },
  { x: 280, icon: 'Flink', label: '消费', fill: '#e11d48', stroke: '#be123c' },
  { x: 410, icon: 'Window', label: '聚合', fill: '#7c3aed', stroke: '#6d28d9' },
  { x: 540, icon: 'CK', label: 'Sink', fill: '#059669', stroke: '#047857' }
]

const connections = [
  { x1: 110, x2: 150 },
  { x1: 240, x2: 280 },
  { x1: 370, x2: 410 },
  { x1: 500, x2: 540 }
]

const eventTypes = [
  { text: '订单', color: '#3b82f6', type: 'orders', amount: () => Math.floor(Math.random() * 5000 + 100) },
  { text: '支付', color: '#10b981', type: 'payments', amount: () => Math.floor(Math.random() * 3000 + 50) },
  { text: '浏览', color: '#f59e0b', type: 'views', amount: () => 0 }
]

const tps = computed(() => running.value ? Math.floor(Math.random() * 50 + 200) : 0)
const watermark = computed(() => '2026-04-05 11:' + String(Math.floor(Math.random() * 59)).padStart(2, '0'))
const windowLines = computed(() => [
  `订单: ${windowData.value.orders}  支付: ${windowData.value.payments}  浏览: ${windowData.value.views}`,
  `窗口 GMV: ¥${windowData.value.gmv.toLocaleString()}`
])

onMounted(() => {
  intervalId = setInterval(() => {
    if (!running.value) return

    const evt = eventTypes[Math.floor(Math.random() * eventTypes.length)]
    const amount = evt.amount()

    messages.value.push({
      id: msgId++,
      x: 120, y: 45,
      text: evt.text,
      color: evt.color,
      targetX: 560,
      speed: 2 + Math.random() * 2
    })

    totalEvents.value++
    windowData.value[evt.type]++
    if (amount) windowData.value.gmv += amount

    if (messages.value.length > 8) messages.value.shift()
  }, 400)

  const moveMessages = () => {
    messages.value.forEach(m => {
      m.x = Math.min(m.x + m.speed, m.targetX)
    })
    messages.value = messages.value.filter(m => m.x < m.targetX)
    requestAnimationFrame(moveMessages)
  }
  requestAnimationFrame(moveMessages)
})

onUnmounted(() => { if (intervalId) clearInterval(intervalId) })
</script>

<style scoped>
.stream-container {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px 0;
  background: var(--vp-c-bg);
}
.stream-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.stream-badge {
  background: #e11d48;
  color: #fff;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.stream-toggle {
  margin-left: auto;
  padding: 4px 14px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.stream-toggle:hover { background: var(--vp-c-bg-soft); }
.stream-canvas { width: 100%; display: block; }
.stream-legend {
  display: flex;
  gap: 16px;
  padding: 8px 14px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  border-top: 1px solid var(--vp-c-divider);
}
.stream-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 4px;
  vertical-align: middle;
}
</style>
