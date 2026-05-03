import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const projectRoot = path.join(root, 'project-workbench', 'projects');
const manifestPath = path.join(root, 'project-workbench', 'project-manifest.json');
const runbookPath = path.join(root, 'docs', 'project-runbook.md');

const projects = [
  '01-postgresql-analytics',
  '02-postgres-to-clickhouse',
  '03-cdc-realtime-warehouse',
  '04-mini-lakehouse',
  '05-rag-vector-kb',
  '06-knowledge-graph-graphrag',
  '07-governance-mini-platform'
];

const requiredSections = [
  '## 目标',
  '## 系统位置',
  '## 数据模型',
  '## 核心链路',
  '## 验收指标',
  '## 运行命令',
  '## 质量检查',
  '## 复盘问题'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

assert(fs.existsSync(projectRoot), 'Missing project-workbench/projects directory');
assert(fs.existsSync(manifestPath), 'Missing project-workbench/project-manifest.json');
assert(fs.existsSync(runbookPath), 'Missing docs/project-runbook.md');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const runbook = fs.readFileSync(runbookPath, 'utf8');
assert(manifest.schemaVersion === 1, 'Project manifest schemaVersion must be 1');
assert(Array.isArray(manifest.projects), 'Project manifest must include projects array');
assert(manifest.projects.length === projects.length, 'Project manifest must describe exactly 7 projects');

const allowedRuntimeStatuses = new Set(manifest.runtimeStatusContract?.allowedStatuses ?? []);
const forbiddenRuntimeStatuses = manifest.runtimeStatusContract?.forbiddenStatuses ?? [];
assert(allowedRuntimeStatuses.size > 0, 'Project manifest must define allowed runtime statuses');
assert(forbiddenRuntimeStatuses.length > 0, 'Project manifest must define forbidden runtime statuses');

const manifestIds = manifest.projects.map((project) => project.id);
assert(JSON.stringify(manifestIds) === JSON.stringify(projects), 'Project manifest ids must match project order');

for (const project of manifest.projects) {
  assert(project.title && project.stage, `Manifest project ${project.id} must include title and stage`);
  assert(project.directory === `projects/${project.id}`, `Manifest project ${project.id} directory must match id`);
  assert(allowedRuntimeStatuses.has(project.runtimeStatus), `Manifest project ${project.id} has unsupported runtimeStatus`);
  assert(runbook.includes(`### ${project.id} ${project.title}`), `Runbook missing project card for ${project.id}`);
  assert(runbook.includes(`\`${project.runtimeStatus}\``), `Runbook missing runtime status for ${project.id}`);
  for (const forbidden of forbiddenRuntimeStatuses) {
    assert(
      !project.runtimeStatus.toLowerCase().includes(forbidden),
      `Manifest project ${project.id} must not claim forbidden runtime status: ${forbidden}`
    );
  }
  assert(Array.isArray(project.blockedBy) && project.blockedBy.length > 0, `Manifest project ${project.id} must list runtime blockers`);
  assert(Array.isArray(project.requiredArtifacts) && project.requiredArtifacts.length >= 3, `Manifest project ${project.id} must list required artifacts`);
  for (const blocker of project.blockedBy) {
    assert(runbook.includes(blocker), `Runbook missing blocker for ${project.id}: ${blocker}`);
  }

  const projectDir = path.join(root, 'project-workbench', project.directory);
  assert(fs.existsSync(projectDir), `Manifest project directory does not exist: ${project.directory}`);
  for (const artifact of project.requiredArtifacts) {
    const artifactPath = path.join(projectDir, artifact);
    assert(fs.existsSync(artifactPath), `Manifest artifact missing for ${project.id}: ${artifact}`);
    assert(runbook.includes(`${project.directory}/${artifact}`), `Runbook missing artifact link for ${project.id}: ${artifact}`);
  }
}

assert(runbook.includes('不证明数据库、消息队列、计算引擎或 AI 检索链路已经真实运行'), 'Runbook must preserve runtime boundary');

for (const project of projects) {
  const file = path.join(projectRoot, project, 'README.md');
  const deliverablesFile = path.join(projectRoot, project, 'DELIVERABLES.md');
  assert(fs.existsSync(file), `Missing project README: ${file}`);
  assert(fs.existsSync(deliverablesFile), `Missing project deliverables: ${deliverablesFile}`);
  const text = fs.readFileSync(file, 'utf8');
  const deliverables = fs.readFileSync(deliverablesFile, 'utf8');

  for (const section of requiredSections) {
    assert(text.includes(section), `Missing section ${section} in ${project}`);
  }

  assert(text.includes('```text'), `Missing text architecture block in ${project}`);
  assert(/\[[ x]\]/.test(text), `Missing checklist items in ${project}`);

  for (const section of ['## 架构产物', '## 数据模型产物', '## 核心任务产物', '## 验证证据', '## 复盘记录']) {
    assert(deliverables.includes(section), `Missing deliverables section ${section} in ${project}`);
  }
}

const projectOneRunScript = path.join(projectRoot, '01-postgresql-analytics', 'run.sh');
assert(fs.existsSync(projectOneRunScript), 'Missing project 1 run script');
assert(
  fs.readFileSync(projectOneRunScript, 'utf8').includes('pnpm sql:run'),
  'Project 1 run script must execute pnpm sql:run'
);

const projectOneReport = path.join(projectRoot, '01-postgresql-analytics', 'reports', 'run-record-template.md');
assert(fs.existsSync(projectOneReport), 'Missing project 1 run record template');

const projectOneCompose = path.join(projectRoot, '01-postgresql-analytics', 'docker-compose.yml');
assert(fs.existsSync(projectOneCompose), 'Missing project 1 Docker Compose file');
const compose = fs.readFileSync(projectOneCompose, 'utf8');
assert(compose.includes('postgres:17'), 'Project 1 Docker Compose must use PostgreSQL 17');
assert(compose.includes('db_cookbook_lab'), 'Project 1 Docker Compose must create db_cookbook_lab');

const projectTwoRoot = path.join(projectRoot, '02-postgres-to-clickhouse');
const projectTwoMapping = path.join(projectTwoRoot, 'mappings', 'orders-wide-mapping.md');
const projectTwoSchema = path.join(projectTwoRoot, 'clickhouse', 'schema.sql');
const projectTwoQuery = path.join(projectTwoRoot, 'queries', 'daily-gmv.sql');
const projectTwoReport = path.join(projectTwoRoot, 'reports', 'reconciliation-template.md');

for (const file of [projectTwoMapping, projectTwoSchema, projectTwoQuery, projectTwoReport]) {
  assert(fs.existsSync(file), `Missing project 2 artifact: ${file}`);
}

const projectTwoSchemaSql = fs.readFileSync(projectTwoSchema, 'utf8');
assert(projectTwoSchemaSql.includes('ENGINE = MergeTree'), 'Project 2 schema must define a MergeTree detail table');
assert(projectTwoSchemaSql.includes('ENGINE = ReplacingMergeTree'), 'Project 2 schema must define a ReplacingMergeTree aggregate table');
assert(projectTwoSchemaSql.includes('PARTITION BY toYYYYMM(created_at)'), 'Project 2 detail table must define a time partition');
assert(projectTwoSchemaSql.includes('ORDER BY (created_at, category, user_id, order_id)'), 'Project 2 detail table must define the expected sorting key');

const projectTwoQuerySql = fs.readFileSync(projectTwoQuery, 'utf8');
assert(projectTwoQuerySql.includes('sumIf(item_amount'), 'Project 2 query must calculate paid GMV');
assert(projectTwoQuerySql.includes('uniqExactIf(order_id'), 'Project 2 query must calculate paid orders');
assert(projectTwoQuerySql.includes('analytics.daily_gmv'), 'Project 2 query must write or read daily_gmv');

const projectThreeRoot = path.join(projectRoot, '03-cdc-realtime-warehouse');
const projectThreeEvent = path.join(projectThreeRoot, 'events', 'order-status-changed.json');
const projectThreeTopics = path.join(projectThreeRoot, 'kafka', 'topics.md');
const projectThreeFlink = path.join(projectThreeRoot, 'flink', 'realtime-gmv.sql');
const projectThreeSink = path.join(projectThreeRoot, 'sinks', 'clickhouse-realtime.sql');
const projectThreeBoundary = path.join(projectThreeRoot, 'docs', 'exactly-once-boundary.md');

for (const file of [projectThreeEvent, projectThreeTopics, projectThreeFlink, projectThreeSink, projectThreeBoundary]) {
  assert(fs.existsSync(file), `Missing project 3 artifact: ${file}`);
}

const projectThreeEventJson = JSON.parse(fs.readFileSync(projectThreeEvent, 'utf8'));
assert(projectThreeEventJson.before.order_status === 'created', 'Project 3 event must include before state');
assert(projectThreeEventJson.after.order_status === 'paid', 'Project 3 event must include paid after state');

const projectThreeTopicsText = fs.readFileSync(projectThreeTopics, 'utf8');
assert(projectThreeTopicsText.includes('db.public.orders'), 'Project 3 topics must include orders CDC topic');
assert(projectThreeTopicsText.includes('flink-realtime-gmv'), 'Project 3 topics must include Flink consumer group');

const projectThreeFlinkSql = fs.readFileSync(projectThreeFlink, 'utf8');
assert(projectThreeFlinkSql.includes('WATERMARK FOR event_time'), 'Project 3 Flink SQL must define event-time watermark');
assert(projectThreeFlinkSql.includes("TUMBLE(TABLE orders_cdc"), 'Project 3 Flink SQL must define a tumbling window');
assert(projectThreeFlinkSql.includes('COUNT(DISTINCT order_id)'), 'Project 3 Flink SQL must calculate paid order count');

const projectThreeSinkSql = fs.readFileSync(projectThreeSink, 'utf8');
assert(projectThreeSinkSql.includes('ReplacingMergeTree'), 'Project 3 sink must use idempotent/replacing table design');

const projectThreeBoundaryText = fs.readFileSync(projectThreeBoundary, 'utf8');
assert(projectThreeBoundaryText.includes('Source'), 'Project 3 boundary doc must cover Source');
assert(projectThreeBoundaryText.includes('Checkpoint'), 'Project 3 boundary doc must cover Checkpoint');
assert(projectThreeBoundaryText.includes('Sink'), 'Project 3 boundary doc must cover Sink');

const projectFourRoot = path.join(projectRoot, '04-mini-lakehouse');
const projectFourLayout = path.join(projectFourRoot, 'storage', 'object-layout.md');
const projectFourIceberg = path.join(projectFourRoot, 'iceberg', 'orders.sql');
const projectFourTrino = path.join(projectFourRoot, 'trino', 'orders-analysis.sql');
const projectFourSpark = path.join(projectFourRoot, 'spark', 'build-order-items-wide.sql');
const projectFourEvolution = path.join(projectFourRoot, 'docs', 'evolution-record.md');

for (const file of [projectFourLayout, projectFourIceberg, projectFourTrino, projectFourSpark, projectFourEvolution]) {
  assert(fs.existsSync(file), `Missing project 4 artifact: ${file}`);
}

const projectFourLayoutText = fs.readFileSync(projectFourLayout, 'utf8');
assert(projectFourLayoutText.includes('*.parquet'), 'Project 4 layout must describe Parquet files');
assert(projectFourLayoutText.includes('warehouse/iceberg'), 'Project 4 layout must describe Iceberg warehouse');

const projectFourIcebergSql = fs.readFileSync(projectFourIceberg, 'utf8');
assert(projectFourIcebergSql.includes('USING iceberg'), 'Project 4 DDL must use Iceberg tables');
assert(projectFourIcebergSql.includes("'format-version' = '2'"), 'Project 4 DDL must specify Iceberg format version');
assert(projectFourIcebergSql.includes('PARTITIONED BY'), 'Project 4 DDL must define partitioning');

const projectFourTrinoSql = fs.readFileSync(projectFourTrino, 'utf8');
assert(projectFourTrinoSql.includes('FROM lakehouse.orders'), 'Project 4 Trino query must read orders');
assert(projectFourTrinoSql.includes('FROM lakehouse.order_items_wide'), 'Project 4 Trino query must read derived wide table');

const projectFourSparkSql = fs.readFileSync(projectFourSpark, 'utf8');
assert(projectFourSparkSql.includes('INSERT OVERWRITE lakehouse.order_items_wide'), 'Project 4 Spark SQL must write derived table');
assert(projectFourSparkSql.includes('JOIN lakehouse.raw_order_items'), 'Project 4 Spark SQL must join raw order items');

const projectFourEvolutionText = fs.readFileSync(projectFourEvolution, 'utf8');
assert(projectFourEvolutionText.includes('Schema 演化'), 'Project 4 evolution doc must cover schema evolution');
assert(projectFourEvolutionText.includes('分区演化'), 'Project 4 evolution doc must cover partition evolution');

const projectFiveRoot = path.join(projectRoot, '05-rag-vector-kb');
const projectFiveSchema = path.join(projectFiveRoot, 'schema', 'pgvector.sql');
const projectFiveQuery = path.join(projectFiveRoot, 'queries', 'retrieve-with-permission.sql');
const projectFiveEval = path.join(projectFiveRoot, 'evals', 'rag-eval-sample.json');
const projectFiveChunking = path.join(projectFiveRoot, 'docs', 'chunking-and-versioning.md');
const projectFivePermission = path.join(projectFiveRoot, 'docs', 'permission-boundary.md');
const projectFiveLog = path.join(projectFiveRoot, 'reports', 'retrieval-log-template.md');

for (const file of [projectFiveSchema, projectFiveQuery, projectFiveEval, projectFiveChunking, projectFivePermission, projectFiveLog]) {
  assert(fs.existsSync(file), `Missing project 5 artifact: ${file}`);
}

const projectFiveSchemaSql = fs.readFileSync(projectFiveSchema, 'utf8');
for (const table of ['rag.documents', 'rag.chunks', 'rag.embeddings', 'rag.retrieval_logs', 'rag.evaluations']) {
  assert(projectFiveSchemaSql.includes(table), `Project 5 schema must define ${table}`);
}
assert(projectFiveSchemaSql.includes('vector(1536)'), 'Project 5 schema must define vector embeddings');
assert(projectFiveSchemaSql.includes('USING hnsw'), 'Project 5 schema must define an HNSW index');

const projectFiveQuerySql = fs.readFileSync(projectFiveQuery, 'utf8');
assert(projectFiveQuerySql.includes('visible_documents'), 'Project 5 query must filter visible documents before retrieval');
assert(projectFiveQuerySql.includes('owner_id = :user_id'), 'Project 5 query must include owner filter');
assert(projectFiveQuerySql.includes('e.embedding <=> :query_embedding'), 'Project 5 query must use vector distance');
assert(projectFiveQuerySql.includes('rag.retrieval_logs'), 'Project 5 query must log retrievals');

const projectFiveEvalJson = JSON.parse(fs.readFileSync(projectFiveEval, 'utf8'));
assert(Array.isArray(projectFiveEvalJson) && projectFiveEvalJson.length >= 3, 'Project 5 eval set must contain at least 3 cases');
for (const item of projectFiveEvalJson) {
  assert(item.question && item.expected_source_uri && item.expected_answer, 'Project 5 eval cases must include question, source, and answer');
}

const projectFivePermissionText = fs.readFileSync(projectFivePermission, 'utf8');
assert(projectFivePermissionText.includes('检索前过滤'), 'Project 5 permission doc must cover pre-retrieval filtering');
assert(projectFivePermissionText.includes('检索后校验'), 'Project 5 permission doc must cover post-retrieval validation');

const projectSixRoot = path.join(projectRoot, '06-knowledge-graph-graphrag');
const projectSixOntology = path.join(projectSixRoot, 'ontology', 'entity-relation-types.md');
const projectSixTriples = path.join(projectSixRoot, 'data', 'triples-sample.jsonl');
const projectSixNeo4j = path.join(projectSixRoot, 'queries', 'neo4j-paths.cypher');
const projectSixNebula = path.join(projectSixRoot, 'queries', 'nebulagraph-paths.ngql');
const projectSixContext = path.join(projectSixRoot, 'graphrag', 'context-template.md');
const projectSixLog = path.join(projectSixRoot, 'reports', 'graph-query-log-template.md');

for (const file of [projectSixOntology, projectSixTriples, projectSixNeo4j, projectSixNebula, projectSixContext, projectSixLog]) {
  assert(fs.existsSync(file), `Missing project 6 artifact: ${file}`);
}

const projectSixOntologyText = fs.readFileSync(projectSixOntology, 'utf8');
for (const token of ['User', 'Product', 'Metric', 'PLACED', 'DEFINED_IN']) {
  assert(projectSixOntologyText.includes(token), `Project 6 ontology must include ${token}`);
}

const projectSixTriplesText = fs.readFileSync(projectSixTriples, 'utf8').trim();
assert(projectSixTriplesText.split('\n').length >= 5, 'Project 6 triples must contain at least 5 sample triples');
for (const line of projectSixTriplesText.split('\n')) {
  const triple = JSON.parse(line);
  assert(triple.subject && triple.predicate && triple.object, 'Project 6 triples must include subject, predicate, object');
  assert(triple.source && typeof triple.confidence === 'number' && triple.graph_version, 'Project 6 triples must include source, confidence, graph_version');
}

const projectSixNeo4jText = fs.readFileSync(projectSixNeo4j, 'utf8');
assert(projectSixNeo4jText.includes('MATCH path'), 'Project 6 Neo4j query must include path matching');
assert(projectSixNeo4jText.includes('length(path)'), 'Project 6 Neo4j query must expose hop length');

const projectSixNebulaText = fs.readFileSync(projectSixNebula, 'utf8');
assert(projectSixNebulaText.includes('FIND ALL PATH'), 'Project 6 Nebula query must include path query');
assert(projectSixNebulaText.includes('UPTO 3 STEPS'), 'Project 6 Nebula query must include multi-hop bound');

const projectSixContextText = fs.readFileSync(projectSixContext, 'utf8');
assert(projectSixContextText.includes('向量召回片段'), 'Project 6 context must combine vector evidence');
assert(projectSixContextText.includes('图路径证据'), 'Project 6 context must combine graph evidence');

const projectSevenRoot = path.join(projectRoot, '07-governance-mini-platform');
const projectSevenSchema = path.join(projectSevenRoot, 'schema', 'governance.sql');
const projectSevenMetrics = path.join(projectSevenRoot, 'catalog', 'metric-dictionary.md');
const projectSevenLineage = path.join(projectSevenRoot, 'lineage', 'lineage-sample.json');
const projectSevenQuality = path.join(projectSevenRoot, 'quality', 'rules.sql');
const projectSevenPolicies = path.join(projectSevenRoot, 'policies', 'access-policies.md');
const projectSevenAudit = path.join(projectSevenRoot, 'reports', 'governance-audit-template.md');

for (const file of [projectSevenSchema, projectSevenMetrics, projectSevenLineage, projectSevenQuality, projectSevenPolicies, projectSevenAudit]) {
  assert(fs.existsSync(file), `Missing project 7 artifact: ${file}`);
}

const projectSevenSchemaSql = fs.readFileSync(projectSevenSchema, 'utf8');
for (const table of ['governance.tables', 'governance.columns', 'governance.metrics', 'governance.lineage_edges', 'governance.quality_rules', 'governance.policies', 'governance.ai_evaluations']) {
  assert(projectSevenSchemaSql.includes(table), `Project 7 schema must define ${table}`);
}

const projectSevenMetricsText = fs.readFileSync(projectSevenMetrics, 'utf8');
assert(projectSevenMetricsText.includes('GMV'), 'Project 7 metric dictionary must include GMV');
assert(projectSevenMetricsText.includes('口径冲突案例'), 'Project 7 metric dictionary must include a conflict case');

const projectSevenLineageJson = JSON.parse(fs.readFileSync(projectSevenLineage, 'utf8'));
assert(Array.isArray(projectSevenLineageJson.edges) && projectSevenLineageJson.edges.length >= 3, 'Project 7 lineage must contain at least 3 edges');
for (const edge of projectSevenLineageJson.edges) {
  assert(edge.source_type && edge.source_id && edge.target_type && edge.target_id && edge.relation_type, 'Project 7 lineage edges must include source and target');
}

const projectSevenQualitySql = fs.readFileSync(projectSevenQuality, 'utf8');
assert(projectSevenQualitySql.includes('governance.quality_rules'), 'Project 7 quality SQL must write quality rules');
assert(projectSevenQualitySql.includes('source_hit'), 'Project 7 quality SQL must include AI evaluation source hit rule');

const projectSevenPoliciesText = fs.readFileSync(projectSevenPolicies, 'utf8');
for (const token of ['SQL', '向量', '图', '执行位置', '漏检风险']) {
  assert(projectSevenPoliciesText.includes(token), `Project 7 policies must cover ${token}`);
}

console.log('Project workbench structure: ok');
