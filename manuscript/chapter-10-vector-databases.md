# 第 10 章：向量数据库：面向 AI / RAG / 语义检索的数据系统

传统数据库擅长回答结构化问题。

## 问题切入

例如：

```text
订单金额大于 100 的记录
某个用户最近 20 笔订单
某天 GMV 总和
某类商品销量排行
```

但 AI 应用经常要回答另一类问题：

```text
哪些文档和这个问题语义相似？
哪些图片和这张图片相似？
哪些代码片段和这个需求相关？
哪些历史对话可以作为 Agent 记忆？
```

这些问题不是简单等值匹配，而是语义相似性检索。

第 9 章的 OLAP 数据库解决的是结构化分析查询：过滤、聚合、排序、分组和多维下钻。但 AI 应用经常面对的是文档、图片、代码、对话、网页、知识片段和操作记录。这些数据不一定能先被整理成整齐的行列，也不一定能通过关键词精确匹配找到。

一个企业知识库的真实问题通常不是：

```text
WHERE title = '报销制度'
```

而是：

```text
“出差打车超过预算还能报销吗？”
“客户合同里的自动续约条款在哪里？”
“这个报错和过去哪个工单最像？”
```

这些问题需要先把非结构化内容变成可检索的语义表示，再把检索结果和权限、来源、版本、上下文、评测结合起来。

## 核心判断

> 向量数据库不是传统数据库替代品，它解决的是非结构化数据进入 AI 应用后的语义检索问题。

本章要建立的判断是：向量数据库让“语义相似”成为一种可查询能力，但它只解决 RAG 和 AI 数据系统中的召回问题，不解决全部可信问题。

一个可用的 AI 数据系统不仅需要向量检索，还需要文档解析、分块、Embedding 版本、元数据、权限过滤、重排、上下文组装、检索日志、评测和治理。把向量数据库当成 AI 数据基础设施的全部，是最常见的误判。

## 机制解释

### 10.1 基础概念

Embedding 是把文本、图片、音频、代码等对象转换成向量的过程。

Vector 是一组数字，表示对象在语义空间中的位置。

Dimension 是向量维度。

Similarity Search 是相似性搜索。

Approximate Nearest Neighbor 是近似最近邻搜索，用一定精度换取更快检索。

Top-K 是返回最相似的 K 个结果。

Recall 表示相关结果被召回的比例。

Precision 表示召回结果中真正相关的比例。

Metadata Filter 是元数据过滤，例如只检索某个知识库、某个用户权限范围、某个文档类型。

Hybrid Search 是混合检索，把关键词、全文、向量和元数据过滤结合起来。

### 10.2 向量生成

向量数据库的第一步不是建库，而是生成向量。

典型 RAG 数据链路是：

```text
文档采集
  -> 文档解析
  -> Chunking
  -> Embedding
  -> 向量入库
```

Chunking 很关键。

如果 Chunk 太大，召回内容不精确；如果 Chunk 太小，语义不完整。Chunk 还需要保存来源、位置、标题、权限、版本和解析方式。

Embedding Model 决定向量空间。模型一旦变化，旧向量和新向量通常不能直接混用。

因此需要向量版本管理：

```text
embedding_model
embedding_version
chunk_version
index_version
```

核心判断是：

> 向量质量不是只由数据库决定，而是由文档解析、切分、模型、版本和索引共同决定。

### 10.3 相似度计算

常见相似度包括：

- Cosine Similarity。
- Dot Product。
- Euclidean Distance。
- Inner Product。

距离函数不是随便选的，它要和 Embedding 模型训练方式、向量是否归一化、数据库索引类型匹配。

相似度分数也不是业务答案。

向量检索只能告诉你“这些内容在向量空间里相近”，不保证事实正确、权限可见、上下文完整或答案可直接生成。

这就是为什么 RAG 系统还需要元数据过滤、重排、上下文组装和评测。

### 10.4 向量索引

小规模数据可以 Flat Index 全量比对。

大规模向量需要索引。

常见索引包括：

- HNSW。
- IVF。
- IVF_FLAT。
- IVF_PQ。
- DiskANN。
- Quantization。

索引带来典型取舍：

```text
召回率
  <-> 查询延迟
  <-> 内存成本
  <-> 构建时间
  <-> 更新成本
```

向量索引的核心判断是：

> 向量索引用精确度、资源和维护成本，换取大规模相似性检索的速度。

### 10.5 向量数据库产品定位

常见系统包括：

- Milvus / Zilliz Cloud。
- Qdrant。
- Weaviate。
- Pinecone。
- Chroma。
- FAISS。
- pgvector。
- Elasticsearch Vector Search。
- OpenSearch Vector。

它们不是同一类使用边界。

FAISS 更像向量检索库，适合嵌入到应用或离线流程中。

Chroma 适合轻量本地和原型。

pgvector 适合中小规模 RAG、元数据和权限与向量共存的场景。

Milvus、Qdrant、Weaviate、Pinecone 更偏专门向量数据库或服务，适合更大规模、更专门的向量检索需求。

### 10.6 PostgreSQL 与向量数据库

PostgreSQL 通过 pgvector 可以保存向量并进行相似性检索。

它适合：

- 中小规模 RAG。
- 元数据与向量共存。
- 权限过滤和向量检索结合。
- 早期产品原型。
- 企业内部知识库起步阶段。

例如一张 `chunks` 表：

```text
chunks
├── chunk_id
├── document_id
├── collection_id
├── content
├── embedding
├── metadata
├── acl_scope
├── chunk_version
└── embedding_version
```

PostgreSQL 的优势是结构化控制强：权限、元数据、事务、版本和业务字段可以放在一起。

但当向量规模、并发、索引更新、分布式检索和多租户隔离要求上升时，专门向量数据库更合适。

核心判断是：

> pgvector 是 PostgreSQL 通向 AI 数据系统的桥梁，但不是所有向量检索规模的终点。

### 10.7 RAG 数据链路

完整 RAG 链路是：

```text
文档采集
  -> 文档解析
  -> Chunking
  -> Embedding
  -> 向量入库
  -> Query Embedding
  -> Vector Search
  -> Metadata Filter
  -> Rerank
  -> Context Assembly
  -> LLM Generation
  -> Evaluation
```

每一步都会影响答案质量。

文档解析错误，后面检索再快也没用。

Chunk 切分不合理，召回上下文会碎。

Embedding 模型不适合领域，语义相似性会偏。

没有权限过滤，可能泄露数据。

没有评测，系统无法判断改动是否变好。

### 10.8 混合检索

向量检索擅长语义相似，但不擅长所有问题。

关键词检索擅长精确词匹配。

全文检索和 BM25 擅长词项相关性。

元数据过滤控制范围。

Reranking 对候选结果重新排序。

混合检索的目标是结合这些能力：

```text
Metadata Filter
  -> BM25 / Keyword Search
  -> Vector Search
  -> Score Fusion
  -> Rerank
  -> Context Assembly
```

核心判断是：

> 高质量 RAG 很少只靠单一路径召回，通常需要关键词、向量、元数据和重排协同。

### 10.9 向量数据库在大数据体系中的位置

向量数据库不是孤岛。

它通常和这些系统协同：

- PostgreSQL 保存元数据、权限、任务状态。
- 对象存储保存原始文件。
- Spark 处理大规模离线 Embedding。
- Kafka / Flink 处理实时向量更新。
- 数据湖保存文档和中间产物。
- LLM / Agent 使用检索结果生成答案。
- 数据治理系统记录版本、血缘、权限和评测。

## 系统位置

向量数据库是 AI 数据基础设施中的语义检索层。

```text
原始文档 / 网页 / 代码 / 对话 / 图片
  -> 采集与解析
  -> Chunking
  -> Embedding
  -> Vector DB / pgvector
  -> Hybrid Search / Rerank
  -> Context Assembly
  -> LLM / Agent
  -> Retrieval Logs / Evaluation / Governance
```

它继承前面章节的数据平台能力：对象存储保存原文，PostgreSQL 保存元数据和权限，批处理负责大规模离线 Embedding，实时链路负责增量更新，治理系统负责版本、血缘、质量和访问控制。

它也引出第 11 章图数据库：向量检索擅长找“语义相似”的内容，但不擅长表达实体之间的显式关系、路径、多跳推理和关系约束。知识图谱和图数据库会补足这部分能力。

## 场景案例

设计一个企业制度 RAG 知识库时，可以把数据模型拆成几类表和存储：

```text
object_storage
  原始 PDF / DOCX / HTML 文件

documents
  一行一个文档，记录来源、标题、部门、版本、权限、解析状态

chunks
  一行一个文本块，记录 document_id、章节位置、chunk 文本、chunk_version

embeddings
  一行一个向量，记录 chunk_id、embedding_model、embedding_version、vector

retrieval_logs
  一行一次检索，记录 query、过滤条件、召回结果、点击、反馈

evaluations
  一行一个评测样本，记录问题、标准答案、期望来源、实际召回和评分
```

用户提问“出差打车超过预算还能报销吗？”时，链路不应只做向量 Top-K：

```text
Query
  -> 判断用户权限和所在部门
  -> 关键词 + 向量混合召回
  -> 过滤过期制度和不可见文档
  -> Rerank
  -> 组装带来源和章节位置的上下文
  -> LLM 生成答案
  -> 记录检索日志和用户反馈
```

这个案例说明：向量数据库是关键组件，但答案质量来自整条 RAG 数据链路，而不是单次相似度检索。

## 常见误区

**误区一：向量数据库可以替代关系型数据库。**

向量库解决相似性检索，不解决强事务、复杂关系建模、指标分析和完整数据治理。

**误区二：Embedding 后就能问答。**

RAG 还需要解析、切分、检索、过滤、重排、上下文组装、生成和评测。

**误区三：召回分数高就一定答案正确。**

相似不等于事实正确，也不等于权限可见或上下文完整。

**误区四：只要换更强的 Embedding 模型，RAG 就一定变好。**

模型很重要，但文档解析、Chunk 策略、元数据、权限、混合检索、重排和评测同样会决定结果。模型变化还可能要求全量重算向量。

**误区五：向量库里只需要保存向量。**

真实系统必须保存来源、版本、权限、租户、文档结构、时间、解析状态和检索日志。没有这些元数据，检索结果无法治理、无法追溯、无法安全使用。

## 实战任务

设计一个 RAG 知识库数据模型：

```text
documents
chunks
embeddings
collections
retrieval_logs
evaluations
```

要求说明：

- 每张表一行代表什么。
- 原始文档保存在哪里。
- Chunk 如何关联文档。
- Embedding 如何记录模型版本。
- 检索日志如何用于评测。
- 权限过滤如何进入检索。

补充要求：

- 设计 `documents`、`chunks`、`embeddings` 的主键和外键关系。
- 为 `embedding_model`、`embedding_version`、`chunk_version` 设计升级策略。
- 说明如何处理文档删除、文档更新和权限变化。
- 设计一次 RAG 评测：至少包含 10 个问题、标准来源、期望召回 chunk、答案评分规则。
- 对比 pgvector 和专门向量数据库在这个场景中的边界。

## 小结引出下一章

向量数据库让语义相似性成为可查询对象。

它把非结构化数据接入 AI 应用，但它必须和元数据、权限、对象存储、评测、数据链路和治理协同。

下一章进入图数据库。

因为除了语义相似，AI 和数据分析还经常需要理解实体之间的关系网络。
