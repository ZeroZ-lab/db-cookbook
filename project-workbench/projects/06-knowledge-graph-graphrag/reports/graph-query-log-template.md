# 图查询记录模板

## 请求

- request_id：
- user_id：
- question：
- graph_version：
- permission_scope：

## 查询

| query_id | 引擎 | 查询文件 | 目的 |
| --- | --- | --- | --- |
| q1 | Neo4j | `queries/neo4j-paths.cypher` | 多跳路径查询 |
| q2 | NebulaGraph | `queries/nebulagraph-paths.ngql` | 分布式图路径查询 |

## 结果

| path_id | path | source | confidence | permission_passed |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## GraphRAG 拼接

- 使用的向量 chunk：
- 使用的图路径：
- 被过滤的路径：
- 最终上下文文件：

## 复盘

- 图路径是否补足了向量召回的关系缺口：
- 是否有路径置信度不足：
- 是否有权限或来源追溯风险：
