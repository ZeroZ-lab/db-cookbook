CREATE SCHEMA IF NOT EXISTS governance;

CREATE TABLE IF NOT EXISTS governance.tables (
  table_id TEXT PRIMARY KEY,
  system_name TEXT NOT NULL,
  database_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  table_name TEXT NOT NULL,
  owner TEXT NOT NULL,
  lifecycle TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance.columns (
  column_id TEXT PRIMARY KEY,
  table_id TEXT NOT NULL REFERENCES governance.tables(table_id),
  column_name TEXT NOT NULL,
  data_type TEXT NOT NULL,
  sensitivity_level TEXT NOT NULL,
  description TEXT,
  UNIQUE (table_id, column_name)
);

CREATE TABLE IF NOT EXISTS governance.metrics (
  metric_id TEXT PRIMARY KEY,
  metric_name TEXT NOT NULL,
  metric_version TEXT NOT NULL,
  owner TEXT NOT NULL,
  definition TEXT NOT NULL,
  calculation_sql TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS governance.lineage_edges (
  edge_id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  job_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS governance.quality_rules (
  rule_id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  rule_type TEXT NOT NULL,
  rule_sql TEXT NOT NULL,
  severity TEXT NOT NULL,
  owner TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS governance.quality_results (
  result_id BIGSERIAL PRIMARY KEY,
  rule_id TEXT NOT NULL REFERENCES governance.quality_rules(rule_id),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  passed BOOLEAN NOT NULL,
  failed_count BIGINT NOT NULL,
  sample_rows JSONB
);

CREATE TABLE IF NOT EXISTS governance.policies (
  policy_id TEXT PRIMARY KEY,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  action TEXT NOT NULL,
  decision TEXT NOT NULL,
  enforcement_point TEXT NOT NULL,
  risk_note TEXT
);

CREATE TABLE IF NOT EXISTS governance.ai_evaluations (
  evaluation_id TEXT PRIMARY KEY,
  application_name TEXT NOT NULL,
  dataset_id TEXT NOT NULL,
  question TEXT NOT NULL,
  expected_source_uri TEXT NOT NULL,
  expected_policy_scope TEXT NOT NULL,
  passed BOOLEAN,
  notes TEXT
);
