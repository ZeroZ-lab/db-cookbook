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

const contractChecks = [
  {
    name: 'solves-problem',
    pattern: /解决|承担|负责|用于|为了/
  },
  {
    name: 'does-not-solve-boundary',
    pattern: /不解决|不能|无法|不适合|边界|代价|风险/
  },
  {
    name: 'why-it-appears',
    pattern: /为什么|出现|压力|问题|瓶颈|需求/
  },
  {
    name: 'before-after-relation',
    pattern: /上一章|下一章|承接|引出|前后|关系|演化|迁移|推进/
  },
  {
    name: 'real-platform-position',
    pattern: /真实平台|真实系统|数据平台|平台里|落地|工程/
  },
  {
    name: 'verifiable-practice',
    pattern: /实战任务|验证|运行|设计|记录|复盘/
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const chapter of chapters) {
  const file = path.join(root, chapter);
  assert(fs.existsSync(file), `Missing chapter: ${chapter}`);
  const text = fs.readFileSync(file, 'utf8');

  for (const check of contractChecks) {
    assert(check.pattern.test(text), `Missing writing contract signal ${check.name} in ${chapter}`);
  }
}

console.log('Writing contract coverage: ok');
