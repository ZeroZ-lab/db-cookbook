# 项目 5：RAG 向量知识库

## 目标

理解文档、Chunk、Embedding、向量检索、元数据过滤、重排和 RAG 评测如何组成 AI 数据应用链路。

## 系统位置

```text
Document
  -> Parse
  -> Chunk
  -> Embed
  -> pgvector / Milvus / Qdrant
  -> Retrieve / Rerank
  -> LLM Answer
```

## 数据模型

- `documents`：文档元数据、权限和版本。
- `chunks`：切片文本、位置和来源。
- `embeddings`：向量、模型版本和索引版本。
- `retrieval_logs`：召回结果、过滤条件和评分。
- `evaluations`：问题、期望答案和评测结果。
- pgvector schema 见 `schema/pgvector.sql`。
- 权限过滤检索 SQL 见 `queries/retrieve-with-permission.sql`。
- RAG 评测集样例见 `evals/rag-eval-sample.json`。
- Chunk 与版本策略见 `docs/chunking-and-versioning.md`。
- 权限边界见 `docs/permission-boundary.md`。

## 核心链路

- 解析文档并生成稳定 chunk。
- 保存 embedding 模型版本。
- 在检索前应用权限和元数据过滤。
- 记录每次召回和重排结果。
- 用小型评测集检查召回质量。

## 验收指标

- [ ] 有文档、chunk、embedding 三层模型。
- [ ] 有权限过滤字段。
- [ ] 有检索日志表。
- [ ] 有 RAG 评测集样例。
- [ ] 能解释 pgvector 与专门向量数据库的边界。

## 运行命令

```bash
pnpm projects:verify
```

如果本机有 PostgreSQL 和 pgvector，可先执行 `schema/pgvector.sql`，再按 `queries/retrieve-with-permission.sql` 的参数约定测试检索。本项目当前先提供可检查产物，不声称本仓库环境已端到端运行。

## 质量检查

- 检索结果必须能追溯回原文位置。
- 模型版本变化必须触发重新 embedding 或兼容性说明。
- 权限过滤必须在候选召回前和重排后都能说明。

## 复盘问题

- RAG 的失败是召回失败、重排失败还是生成失败？
- 权限过滤应该发生在向量检索前、检索后，还是两者都需要？
