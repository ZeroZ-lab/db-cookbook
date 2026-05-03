# 项目 3 交付物：CDC 实时数仓 Demo

## 架构产物

- [ ] 画出 PostgreSQL WAL、Debezium、Kafka、Flink、Sink 的链路。
- [ ] 标出 Source、Checkpoint、Sink 的一致性边界。
- [ ] 标出事件时间、处理时间和 Watermark 的位置。

## 数据模型产物

- [x] 订单变更事件 JSON 示例：`events/order-status-changed.json`。
- [x] Kafka Topic 规划：`kafka/topics.md`。
- [x] Flink 窗口结果 schema：`flink/realtime-gmv.sql`。
- [x] Sink 表 DDL：`sinks/clickhouse-realtime.sql`。

## 核心任务产物

- [ ] 捕获订单状态变化。
- [ ] 写入 Kafka Topic。
- [x] 计算实时订单数和 GMV：`flink/realtime-gmv.sql`。
- [x] 处理迟到事件：`docs/exactly-once-boundary.md`。

## 验证证据

- [x] CDC 事件样例：`events/order-status-changed.json`。
- [ ] Kafka 消费样例。
- [x] Flink Checkpoint 配置记录：`docs/exactly-once-boundary.md`。
- [x] Sink 端幂等或事务写入说明：`docs/exactly-once-boundary.md`。

## 复盘记录

- 实时链路解决的问题：
- 实时链路新增的问题：
- Exactly Once 没有覆盖的边界：
