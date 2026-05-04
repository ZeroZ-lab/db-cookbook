# 项目 3：CDC 实时数仓 Demo

## 目标

理解 WAL、CDC、Kafka、Flink、窗口、状态和 Exactly Once 边界，完成订单状态变化的实时指标链路设计。

## 系统位置

```text
PostgreSQL WAL
  -> Debezium
  -> Kafka Topic
  -> Flink Window / State
  -> ClickHouse 或 Doris
  -> 实时看板
```

## 数据模型

- 订单变更事件。
- 支付变更事件。
- 实时订单窗口结果。
- 实时 GMV 窗口结果。
- CDC 事件示例见 `events/order-status-changed.json`。
- Kafka Topic 规划见 `kafka/topics.md`。
- Flink SQL 见 `flink/realtime-gmv.sql`。
- ClickHouse Sink DDL 见 `sinks/clickhouse-realtime.sql`。
- Exactly Once 边界见 `docs/exactly-once-boundary.md`。
- 运行记录模板见 `reports/run-record-template.md`。

## 核心链路

- 设计订单表 CDC 事件格式。
- 设计 Kafka Topic 和 Consumer Group。
- 设计 Flink Event Time、Watermark 和窗口。
- 设计 Sink 幂等写入或事务写入边界。
- 用 `run.sh` 做事件、Topic、Flink SQL、Sink 和边界文档的本地静态检查。

## 验收指标

- [ ] 有 CDC 事件示例。
- [ ] 有 Kafka Topic 规划。
- [ ] 有 Flink 窗口计算说明。
- [ ] 有迟到数据处理策略。
- [ ] 能说明端到端 Exactly Once 依赖哪些组件共同成立。
- [x] 有本地静态检查入口和运行记录模板。

## 运行命令

```bash
project-workbench/projects/03-cdc-realtime-warehouse/run.sh
pnpm projects:verify
```

如果本机有 Kafka、Flink SQL Client 和 ClickHouse，可按 README 中的 Topic、Flink SQL 和 Sink DDL 分别创建链路。本项目当前先提供可检查产物，不声称本仓库环境已端到端运行。

## 质量检查

- 指标结果必须区分事件时间和处理时间。
- 失败恢复说明必须覆盖 Source、Checkpoint、Sink 三个位置。
- 迟到数据必须说明 Watermark、修正流或补偿批处理策略。

## 复盘问题

- 实时链路比批处理多解决了什么？
- 它又新增了哪些一致性、延迟和运维成本？
