INSERT INTO governance.quality_rules (
  rule_id,
  target_type,
  target_id,
  rule_type,
  rule_sql,
  severity,
  owner
)
VALUES
(
  'rule_orders_total_amount_non_negative',
  'table',
  'postgres.public.orders',
  'non_negative',
  'SELECT count(*) FROM orders WHERE total_amount < 0',
  'critical',
  'analytics-team'
),
(
  'rule_order_items_have_product',
  'table',
  'postgres.public.order_items',
  'referential_completeness',
  'SELECT count(*) FROM order_items oi LEFT JOIN products p ON oi.product_id = p.product_id WHERE p.product_id IS NULL',
  'critical',
  'analytics-team'
),
(
  'rule_rag_eval_has_expected_source',
  'ai_evaluation',
  'rag.gmv.evaluation.v1',
  'source_hit',
  'SELECT count(*) FROM rag.evaluations WHERE expected_source_uri IS NULL OR expected_source_uri = ''''',
  'major',
  'ai-platform-team'
);
