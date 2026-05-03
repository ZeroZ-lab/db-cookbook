# 第 7 章：批处理系统：Hive / Spark / Trino

批处理解决的是历史数据的大规模计算。

## 问题切入

它不追求每条数据毫秒级处理，而是关注在可接受的时间窗口内，把大量历史数据稳定、可重复、可调度地计算出来。

第 6 章解决了数据如何从 PostgreSQL 进入数仓和湖仓。但数据进入平台后，还要被持续加工：订单明细要清洗，支付和退款要对账，用户日汇总要生成，商品销量排行要重算，历史分区要回填。

当数据量还小时，这些任务可以在 PostgreSQL 或单机脚本中完成。但当历史数据进入 TB、PB 级，或者任务需要跨很多天、很多表、很多主题域运行时，单机数据库和简单脚本会遇到明显瓶颈：

```text
一次重算要扫描几年历史数据。
一个 JOIN 需要处理几十亿行明细。
每日任务失败后，需要按分区重跑。
一个上游维度变更，会影响大量下游汇总。
多个团队同时运行历史分析，资源需要统一调度。
```

这时需要的不是“更复杂的 SQL”，而是能组织海量文件、分布式计算、任务重跑和跨源查询的批处理体系。

## 核心判断

> 批处理回答的是：过去发生了什么，以及这些历史数据如何被加工成可分析、可复用的数据资产。

本章要建立的判断是：批处理系统解决的是大规模历史数据的稳定加工问题。它牺牲毫秒级实时性，换取高吞吐、可重跑、可调度、可追溯和适合大规模历史计算的能力。

批处理也不是所有问题的答案。它不适合强实时告警、在线交易、点查更新和低延迟交互应用。它更适合离线数仓、历史回算、特征批量生成、报表汇总和数据资产建设。

## 机制解释

### 7.1 Hive：离线数仓的 SQL 入口

Hive 的重要性不只在于 Hive SQL，而在于它把大规模文件存储包装成表的方式。

典型组件包括：

- Hive SQL。
- Hive Metastore。
- 内部表 / 外部表。
- 分区表 / 桶表。
- Parquet / ORC。
- HDFS / Object Storage。

Hive 让存储在 HDFS 或对象存储中的文件，可以被组织成表：

```text
database
  -> table
  -> partition
  -> file
```

分区表是 Hive 离线数仓的关键能力。例如按日期分区：

```text
ods_orders/dt=2026-04-01/
ods_orders/dt=2026-04-02/
```

查询某天数据时，只扫描对应分区。

Hive 的核心判断是：

> Hive 把文件系统上的大规模数据组织成 SQL 可查询的数仓表。

它不适合低延迟交互分析，但适合离线数仓、历史归档和大规模批处理。

### 7.2 Spark：大规模数据计算引擎

Spark 解决的是分布式计算问题。

它不仅能跑 SQL，也能处理复杂 ETL、机器学习预处理、数据清洗和批量特征计算。

核心概念包括：

- Spark Core。
- Spark SQL。
- DataFrame / Dataset。
- Driver / Executor。
- Partition。
- Job / Stage / Task。
- Shuffle。
- Cache。
- Broadcast Join。
- Sort Merge Join。
- AQE。

Spark 的执行可以粗略理解为：

```text
用户提交任务
  -> Driver 生成执行计划
  -> 拆成 Job / Stage / Task
  -> Executor 并行处理数据分区
  -> Shuffle 重新分布数据
  -> 输出结果
```

Spark 的关键难点是 Shuffle。

当数据需要按 key 重新分组、聚合或 JOIN 时，数据会跨节点移动。Shuffle 通常意味着网络、磁盘、序列化、排序和内存压力。

所以 Spark SQL 优化不是只看 SQL 写法，还要看：

```text
数据分区是否合理
JOIN 两边数据量多大
是否可以广播小表
是否发生数据倾斜
是否反复读取相同数据
文件数量是否过多
```

Spark 的核心判断是：

> Spark 把单机无法舒适完成的大规模历史计算，拆成分布式任务并行执行。

### 7.3 Trino / Presto：跨源交互式分析

Trino 和 Presto 的核心定位是分布式 SQL 查询引擎。

它们通过 Connector 连接不同数据源：

- Hive。
- Iceberg。
- PostgreSQL。
- MySQL。
- Kafka。
- Elasticsearch。
- 其他对象存储或数据系统。

核心组件包括：

- Coordinator。
- Worker。
- Catalog。
- Schema。
- Connector。

Trino 的价值在于跨源查询和交互式分析：

```sql
SELECT
    u.channel,
    SUM(o.total_amount) AS gmv
FROM postgresql.sales.orders o
JOIN hive.dim.dim_user u
    ON o.user_id = u.user_id
GROUP BY u.channel;
```

这类能力让分析人员可以通过统一 SQL 查询多个系统。

但跨源查询也有边界。数据下推、网络传输、源系统压力、JOIN 数据量、权限一致性，都会影响可用性。

Trino 的核心判断是：

> Trino 不是存储系统，而是把多个数据源统一到 SQL 查询层的分析引擎。

### 批处理与 PostgreSQL 的差异

PostgreSQL 适合业务库和中小规模分析。

批处理系统适合大规模历史数据加工。

差异包括：

| 维度 | PostgreSQL | Hive / Spark / Trino |
| --- | --- | --- |
| 主要任务 | 业务交易、中小查询 | 大规模历史计算、跨源分析 |
| 存储形态 | 数据库内部存储 | HDFS / Object Storage / 表格式 |
| 计算方式 | 单机为主 | 分布式 |
| 查询延迟 | 低延迟短查询 | 批量或交互式分析 |
| 典型数据 | 当前业务数据 | 历史明细、数仓、湖仓 |

## 系统位置

批处理位于数据平台的离线计算层。

```text
PostgreSQL / 日志 / 外部文件
  -> ETL / CDC
  -> ODS / Lake
  -> Hive Metastore / 表格式
  -> Spark / Hive SQL 批量加工
  -> DWD / DWS / ADS
  -> Trino / BI / 特征平台 / AI 数据准备
```

它承接第 6 章的数据链路，负责把进入平台的数据加工成可复用资产。它也为后续章节做铺垫：第 8 章实时处理解决“不能等到明天”的问题，第 9 章 OLAP 数据库解决“结果如何被快速查询”的问题，第 12 章湖仓把批处理和多引擎访问建立在开放表格式之上。

从 PostgreSQL 视角看，批处理不是替代业务库，而是把业务库不适合长期承担的历史扫描、跨域 JOIN、全量回算和特征批量生成转移到分布式分析体系。

## 场景案例

假设经营看板每天早上 8 点前要展示昨天的销售指标。

批处理链路可以设计为：

```text
00:30 同步 PostgreSQL orders / order_items / payments 到 ODS 分区
01:00 清洗生成 dwd_order_payment_detail
02:00 关联 dim_user / dim_product / dim_channel
03:00 生成 dws_product_daily、dws_channel_daily、dws_user_daily
04:00 生成 ads_sales_dashboard
05:00 运行质量检查和对账
08:00 BI 看板展示
```

这个链路有几个关键判断：

- ODS 按业务日期或同步日期分区，方便重跑和追溯。
- DWD 明确订单支付明细的一行粒度，避免 JOIN 后重复计算。
- DWS 沉淀公共汇总，避免每个报表重复扫描明细。
- ADS 面向具体看板，允许为展示便利做冗余。
- 如果某天任务失败，可以只重跑受影响分区，而不是重算全部历史。

批处理的价值就在这里：它把复杂历史加工变成可调度、可重跑、可检查的工程流程。

## 常见误区

**误区一：Hive、Spark、Trino 都是同一种东西。**

Hive 更像离线数仓 SQL 和元数据体系，Spark 是通用分布式计算引擎，Trino 是跨源交互式 SQL 查询引擎。

**误区二：Spark 一定比 PostgreSQL 快。**

小数据、点查、事务查询，PostgreSQL 更合适。Spark 的优势在大规模并行计算，不在所有查询都快。

**误区三：批处理只要能跑完就行。**

批处理还要支持依赖、重跑、幂等、质量校验、资源成本和产物可追溯。

**误区四：分布式计算一定比单机快。**

小数据、点查、短查询和强事务场景下，分布式系统的调度、网络和 Shuffle 成本可能反而更高。批处理的优势在大规模历史吞吐，不在所有查询延迟。

**误区五：能跨源查询就可以随意 JOIN。**

Trino 可以连接多个系统，但跨源 JOIN 可能造成大量网络传输和源库压力。跨源查询适合探索和轻量联邦分析，稳定报表通常仍应沉淀到数仓或湖仓模型中。

## 实战任务

设计一个每日订单数仓批处理任务：

```text
PostgreSQL orders / order_items / payments
  -> ODS
  -> DWD 订单明细
  -> DWS 商品日汇总
  -> ADS 销售看板
```

要求说明：

- 哪些数据按天分区。
- 哪些任务可以重跑。
- 哪些 JOIN 可能产生 Shuffle。
- 哪些维度表适合广播。
- 输出哪些质量检查。

补充要求：

- 画出任务 DAG。
- 指出每个任务输入分区和输出分区。
- 说明如果 `dim_product` 修正了历史类目，哪些 DWS / ADS 表需要回填。
- 设计至少 3 个质量检查，例如行数波动、主键唯一、金额对账。
- 估算最容易发生 Shuffle 的步骤，并说明如何优化。

示例 DAG：

```text
ods_orders
  -> dwd_order_payment_detail
ods_order_items
  -> dwd_order_payment_detail
ods_payments
  -> dwd_order_payment_detail
dim_product
  -> dws_product_daily
dwd_order_payment_detail
  -> dws_product_daily
  -> dws_channel_daily
  -> ads_sales_dashboard
```

## 小结引出下一章

批处理系统让数据平台能够稳定加工大规模历史数据。

Hive 组织离线数仓表，Spark 执行大规模计算，Trino 提供跨源交互式查询。

下一章进入实时数据处理。

因为很多业务问题不能等到明天再回答，它们需要在事件发生时就被捕获、计算和展示。
