# 项目 3 运行记录模板

## 环境

- PostgreSQL 版本：
- Debezium / CDC 组件：
- Kafka 版本：
- Flink 版本：
- ClickHouse / Doris 版本：

## 静态检查

```bash
project-workbench/projects/03-cdc-realtime-warehouse/run.sh
```

- 检查结果：
- 未验证运行时：

## Topic 与事件

| 项目 | 记录 |
| --- | --- |
| Source Topic | `db.public.orders` |
| Result Topic | `warehouse.realtime.order_gmv_1m` |
| Consumer Group | `flink-realtime-gmv` |
| 示例事件是否写入 |  |

## Flink 作业

- SQL 文件：`flink/realtime-gmv.sql`
- Watermark 延迟：
- 窗口大小：
- Checkpoint 间隔：
- 作业提交命令：
- 作业运行状态：

## Sink 验证

- Sink DDL：`sinks/clickhouse-realtime.sql`
- 幂等键：
- 重复事件测试：
- 迟到事件测试：

## 指标结果

| 窗口 | paid_orders | paid_users | paid_gmv | 说明 |
| --- | ---: | ---: | ---: | --- |
|  |  |  |  |  |

## 边界结论

- 本次是否只是静态检查：
- 本次是否真实运行 Kafka/Flink/Sink：
- Exactly Once 未覆盖的边界：
