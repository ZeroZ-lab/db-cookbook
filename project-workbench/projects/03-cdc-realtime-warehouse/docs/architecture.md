# 项目 3 架构链路图

## 系统架构

```text
PostgreSQL (业务库)
  |
  |-- WAL (Write-Ahead Log)
  |
  v
Debezium CDC Connector
  |
  |-- 捕获 INSERT / UPDATE / DELETE
  |-- 输出 Debezium JSON 格式
  |
  v
Kafka
  |
  |-- Topic: db.public.orders (订单变更事件)
  |-- Consumer Group: flink-realtime-gmv
  |
  v
Flink SQL
  |
  |-- 事件时间: event_time (从 Debezium payload 提取)
  |-- Watermark: event_time - INTERVAL '5' SECOND
  |-- 窗口: TUMBLE 1 分钟
  |-- 计算: 实时 GMV、订单数、客单价
  |
  v
ClickHouse (实时汇总)
  |
  |-- realtime_gmv 表 (ReplacingMergeTree)
  |-- 按窗口时间去重
  |
  v
BI / 监控
```

## 一致性边界

### Source (Debezium + PostgreSQL)

- PostgreSQL WAL 保证事务顺序
- Debezium 保证 at-least-once 读取
- 不保证 exactly-once 到 Kafka

### Checkpoint (Flink)

- Flink Checkpoint 保证作业状态一致性
- Checkpoint 间隔决定恢复粒度
- 不保证端到端 exactly-once（需 Sink 配合）

### Sink (ClickHouse)

- ReplacingMergeTree 保证幂等写入
- 通过 version 字段去重
- 最终一致性，非强一致

## 事件时间 vs 处理时间

- 事件时间：订单状态变更的实际发生时间
- 处理时间：Flink 处理该事件的时间
- Watermark：允许迟到 5 秒，超过则触发窗口计算
