### 9.4 OLAP数据摄入与更新

前面学习了OLAP查询优化，了解了如何优化查询性能。

数据如何进入OLAP数据库？如何高效导入数据？如何处理数据更新？如何保证数据一致性？

**场景**：
```yaml
数据导入需求：

数据工程师："每天要导入TB级数据"

架构师："如何高效导入？"

新工程师："直接INSERT吗？"
```

**问题**：
- OLAP数据库如何导入数据？
- 有哪些导入方式？
- 如何处理数据更新和删除？
- 如何保证数据一致性？
- 如何优化导入性能？

**答案**：**OLAP数据库提供批量导入、流式导入、SQL导入等多种方式，通过事务、版本管理、两阶段提交等机制保证数据一致性，需要根据数据量、时效性要求选择合适的导入策略**

---

## 数据导入方式

### 1. 批量导入（Bulk Load）

**适用场景**：大规模历史数据导入、定期批量导入

```sql
-- 从文件导入
LOAD DATA LOCAL INPATH '/data/sales_20250101.csv'
INTO TABLE sales_wide
PARTITION (sale_time = '2025-01-01')
FORMAT AS CSV
PROPERTIES (
    "delimiter" = ",",
    "header" = "true"
);

-- 从其他表导入
INSERT INTO sales_wide
SELECT * FROM staging_sales
WHERE sale_date = '2025-01-01';

-- 从Hive导入
INSERT INTO TABLE sales_wide
SELECT * FROM hive_sales
WHERE sale_time >= '2025-01-01'
  AND sale_time < '2025-01-02';
```

**特性**：
```yaml
优势：
- 吞吐量高：GB/s级
- 适合大批量：TB级数据
- 效率高：直接写存储文件

劣势：
- 延迟高：分钟级
- 不适合小批量：开销大
- 非实时：无法实时查询

适用：
- 历史数据初始化
- 定期批量导入（T+1）
- 离线数仓导入
```

### 2. 流式导入（Stream Load）

**适用场景**：实时数据导入、CDC数据同步

```bash
# ClickHouse流式导入
cat sales_data.csv | \
clickhouse-client \
  --query="INSERT INTO sales_wide FORMAT CSV"

# Doris流式导入
curl --location-trusted -u user:password \
  -H "label:label_20250101" \
  -H "column_separator:," \
  -T sales_data.csv \
  http://doris_fe:8030/api/db/sales_wide/_stream_load

# Kafka实时导入
CREATE KAFKA TABLE sales_kafka (
    sale_time TIMESTAMP,
    customer_id INT,
    product_id INT,
    amount DECIMAL(10,2)
) PROPERTIES (
    "kafka_broker_list" = "kafka1:9092,kafka2:9092",
    "kafka_topic" = "sales_events",
    "kafka_group_id" = "doris_sales_group"
);

-- 定时任务导入
CREATE ROUTINE LOAD sales_job ON sales_wide
FROM KAFKA
PROPERTIES (
    "kafka_broker_list" = "kafka1:9092",
    "kafka_topic" = "sales_events"
);
```

**特性**：
```yaml
优势：
- 延迟低：秒级
- 持续导入：7×24运行
- 实时查询：数据可见快

劣势：
- 吞吐量有限：MB/s级
- 复杂度高：需要管理连接
- 资源占用：持续运行

适用：
- 实时数仓
- CDC同步
- 监控指标采集
```

### 3. SQL导入

**适用场景**：小批量导入、其他数据库迁移

```sql
-- 单条INSERT
INSERT INTO sales_wide 
VALUES (12345, '2025-01-01 10:00:00', 1001, 2001, 100.0);

-- 批量INSERT
INSERT INTO sales_wide 
VALUES 
    (12346, '2025-01-01 10:01:00', 1002, 2002, 200.0),
    (12347, '2025-01-01 10:02:00', 1003, 2003, 300.0),
    (12348, '2025-01-01 10:03:00', 1004, 2004, 400.0);

-- INSERT SELECT
INSERT INTO sales_wide
SELECT 
    sale_id,
    sale_time,
    customer_id,
    product_id,
    amount
FROM mysql_sales
WHERE sale_time >= '2025-01-01';
```

**特性**：
```yaml
优势：
- 简单：标准SQL
- 灵活：支持复杂查询
- 兼容：易迁移

劣势：
- 性能差：逐条或小批量
- 开销大：解析开销
- 不适合大规模

适用：
- 小批量导入
- 数据修正
- 其他数据库迁移
```

### 4. 同步导入（CDC）

**适用场景**：业务库实时同步

```yaml
架构：
业务库（MySQL）
    ↓ Binlog
CDC工具（Canal/Debezium）
    ↓ Kafka
OLAP数据库（ClickHouse/Doris）

实现：
1. MySQL开启Binlog
2. Canal订阅Binlog
3. Canal发送到Kafka
4. Doris从Kafka消费
```

```sql
-- Doris Routine Load从Kafka导入
CREATE ROUTINE LOAD mysql_sync_job ON sales_wide
COLUMNS (
    sale_id,
    sale_time,
    customer_id,
    product_id,
    amount
)
FROM KAFKA
PROPERTIES (
    "kafka_broker_list" = "kafka1:9092",
    "kafka_topic" = "mysql_binlog_sales",
    "kafka_partitions" = "3",
    "kafka_offsets" = "OFFSET_BEGINNING"
);
```

**特性**：
```yaml
优势：
- 实时：秒级同步
- 可靠：消息队列保证
- 解耦：异步处理

劣势：
- 架构复杂：多组件
- 延迟：非实时
- 数据顺序：可能乱序

适用：
- 业务库实时同步
- 数据湖入湖
- 微服务架构
```

## 数据更新与删除

### 更新策略

**策略1：批量更新（Batch Update）**

```sql
-- ClickHouse: ALTER TABLE UPDATE
-- 不适合频繁更新
ALTER TABLE sales_wide 
UPDATE amount = amount * 1.1 
WHERE category = 'Electronics';

-- Doris: 支持UPDATE
UPDATE sales_wide 
SET amount = amount * 1.1
WHERE category = 'Electronics';

-- 性能影响：
-- - ClickHouse: 异步操作，开销大
-- - Doris: 相对快，但仍有开销
-- - 建议：批量更新，避免频繁操作
```

**策略2：合并（Merge）**

```sql
-- 新增量+更新量
-- 使用新文件记录更新，查询时合并

-- 插入更新数据
INSERT INTO sales_wide_updates
SELECT 
    sale_id,
    new_amount AS amount,
    update_time
FROM updates;

-- 查询时自动合并
-- OLAP数据库自动处理版本合并
SELECT * FROM sales_wide
WHERE sale_time >= '2025-01-01';
-- 返回合并后的最新数据
```

**策略3：版本化（Versioning）**

```sql
-- 保留历史版本
CREATE TABLE sales_versioned (
    sale_id BIGINT,
    sale_time TIMESTAMP,
    amount DECIMAL(10,2),
    valid_from TIMESTAMP,
    valid_to TIMESTAMP,
    is_current BOOLEAN
);

-- 插入新版本
INSERT INTO sales_versioned
SELECT 
    sale_id,
    sale_time,
    new_amount AS amount,
    NOW() AS valid_from,
    NULL AS valid_to,
    true AS is_current
FROM updates;

-- 更新旧版本
UPDATE sales_versioned
SET valid_to = NOW(), is_current = false
WHERE sale_id IN (SELECT sale_id FROM updates)
  AND is_current = true;

-- 查询当前版本
SELECT * FROM sales_versioned
WHERE is_current = true;
```

### 删除策略

**策略1：批量删除（Batch Delete）**

```sql
-- ClickHouse: ALTER TABLE DELETE
ALTER TABLE sales_wide 
DELETE WHERE sale_time < '2024-01-01';

-- Doris: 支持DELETE
DELETE FROM sales_wide
WHERE sale_time < '2024-01-01';

-- 性能影响：
-- - 标记删除，不立即释放空间
-- - 后台异步清理
-- - 建议：批量删除，避免频繁操作
```

**策略2：分区删除（Drop Partition）**

```sql
-- 最快：直接删除分区
ALTER TABLE sales_wide 
DROP PARTITION p202401;

-- 优势：
-- - 即时删除
-- - 不影响其他分区
-- - 适合时间序列数据

-- 适用场景：
-- - 定期清理历史数据
-- - 数据生命周期管理
-- - 按时间分区
```

**策略3：软删除（Soft Delete）**

```sql
-- 添加删除标记
ALTER TABLE sales_wide 
ADD COLUMN is_deleted BOOLEAN DEFAULT false;

-- 标记删除
UPDATE sales_wide
SET is_deleted = true
WHERE sale_time < '2024-01-01';

-- 查询过滤
SELECT * FROM sales_wide
WHERE is_deleted = false;

-- 定期物理删除
-- 清理标记为删除的数据
```

## 数据一致性保证

### 事务支持

```sql
-- 显式事务
BEGIN;
    INSERT INTO sales_wide VALUES (...);
    INSERT INTO sales_detail VALUES (...);
    UPDATE inventory SET quantity = quantity - 1;
COMMIT;

-- 失败回滚
BEGIN;
    INSERT INTO sales_wide VALUES (...);
    -- 某步失败
    ROLLBACK;
-- 所有操作回滚
```

**支持情况**：
```yaml
ClickHouse：
- 不支持完整ACID
- 支持原子性INSERT
- 不支持ROLLBACK
- 最终一致性

Doris：
- 支持ACID
- 支持ROLLBACK
- 强一致性
- 适合事务场景

StarRocks：
- 支持ACID
- 支持ROLLBACK
- 强一致性
- 主表唯一键
```

### 两阶段提交

```yaml
场景：跨系统数据导入

流程：
Phase 1: Prepare
- 导入数据到OLAP
- 数据不可见
- 检查导入成功

Phase 2: Commit
- 标记数据可见
- 提交事务
- 更新元数据

如果失败：
- Rollback: 清理已导入数据
- 重试: 重新导入
```

```sql
-- Doris Stream Load两阶段提交
curl --location-trusted -u user:password \
  -H "two_phase_commit:true" \
  -H "label:label_20250101" \
  -T data.csv \
  http://doris_fe:8030/api/db/sales_wide/_stream_load

-- 返回txn ID
-- 使用txn ID提交或回滚
curl --location-trusted -u user:password \
  -X PUT \
  http://doris_fe:8030/api/db/transaction/commit/1001

-- 或回滚
curl --location-trusted -u user:password \
  -X PUT \
  http://doris_fe:8030/api/db/transaction/rollback/1001
```

### 重复数据处理

```yaml
Label机制：
- 每次导入指定唯一label
- 相同label自动去重
- 支持幂等性

实现：
Label = "sales_20250101_001"
导入数据：
- Label不存在：导入
- Label存在：跳过/报错/覆盖
```

```sql
-- 导入时指定label
LOAD DATA LABEL sales_20250101_001
INPATH '/data/sales_20250101.csv'
INTO TABLE sales_wide;

-- 重复导入相同label（幂等）
LOAD DATA LABEL sales_20250101_001
INPATH '/data/sales_20250101.csv'
INTO TABLE sales_wide;
-- 自动去重，不会重复导入
```

## 导入性能优化

### 批量大小优化

```yaml
批量过小：
- 每批1000行
- 问题：频繁提交、开销大
- 吞吐量：10 MB/s

批量适中：
- 每批10万行
- 优势：平衡开销和内存
- 吞吐量：100 MB/s

批量过大：
- 每批1000万行
- 问题：内存溢出
- 吞吐量：50 MB/s

推荐：
- 行数：10-100万行/批
- 大小：100-500MB/批
- 根据内存调整
```

### 并发导入

```bash
# 单文件导入（串行）
clickhouse-client --query="INSERT INTO sales_wide FORMAT CSV" < data.csv

# 多文件并发导入
for file in data_*.csv; do
    clickhouse-client --query="INSERT INTO sales_wide FORMAT CSV" < $file &
done
wait

# 优势：
# - 多文件并行导入
# - 充分利用IO和CPU
# - 吞吐量提升2-5倍
```

### 压缩传输

```bash
# 压缩后传输
gzip -c data.csv | \
clickhouse-client \
    --query="INSERT INTO sales_wide FORMAT CSVWithNames"

# 优势：
# - 网络传输量减少
# - 传输时间缩短
# - CPU换带宽

# 推荐：
# - 本地导入：不需要压缩
# - 跨机房：推荐压缩
# - 带宽受限：必须压缩
```

### 内存优化

```sql
-- 调整导入内存
SET load_mem_limit = 2147483648;  -- 2GB

-- 原理：
-- 导入需要内存缓冲
-- 内存小：频繁flush、性能差
-- 内存大：一次性导入、性能好

-- 推荐配置：
-- 单机内存 / 并发导入数 / 2
-- 例如：64GB内存，4并发导入
-- 每导入 = 64GB / 4 / 2 = 8GB
```

## 数据导入架构设计

### Lambda架构导入

```
                    ┌─────────────┐
                    │  数据源系统   │
                    └──────┬──────┘
                           │
            ┌──────────────┴──────────────┐
            │                             │
      ┌─────▼─────┐                 ┌─────▼─────┐
      │ 实时流处理  │                 │ 批量ETL   │
      │ (Flink)   │                 │ (Spark)   │
      └─────┬─────┘                 └─────┬─────┘
            │                             │
            │ Stream Load                │ Bulk Load
            │                             │
        ┌───▼────────────────────────────▼───┐
        │         OLAP数据库                  │
        │  ┌────────────┐    ┌─────────────┐ │
        │  │  实时层    │    │   批量层    │ │
        │  │ (增量数据) │    │ (全量数据) │ │
        │  └────────────┘    └─────────────┘ │
        └────────────────────────────────────┘
```

### Kappa架构导入

```
                    ┌─────────────┐
                    │  数据源系统   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Kafka     │
                    │  消息队列    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  流处理引擎  │
                    │  (Flink)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  OLAP数据库  │
                    │ (Stream Load)│
                    └─────────────┘
```

## 导入监控与运维

### 导入任务监控

```sql
-- 查看导入任务
SHOW LOAD;

-- 查看导入详情
SHOW LOAD FROM db_name WHERE LABEL = 'label_20250101';

-- 查看Routine Load
SHOW ROUTINE LOAD;

-- 查看导入统计
SELECT 
    LABEL,
    JOB_NAME,
    STATE,
    ROWS_INSERTED,
    ROWS_DELETED,
    EXECUTION_TIME_MS
FROM information_schema.load_jobs
ORDER BY CREATE_TIME DESC
LIMIT 20;
```

### 导入失败处理

```yaml
常见原因：
1. 数据格式错误
   - 检查：查看错误日志
   - 解决：修正数据格式

2. 类型不匹配
   - 检查：查看类型定义
   - 解决：CAST转换

3. 内存不足
   - 检查：查看内存使用
   - 解决：减少批量大小

4. 网络超时
   - 检查：查看网络连接
   - 解决：增加超时时间

处理策略：
- 自动重试：失败自动重试3次
- 人工介入：查看日志、手动修正
- 告警通知：严重失败发送告警
```

### 数据质量检查

```sql
-- 导入后数据量检查
SELECT COUNT(*) FROM sales_wide
WHERE sale_time >= '2025-01-01';

-- 对比源数据量
SELECT COUNT(*) FROM source_sales
WHERE sale_time >= '2025-01-01';

-- 数据分布检查
SELECT 
    sale_time,
    COUNT(*) AS cnt
FROM sales_wide
WHERE sale_time >= '2025-01-01'
GROUP BY sale_time
ORDER BY sale_time;

-- 空值检查
SELECT 
    COUNT(*) AS total,
    COUNT(customer_id) AS not_null_customer,
    COUNT(amount) AS not_null_amount
FROM sales_wide
WHERE sale_time >= '2025-01-01';
```

## 总结

**OLAP数据摄入核心要点**：
1. **选择合适方式**：批量、流式、CDC根据场景选择
2. **保证一致性**：事务、两阶段提交、Label机制
3. **优化性能**：批量大小、并发、压缩、内存
4. **监控运维**：任务监控、失败处理、质量检查

**实践建议**：
1. **历史数据**：批量导入（Bulk Load）
2. **实时数据**：流式导入（Stream Load）
3. **业务同步**：CDC方案
4. **定期清理**：分区删除

**导入策略对比**：
```yaml
场景 | 推荐方式 | 延迟 | 吞吐量 | 复杂度
-----|----------|------|--------|--------
历史数据 | Bulk Load | 分钟 | GB/s | 低
实时数据 | Stream Load | 秒 | MB/s | 中
业务同步 | CDC | 秒 | MB/s | 高
小批量 | INSERT | 秒 | KB/s | 低
```
