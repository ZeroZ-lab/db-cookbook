# 项目 5 运行记录模板

## 环境

- PostgreSQL 版本：
- pgvector 版本：
- Embedding 模型：
- Embedding 维度：
- Rerank 模型：

## 静态检查

```bash
project-workbench/projects/05-rag-vector-kb/run.sh
```

- 检查结果：
- 未验证运行时：

## Schema 执行

- SQL 文件：`schema/pgvector.sql`
- `CREATE EXTENSION vector` 结果：
- 表创建结果：
- HNSW 索引创建结果：

## 检索执行

- 查询文件：`queries/retrieve-with-permission.sql`
- 用户：
- 权限过滤条件：
- Top K：
- 检索耗时：
- 召回 chunk IDs：

## RAG 评测

| question | expected_source_uri | source_hit | answer_passed | notes |
| --- | --- | --- | --- | --- |
|  |  |  |  |  |

## 权限边界

- 检索前过滤是否生效：
- 检索后校验是否生效：
- 是否发现越权候选：

## 结论

- 本次是否只是静态检查：
- 本次是否真实执行 pgvector 检索：
- 本次是否真实执行 RAG 评测：
