# 项目 5 交付物：RAG 向量知识库

## 架构产物

- [x] 画出文档解析、Chunk、Embedding、向量库、重排、LLM 的链路：`docs/architecture.md`。
- [x] 标出权限过滤和元数据过滤的位置：`docs/architecture.md`。
- [x] 标出检索日志和评测集的位置：`docs/architecture.md`。

## 数据模型产物

- [x] `documents` 表设计：`schema/pgvector.sql`。
- [x] `chunks` 表设计：`schema/pgvector.sql`。
- [x] `embeddings` 表设计：`schema/pgvector.sql`。
- [x] `retrieval_logs` 和 `evaluations` 表设计：`schema/pgvector.sql`。

## 核心任务产物

- [x] 文档解析规则：`docs/document-parsing-rules.md`。
- [x] Chunk 策略：`docs/chunking-and-versioning.md`。
- [x] Embedding 版本记录：`schema/pgvector.sql` 和 `docs/chunking-and-versioning.md`。
- [x] 检索和重排策略：`queries/retrieve-with-permission.sql` 和 `reports/retrieval-log-template.md`。
- [x] RAG 评测样例：`evals/rag-eval-sample.json`。

## 验证证据

- [x] 文档到 chunk 的追溯记录：`schema/pgvector.sql`。
- [x] 向量检索结果记录：`reports/retrieval-log-template.md`。
- [x] 权限过滤测试记录：`docs/permission-boundary.md`。
- [x] 本地静态运行入口：`run.sh`。
- [x] 运行记录模板：`reports/run-record-template.md`。
- [x] RAG 评测结果模板：`reports/rag-eval-result-template.md`。

## 复盘记录

- 召回失败的原因：
- 权限过滤的风险：
- pgvector 与专门向量数据库的边界：
