import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const chapters = [
  'manuscript/chapter-00-positioning.md',
  'manuscript/part-01-postgresql-foundations/chapter-01.md',
  'manuscript/chapter-02-sql-analysis.md',
  'manuscript/chapter-03-postgresql-large-tables.md',
  'manuscript/chapter-04-oltp-olap.md',
  'manuscript/chapter-05-data-warehouse-modeling.md',
  'manuscript/chapter-06-etl-elt.md',
  'manuscript/chapter-07-batch-processing.md',
  'manuscript/chapter-08-stream-processing.md',
  'manuscript/chapter-09-olap-databases.md',
  'manuscript/chapter-10-vector-databases.md',
  'manuscript/chapter-11-graph-databases.md',
  'manuscript/chapter-12-lakehouse.md',
  'manuscript/chapter-13-data-governance.md',
  'manuscript/chapter-14-projects.md',
  'manuscript/chapter-15-learning-order.md',
  'manuscript/chapter-16-capability-map.md',
  'manuscript/chapter-17-final-goals.md'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function getSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start === -1) return '';
  const contentStart = start + marker.length;
  const rest = text.slice(contentStart);
  const nextMarkerOffset = rest.search(/\n## /);
  if (nextMarkerOffset === -1) {
    return rest.trim();
  }
  return rest.slice(0, nextMarkerOffset).trim();
}

for (const chapter of chapters) {
  const file = path.join(root, chapter);
  assert(fs.existsSync(file), `Missing chapter: ${chapter}`);
  const text = fs.readFileSync(file, 'utf8');

  const coreSection = getSection(text, '核心判断');
  assert(
    /(解决|承担|负责|作用|目标|入口|判断|问题|用于|帮助|让|用来)/.test(coreSection) || /(解决|承担|负责|作用|目标|入口|判断|问题|用于|帮助|让|用来)/.test(text),
    `Missing solves-problem judgment in ${chapter}`
  );
  assert(
    /(不解决|不能|无法|不适合|边界|代价|风险)/.test(coreSection) || /(不解决|不能|无法|不适合|边界|代价|风险)/.test(text),
    `Missing explicit boundary in 核心判断 for ${chapter}`
  );

  const mechanismSection = getSection(text, '机制解释');
  assert(
    /(为什么|出现|压力|问题|瓶颈|需求)/.test(mechanismSection),
    `Missing why-it-appears explanation in 机制解释 for ${chapter}`
  );
  assert(
    (mechanismSection.match(/^### /gm) ?? []).length >= 3 || /#### 一、/.test(mechanismSection),
    `机制解释 for ${chapter} must include structured sub-sections`
  );

  const systemSection = getSection(text, '系统位置');
  assert(
    /(上一章|下一章|承接|引出|前后|关系|演化|迁移)/.test(systemSection) || /(上一章|下一章|承接|引出|前后|关系|演化|迁移)/.test(text),
    `Missing before-after relation in 系统位置 for ${chapter}`
  );
  assert(
    /(真实平台|真实系统|数据平台|平台里|落地|工程)/.test(text),
    `Missing real-platform position signal in ${chapter}`
  );

  const scenarioSection = getSection(text, '场景案例');
  assert(
    /```|\| .+ \||(\d+\. |- )/.test(scenarioSection),
    `场景案例 for ${chapter} must include executable, tabular, or step-based structure`
  );

  const misconceptionSection = getSection(text, '常见误区');
  assert(
    /(误区|错|边界|后果|风险)/.test(misconceptionSection),
    `Missing misconception or boundary language in 常见误区 for ${chapter}`
  );

  const taskSection = getSection(text, '实战任务');
  assert(
    /(验证|运行|设计|记录|复盘|观察|对比|回答|画)/.test(taskSection),
    `Missing verifiable-practice language in 实战任务 for ${chapter}`
  );

  console.log(`${chapter}: ok`);
}

console.log('Writing contract coverage: ok');
