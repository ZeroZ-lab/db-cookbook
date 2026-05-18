<template>
  <div class="vs-container">
    <div class="vs-header">
      <span class="vs-badge">向量检索模拟</span>
      <span class="vs-model">模型: MiniLM (384d)</span>
    </div>

    <div class="vs-body">
      <div class="vs-input-area">
        <input
          v-model="query"
          class="vs-query"
          placeholder="输入查询，如：性价比高的耳机"
          @keyup.enter="search"
        />
        <button class="vs-search-btn" @click="search" :disabled="!query.trim()">检索</button>
      </div>

      <div class="vs-examples">
        <button v-for="ex in examples" :key="ex" class="vs-example-chip" @click="query = ex; search()">{{ ex }}</button>
      </div>

      <div v-if="searched" class="vs-results">
        <div class="vs-result-header">Top-{{ results.length }} 语义相似结果</div>
        <div v-for="(r, i) in results" :key="i" class="vs-result-item">
          <div class="vs-result-rank">{{ i + 1 }}</div>
          <div class="vs-result-body">
            <div class="vs-result-name">{{ r.name }}</div>
            <div class="vs-result-meta">
              <span class="vs-result-cat">{{ r.category }}</span>
              <span class="vs-result-price">¥{{ r.price }}</span>
            </div>
            <div class="vs-result-score">
              相似度: {{ r.score.toFixed(3) }}
              <div class="vs-score-bar">
                <div class="vs-score-fill" :style="{ width: (r.score * 100) + '%' }"></div>
              </div>
            </div>
          </div>
          <div class="vs-result-vec" :title="'向量: [' + r.vector.slice(0, 6).map(v => v.toFixed(2)).join(', ') + ', ...]'">
            <svg width="60" height="28" viewBox="0 0 60 28">
              <polyline
                :points="r.vector.slice(0, 12).map((v, vi) => `${vi * 5 + 2},${28 - ((v + 1) / 2) * 24}`).join(' ')"
                fill="none" stroke="var(--vp-c-brand-1)" stroke-width="1.5"
              />
            </svg>
          </div>
        </div>
        <div v-if="!results.length" class="vs-empty">无匹配结果</div>
      </div>

      <div class="vs-explain">
        <div class="vs-explain-title">检索过程</div>
        <div class="vs-pipeline">
          <div class="vs-pipe-step" :class="{ active: step >= 1 }">
            <div class="vs-pipe-icon">Q</div>
            <div class="vs-pipe-label">查询文本</div>
          </div>
          <div class="vs-pipe-arrow">→</div>
          <div class="vs-pipe-step" :class="{ active: step >= 2 }">
            <div class="vs-pipe-icon">E</div>
            <div class="vs-pipe-label">Embedding</div>
          </div>
          <div class="vs-pipe-arrow">→</div>
          <div class="vs-pipe-step" :class="{ active: step >= 3 }">
            <div class="vs-pipe-icon">ANN</div>
            <div class="vs-pipe-label">近似检索</div>
          </div>
          <div class="vs-pipe-arrow">→</div>
          <div class="vs-pipe-step" :class="{ active: step >= 4 }">
            <div class="vs-pipe-icon">R</div>
            <div class="vs-pipe-label">Top-K 结果</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const query = ref('')
const results = ref([])
const searched = ref(false)
const step = ref(0)

const examples = ['性价比高的耳机', '编程学习书籍', '高端笔记本', '无线音乐设备', '便宜好用的东西']

// Simulated keyword-semantic mapping for demo purposes
// In production, this would be a real embedding model
const products = [
  { name: 'MacBook Pro 14', category: '电子产品', price: 14999, keywords: ['高端', '笔记本', '电脑', 'pro', 'mac', '苹果', '专业', '性能'] },
  { name: 'AirPods Pro', category: '电子产品', price: 1899, keywords: ['耳机', '无线', '音乐', '蓝牙', '降噪', 'airpods', '音频', '听歌'] },
  { name: '数据密集型应用系统设计', category: '书籍', price: 119, keywords: ['编程', '学习', '书籍', '系统设计', '数据', '技术', '架构', '开发'] },
  { name: '设计数据密集型应用', category: '书籍', price: 89, keywords: ['编程', '学习', '书籍', '设计', '数据', '技术', '入门', '经典'] },
  { name: 'Sony WH-1000XM5', category: '电子产品', price: 2499, keywords: ['耳机', '无线', '音乐', '降噪', '高端', '音质', '蓝牙', '头戴'] },
  { name: 'ThinkPad X1 Carbon', category: '电子产品', price: 9999, keywords: ['笔记本', '商务', '轻薄', '办公', '电脑', '专业', 'thinkpad'] },
  { name: '深入理解计算机系统', category: '书籍', price: 139, keywords: ['编程', '学习', '书籍', '计算机', '底层', '经典', '技术', '系统'] },
  { name: '小米降噪耳机 Pro', category: '电子产品', price: 699, keywords: ['耳机', '便宜', '性价比', '降噪', '小米', '无线', '入门'] },
]

// Pre-computed pseudo-vectors (simulating 12-dim for visualization, real models use 384/768/1536)
function pseudoVector(keywords, seed) {
  const v = []
  for (let i = 0; i < 12; i++) {
    let val = Math.sin(seed * (i + 1) * 0.7) * 0.5
    keywords.forEach((kw, ki) => {
      val += Math.sin((ki + 1) * (i + 1) * 0.3) * 0.1
    })
    v.push(val)
  }
  // normalize
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 1))
  return v.map(x => x / norm)
}

products.forEach((p, i) => {
  p.vector = pseudoVector(p.keywords, i + 1)
})

function cosineSimilarity(a, b) {
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    na += a[i] * a[i]
    nb += b[i] * b[i]
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb))
}

function simpleTokenize(text) {
  return text.toLowerCase().replace(/[^\w\u4e00-\u9fff]/g, ' ').split(/\s+/).filter(Boolean)
}

function search() {
  if (!query.value.trim()) return
  searched.value = true
  step.value = 0

  // Step 1: query text
  setTimeout(() => { step.value = 1 }, 100)
  // Step 2: embedding
  setTimeout(() => { step.value = 2 }, 300)

  const queryTokens = simpleTokenize(query.value)
  const queryKeywords = queryTokens

  // Compute query pseudo-vector
  const queryVec = pseudoVector(queryTokens, 42)

  // Step 3: ANN search
  setTimeout(() => { step.value = 3 }, 500)

  // Score = weighted combination of cosine similarity + keyword overlap
  const scored = products.map(p => {
    const cosSim = cosineSimilarity(queryVec, p.vector)
    const keywordOverlap = p.keywords.filter(kw =>
      queryKeywords.some(qk => kw.includes(qk) || qk.includes(kw))
    ).length / Math.max(p.keywords.length, 1)
    const score = 0.4 * cosSim + 0.6 * keywordOverlap
    return { ...p, score }
  })

  scored.sort((a, b) => b.score - a.score)
  results.value = scored.filter(r => r.score > 0.05).slice(0, 5)

  // Step 4: results
  setTimeout(() => { step.value = 4 }, 700)
}
</script>

<style scoped>
.vs-container {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px 0;
  background: var(--vp-c-bg);
}
.vs-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.vs-badge {
  background: #7c3aed;
  color: #fff;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}
.vs-model {
  margin-left: auto;
  font-size: 11px;
  color: var(--vp-c-text-3);
  font-family: monospace;
}
.vs-body { padding: 14px; }
.vs-input-area {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.vs-query {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 14px;
  outline: none;
}
.vs-query:focus { border-color: var(--vp-c-brand-1); }
.vs-search-btn {
  padding: 8px 20px;
  background: #7c3aed;
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}
.vs-search-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.vs-search-btn:hover:not(:disabled) { background: #6d28d9; }
.vs-examples {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.vs-example-chip {
  padding: 3px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  cursor: pointer;
}
.vs-example-chip:hover { border-color: #7c3aed; color: #7c3aed; }
.vs-results { margin-bottom: 14px; }
.vs-result-header {
  font-size: 12px;
  color: var(--vp-c-text-3);
  margin-bottom: 8px;
  font-weight: 600;
}
.vs-result-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  margin-bottom: 6px;
  background: var(--vp-c-bg-soft);
}
.vs-result-rank {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #7c3aed;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
}
.vs-result-body { flex: 1; min-width: 0; }
.vs-result-name { font-size: 14px; font-weight: 600; color: var(--vp-c-text-1); }
.vs-result-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  margin: 2px 0;
}
.vs-result-cat {
  padding: 1px 6px;
  background: var(--vp-c-bg);
  border-radius: 4px;
  color: var(--vp-c-text-3);
}
.vs-result-price { color: var(--vp-c-brand-1); font-weight: 600; }
.vs-result-score { font-size: 11px; color: var(--vp-c-text-3); }
.vs-score-bar {
  height: 4px;
  background: var(--vp-c-divider);
  border-radius: 2px;
  margin-top: 2px;
  overflow: hidden;
}
.vs-score-fill {
  height: 100%;
  background: #7c3aed;
  border-radius: 2px;
  transition: width 0.3s ease;
}
.vs-result-vec { flex-shrink: 0; opacity: 0.7; }
.vs-empty { text-align: center; color: var(--vp-c-text-3); padding: 20px; font-size: 13px; }
.vs-explain {
  border-top: 1px solid var(--vp-c-divider);
  padding-top: 12px;
}
.vs-explain-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  margin-bottom: 8px;
}
.vs-pipeline {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.vs-pipe-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  opacity: 0.35;
  transition: opacity 0.3s;
}
.vs-pipe-step.active { opacity: 1; }
.vs-pipe-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
  border: 2px solid var(--vp-c-divider);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--vp-c-text-3);
}
.vs-pipe-step.active .vs-pipe-icon {
  border-color: #7c3aed;
  background: #7c3aed20;
  color: #7c3aed;
}
.vs-pipe-label { font-size: 10px; color: var(--vp-c-text-3); }
.vs-pipe-arrow { color: var(--vp-c-text-3); font-size: 14px; }
</style>
