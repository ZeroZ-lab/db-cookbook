# CDC 捕获与写入 Kafka 伪运行流程

## 流程概述

```text
1. PostgreSQL 写入订单
   INSERT INTO orders (...) VALUES (...);
   UPDATE orders SET order_status = 'paid' WHERE order_id = 1001;

2. PostgreSQL WAL 记录变更
   WAL (Write-Ahead Log) 自动记录所有数据变更

3. Debezium 捕获 WAL
   Debezium CDC Connector 读取 PostgreSQL WAL
   输出 Debezium JSON 格式到 Kafka Topic

4. Kafka 接收事件
   Topic: db.public.orders
   Key: order_id
   Value: Debezium JSON (before/after + op + ts_ms)

5. Flink 消费 Kafka
   Flink SQL 从 Kafka Topic 读取事件
   提取 event_time, order_id, total_amount, order_status

6. Flink 窗口计算
   TUMBLE 窗口: 1 分钟
   计算: 实时 GMV, 订单数, 客单价

7. ClickHouse Sink
   写入 realtime_gmv 表 (ReplacingMergeTree)
   按窗口时间去重
```

## Debezium 配置示例

```json
{
  "name": "postgres-cdc-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "database.hostname": "postgres",
    "database.port": "5432",
    "database.user": "db_cookbook",
    "database.password": "db_cookbook",
    "database.dbname": "db_cookbook_lab",
    "database.server.name": "db",
    "table.include.list": "public.orders",
    "plugin.name": "pgoutput",
    "slot.name": "debezium_slot",
    "publication.name": "debezium_pub"
  }
}
```

## 伪运行命令

```bash
# 1. 启动 PostgreSQL
docker compose up -d postgres

# 2. 启动 Kafka
docker compose up -d kafka zookeeper

# 3. 启动 Debezium
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d @debezium-config.json

# 4. 启动 Flink
docker compose up -d flink

# 5. 提交 Flink SQL 作业
docker exec -it flink-sql-client \
  sql-client.sh -f /opt/flink/realtime-gmv.sql

# 6. 启动 ClickHouse
docker compose up -d clickhouse

# 7. 验证数据
docker exec -it clickhouse-client \
  clickhouse-client -q "SELECT * FROM analytics.realtime_gmv LIMIT 10"
```

**注意**：以上命令为伪运行流程，当前环境未安装 Kafka、Flink、ClickHouse 运行时。
