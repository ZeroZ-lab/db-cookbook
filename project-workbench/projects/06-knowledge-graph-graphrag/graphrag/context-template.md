# GraphRAG 上下文模板

## 用户问题

`{question}`

## 向量召回片段

| chunk_id | source_uri | score | 摘要 |
| --- | --- | --- | --- |
| `{chunk_id}` | `{source_uri}` | `{score}` | `{summary}` |

## 图路径证据

| path_id | path | source | confidence |
| --- | --- | --- | --- |
| `path-001` | `Metric:GMV -> DEFINED_IN -> Document:docs/metrics/gmv.md -> MENTIONS -> Product:Analytics Handbook` | `document_extraction` | `0.84 / 0.67` |
| `path-002` | `User:501 -> PLACED -> Order:10021 -> CONTAINS -> Product:Analytics Handbook` | `postgres.orders + postgres.order_items` | `1.0` |

## 生成约束

- 只使用通过权限过滤的 chunk 和图路径。
- 回答中必须引用 `source_uri` 或图路径证据。
- 如果向量证据和图路径冲突，标记为待核查，不直接合并。
- 图路径只说明关系存在，不自动证明指标口径正确。

## 输出格式

```text
答案：
依据：
- 文档证据：
- 图路径证据：
不确定性：
```
