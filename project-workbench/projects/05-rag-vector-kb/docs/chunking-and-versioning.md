# Chunk 与 Embedding 版本策略

## Chunk 策略

- 每个 chunk 必须记录 `document_id`、`chunk_index`、`start_offset`、`end_offset` 和 `source_uri`。
- `chunk_index` 在同一文档版本内必须稳定，方便重跑和对账。
- chunk 大小优先围绕语义段落切分，再控制 token 数上限。
- 表格、代码块和指标定义不应被随意拆断。

## Embedding 版本

- `embedding_model` 记录模型名称。
- `embedding_version` 记录模型版本、维度和生成参数。
- 模型版本变化后，不能把新旧向量混在同一个检索空间里直接比较。
- 如果不能一次性重算全部 embedding，需要为新旧版本分别建索引并记录兼容策略。

## 边界

- Chunk 解决的是可追溯的文本切片，不解决答案真实性。
- Embedding 解决的是语义相似召回，不解决权限、事实校验和最终生成质量。
- RAG 评测必须区分召回失败、重排失败和生成失败。
