# 路径查询结果模板

## 查询环境

| 维度 | 值 |
| --- | --- |
| 图数据库 | [Neo4j / NebulaGraph] |
| 版本 | [待填写] |
| 节点数 | [待填写] |
| 边数 | [待填写] |

## 查询 1：一跳路径（用户 -> 订单）

```cypher
-- Neo4j
MATCH (u:User)-[r:PLACED]->(o:Order)
WHERE u.name = 'Alice'
RETURN u.name, o.order_id, o.total_amount, o.created_at
ORDER BY o.created_at DESC;
```

| user_name | order_id | total_amount | created_at |
| --- | --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 2：两跳路径（用户 -> 订单 -> 商品）

```cypher
-- Neo4j
MATCH (u:User)-[:PLACED]->(o:Order)-[:CONTAINS]->(p:Product)
WHERE u.name = 'Alice'
RETURN u.name, o.order_id, p.product_name, p.category
ORDER BY o.order_id;
```

| user_name | order_id | product_name | category |
| --- | --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 3：多跳路径（用户 -> 订单 -> 商品 -> 品类）

```cypher
-- Neo4j
MATCH path = (u:User)-[:PLACED]->(o:Order)-[:CONTAINS]->(p:Product)-[:BELONGS_TO]->(c:Category)
WHERE u.name = 'Alice'
RETURN u.name, o.order_id, p.product_name, c.name AS category,
       length(path) AS hops
ORDER BY o.order_id;
```

| user_name | order_id | product_name | category | hops |
| --- | --- | --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 4：最短路径

```cypher
-- Neo4j: 找到两个用户之间的最短路径
MATCH path = shortestPath(
  (u1:User)-[*]-(u2:User)
)
WHERE u1.name = 'Alice' AND u2.name = 'Bob'
RETURN u1.name, u2.name, length(path) AS hops,
       [n IN nodes(path) | labels(n)] AS node_types;
```

| user_a | user_b | hops | node_types |
| --- | --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 5：所有路径（NebulaGraph）

```ngql
-- NebulaGraph
LOOKUP ON User WHERE User.name == 'Alice' YIELD id(vertex) AS id |
GO FROM $-.id OVER PLACED YIELD dst(edge) AS order_id |
GO FROM $-.order_id OVER CONTAINS YIELD dst(edge) AS product_id |
GO FROM $-.product_id OVER BELONGS_TO YIELD properties($$).name AS category;
```

| category |
| --- |
| [待运行时验证] |

## 结果验证

| 验证项 | 预期 | 实际 | 状态 |
| --- | --- | --- | --- |
| 一跳路径正确 | 用户 -> 订单关系存在 | [待运行时验证] | [待运行时验证] |
| 两跳路径正确 | 用户 -> 订单 -> 商品关系存在 | [待运行时验证] | [待运行时验证] |
| 多跳路径正确 | 完整路径可追溯 | [待运行时验证] | [待运行时验证] |
| 最短路径合理 | 跳数符合预期 | [待运行时验证] | [待运行时验证] |

**注意**：以上查询结果需要在真实 Neo4j 或 NebulaGraph 环境中执行，当前环境未安装。
