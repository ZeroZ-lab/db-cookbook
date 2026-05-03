# 跨 SQL、向量、图的权限策略

| policy_id | 主体 | 资源 | 动作 | 决策 | 执行位置 | 漏检风险 |
| --- | --- | --- | --- | --- | --- | --- |
| `policy_sql_orders_read_analytics` | `role:analytics` | `postgres.public.orders` | read | allow | SQL 网关 / 数据库角色 | 绕过网关直连数据库 |
| `policy_vector_docs_security` | `role:security` | `rag.collection.security` | retrieve | allow | 检索前过滤 + 重排后校验 | chunk 元数据错误 |
| `policy_graph_paths_pii` | `role:analytics` | `graph.User` | traverse | deny | 图查询服务 | 路径中间节点泄漏 PII |
| `policy_ai_eval_admin` | `role:ai-platform` | `governance.ai_evaluations` | write | allow | 治理 API | 评测集被非授权人员篡改 |

## 边界

- SQL 权限不自动覆盖向量库和图数据库。
- 向量检索权限必须覆盖候选召回和最终上下文拼接。
- 图权限必须考虑路径上的中间节点，而不只是起点和终点。
- AI 评测数据本身也是治理对象，不能被任意修改。
