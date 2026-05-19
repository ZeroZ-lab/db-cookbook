import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const siteDir = path.join(root, 'site');
const chaptersDir = path.join(siteDir, 'chapters');

const chapters = [
  {
    chapter: 0,
    title: '核心定位',
    source: 'manuscript/chapter-00-positioning.md',
    target: '00-positioning.md',
    summary: '说明本书为什么以 PostgreSQL 为入口，如何把数据库学习连接到大数据与 AI 数据基础设施。',
    diagram: `flowchart LR
  A["会查数据"] --> B["PostgreSQL 直觉"]
  B --> C["SQL 分析"]
  C --> D["数仓与数据链路"]
  D --> E["批处理 / 实时 / OLAP"]
  E --> F["湖仓"]
  F --> G["向量 / 图"]
  G --> H["智能数据系统"]`
  },
  {
    chapter: 1,
    title: '数据库基础：用 PostgreSQL 建立数据系统直觉',
    source: 'manuscript/part-01-postgresql-foundations/chapter-01.md',
    target: '01-postgresql-foundations.md',
    summary: '用 PostgreSQL 建立数据如何被组织、约束、查询和保持一致的基础直觉。',
    diagram: `flowchart TB
  S["PostgreSQL Server"] --> D["Database"]
  D --> SC["Schema"]
  SC --> T["Table"]
  T --> R["Row: 一条事实"]
  T --> C["Column: 事实属性"]`
  },
  {
    chapter: 2,
    title: 'SQL 分析能力：大数据方向第一硬技能',
    source: 'manuscript/chapter-02-sql-analysis.md',
    target: '02-sql-analysis.md',
    summary: '把 SQL 从查询语法提升为分析表达能力，训练取数、聚合、关联、窗口和指标口径。',
    diagram: `flowchart LR
  A["基础查询"] --> B["聚合分析"]
  B --> C["多表关联"]
  C --> D["复杂 SQL"]
  D --> E["窗口函数"]
  E --> F["指标 SQL"]`
  },
  {
    chapter: 3,
    title: 'PostgreSQL 大表能力：理解单机数据库边界',
    source: 'manuscript/chapter-03-postgresql-large-tables.md',
    target: '03-postgresql-large-tables.md',
    summary: '从分区、索引、物化视图和执行计划理解 PostgreSQL 如何支撑大表，以及边界在哪里。',
    diagram: `flowchart LR
  A["大表变慢"] --> B{"访问模式"}
  B --> C["索引"]
  B --> D["分区"]
  B --> E["物化视图"]
  C --> F["EXPLAIN 验证"]
  D --> F
  E --> F
  F --> G["识别 OLAP 边界"]`
  },
  {
    chapter: 4,
    title: 'OLTP vs OLAP：大数据系统的第一分水岭',
    source: 'manuscript/chapter-04-oltp-olap.md',
    target: '04-oltp-olap.md',
    summary: '解释业务交易和分析计算为什么会分化，以及 PostgreSQL 与 OLAP 系统如何分工。',
    diagram: `flowchart LR
  P["PostgreSQL 业务库"] --> O1["OLTP: 高频小事务 / 强一致"]
  P --> O2["OLAP: 大范围扫描 / 聚合分析"]
  O1 --> A["业务正确"]
  O2 --> B["分析效率"]`
  },
  {
    chapter: 5,
    title: '数据仓库建模：从表设计到分析建模',
    source: 'manuscript/chapter-05-data-warehouse-modeling.md',
    target: '05-data-warehouse-modeling.md',
    summary: '把业务表重构成事实表、维度表、分层模型和稳定指标体系。',
    diagram: `flowchart LR
  A["PostgreSQL 源表"] --> ODS["ODS 原始层"]
  ODS --> DWD["DWD 明细层"]
  DWD --> DWS["DWS 汇总层"]
  DWS --> ADS["ADS 应用层"]
  DWD --> F["事实表"]
  DWD --> DIM["维度表"]`
  },
  {
    chapter: 6,
    title: 'ETL / ELT：数据如何进入大数据系统',
    source: 'manuscript/chapter-06-etl-elt.md',
    target: '06-etl-elt.md',
    summary: '说明 PostgreSQL 数据如何通过批量同步、CDC、转换和调度进入数据平台。',
    diagram: `flowchart LR
  P["PostgreSQL"] --> B["Batch Extract"]
  P --> C["CDC / WAL"]
  B --> W["Data Warehouse"]
  C --> K["Kafka"]
  K --> F["Flink"]
  F --> O["OLAP / Lakehouse"]
  W --> BI["BI / 指标"]`
  },
  {
    chapter: 7,
    title: '批处理系统：Hive / Spark / Trino',
    source: 'manuscript/chapter-07-batch-processing.md',
    target: '07-batch-processing.md',
    summary: '理解 Hive、Spark、Trino 在历史数据加工、分布式计算和跨源分析中的定位。',
    diagram: `flowchart LR
  H["Hive: 表和元数据"] --> S["Spark: 大规模计算"]
  S --> T["Trino: 跨源交互查询"]
  H --> F["Parquet / ORC / Object Storage"]
  T --> BI["分析和探索"]`
  },
  {
    chapter: 8,
    title: '实时数据处理：Kafka / Flink',
    source: 'manuscript/chapter-08-stream-processing.md',
    target: '08-stream-processing.md',
    summary: '围绕事件流、状态、窗口、水位线和一致性理解实时数据系统。',
    diagram: `flowchart LR
  P["PostgreSQL CDC"] --> D["Debezium"]
  D --> K["Kafka Topic"]
  K --> F["Flink: Window / State"]
  F --> C["ClickHouse / Doris"]
  C --> R["实时看板"]`
  },
  {
    chapter: 9,
    title: 'OLAP 数据库：ClickHouse / Doris / DuckDB',
    source: 'manuscript/chapter-09-olap-databases.md',
    target: '09-olap-databases.md',
    summary: '理解列式存储、MPP、本地 OLAP 和 PostgreSQL 到分析库的链路。',
    diagram: `flowchart LR
  A["分析查询"] --> B["列式读取"]
  B --> C["压缩 / 排序 / 索引"]
  C --> D["聚合执行"]
  D --> E["BI / Dashboard"]
  P["PostgreSQL"] --> S["同步"] --> C`
  },
  {
    chapter: 10,
    title: '向量数据库：面向 AI / RAG / 语义检索的数据系统',
    source: 'manuscript/chapter-10-vector-databases.md',
    target: '10-vector-databases.md',
    summary: '把非结构化数据转成可检索语义空间，理解 RAG、混合检索和向量治理。',
    diagram: `flowchart LR
  D["文档"] --> P["解析"]
  P --> C["Chunking"]
  C --> E["Embedding"]
  E --> V["Vector DB"]
  Q["Query"] --> QE["Query Embedding"]
  QE --> V
  V --> R["Rerank"]
  R --> L["LLM Context"]`
  },
  {
    chapter: 11,
    title: '图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统',
    source: 'manuscript/chapter-11-graph-databases.md',
    target: '11-graph-databases.md',
    summary: '理解节点、边、路径、多跳查询、知识图谱和 GraphRAG 在数据平台中的位置。',
    diagram: `flowchart LR
  U["User"] -->|PURCHASED| P["Product"]
  P -->|BELONGS_TO| C["Category"]
  D["Document"] -->|MENTIONS| E["Entity"]
  E -->|RELATED_TO| E2["Entity"]
  E2 --> G["GraphRAG Context"]`
  },
  {
    chapter: 12,
    title: '数据湖与湖仓架构',
    source: 'manuscript/chapter-12-lakehouse.md',
    target: '12-lakehouse.md',
    summary: '用对象存储、文件格式、表格式、Catalog 和多引擎查询构建开放分析底座。',
    diagram: `flowchart LR
  DB["PostgreSQL / MySQL"] --> I["Ingestion"]
  I --> O["Object Storage"]
  O --> P["Parquet"]
  P --> T["Iceberg / Delta / Hudi"]
  T --> S["Spark"]
  T --> TR["Trino"]
  T --> F["Flink"]
  TR --> BI["BI / AI"]`
  },
  {
    chapter: 13,
    title: '数据治理与工程化',
    source: 'manuscript/chapter-13-data-governance.md',
    target: '13-data-governance.md',
    summary: '覆盖质量、元数据、血缘、权限、指标和 AI 知识治理，让数据平台长期可信。',
    diagram: `mindmap
  root((数据治理))
    数据质量
    元数据
    血缘
    权限安全
    指标治理
    知识治理`
  },
  {
    chapter: 14,
    title: '大数据方向项目实战',
    source: 'manuscript/chapter-14-projects.md',
    target: '14-projects.md',
    summary: '用 7 个项目把 PostgreSQL、OLAP、实时、湖仓、RAG、图和治理串成可执行闭环。',
    diagram: `flowchart LR
  P1["1 PostgreSQL 分析库"] --> P2["2 PG -> ClickHouse"]
  P2 --> P3["3 CDC 实时数仓"]
  P3 --> P4["4 Mini Lakehouse"]
  P4 --> P5["5 RAG 知识库"]
  P5 --> P6["6 知识图谱"]
  P6 --> P7["7 治理平台"]`
  },
  {
    chapter: 15,
    title: '推荐学习顺序',
    source: 'manuscript/chapter-15-learning-order.md',
    target: '15-learning-order.md',
    summary: '给出从 PostgreSQL 到数据治理的阶段化学习路径，避免直接跳工具。',
    diagram: `flowchart TB
  A["PostgreSQL"] --> B["SQL"]
  B --> C["大表边界"]
  C --> D["数仓"]
  D --> E["ETL / CDC"]
  E --> F["OLAP / 批处理"]
  F --> G["实时"]
  G --> H["向量 / 图"]
  H --> I["湖仓 / 治理"]`
  },
  {
    chapter: 16,
    title: '能力地图',
    source: 'manuscript/chapter-16-capability-map.md',
    target: '16-capability-map.md',
    summary: '把全书能力沉淀为 SQL、建模、链路、选型和治理五类能力。',
    diagram: `mindmap
  root((能力地图))
    SQL 能力
    建模能力
    数据链路能力
    系统选型能力
    治理能力`
  },
  {
    chapter: 17,
    title: '最终学习目标',
    source: 'manuscript/chapter-17-final-goals.md',
    target: '17-final-goals.md',
    summary: '定义从会查数据到会构建智能数据系统的最终能力标准。',
    diagram: `flowchart LR
  A["会查数据"] --> B["理解数据结构"]
  B --> C["设计数据链路"]
  C --> D["构建分析系统"]
  D --> E["接入 AI 检索"]
  E --> F["治理与演化"]
  F --> G["会构建智能数据系统"]`
  }
];

const learningParts = [
  {
    title: '第一部分：PostgreSQL 建立数据库直觉',
    range: [0, 3],
    promise: '让读者先理解数据如何被组织、约束、查询、优化，以及单机数据库为什么会出现边界。'
  },
  {
    title: '第二部分：从业务库走向分析系统',
    range: [4, 6],
    promise: '解释 OLTP / OLAP 分工、数仓建模和 ETL / CDC，让读者理解数据平台不是工具堆叠，而是系统目标分化后的结果。'
  },
  {
    title: '第三部分：大数据计算与湖仓底座',
    range: [7, 9],
    promise: '把批处理、实时计算和 OLAP 引擎放到同一条链路中，理解历史分析、实时分析和交互分析的不同压力。'
  },
  {
    title: '第四部分：AI 时代的数据基础设施',
    range: [10, 13],
    promise: '把向量、图、湖仓和治理纳入统一数据系统，理解 AI 应用为什么依赖可信、可追溯、可检索的数据底座。'
  },
  {
    title: '第五部分：项目、路线和能力闭环',
    range: [14, 17],
    promise: '用项目实战、学习顺序、能力地图和最终目标，把全书从知识阅读落到可执行训练。'
  }
];

const chapterCheckpoints = new Map([
  [0, ['为什么本书先讲 PostgreSQL，而不是直接讲 Spark、Flink 或向量数据库？', '你能否复述从业务库到 AI 数据基础设施的最小演化链路？']],
  [1, ['你能否解释一张表中的一行、一列、主键、外键和约束各代表什么业务事实？', '你能否说明 PostgreSQL 为什么适合作为数据库直觉训练入口？']],
  [2, ['你能否为 GMV、留存或复购写出口径说明，而不是只写出一条 SQL？', '你能否指出一条 SQL 的粒度、时间边界和状态边界？']],
  [3, ['你能否区分索引、分区、物化视图分别解决什么问题？', '你能否判断一个慢查询是 SQL 写法问题还是单机边界问题？']],
  [4, ['你能否解释为什么一个系统很难同时做好高频事务和复杂分析？', '你能否判断一个查询应该留在 PostgreSQL 还是迁入 OLAP？']],
  [5, ['你能否把业务表重构成事实表、维度表和分层模型？', '你能否说明指标口径应该沉淀在哪一层，而不是散落在报表里？']],
  [6, ['你能否画出 PostgreSQL 到数仓或实时链路的同步路径？', '你能否说明 ETL、ELT、CDC 在你的场景里各自承担什么责任？']],
  [7, ['你能否区分批处理层和查询层的职责边界？', '你能否说明 Spark、Hive、Trino 在一条历史分析链路中的不同位置？']],
  [8, ['你能否说明事件时间、水位线和状态为什么是实时系统的核心？', '你能否指出重复消息、迟到数据和 sink 幂等各自会造成什么问题？']],
  [9, ['你能否根据查询模式选择 ClickHouse、Doris 或 DuckDB？', '你能否解释 OLAP 快和数据可信之间为什么不是同一件事？']],
  [10, ['你能否说明向量检索解决什么问题，又不解决什么问题？', '你能否解释来源、权限、版本和评测为什么必须进入 RAG 链路？']],
  [11, ['你能否判断一个问题为什么更适合图数据库而不是关系库或向量库？', '你能否说明 GraphRAG 的路径扩展为什么必须受权限和来源约束？']],
  [12, ['你能否解释对象存储、Parquet、表格式和 Catalog 的责任分工？', '你能否说明湖仓为什么仍然需要建模、质量和治理，而不只是开放格式？']],
  [13, ['你能否为一个指标或知识库写出最小治理卡片？', '你能否说明数据治理为什么必须嵌入流程，而不是最后补文档？']],
  [14, ['你能否从 7 个项目里看出 PostgreSQL 到 AI 数据系统的连续演化关系？', '你能否区分“可检查骨架”和“端到端已跑通”的证据差别？']],
  [15, ['你能否判断自己应该先补 SQL、建模、链路还是治理？', '你能否为下一阶段学习写出一个可检查交付物，而不是只列工具名？']],
  [16, ['你能否用能力地图定位自己的短板，而不是只说“会不会某个工具”？', '你能否把一个项目拆成 SQL、建模、链路、选型和治理五类能力？']],
  [17, ['你能否独立设计一条业务库到数据应用的最小闭环？', '你能否说明每个组件加入系统的原因、代价和验证方式？']]
]);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function write(file, content) {
  ensureDir(path.dirname(file));
  fs.writeFileSync(file, content);
}

function stripH1(markdown) {
  return markdown.replace(/^# .+\n+/, '');
}

const STUB_THRESHOLD = 2000; // bytes — files below this are template stubs, not real content

function readSections(chapterNum) {
  const sectionDir = path.join(root, 'manuscript');
  const padded = String(chapterNum).padStart(2, '0');
  const sections = [];
  for (let i = 1; i <= 20; i++) {
    const file = path.join(sectionDir, `chapter-${padded}-section-${i}-complete.md`);
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8').trim();
      if (Buffer.byteLength(content, 'utf8') <= STUB_THRESHOLD) continue;

      // Section 1 often starts with the full chapter intro (# title, ## 问题切入, etc.)
      // Strip everything before the first ### X.Y heading
      if (i === 1) {
        const lines = content.split('\n');
        const firstH3 = lines.findIndex(line => /^### \d+\.\d+/.test(line));
        if (firstH3 > 0) {
          content = lines.slice(firstH3).join('\n').trim();
        }
      }

      sections.push(content);
    }
  }
  return sections;
}

function extractSectionTitle(content) {
  const match = content.match(/^### \d+\.\d+\s+(.+)/m);
  return match ? match[1].trim() : null;
}

function readSectionsDetailed(chapterNum) {
  const padded = String(chapterNum).padStart(2, '0');
  const sections = [];
  for (let i = 1; i <= 20; i++) {
    const file = path.join(root, 'manuscript', `chapter-${padded}-section-${i}-complete.md`);
    if (fs.existsSync(file)) {
      let content = fs.readFileSync(file, 'utf8').trim();
      if (Buffer.byteLength(content, 'utf8') <= STUB_THRESHOLD) continue;

      if (i === 1) {
        const lines = content.split('\n');
        const firstH3 = lines.findIndex(line => /^### \d+\.\d+/.test(line));
        if (firstH3 > 0) {
          content = lines.slice(firstH3).join('\n').trim();
        }
      }

      const title = extractSectionTitle(content);
      sections.push({ num: i, title: title || `${chapterNum}.${i}`, content });
    }
  }
  return sections;
}

function integrateSectionsInOverview(overviewContent, chapterNum) {
  const sections = readSections(chapterNum);
  if (sections.length === 0) return overviewContent;

  const lines = overviewContent.split('\n');

  // Find ## 机制解释 line
  const mechIdx = lines.findIndex(line => line.startsWith('## 机制解释'));
  if (mechIdx === -1) return overviewContent;

  // Find the first ### heading AFTER ## 机制解释 (could be ### X.Y or ### 一、二...)
  const firstSectionIdx = lines.findIndex((line, idx) => idx > mechIdx && line.startsWith('### '));
  if (firstSectionIdx === -1) return overviewContent;

  // Find ## 系统位置 line index (everything from here to end is closing)
  const systemPosIdx = lines.findIndex(line => line.startsWith('## 系统位置'));
  if (systemPosIdx === -1) return overviewContent;

  const intro = lines.slice(0, firstSectionIdx).join('\n').trimEnd();
  const closing = lines.slice(systemPosIdx).join('\n').trim();

  return [intro, '', sections.join('\n\n'), '', closing].join('\n');
}

function frontmatter(chapter) {
  const prev = chapters[chapters.findIndex((item) => item.target === chapter.target) - 1];
  const next = chapters[chapters.findIndex((item) => item.target === chapter.target) + 1];
  const lines = [
    '---',
    `title: "${chapter.chapter}. ${chapter.title}"`,
    `description: "${chapter.summary}"`,
    prev ? `prev: { text: "${prev.chapter}. ${prev.title}", link: "/chapters/${prev.target.replace(/\.md$/, '')}" }` : 'prev: false',
    next ? `next: { text: "${next.chapter}. ${next.title}", link: "/chapters/${next.target.replace(/\.md$/, '')}" }` : 'next: false',
    '---',
    ''
  ];
  return lines.join('\n');
}

function renderCheckpoints(chapterNum) {
  const checkpoints = chapterCheckpoints.get(chapterNum) ?? [];
  if (checkpoints.length === 0) return '';
  const items = checkpoints.map((item) => `- ${item}`).join('\n');
  return `::: info 本章验收问题\n${items}\n:::\n`;
}

// --- Split-aware chapter page generation ---

// Pre-compute section metadata (populated in main loop)
const chapterSectionsMap = new Map();

function linkFor(chapter) {
  if (chapterSectionsMap.has(chapter.chapter)) {
    return `/chapters/${String(chapter.chapter).padStart(2, '0')}/`;
  }
  return `/chapters/${chapter.target.replace(/\.md$/, '')}`;
}

function chapterPage(chapter) {
  // Single-page chapter (no sections): keep original behavior
  const rawSource = stripH1(read(chapter.source)).trim();
  const source = integrateSectionsInOverview(rawSource, chapter.chapter);
  const visualPath = chapter.chapter <= 5 ? `\n![${chapter.title}](/images/chapter-${String(chapter.chapter).padStart(2, '0')}.svg)\n` : '';
  return `${frontmatter(chapter)}# ${chapter.chapter}. ${chapter.title}

::: tip 本章导读
${chapter.summary}
:::
${renderCheckpoints(chapter.chapter)}
${visualPath}


\`\`\`mermaid
${chapter.diagram}
\`\`\`

${source}
`;
}

function chapterIndexPage(chapter, sections) {
  const rawSource = stripH1(read(chapter.source)).trim();
  const lines = rawSource.split('\n');

  // Split source: intro (before subsections under 机制解释) + closing (from 系统位置)
  const mechIdx = lines.findIndex(line => line.startsWith('## 机制解释'));
  let intro, closing;
  if (mechIdx !== -1) {
    const firstSubIdx = lines.findIndex((line, idx) => idx > mechIdx && line.startsWith('### '));
    const sysIdx = lines.findIndex(line => line.startsWith('## 系统位置'));
    if (firstSubIdx !== -1 && sysIdx !== -1) {
      intro = lines.slice(0, firstSubIdx).join('\n').trimEnd();
      closing = lines.slice(sysIdx).join('\n').trim();
    } else {
      intro = rawSource;
      closing = '';
    }
  } else {
    intro = rawSource;
    closing = '';
  }

  // Section links table
  const padded = String(chapter.chapter).padStart(2, '0');
  const sectionRows = sections
    .map(s => `| [${padded}.${s.num}](/chapters/${padded}/${padded}-${s.num}) | ${s.title} |`)
    .join('\n');
  const linksTable = `\n## 本章内容\n\n| 节号 | 主题 |\n|------|------|\n${sectionRows}\n`;

  // Frontmatter with prev/next
  const prevChapter = chapters[chapters.findIndex(c => c.chapter === chapter.chapter) - 1];
  const firstSection = sections[0];
  const prevLink = prevChapter ? linkFor(prevChapter) : null;
  const prevText = prevChapter ? `${prevChapter.chapter}. ${prevChapter.title}` : null;
  const nextLink = firstSection ? `/chapters/${padded}/${padded}-${firstSection.num}` : null;
  const nextText = firstSection ? `${padded}.${firstSection.num} ${firstSection.title}` : null;

  const fm = [
    '---',
    `title: "${chapter.chapter}. ${chapter.title}"`,
    `description: "${chapter.summary}"`,
    prevText ? `prev: { text: "${prevText}", link: "${prevLink}" }` : 'prev: false',
    nextText ? `next: { text: "${nextText}", link: "${nextLink}" }` : 'next: false',
    '---',
    ''
  ].join('\n');

  const visualPath = chapter.chapter <= 5
    ? `\n![${chapter.title}](/images/chapter-${padded}.svg)\n`
    : '';

  return `${fm}# ${chapter.chapter}. ${chapter.title}

::: tip 本章导读
${chapter.summary}
:::
${renderCheckpoints(chapter.chapter)}
${visualPath}

\`\`\`mermaid
${chapter.diagram}
\`\`\`

${intro}
${linksTable}
${closing ? '\n' + closing : ''}
`;
}

function sanitizeYaml(str) {
  return str.replace(/["""'"'""]/g, '').replace(/\n/g, ' ').trim();
}

// Interactive component embedding: map chapter.section -> component tag
const interactiveEmbeds = {
  '2': '::: tip 动手试试\n在下方沙盒中执行 SQL 查询，体验 SELECT、JOIN、窗口函数等操作。\n:::\n\n<SqlSandbox />\n',
  '6.5': '\n<EtlPipeline />\n',
  '8.3': '\n<StreamSimulator />\n',
  '10.3': '\n<VectorSearch />\n',
};

function getInteractiveEmbed(chapterNum, sectionNum) {
  // Check section-specific embed first
  const sectionKey = `${chapterNum}.${sectionNum}`;
  if (interactiveEmbeds[sectionKey]) return interactiveEmbeds[sectionKey];
  // Check chapter-level embed (only on last section of the chapter)
  if (interactiveEmbeds[String(chapterNum)] && sectionNum === getLastSectionNum(chapterNum)) {
    return interactiveEmbeds[String(chapterNum)];
  }
  return '';
}

// Cache for last section numbers
const lastSectionCache = new Map();
function getLastSectionNum(chapterNum) {
  if (lastSectionCache.has(chapterNum)) return lastSectionCache.get(chapterNum);
  const padded = String(chapterNum).padStart(2, '0');
  let last = 1;
  for (let i = 20; i >= 1; i--) {
    const file = path.join(root, 'manuscript', `chapter-${padded}-section-${i}-complete.md`);
    if (fs.existsSync(file)) { last = i; break; }
  }
  lastSectionCache.set(chapterNum, last);
  return last;
}

function generateSectionPage(chapter, section, prevRef, nextRef) {
  const padded = String(chapter.chapter).padStart(2, '0');
  const fullTitle = sanitizeYaml(`${padded}.${section.num} ${section.title}`);
  const desc = sanitizeYaml(section.content.replace(/[#*`\[\]{}|>!]/g, '')).slice(0, 120);
  const prevLine = prevRef
    ? `prev: { text: "${prevRef.text}", link: "${prevRef.link}" }`
    : 'prev: false';
  const nextLine = nextRef
    ? `next: { text: "${nextRef.text}", link: "${nextRef.link}" }`
    : 'next: false';
  const fm = [
    '---',
    `title: "${fullTitle}"`,
    `description: "${desc}"`,
    prevLine,
    nextLine,
    '---',
    ''
  ].join('\n');

  const embed = getInteractiveEmbed(chapter.chapter, section.num);
  return `${fm}${section.content}\n${embed}`;
}

function createIndex() {
  const partSections = learningParts
    .map((part) => {
      const items = chapters
        .filter((chapter) => chapter.chapter >= part.range[0] && chapter.chapter <= part.range[1])
        .map((chapter) => `- [${chapter.chapter}. ${chapter.title}](${linkFor(chapter)})：${chapter.summary}`)
        .join('\n');
      return `### ${part.title}

${part.promise}

${items}`;
    })
    .join('\n\n');
  return `---
layout: home
hero:
  name: "数据库全书"
  text: "从 PostgreSQL 到智能数据系统"
  tagline: "一条从会查数据到会构建大数据与 AI 数据基础设施的系统化学习路径。"
  actions:
    - theme: brand
      text: 开始阅读
      link: /chapters/00-positioning
features:
  - title: 不是 SQL 语法手册
    details: 每章从真实问题进入，解释机制、边界、系统位置和实践任务。
  - title: 不是工具清单
    details: 按 PostgreSQL、SQL、数仓、批流、OLAP、湖仓、AI 数据系统的演化顺序组织。
  - title: 面向长期能力
    details: 目标是让读者从会查数据，走向能设计和评估智能数据基础设施。
---

## 这份大文档怎么读

这不是按工具热度排列的教程，而是一条系统演化路线。读者先用 PostgreSQL 建立数据库直觉，再用 SQL 建立分析表达能力，然后理解业务库为什么会分化出数仓、ETL/CDC、批处理、实时计算、OLAP 数据库和湖仓，最后进入向量、图和治理这些 AI 时代的数据基础设施主题。

每章都按同一套阅读结构展开：问题切入、核心判断、机制解释、系统位置、场景案例、常见误区、实战任务、下一章衔接。这样读者不是背概念，而是在训练系统判断。

## 你现在怎么验证自己学会了

- [第 15 章：推荐学习顺序](/chapters/15-learning-order)：判断自己现在该补 SQL、建模、链路还是治理。
- [第 16 章：能力地图](/chapters/16-capability-map)：把”学过哪些工具”转换成”具备哪些可复用能力”。

## 分阶段阅读路径

${partSections}
`;
}

function createConfig() {
  // Build sidebar with 5-part nested structure + section sub-items
  const sidebarItems = learningParts.map(part => ({
    text: part.title,
    collapsed: false,
    items: chapters
      .filter(c => c.chapter >= part.range[0] && c.chapter <= part.range[1])
      .map(c => {
        const sections = chapterSectionsMap.get(c.chapter);
        if (sections && sections.length > 0) {
          const padded = String(c.chapter).padStart(2, '0');
          return {
            text: `${c.chapter}. ${c.title}`,
            collapsed: false,
            items: [
              { text: '章节概览', link: `/chapters/${padded}/` },
              ...sections.map(s => ({
                text: `${padded}.${s.num} ${s.title}`,
                link: `/chapters/${padded}/${padded}-${s.num}`
              }))
            ]
          };
        }
        return { text: `${c.chapter}. ${c.title}`, link: linkFor(c) };
      })
  }));
  return `import { defineConfig } from 'vitepress'

const sidebarItems = ${JSON.stringify(sidebarItems, null, 2)}

export default defineConfig({
  title: '数据库全书',
  description: '从 PostgreSQL 到智能数据系统',
  lang: 'zh-CN',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/images/logo.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    logo: '/images/logo.svg',
    nav: [
      { text: '开始阅读', link: '/chapters/00-positioning' }
    ],
    sidebar: sidebarItems,
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    search: {
      provider: 'local'
    },
    docFooter: {
      prev: '上一章',
      next: '下一章'
    },
    footer: {
      message: '从 PostgreSQL 到智能数据系统',
      copyright: 'Copyright © 2026'
    }
  },
  markdown: {
    lineNumbers: true,
    config(md) {
      const defaultFence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim()
        if (info === 'mermaid') {
          const code = encodeURIComponent(token.content)
          return \`<Mermaid code="\${code}" />\`
        }
        return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
      }
    }
  }
})
`;
}

function createTheme() {
  return `import DefaultTheme from 'vitepress/theme'
import Mermaid from './Mermaid.vue'
import './custom.css'

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component('Mermaid', Mermaid)
  }
}
`;
}

function createMermaidComponent() {
  return `<template>
  <div ref="container" class="mermaid-block" />
</template>

<script setup>
import { onMounted, ref, watch } from 'vue'

const props = defineProps({
  code: {
    type: String,
    required: true
  }
})

const container = ref(null)

async function renderDiagram() {
  if (!container.value) return
  const { default: mermaid } = await import('mermaid')
  const source = decodeURIComponent(props.code)
  const id = 'mermaid-' + Math.random().toString(36).slice(2)
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: document.documentElement.classList.contains('dark') ? 'dark' : 'default'
  })
  const result = await mermaid.render(id, source)
  container.value.innerHTML = result.svg
}

onMounted(renderDiagram)
watch(() => props.code, renderDiagram)
</script>
`;
}

function createCss() {
  return `:root {
  --vp-c-brand-1: #2563eb;
  --vp-c-brand-2: #1d4ed8;
  --vp-c-brand-3: #60a5fa;
  --vp-home-hero-name-color: transparent;
  --vp-home-hero-name-background: linear-gradient(120deg, #1f2937, #2563eb);
}

.VPDoc .content {
  max-width: 920px;
}

.vp-doc p {
  line-height: 1.9;
  margin: 14px 0;
}

.vp-doc h2 {
  margin-top: 44px;
  padding-top: 12px;
  border-top: 1px solid var(--vp-c-divider);
}

.vp-doc h3 {
  margin-top: 32px;
}

.vp-doc table {
  display: table;
  width: 100%;
  font-size: 14px;
}

.vp-doc th,
.vp-doc td {
  vertical-align: top;
}

.vp-doc li + li {
  margin-top: 6px;
}

.vp-doc img {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}

.vp-doc blockquote {
  border-left-color: var(--vp-c-brand-1);
  background: color-mix(in srgb, var(--vp-c-brand-1) 8%, transparent);
  padding: 12px 16px;
  border-radius: 8px;
}

.VPHome .VPFeature {
  border-radius: 8px;
}

@media print {
  .VPNav,
  .VPLocalNav,
  .VPSidebar,
  .VPDocFooter,
  .VPDocAside {
    display: none !important;
  }

  .VPContent,
  .VPDoc,
  .VPDoc .container,
  .VPDoc .content,
  .vp-doc {
    max-width: none !important;
    padding: 0 !important;
  }

  .vp-doc h1,
  .vp-doc h2 {
    break-after: avoid;
  }

  .vp-doc pre,
  .vp-doc table,
  .mermaid-block {
    break-inside: avoid;
  }
}

.mermaid-block {
  margin: 24px 0;
  padding: 20px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  overflow-x: auto;
}

.mermaid-block svg {
  max-width: 100%;
  height: auto;
}
`;
}

function createLogo() {
  return `<svg width="96" height="96" viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="96" height="96" rx="22" fill="#1f2937"/>
  <path d="M24 30C24 24.477 28.477 20 34 20H62C67.523 20 72 24.477 72 30V66C72 71.523 67.523 76 62 76H34C28.477 76 24 71.523 24 66V30Z" fill="#EFF6FF"/>
  <path d="M35 35H61M35 47H61M35 59H52" stroke="#2563EB" stroke-width="5" stroke-linecap="round"/>
  <circle cx="67" cy="68" r="11" fill="#60A5FA" stroke="#1f2937" stroke-width="4"/>
</svg>
`;
}

function chapterSvg(title, subtitle, labels) {
  const safeTitle = title.replace(/&/g, '&amp;');
  const safeSubtitle = subtitle.replace(/&/g, '&amp;');
  const nodes = labels.map((label, index) => {
    const x = 70 + index * 150;
    const safeLabel = label.replace(/&/g, '&amp;');
    const arrow = index < labels.length - 1
      ? `<path d="M${x + 105} 220H${x + 135}" stroke="#2563EB" stroke-width="3" marker-end="url(#arrow)"/>`
      : '';
    return `<g>
      <rect x="${x}" y="180" width="112" height="80" rx="16" fill="#EFF6FF" stroke="#93C5FD"/>
      <text x="${x + 56}" y="226" text-anchor="middle" font-size="15" font-weight="700" fill="#1F2937">${safeLabel}</text>
      ${arrow}
    </g>`;
  }).join('\n');
  return `<svg width="960" height="360" viewBox="0 0 960 360" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
      <path d="M0 0L8 4L0 8V0Z" fill="#2563EB"/>
    </marker>
  </defs>
  <rect width="960" height="360" rx="28" fill="#F8FAFC"/>
  <rect x="24" y="24" width="912" height="312" rx="24" fill="white" stroke="#E5E7EB"/>
  <circle cx="82" cy="86" r="30" fill="#DBEAFE"/>
  <path d="M70 86H94M82 74V98" stroke="#2563EB" stroke-width="5" stroke-linecap="round"/>
  <text x="130" y="82" font-size="30" font-weight="800" fill="#111827">${safeTitle}</text>
  <text x="130" y="116" font-size="17" fill="#64748B">${safeSubtitle}</text>
  ${nodes}
  <text x="70" y="306" font-size="14" fill="#64748B">信息优先 · 结构优先 · 机制导向</text>
</svg>
`;
}

function writeChapterVisuals() {
  const visuals = [
    ['00', '从 PostgreSQL 到智能数据系统', '全书路线不是工具清单，而是数据系统的演化路径', ['PG', 'SQL', '数仓', '批流', 'AI']],
    ['01', 'PostgreSQL 建立数据库直觉', '先理解数据放在哪里，再理解如何查询和演化', ['Server', 'DB', 'Schema', 'Table', 'Row']],
    ['02', 'SQL 分析能力阶梯', '从取数边界到指标口径的分析表达能力', ['查询', '聚合', 'JOIN', '窗口', '指标']],
    ['03', '大表与单机边界', '用访问路径、预计算和分区理解分析压力', ['大表', '索引', '分区', '计划', '边界']],
    ['04', 'OLTP 与 OLAP 分工', '业务正确和分析效率来自不同系统目标', ['交易', '一致', '扫描', '聚合', '分工']],
    ['05', '从业务表到数仓模型', '把业务事实重构成可分析、可复用的语义层', ['ODS', 'DWD', 'DWS', 'ADS', '指标']]
  ];
  for (const [id, title, subtitle, labels] of visuals) {
    write(path.join(siteDir, 'public', 'images', `chapter-${id}.svg`), chapterSvg(title, subtitle, labels));
  }
}

ensureDir(chaptersDir);
ensureDir(path.join(siteDir, '.vitepress', 'theme'));
ensureDir(path.join(siteDir, 'public', 'images'));

// Pre-compute section metadata for split chapters
for (const ch of chapters) {
  const sections = readSectionsDetailed(ch.chapter);
  if (sections.length > 0) {
    chapterSectionsMap.set(ch.chapter, sections);
  }
}

write(path.join(siteDir, 'index.md'), createIndex());
write(path.join(siteDir, '.vitepress', 'config.ts'), createConfig());
write(path.join(siteDir, '.vitepress', 'theme', 'index.ts'), createTheme());
write(path.join(siteDir, '.vitepress', 'theme', 'Mermaid.vue'), createMermaidComponent());
write(path.join(siteDir, '.vitepress', 'theme', 'custom.css'), createCss());
write(path.join(siteDir, 'public', 'images', 'logo.svg'), createLogo());
writeChapterVisuals();

let totalSectionPages = 0;

for (const chapter of chapters) {
  const sections = chapterSectionsMap.get(chapter.chapter);

  if (sections && sections.length > 0) {
    // Split chapter: generate index page + section pages
    const padded = String(chapter.chapter).padStart(2, '0');
    const chapterDir = path.join(chaptersDir, padded);
    ensureDir(chapterDir);

    // Chapter index page
    write(path.join(chapterDir, 'index.md'), chapterIndexPage(chapter, sections));

    // Section pages with prev/next chain
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const chapterLink = `/chapters/${padded}/`;

      let prevRef, nextRef;

      // prev: previous section, or chapter index if first
      if (i === 0) {
        prevRef = { text: `${chapter.chapter}. ${chapter.title}`, link: chapterLink };
      } else {
        const prevSection = sections[i - 1];
        prevRef = {
          text: `${padded}.${prevSection.num} ${prevSection.title}`,
          link: `/chapters/${padded}/${padded}-${prevSection.num}`
        };
      }

      // next: next section, or next chapter index if last
      if (i === sections.length - 1) {
        const nextChapter = chapters[chapters.findIndex(c => c.chapter === chapter.chapter) + 1];
        if (nextChapter) {
          nextRef = { text: `${nextChapter.chapter}. ${nextChapter.title}`, link: linkFor(nextChapter) };
        } else {
          nextRef = null;
        }
      } else {
        const nextSection = sections[i + 1];
        nextRef = {
          text: `${padded}.${nextSection.num} ${nextSection.title}`,
          link: `/chapters/${padded}/${padded}-${nextSection.num}`
        };
      }

      write(
        path.join(chapterDir, `${padded}-${section.num}.md`),
        generateSectionPage(chapter, section, prevRef, nextRef)
      );
      totalSectionPages++;
    }
  } else {
    // Single-page chapter: keep original behavior
    write(path.join(chaptersDir, chapter.target), chapterPage(chapter));
  }
}

const splitChapters = [...chapterSectionsMap.keys()].map(n => String(n).padStart(2, '0'));
console.log(`Generated ${chapters.length - chapterSectionsMap.size} single-page chapters + ${chapterSectionsMap.size} split chapters (${totalSectionPages} section pages) into site/`);
console.log(`Split chapters: ${splitChapters.join(', ')}`);
