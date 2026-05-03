# 第 8 章：实时数据处理：Kafka / Flink

批处理回答过去发生了什么。

流处理回答正在发生什么。

## 问题切入

当订单支付、用户点击、库存变化、风控事件、设备日志不断产生时，数据平台不能总是等到第二天再处理。

第 7 章的批处理适合每日经营看板、历史回算和离线特征。但有些问题等不到 T+1：

```text
支付成功后，实时大盘多久能看到？
异常订单是否要在几秒内进入风控？
库存变化是否要马上同步到搜索和推荐？
用户刚完成一次点击，是否要进入实时画像？
Kafka 消费积压后，指标延迟如何被发现？
迟到事件到达后，窗口结果是否要修正？
```

这些问题的共同点是：数据不是以“每天一批文件”的形式出现，而是以持续事件流的形式出现。系统不再只处理有限历史数据，而要面对不断到来的无界数据。

## 核心判断

> 实时数据系统围绕事件流构建，核心问题是顺序、延迟、状态、容错和语义一致性。

本章要建立的判断是：实时数据处理不是“把批处理跑得更快”，而是围绕事件流、事件时间、状态、窗口、容错和端到端语义重新设计数据链路。

实时系统也不是越快越好。它的设计必须在延迟、准确性、成本、复杂度、可恢复性和结果修正之间取舍。很多业务只需要分钟级实时，不需要秒级甚至毫秒级实时。

## 机制解释

### 8.1 Kafka：事件流和数据总线

Kafka 是分布式事件流平台。

核心概念包括：

- Producer。
- Consumer。
- Broker。
- Topic。
- Partition。
- Offset。
- Consumer Group。
- Retention。
- Replication。
- ISR。
- Kafka Connect。
- Schema Registry。

Producer 写入消息，Consumer 消费消息，Broker 存储和分发消息。

Topic 是事件类别，Partition 让 Topic 可以并行写入和消费，Offset 表示消费者在分区中的读取位置。

例如订单变更事件可以进入：

```text
topic: order_events
```

消息可能是：

```json
{
  "order_id": "10001",
  "user_id": "501",
  "status": "paid",
  "event_time": "2026-04-01T10:31:20"
}
```

Kafka 的核心判断是：

> Kafka 把系统之间的直接调用，转化为可持久、可回放、可并行消费的事件流。

### 8.2 Kafka 在大数据链路中的角色

Kafka 在数据平台中常见角色包括：

- 数据总线。
- 日志收集。
- CDC 通道。
- 事件流。
- 削峰填谷。
- 系统解耦。

例如 PostgreSQL CDC 链路：

```text
PostgreSQL WAL
  -> Debezium
  -> Kafka Topic
  -> Flink / ClickHouse / Doris / Iceberg
```

Kafka 的价值不是“更快传消息”这么简单。

它让多个下游可以独立消费同一份变更：

```text
实时看板消费订单事件
风控系统消费支付事件
搜索系统消费商品变更
数仓系统消费业务变更
AI 特征系统消费用户行为
```

这让系统解耦，但也带来 schema 管理、重复消费、顺序保证、积压处理和数据一致性问题。

### 8.3 Flink：有状态流计算

Kafka 保存事件流，Flink 处理事件流。

Flink 核心概念包括：

- Stream Processing。
- Flink SQL。
- DataStream API。
- Event Time。
- Processing Time。
- Watermark。
- Window。
- State。
- Checkpoint。
- Savepoint。
- Exactly Once。
- Late Data。
- Backpressure。

实时计算难在状态。

例如统计最近 5 分钟支付成功订单数，系统必须持续维护窗口内状态：

```text
事件进入
  -> 按 event_time 分配窗口
  -> 更新窗口状态
  -> 到达水位线后输出结果
```

Event Time 是事件真实发生时间。

Processing Time 是系统处理事件的时间。

Watermark 用来判断事件时间推进到哪里，从而决定窗口何时可以输出。

迟到数据 Late Data 会让结果修正变复杂。

Flink 的核心判断是：

> Flink 不只是实时跑 SQL，而是在持续事件流上维护状态、窗口和容错。

### 8.4 Exactly Once 的价值与成本

Exactly Once 常被误解成“绝对不会重复”。

更准确地说，它是一种端到端处理语义：在失败恢复后，计算结果表现得像每条数据只影响一次结果。

要实现它，需要多个环节配合：

```text
Source 可重放
  -> Flink Checkpoint
  -> 状态一致快照
  -> Sink 支持事务或幂等写入
```

如果 Sink 不支持事务或幂等，即使 Flink 内部状态一致，外部结果也可能重复写。

所以 Exactly Once 的核心判断是：

> Exactly Once 是端到端系统设计，不是某个组件单独开关。

它有价值，也有成本：更复杂的状态管理、更高延迟、更重的 checkpoint、更严格的 sink 语义。

### 8.5 典型实时链路

典型 PostgreSQL CDC 实时数仓链路是：

```text
PostgreSQL CDC
  -> Debezium
  -> Kafka
  -> Flink SQL
  -> ClickHouse / Doris / Iceberg
  -> 实时 Dashboard
```

这条链路中：

- PostgreSQL 负责记录业务事实。
- Debezium 捕获变更。
- Kafka 承接和分发事件。
- Flink 计算实时指标。
- ClickHouse / Doris / Iceberg 承载查询或分析存储。
- Dashboard 展示实时结果。

每一层都有边界。Kafka 不负责复杂计算，Flink 不负责长期分析存储，ClickHouse 不负责捕获源库变更。

## 系统位置

实时处理位于数据平台的事件流和流式计算层。

```text
PostgreSQL CDC / App Events / Logs
  -> Kafka
  -> Flink
  -> ClickHouse / Doris / Iceberg / Redis
  -> 实时看板 / 风控 / 特征 / 告警 / AI 应用
```

它承接第 6 章的 CDC 链路，也补足第 7 章批处理的时效性边界。批处理擅长稳定回算和历史加工，实时处理擅长低延迟感知、持续状态计算和事件驱动。

实时处理还会引出第 9 章 OLAP 数据库：实时计算产出的结果需要被快速查询、聚合和展示，通常会写入 ClickHouse、Doris 等分析存储，或者写入湖仓表供后续批流统一分析。

## 场景案例

设计一个实时订单看板时，不应只画“Kafka -> Flink -> ClickHouse”三个框，而要定义事件语义。

订单支付事件可以定义为：

```json
{
  "event_id": "evt_10001_paid",
  "order_id": "10001",
  "user_id": "501",
  "event_type": "order_paid",
  "amount": 299.00,
  "event_time": "2026-04-01T10:31:20",
  "source": "postgres_cdc"
}
```

实时计算链路：

```text
PostgreSQL payments
  -> Debezium 捕获支付状态变更
  -> Kafka topic: order_payment_events
  -> Flink 按 event_time 做 1 分钟滚动窗口
  -> 输出每分钟支付订单数、支付 GMV、失败订单数
  -> ClickHouse 承载 Dashboard 查询
```

这里要做几个机制判断：

- 使用 `event_time` 而不是处理时间，避免上游延迟影响业务时间口径。
- 设置 Watermark，允许一定迟到事件进入正确窗口。
- Sink 写入要支持幂等或去重，避免故障恢复后重复写入。
- Dashboard 展示实时值时，要标注延迟和修正语义，避免把近实时结果误当最终财务口径。

最终财务 GMV 仍然应由批处理链路对账确认，实时 GMV 用于监控和快速决策。

## 常见误区

**误区一：实时就是越快越好。**

实时系统要在延迟、准确性、成本和复杂度之间取舍。秒级不一定比分钟级更好。

**误区二：Kafka 等于实时计算。**

Kafka 是事件流平台，不是计算引擎。计算需要 Flink、Spark Streaming 或其他处理系统。

**误区三：Flink SQL 和普通 SQL 一样。**

Flink SQL 面对的是无界流，需要理解时间、窗口、状态、水位线和迟到数据。

**误区四：Kafka 保存了消息就等于数据不会丢。**

Kafka 提供持久化和副本机制，但端到端不丢还取决于生产者确认、Topic 配置、消费者提交 offset、下游写入和故障恢复。

**误区五：实时指标可以直接替代离线指标。**

实时指标通常有延迟、迟到修正和去重语义。财务、结算和正式经营复盘仍需要离线链路做最终对账。

## 实战任务

设计一个实时订单看板：

```text
PostgreSQL orders
  -> Debezium
  -> Kafka order_events
  -> Flink SQL
  -> ClickHouse realtime_order_metrics
  -> Dashboard
```

要求定义：

- 事件结构。
- Topic 设计。
- 窗口粒度。
- Event Time 字段。
- Watermark 策略。
- 迟到数据处理方式。
- 输出指标。

补充要求：

- 定义事件唯一键，说明如何去重。
- 定义消费延迟告警，例如 Kafka lag 或 Flink checkpoint 延迟。
- 说明 Sink 如何保证幂等写入。
- 说明实时指标如何与批处理 T+1 指标对账。
- 写出一条迟到数据处理策略：丢弃、修正历史窗口，或进入补偿流。

示例输出指标：

```text
minute_time
paid_order_count
paid_gmv
failed_payment_count
unique_paid_users
processing_delay_seconds
```

## 小结引出下一章

实时数据系统把业务变化从数据库中持续捕获出来，进入事件流，再通过有状态计算生成实时结果。

Kafka 负责事件流，Flink 负责状态计算。

下一章进入 OLAP 数据库。

因为无论数据来自批处理还是实时流，最终都需要一个适合高性能分析查询的系统承载结果。
