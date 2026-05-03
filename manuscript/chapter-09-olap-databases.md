# 第 9 章：OLAP 数据库：ClickHouse / Doris / DuckDB

OLAP 数据库面向高性能分析。

## 问题切入

它们的设计目标不是替代 PostgreSQL 的业务事务能力，而是更高效地处理大范围扫描、聚合、排序、多维分析和报表查询。

第 7 章说明了历史数据如何通过批处理生成 DWD、DWS、ADS。第 8 章说明了实时事件如何通过 Kafka 和 Flink 生成实时指标。但无论数据来自批处理还是实时流，最终都会遇到一个问题：这些结果要被人和应用高频查询。

典型需求包括：

```text
BI 看板秒级打开最近 90 天 GMV 趋势。
运营按渠道、地区、类目、用户等级自由下钻。
实时大盘每分钟刷新订单数和支付金额。
日志分析要在几十亿行中快速过滤错误事件。
数据科学家想在本地直接分析 Parquet 文件。
```

这些查询和 PostgreSQL 的业务点查不同，也和 Spark 批处理不同。它们需要在大量历史或近实时数据上做低延迟分析，于是需要专门面向分析查询优化的 OLAP 数据库。

## 核心判断

> OLAP 数据库的核心，是用列式存储、压缩、排序、预聚合和分布式执行，为分析查询优化。

本章要建立的判断是：OLAP 数据库不是“更快的 PostgreSQL”，而是面向分析负载重新设计的查询系统。它通过列式存储、排序键、压缩、分区、向量化执行、MPP 或本地嵌入式执行，让大范围扫描和聚合更高效。

OLAP 数据库也不是数仓建模、ETL、治理和事务系统的替代品。它负责承载分析查询，但指标口径、数据质量、血缘、权限、更新语义和源系统一致性仍然需要完整数据平台来保证。

## 机制解释

### 9.1 为什么列式存储适合分析

业务查询经常需要读取一整行。

分析查询经常只需要少数列，但要扫描大量行。

例如统计 GMV：

```sql
SELECT
    date(created_at) AS dt,
    SUM(total_amount) AS gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);
```

这个查询主要需要：

```text
created_at
total_amount
order_status
```

如果表有 100 个字段，行存会读取大量不需要的列。列存只读取相关列，因此更适合扫描和聚合。

列式存储还更容易压缩，因为同一列的数据类型和分布更一致。

### 9.2 ClickHouse

ClickHouse 是高性能列式 OLAP 数据库。

核心概念包括：

- 列式存储。
- MergeTree。
- 分区 Partition。
- 排序键 `ORDER BY`。
- 主键 Primary Key。
- 稀疏索引。
- 数据压缩。
- 物化视图。
- 聚合函数。
- ReplacingMergeTree。
- SummingMergeTree。
- AggregatingMergeTree。
- 分布式表。
- 大宽表建模。

ClickHouse 中最重要的是 MergeTree 系列表引擎。

一个常见表设计：

```sql
CREATE TABLE orders_olap
(
    order_id String,
    user_id String,
    order_status String,
    total_amount Decimal(18, 2),
    created_at DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(created_at)
ORDER BY (user_id, created_at);
```

这里 Partition 解决数据管理和分区裁剪，`ORDER BY` 解决数据排序和稀疏索引访问路径。

ClickHouse 的核心判断是：

> ClickHouse 快，不只是因为列存，而是列存、排序、压缩、稀疏索引、向量化执行和表引擎共同作用。

它适合日志分析、行为分析、实时看板、宽表分析和高并发聚合查询。

它不适合替代强事务业务库。

### 9.3 Apache Doris

Doris 是面向实时数仓和 BI 的 MPP 分析数据库。

核心概念包括：

- FE / BE。
- MPP 架构。
- 明细模型。
- 聚合模型。
- 主键模型。
- Duplicate Key。
- Aggregate Key。
- Unique Key。
- 物化视图。
- 数据导入。
- 冷热分层。
- 实时数仓。

Doris 的表模型强调分析场景。

Duplicate Key 适合保留明细。

Aggregate Key 适合写入时聚合。

Unique Key 适合更新型场景。

Doris 的核心判断是：

> Doris 把数据导入、表模型、MPP 查询和实时数仓能力整合到一个面向 BI 的分析系统中。

它适合实时数仓、报表平台、交互分析和统一分析服务。

### 9.4 DuckDB

DuckDB 是本地嵌入式 OLAP 数据库。

它不像 ClickHouse 和 Doris 那样主要面向服务化集群，而是适合本地分析、数据科学和嵌入式场景。

核心能力包括：

- 本地 OLAP。
- 嵌入式分析。
- Parquet 查询。
- Python 集成。
- 单机高性能。
- 数据科学。
- AI 数据预处理。

例如直接查询 Parquet：

```sql
SELECT
    category,
    SUM(amount) AS gmv
FROM read_parquet('orders.parquet')
GROUP BY category;
```

DuckDB 的核心判断是：

> DuckDB 让本地文件、Notebook、Python 和分析 SQL 之间的距离变得很短。

它特别适合开发、探索、数据科学预处理、小型离线分析和 AI 数据准备。

### 9.5 PostgreSQL 到 OLAP 的分析链路

典型链路是：

```text
PostgreSQL
  -> ETL / CDC
  -> ClickHouse / Doris
  -> BI / Dashboard
```

在这条链路中：

- PostgreSQL 负责业务写入。
- ETL / CDC 负责同步。
- OLAP 数据库负责分析查询。
- BI 负责展示和交互。

设计时要注意：

```text
源表主键如何映射？
更新和删除如何处理？
是否保留明细？
是否构建宽表？
是否预聚合？
实时性要求多高？
指标口径在哪里定义？
```

## 系统位置

OLAP 数据库位于数据平台的分析服务层。

```text
PostgreSQL / Kafka / Files
  -> ETL / CDC / Flink / Spark
  -> 明细表 / 宽表 / 汇总表
  -> ClickHouse / Doris / DuckDB
  -> BI / Dashboard / Ad hoc SQL / 数据应用
```

它承接第 7 章和第 8 章的计算结果：批处理生成的历史汇总、实时处理生成的近实时指标，都需要一个查询层服务用户。它也引出第 10 章向量数据库：当查询对象从结构化字段、指标和维度扩展到文本语义、图片语义和知识片段时，传统 OLAP 的过滤聚合能力就不够，需要相似度检索和向量索引。

选型时要先看场景：

| 场景 | 更常见选择 | 判断原因 |
| --- | --- | --- |
| 高并发实时看板、日志分析 | ClickHouse | 列式、MergeTree、宽表和高吞吐聚合能力强 |
| 实时数仓、BI 服务、更新型分析 | Doris | MPP、表模型和 BI 场景整合度高 |
| 本地文件分析、Notebook、数据科学预处理 | DuckDB | 嵌入式、本地高性能、直接查询 Parquet |
| 大规模离线回算 | Spark / Hive | 更适合批量计算，不是交互查询层 |
| 强事务业务写入 | PostgreSQL | OLTP 一致性和事务能力更合适 |

## 场景案例

一个订单分析平台可以这样设计：

```text
PostgreSQL orders / order_items / payments
  -> CDC 或批量同步
  -> dwd_order_payment_detail
  -> ClickHouse orders_wide
  -> daily_order_metrics 物化视图 / 汇总表
  -> BI Dashboard
```

ClickHouse 明细宽表可以围绕查询模式设计：

```sql
CREATE TABLE orders_wide
(
    order_id String,
    user_id String,
    channel String,
    category String,
    order_status String,
    total_amount Decimal(18, 2),
    paid_at DateTime
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(paid_at)
ORDER BY (channel, category, paid_at, user_id);
```

这个表设计表达了几个判断：

- `PARTITION BY toYYYYMM(paid_at)` 方便按月管理和裁剪历史数据。
- `ORDER BY (channel, category, paid_at, user_id)` 服务常见渠道、类目、时间范围分析。
- 宽表牺牲一定冗余，换取 BI 查询便利。
- 如果订单状态会更新，必须设计更新和去重策略，不能只把 append-only 日志当最终事实。

同一个场景如果是本地探索，可以先把 DWD 明细导出为 Parquet，用 DuckDB 在 Notebook 中快速验证分析逻辑；如果是企业 BI 平台，可以选择 Doris 承载高并发查询和更新型实时数仓。

## 常见误区

**误区一：OLAP 数据库越快越好，业务库可以不要。**

OLAP 快在分析，不代表适合强事务写入和复杂业务一致性。

**误区二：ClickHouse 有物化视图，就不需要数仓。**

物化视图是计算机制，数仓还包括分层、口径、质量、血缘、权限和治理。

**误区三：DuckDB 只是玩具。**

DuckDB 不适合替代服务化数仓，但在本地 OLAP、数据科学和文件分析中非常实用。

**误区四：把所有字段做成大宽表就万事大吉。**

宽表能提升查询便利性，但会带来冗余、更新困难、口径固化和存储成本。公共明细、汇总表和应用宽表要有边界。

**误区五：OLAP 查询快就代表数据可信。**

查询速度和数据可信是两件事。OLAP 数据库可以很快返回错误口径、重复数据或未治理字段。可信仍依赖建模、质量、血缘和权限。

## 实战任务

设计 PostgreSQL 到 ClickHouse 的订单分析链路。

要求：

1. 选择同步方式：批量还是 CDC。
2. 设计 ClickHouse 明细表。
3. 选择分区键。
4. 选择排序键。
5. 设计每日 GMV 物化视图或汇总表。
6. 说明更新和删除如何处理。
7. 说明哪些查询留在 PostgreSQL，哪些查询进入 ClickHouse。

补充要求：

- 列出 5 条目标查询，并用它们反推分区键、排序键和宽表字段。
- 对比 ClickHouse 明细宽表、Doris 主键模型、DuckDB 本地 Parquet 分析三种方案。
- 说明物化视图或汇总表的刷新策略。
- 设计一条对账规则：ClickHouse 每日 GMV 与数仓 DWS 每日 GMV 差异超过阈值时告警。
- 说明哪些场景不能迁入 OLAP，例如订单创建、库存扣减、支付状态强一致更新。

## 小结引出下一章

OLAP 数据库承担高性能分析。

ClickHouse 强在列式高性能和表引擎，Doris 强在实时数仓和 BI 场景，DuckDB 强在本地嵌入式分析。

下一章进入向量数据库。

因为 AI 时代的数据查询不再只有结构化过滤和聚合，还需要基于语义相似性的检索能力。
