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

const requiredHeadings = [
  '问题切入',
  '核心判断',
  '机制解释',
  '系统位置',
  '场景案例',
  '常见误区',
  '实战任务',
  '小结引出下一章'
];

let hasFailure = false;

for (const chapter of chapters) {
  const file = path.join(root, chapter);
  const markdown = fs.readFileSync(file, 'utf8');
  const missing = requiredHeadings.filter((heading) => {
    const pattern = new RegExp(`^## ${heading}$`, 'm');
    return !pattern.test(markdown);
  });

  if (missing.length > 0) {
    hasFailure = true;
    console.error(`${chapter}: missing ${missing.join(', ')}`);
  } else {
    console.log(`${chapter}: ok`);
  }
}

if (hasFailure) {
  process.exit(1);
}

