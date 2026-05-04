# 项目 5 架构链路图

## 系统架构

```text
文档源
  |
  |-- PDF / Markdown / HTML / 代码文件
  |
  v
文档解析层
  |
  |-- 按文件类型选择解析器
  |-- 提取文本、标题、表格、代码块
  |-- 保留文档结构元数据
  |
  v
Chunk 层
  |
  |-- 按语义边界切分（段落、章节）
  |-- 控制 chunk 大小（512-1024 tokens）
  |-- 保留 chunk 来源 URI 和位置
  |
  v
Embedding 层
  |
  |-- 调用 Embedding API（text-embedding-3-small 等）
  |-- 生成 1536 维向量
  |-- 记录 embedding 模型版本
  |
  v
pgvector 向量库
  |
  |-- rag.documents (文档元数据)
  |-- rag.chunks (文本块 + 来源)
  |-- rag.embeddings (向量 + 模型版本)
  |-- rag.retrieval_logs (检索日志)
  |-- rag.evaluations (评测记录)
  |
  v
检索层
  |
  |-- 权限过滤: visible_documents CTE
  |-- 向量检索: ORDER BY embedding <=> :query_embedding
  |-- 重排: 按相关性 + 权限 + 新鲜度综合排序
  |-- 日志: 记录每次检索的 query、结果、延迟
  |
  v
LLM 生成
  |
  |-- 拼接检索结果为上下文
  |-- 生成回答
  |-- 记录引用来源
```

## 权限过滤位置

### 检索前过滤

- 在向量检索前，先通过 `visible_documents` CTE 过滤可见文档
- 基于 `owner_id = :user_id` 或 `visibility = 'public'` 条件
- 避免向量检索返回无权限的文档

### 检索后校验

- 检索结果返回后，再次校验用户权限
- 防止因权限变更导致的越权访问
- 记录权限校验失败的检索日志

## 评测集位置

- `evals/rag-eval-sample.json`：包含问题、期望来源、期望答案
- 用于评估检索质量和回答准确性
- 评测结果记录到 `rag.evaluations` 表
