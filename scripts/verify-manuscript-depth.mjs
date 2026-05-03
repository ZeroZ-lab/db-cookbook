import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const chapterDepthRules = [
  ['manuscript/chapter-00-positioning.md', 3800],
  ['manuscript/part-01-postgresql-foundations/chapter-01.md', 8000],
  ['manuscript/chapter-02-sql-analysis.md', 4500],
  ['manuscript/chapter-03-postgresql-large-tables.md', 4500],
  ['manuscript/chapter-04-oltp-olap.md', 4500],
  ['manuscript/chapter-05-data-warehouse-modeling.md', 4500],
  ['manuscript/chapter-06-etl-elt.md', 4500],
  ['manuscript/chapter-07-batch-processing.md', 4500],
  ['manuscript/chapter-08-stream-processing.md', 4500],
  ['manuscript/chapter-09-olap-databases.md', 4500],
  ['manuscript/chapter-10-vector-databases.md', 4500],
  ['manuscript/chapter-11-graph-databases.md', 4500],
  ['manuscript/chapter-12-lakehouse.md', 4500],
  ['manuscript/chapter-13-data-governance.md', 4500],
  ['manuscript/chapter-14-projects.md', 4500],
  ['manuscript/chapter-15-learning-order.md', 3800],
  ['manuscript/chapter-16-capability-map.md', 3600],
  ['manuscript/chapter-17-final-goals.md', 3800]
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function textCharsWithoutCodeBlocks(text) {
  const withoutCode = text.replace(/```[\s\S]*?```/g, '');
  return [...withoutCode].filter((char) => !/\s/.test(char)).length;
}

for (const [chapter, minChars] of chapterDepthRules) {
  const file = path.join(root, chapter);
  const text = fs.readFileSync(file, 'utf8');
  const chars = textCharsWithoutCodeBlocks(text);
  const tableLines = (text.match(/^\|/gm) ?? []).length;
  const h3Count = (text.match(/^### /gm) ?? []).length;

  assert(chars >= minChars, `${chapter} is too thin: ${chars} chars, expected at least ${minChars}`);
  assert(h3Count >= 5, `${chapter} needs at least 5 third-level sections, found ${h3Count}`);
  assert(tableLines >= 7, `${chapter} needs concrete comparison/checklist tables, found ${tableLines} table lines`);
}

console.log('Manuscript depth coverage: ok');
