# Exactly Once 边界说明

端到端 Exactly Once 不是一个组件单独承诺的结果，而是 Source、Checkpoint、状态和 Sink 共同满足条件时的系统性质。

## Source

- PostgreSQL 通过 WAL 暴露变更。
- Debezium 将变更写入 Kafka。
- Kafka Topic 使用 `order_id` 作为 Key 保证同一订单局部有序。
- Source 侧需要保留足够长的 WAL、Replication Slot 和 Kafka Retention，以便故障后恢复。

## Checkpoint

- Flink 必须开启 Checkpoint。
- 状态后端要能持久化窗口状态和去重状态。
- Checkpoint 间隔决定恢复成本和重复处理窗口。

## Sink

- Upsert Kafka 使用主键更新语义输出窗口结果。
- ClickHouse Sink 如果用普通追加写入，只能保证至少一次，需要通过 ReplacingMergeTree、幂等键或外部事务边界降低重复影响。
- 对外说明时必须区分“Flink 内部状态 Exactly Once”和“端到端结果 Exactly Once”。

## 迟到数据

- `WATERMARK FOR event_time AS event_time - INTERVAL '30' SECOND` 表示系统允许 30 秒乱序。
- 超过 Watermark 的迟到事件需要进入修正流、补偿批处理或人工对账。
- 实时结果应标注可修正，不应直接等同于最终财务口径。
