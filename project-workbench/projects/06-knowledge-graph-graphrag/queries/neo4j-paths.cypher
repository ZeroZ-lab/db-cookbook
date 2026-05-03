CREATE CONSTRAINT user_id IF NOT EXISTS
FOR (u:User)
REQUIRE u.user_id IS UNIQUE;

CREATE CONSTRAINT product_id IF NOT EXISTS
FOR (p:Product)
REQUIRE p.product_id IS UNIQUE;

MATCH (u:User {user_id: 501})-[:PLACED]->(o:Order)-[:CONTAINS]->(p:Product)
RETURN u.name AS user_name, o.order_id AS order_id, p.product_name AS product_name;

MATCH path = (m:Metric {metric_name: 'GMV'})-[:DEFINED_IN]->(d:Document)-[:MENTIONS]->(p:Product)-[:BELONGS_TO]->(c:Category)
RETURN
  m.metric_name AS metric,
  d.source_uri AS source_uri,
  p.product_name AS product,
  c.name AS category,
  length(path) AS hops;

MATCH path = (u:User {user_id: 501})-[:PLACED]->(:Order)-[:CONTAINS]->(:Product)<-[:MENTIONS]-(:Document)<-[:DEFINED_IN]-(m:Metric)
RETURN
  m.metric_name AS related_metric,
  [node IN nodes(path) | labels(node)[0] + ':' + coalesce(node.name, node.product_name, node.metric_name, node.source_uri, toString(node.order_id))] AS path_nodes
LIMIT 10;
