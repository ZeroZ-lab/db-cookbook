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

const forbiddenPhrases = [
  '<!-- depth-expansion:start -->',
  '<!-- depth-expansion:end -->',
  '回到本章机制，检查输入、处理路径、系统边界或治理规则。'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const chapter of chapters) {
  const file = path.join(root, chapter);
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split('\n');

  for (const phrase of forbiddenPhrases) {
    assert(!text.includes(phrase), `${chapter} contains forbidden editorial residue: ${phrase}`);
  }

  lines.forEach((line, index) => {
    assert(line.trim() !== '|', `${chapter}:${index + 1} contains malformed table residue`);
  });
}

console.log('Editorial quality guard: ok');
