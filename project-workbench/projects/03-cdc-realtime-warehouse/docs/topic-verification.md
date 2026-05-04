# Topic 验证说明

## 验证目标

确认 CDC 事件正确写入 Kafka Topic，并能被 Flink 正确消费。

## 验证步骤

### 1. Topic 存在性验证

```bash
# 列出所有 Topic
kafka-topics.sh --bootstrap-server localhost:9092 --list

# 预期输出应包含：db.public.orders
```

### 2. Topic 分区验证

```bash
# 查看 Topic 详情
kafka-topics.sh --bootstrap-server localhost:9092 \
  --topic db.public.orders --describe

# 预期：
# - Partition 数量: 1 (或更多)
# - Replication Factor: 1 (或更多)
# - Leader: broker-0
```

### 3. 消息格式验证

```bash
# 消费 1 条消息并检查格式
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic db.public.orders \
  --max-messages 1 \
  --from-beginning

# 预期输出应包含：
# - "before": 变更前状态
# - "after": 变更后状态
# - "op": 操作类型 (c/u/d)
# - "ts_ms": 时间戳
```

### 4. Consumer Group 验证

```bash
# 查看 Consumer Group 状态
kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group flink-realtime-gmv \
  --describe

# 预期：
# - TOPIC: db.public.orders
# - PARTITION: 0
# - CURRENT-OFFSET: > 0
# - LOG-END-OFFSET: > 0
# - LAG: 0 或很小
```

### 5. 事件内容验证

```bash
# 消费消息并检查内容
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic db.public.orders \
  --from-beginning \
  --max-messages 5 \
  --property print.key=true

# 预期：
# - Key: order_id
# - Value: 包含 before/after 的 Debezium JSON
# - after.order_status 变更: created -> paid
```

## 验证记录

| 验证项 | 预期 | 实际 | 状态 |
| --- | --- | --- | --- |
| Topic 存在 | db.public.orders | [待运行时验证] | [待运行时验证] |
| 分区数 | >= 1 | [待运行时验证] | [待运行时验证] |
| 消息格式 | Debezium JSON | [待运行时验证] | [待运行时验证] |
| Consumer Group | flink-realtime-gmv | [待运行时验证] | [待运行时验证] |
| 事件内容 | before/after/op | [待运行时验证] | [待运行时验证] |

**注意**：以上验证需要 Kafka 运行时环境，当前环境未安装。
