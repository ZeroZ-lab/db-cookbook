# 项目 6 架构链路图

## 系统架构

```text
结构化数据 / 文档
  |
  |-- 订单数据、商品数据、用户行为
  |-- 文档、报告、知识库
  |
  v
实体抽取
  |
  |-- 从结构化数据提取实体（User, Product, Order, Category）
  |-- 从非结构化文本抽取命名实体
  |-- 实体去重和归一化
  |
  v
关系抽取
  |
  |-- 结构化关系：外键、业务关联
  |-- 文档关系：共现、因果、时序
  |-- 关系类型定义：PLACED, CONTAINS, BELONGS_TO, DEFINED_IN
  |
  v
图数据库
  |
  |-- Neo4j: Cypher 查询语言
  |-- NebulaGraph: nGQL 查询语言
  |-- 存储: 三元组 (subject, predicate, object)
  |-- 元数据: source, confidence, graph_version
  |
  v
图查询
  |
  |-- 一跳: 用户 -> 订单
  |-- 两跳: 用户 -> 订单 -> 商品
  |-- 多跳: 用户 -> 订单 -> 商品 -> 品类 -> 指标
  |-- 路径: 最短路径、所有路径
  |
  v
GraphRAG
  |
  |-- 向量召回: 语义相似的文本片段
  |-- 图路径证据: 实体关系链
  |-- 上下文拼接: 向量片段 + 图路径 + 来源标注
  |-- LLM 生成: 基于混合上下文的回答
```

## 实体、关系、路径和证据来源

### 实体来源

- `User`: 用户表
- `Product`: 商品表
- `Order`: 订单表
- `Metric`: 指标字典
- `Category`: 品类表

### 关系来源

- `PLACED`: 用户下单（orders 表）
- `CONTAINS`: 订单包含商品（order_items 表）
- `BELONGS_TO`: 商品属于品类（products 表）
- `DEFINED_IN`: 指标定义在文档中（指标字典）

### 证据来源

- 每个三元组都有 `source` 字段记录数据来源
- `confidence` 字段记录抽取置信度
- `graph_version` 字段记录图谱版本

## 图查询进入 RAG 上下文

1. 用户提问："Alice 买了什么？"
2. 向量检索：找到相关文档片段
3. 图查询：Alice -[PLACED]-> Order -[CONTAINS]-> Product
4. 上下文拼接：文档片段 + 图路径 + 来源
5. LLM 生成：基于混合上下文的回答
