# 实体与关系类型清单

## 实体类型

| 类型 | 含义 | 来源 | 关键属性 |
| --- | --- | --- | --- |
| `User` | 用户 | PostgreSQL `users` / 文档抽取 | `user_id`, `name`, `channel`, `user_level` |
| `Product` | 商品 | PostgreSQL `products` / 商品文档 | `product_id`, `product_name`, `category` |
| `Category` | 商品类目 | `products.category` | `name` |
| `Order` | 订单 | PostgreSQL `orders` | `order_id`, `order_status`, `created_at` |
| `Document` | 知识文档 | RAG 文档库 | `document_id`, `source_uri`, `document_version` |
| `Metric` | 指标 | 指标字典文档 | `metric_name`, `owner`, `version` |

## 关系类型

| 关系 | 方向 | 含义 | 来源 | 置信度 |
| --- | --- | --- | --- | --- |
| `(:User)-[:PLACED]->(:Order)` | 用户到订单 | 用户下单 | `orders.user_id` | 1.0 |
| `(:Order)-[:CONTAINS]->(:Product)` | 订单到商品 | 订单包含商品 | `order_items` | 1.0 |
| `(:Product)-[:BELONGS_TO]->(:Category)` | 商品到类目 | 商品归属类目 | `products.category` | 1.0 |
| `(:Metric)-[:DEFINED_IN]->(:Document)` | 指标到文档 | 指标口径来源 | 文档抽取 | 0.8 |
| `(:Document)-[:MENTIONS]->(:Product)` | 文档到商品 | 文档提到商品 | 文档抽取 | 0.6 |

## 边界

- 图谱表达的是关系结构，不替代 PostgreSQL 的事务事实。
- 文档抽取关系必须记录来源和置信度，不能和结构化事实混为一谈。
- GraphRAG 使用图路径补充上下文，不替代向量召回和权限校验。
