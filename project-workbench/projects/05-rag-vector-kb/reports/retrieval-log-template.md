# RAG 检索记录模板

## 请求

- request_id：
- user_id：
- collection_id：
- query_text：
- allowed_scopes：
- embedding_model：
- embedding_version：

## 召回

| rank | chunk_id | document_id | source_uri | distance | permission_passed |
| --- | --- | --- | --- | --- | --- |
| 1 |  |  |  |  |  |
| 2 |  |  |  |  |  |
| 3 |  |  |  |  |  |

## 重排

| rank | chunk_id | rerank_score | reason |
| --- | --- | --- | --- |
| 1 |  |  |  |
| 2 |  |  |  |
| 3 |  |  |  |

## 评测

- 是否命中期望来源：
- 答案是否引用原文：
- 是否存在权限越界：
- 失败类型：召回失败 / 重排失败 / 生成失败 / 权限失败
