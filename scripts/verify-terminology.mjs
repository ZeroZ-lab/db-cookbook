import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const glossaryFile = path.join(root, 'site/glossary.md');

const terms = [
  { term: 'PostgreSQL', chapters: ['manuscript/chapter-00-positioning.md', 'manuscript/part-01-postgresql-foundations/chapter-01.md'] },
  { term: 'WAL', chapters: ['manuscript/chapter-06-etl-elt.md'] },
  { term: 'OLTP', chapters: ['manuscript/chapter-04-oltp-olap.md'] },
  { term: 'OLAP', chapters: ['manuscript/chapter-04-oltp-olap.md', 'manuscript/chapter-09-olap-databases.md'] },
  { term: 'ETL / ELT', variants: ['ETL', 'ELT'], chapters: ['manuscript/chapter-06-etl-elt.md'] },
  { term: 'CDC', chapters: ['manuscript/chapter-06-etl-elt.md', 'manuscript/chapter-08-stream-processing.md'] },
  { term: 'Kafka', chapters: ['manuscript/chapter-08-stream-processing.md'] },
  { term: 'Flink', chapters: ['manuscript/chapter-08-stream-processing.md'] },
  { term: 'Watermark', variants: ['Watermark', '水位线'], chapters: ['manuscript/chapter-08-stream-processing.md'] },
  { term: 'Exactly Once', chapters: ['manuscript/chapter-08-stream-processing.md'] },
  { term: 'ClickHouse', chapters: ['manuscript/chapter-09-olap-databases.md'] },
  { term: 'MergeTree', chapters: ['manuscript/chapter-09-olap-databases.md'] },
  { term: 'Lakehouse', variants: ['Lakehouse', '湖仓'], chapters: ['manuscript/chapter-12-lakehouse.md'] },
  { term: 'Iceberg', chapters: ['manuscript/chapter-12-lakehouse.md'] },
  { term: 'Parquet', chapters: ['manuscript/chapter-12-lakehouse.md'] },
  { term: 'Embedding', chapters: ['manuscript/chapter-10-vector-databases.md'] },
  { term: 'Vector Search', variants: ['Vector Search', '向量检索'], chapters: ['manuscript/chapter-10-vector-databases.md'] },
  { term: 'Chunk', chapters: ['manuscript/chapter-10-vector-databases.md'] },
  { term: 'Rerank', chapters: ['manuscript/chapter-10-vector-databases.md'] },
  { term: 'pgvector', chapters: ['manuscript/chapter-10-vector-databases.md'] },
  { term: 'GraphRAG', chapters: ['manuscript/chapter-11-graph-databases.md'] },
  { term: 'Data Governance', variants: ['Data Governance', '数据治理'], chapters: ['manuscript/chapter-13-data-governance.md'] },
  { term: 'Data Lineage', variants: ['Data Lineage', '血缘'], chapters: ['manuscript/chapter-13-data-governance.md'] },
  { term: 'Metric Governance', variants: ['Metric Governance', '指标治理'], chapters: ['manuscript/chapter-13-data-governance.md'] }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(fs.existsSync(glossaryFile), 'Missing generated glossary: site/glossary.md');
const glossary = fs.readFileSync(glossaryFile, 'utf8');

for (const entry of terms) {
  assert(glossary.includes(`**${entry.term}**`), `Missing glossary definition: ${entry.term}`);
  const variants = entry.variants ?? [entry.term];

  for (const chapter of entry.chapters) {
    const file = path.join(root, chapter);
    assert(fs.existsSync(file), `Missing chapter for terminology check: ${chapter}`);
    const text = fs.readFileSync(file, 'utf8');
    assert(
      variants.some((variant) => text.includes(variant)),
      `Missing terminology usage ${entry.term} in ${chapter}`
    );
  }
}

console.log('Terminology coverage: ok');
