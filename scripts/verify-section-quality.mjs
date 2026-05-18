import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manuscriptDir = path.join(root, 'manuscript');

// Scene keywords per chapter (for Q1/Q3/Q6 detection)
const sceneKeywords = {
  2: ['orders', 'GMV', 'DAU', '留存', '漏斗', '复购', '转化', '聚合', 'users', 'products', 'events'],
  3: ['orders', '索引', '分区', 'EXPLAIN', '物化视图', '大表', '扫描', 'users', 'events'],
  4: ['orders', 'OLTP', 'OLAP', '业务库', '分析', 'ClickHouse', '读写模式', 'PG'],
  5: ['orders', '事实表', '维度表', '星型', '雪花', '宽表', 'GMV', 'DWS', 'DWD', 'ODS'],
  6: ['orders', 'CDC', 'Debezium', 'Kafka', 'ETL', '抽取', '同步', '对账', 'JDBC', 'WAL'],
  7: ['orders', 'Spark', 'Hive', 'Trino', '批处理', 'Shuffle', 'GMV', '指标', '日跑'],
  8: ['orders', 'Kafka', 'Flink', '实时', 'Watermark', 'Exactly Once', '流', '事件', 'GMV'],
  9: ['orders', 'ClickHouse', 'Doris', 'DuckDB', 'OLAP', 'MergeTree', 'GMV', '留存', '查询'],
  10: ['知识库', '文档', 'RAG', '向量', 'Embedding', '检索', '召回', '语义', '产品文档', '操作手册'],
  11: ['供应商', '客户', '关系', '图', 'GraphRAG', '路径', '反欺诈', 'Neo4j', 'NebulaGraph', '本体'],
  12: ['orders', '对象存储', 'Iceberg', '湖仓', '表格式', 'Catalog', '多引擎', 'Parquet', 'S3'],
  13: ['GMV', '口径', '血缘', '权限', '治理', '质量', '审计', '指标', 'RAG', '治理对象']
};

// YAML dialogue markers (Q4 detection) — match both ASCII : and Chinese ：
const yamlDialogueMarkers = [
  /资深工程师\s*[:：]/,
  /数据分析师\s*[:：]/,
  /数据工程师\s*[:：]/,
  /新同事\s*[:：]/,
  /新工程师\s*[:：]/,
  /产品经理\s*[:：]/,
  /架构师\s*[:：]/,
  /^场景:.*问题:.*解决:/m
];

// Feature listing template markers (Q4 detection)
const featureListingMarkers = [
  /^#{1,4}\s*特点\b/m,
  /^#{1,4}\s*优势\b/m,
  /^#{1,4}\s*劣势\b/m,
  /^#{1,4}\s*适用场景\b/m,
  /^#{1,4}\s*定义\b.*指\b/m
];

// Detect YAML dialogue inside fenced code blocks (```yaml ... ```)
function extractFencedYamlBlocks(text) {
  const blocks = [];
  const re = /```yaml\s*\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    blocks.push(match[1]);
  }
  return blocks;
}

// Core judgment signals (Q2/Q5 detection)
const judgmentSignals = [
  /不是.*而是/,
  /不解决/,
  /不等于/,
  /不能替代/,
  /不是.*的全部/,
  /代价/,
  /失效/,
  /边界/,
  /限制/,
  /前提条件/,
  /额外存储/,
  /写入维护/,
  /维护成本/
];

function checkFile(filepath, chapterNum) {
  const text = fs.readFileSync(filepath, 'utf8');
  const results = {};

  // Q4: YAML dialogue markers — check both inline and inside fenced blocks
  const inlineYamlHits = yamlDialogueMarkers.filter(r => r.test(text));
  const fencedBlocks = extractFencedYamlBlocks(text);
  const fencedYamlHits = yamlDialogueMarkers.filter(r => fencedBlocks.some(block => r.test(block)));
  const yamlHits = [...new Set([...inlineYamlHits, ...fencedYamlHits])];
  results.yaml_dialogue = yamlHits.length > 0 ? `❌ ${yamlHits.length} markers found` : '✅ None';

  // Q4: Feature listing markers
  const featureHits = featureListingMarkers.filter(r => r.test(text));
  results.feature_listing = featureHits.length > 0 ? `❌ ${featureHits.length} markers found` : '✅ None';

  // Q2/Q5: Judgment signals
  const judgmentHits = judgmentSignals.filter(r => r.test(text));
  results.judgment_signals = judgmentHits.length >= 2 ? `✅ ${judgmentHits.length} signals` : `❌ Only ${judgmentHits.length} signals (need ≥ 2)`;

  // Q1/Q3/Q6: Scene keywords
  const keywords = sceneKeywords[chapterNum] || [];
  const hits = keywords.filter(kw => text.toLowerCase().includes(kw.toLowerCase()));
  const uniqueHits = [...new Set(hits)];
  results.scene_keywords = uniqueHits.length >= 3 ? `✅ ${uniqueHits.length} keywords: ${uniqueHits.join(',')}` : `❌ Only ${uniqueHits.length} keywords (need ≥ 3): ${uniqueHits.join(',')}`;

  // P1-P6 preliminary score
  let pScore = 0;
  if (yamlHits.length === 0 && featureHits.length === 0) pScore++; // P1-ish: no formulaic opening
  if (judgmentHits.length >= 2) pScore++; // P2+P3: has core judgment and boundary
  if (judgmentHits.some(r => /代价|失效|边界|限制/.test(text))) pScore++; // P3: has cost/failure
  if (judgmentHits.some(r => /不解决|不能|不等于/.test(text))) pScore++; // P5: contrast rhetoric
  if (uniqueHits.length >= 2) pScore++; // P6: scene references
  if (text.includes('数仓') || text.includes('湖仓') || text.includes('RAG') || text.includes('AI')) pScore++; // P4: evolution link

  // Grade
  let grade;
  if (pScore >= 4) grade = 'A';
  else if (pScore >= 2) grade = 'B';
  else grade = 'C';

  results.p_score = `${pScore}/6`;
  results.grade = grade;

  // Special flags removed — all chapters now fully upgraded

  return results;
}

// Main scan
console.log('=== Section Quality Verification ===\n');

const chapters = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
const gradeDistribution = { A: 0, B: 0, C: 0 };
const allResults = {};

for (const ch of chapters) {
  const padded = String(ch).padStart(2, '0');
  console.log(`\n--- Chapter ${ch} ---`);
  let chGradeDist = { A: 0, B: 0, C: 0 };

  for (let i = 1; i <= 20; i++) {
    const filename = `chapter-${padded}-section-${i}-complete.md`;
    const filepath = path.join(manuscriptDir, filename);
    if (!fs.existsSync(filepath)) continue;

    const results = checkFile(filepath, ch);
    allResults[`${ch}-${i}`] = results;
    chGradeDist[results.grade]++;
    gradeDistribution[results.grade]++;

    const flag = results.special_flag ? ` ${results.special_flag}` : '';
    console.log(`  s${i}: grade=${results.grade} p=${results.p_score} yaml=${results.yaml_dialogue} features=${results.feature_listing} judgment=${results.judgment_signals} scene=${results.scene_keywords}${flag}`);
  }

  console.log(`  Distribution: A=${chGradeDist.A} B=${chGradeDist.B} C=${chGradeDist.C}`);
}

console.log(`\n=== Overall Distribution ===`);
console.log(`A=${gradeDistribution.A} B=${gradeDistribution.B} C=${gradeDistribution.C}`);
console.log(`Total sections graded: ${gradeDistribution.A + gradeDistribution.B + gradeDistribution.C}`);

// C-grade sections needing full rewrite
const cSections = Object.entries(allResults).filter(([_, r]) => r.grade === 'C').map(([key, r]) => `${key} (${r.yaml_dialogue} ${r.feature_listing})`);
if (cSections.length > 0) {
  console.log(`\n=== C-grade sections (need full rewrite) ===`);
  for (const s of cSections) {
    console.log(`  ${s}`);
  }
}