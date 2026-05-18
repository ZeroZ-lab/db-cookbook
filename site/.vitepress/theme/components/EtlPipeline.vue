<template>
  <div class="etl-container">
    <div class="etl-header">
      <span class="etl-badge">ETL 管道模拟</span>
      <div class="etl-steps">
        <button
          v-for="(s, i) in steps"
          :key="i"
          :class="['etl-step-dot', { active: currentStep === i, done: currentStep > i }]"
          @click="currentStep = i"
          :aria-label="s.label"
        >{{ i + 1 }}</button>
      </div>
    </div>

    <svg class="etl-canvas" viewBox="0 0 720 200" preserveAspectRatio="xMidYMid meet">
      <!-- Nodes -->
      <g v-for="(node, i) in nodes" :key="i" :transform="`translate(${node.x}, 60)`">
        <rect width="110" height="64" rx="10"
          :fill="currentStep >= i ? 'var(--vp-c-brand-1)' : 'var(--vp-c-bg-soft)'"
          :stroke="currentStep >= i ? 'var(--vp-c-brand-2)' : 'var(--vp-c-divider)'"
          stroke-width="2"
        />
        <text x="55" y="28" text-anchor="middle" dominant-baseline="middle"
          :fill="currentStep >= i ? '#fff' : 'var(--vp-c-text-2)'"
          font-size="13" font-weight="600">{{ node.icon }}</text>
        <text x="55" y="48" text-anchor="middle" dominant-baseline="middle"
          :fill="currentStep >= i ? '#fff' : 'var(--vp-c-text-2)'"
          font-size="11">{{ node.label }}</text>
      </g>

      <!-- Animated data particles -->
      <circle
        v-for="p in particles" :key="p.id"
        :cx="p.x" :cy="p.y" r="4"
        fill="var(--vp-c-brand-3)"
        :opacity="p.opacity"
      />
    </svg>

    <div class="etl-info">
      <h4>{{ steps[currentStep].title }}</h4>
      <p>{{ steps[currentStep].desc }}</p>
      <div class="etl-data">
        <code>{{ steps[currentStep].data }}</code>
      </div>
    </div>

    <div class="etl-nav">
      <button @click="currentStep = Math.max(0, currentStep - 1)" :disabled="currentStep === 0">上一步</button>
      <button @click="currentStep = Math.min(steps.length - 1, currentStep + 1)" :disabled="currentStep === steps.length - 1">下一步</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, computed } from 'vue'

const currentStep = ref(0)

const steps = [
  { title: 'Extract：从业务库抽取', desc: '从 PostgreSQL 的 orders、users 表中抽取增量数据（昨天新增和变更的订单）。', data: "SELECT * FROM orders WHERE updated_at >= '2026-04-04'" },
  { title: 'Stage：暂存到对象存储', desc: '抽取的数据以 Parquet 格式写入对象存储（S3/MinIO），作为原始数据的备份和下游的输入。', data: 's3://data-lake/raw/orders/dt=2026-04-04/' },
  { title: 'Transform：清洗与转换', desc: 'Spark 作业读取暂存数据，执行清洗（去重、格式统一）、关联维度表、计算衍生字段。', data: "df.join(dim_users, 'user_id').withColumn('is_vip', col('gmv') > 10000)" },
  { title: 'Load：加载到数仓', desc: '转换后的数据按分层模型写入 DWD 明细层和 DWS 汇总层，供下游 ADS 层和 BI 使用。', data: 'INSERT INTO dwd.dwd_order_detail SELECT ...' },
  { title: 'Serve：服务下游消费', desc: 'ADS 层的指标表被 BI 报表、实时看板和推荐系统消费，形成业务闭环。', data: 'SELECT day, gmv, order_count FROM ads.daily_gmv' }
]

const nodes = [
  { x: 10, icon: 'PG', label: '业务库' },
  { x: 155, icon: 'S3', label: '暂存层' },
  { x: 300, icon: 'ETL', label: '转换' },
  { x: 445, icon: 'DWS', label: '数仓' },
  { x: 590, icon: 'BI', label: '服务' }
]

const particles = ref([])
let animFrame = null
let particleId = 0

onMounted(() => {
  let tick = 0
  const animate = () => {
    tick++
    if (tick % 20 === 0 && currentStep.value > 0) {
      const stepIdx = Math.min(currentStep.value - 1, 3)
      const fromX = nodes[stepIdx].x + 110
      const toX = nodes[stepIdx + 1].x
      particles.value.push({ id: particleId++, x: fromX, y: 92, opacity: 1, targetX: toX })
      if (particles.value.length > 12) particles.value.shift()
    }
    particles.value.forEach(p => {
      if (p.x < p.targetX) p.x += 1.5
      else p.opacity -= 0.02
    })
    particles.value = particles.value.filter(p => p.opacity > 0)
    animFrame = requestAnimationFrame(animate)
  }
  animFrame = requestAnimationFrame(animate)
})

onUnmounted(() => { if (animFrame) cancelAnimationFrame(animFrame) })
</script>

<style scoped>
.etl-container {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px 0;
  background: var(--vp-c-bg);
}
.etl-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.etl-badge {
  background: var(--vp-c-brand-1);
  color: #fff;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.etl-steps { display: flex; gap: 6px; margin-left: auto; }
.etl-step-dot {
  width: 24px; height: 24px;
  border-radius: 50%;
  border: 2px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}
.etl-step-dot.active { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-1); color: #fff; }
.etl-step-dot.done { border-color: var(--vp-c-brand-3); background: var(--vp-c-brand-3); color: #fff; }
.etl-canvas { width: 100%; display: block; }
.etl-info { padding: 14px; }
.etl-info h4 { margin: 0 0 6px; font-size: 15px; color: var(--vp-c-text-1); }
.etl-info p { margin: 0 0 10px; font-size: 13px; color: var(--vp-c-text-2); line-height: 1.6; }
.etl-data { background: var(--vp-c-bg-soft); border-radius: 6px; padding: 8px 12px; }
.etl-data code { font-size: 12px; color: var(--vp-c-brand-1); }
.etl-nav { display: flex; gap: 8px; padding: 0 14px 14px; }
.etl-nav button {
  flex: 1; padding: 6px; border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1); cursor: pointer; font-size: 13px;
}
.etl-nav button:disabled { opacity: 0.4; cursor: not-allowed; }
.etl-nav button:hover:not(:disabled) { background: var(--vp-c-bg-soft); }
</style>
