### 3.3 分区表：让大表具有物理边界

前两节讨论了大表为什么慢，以及PostgreSQL的能力边界。

结论之一是：**当数据量增长时，需要优化访问模式**。

优化访问模式的一个核心手段是：**分区表（Partitioning）**。

**什么是分区表？**

简单说，就是把一个大表物理上拆分成多个小表，但逻辑上还是一个大表。

```sql
-- 不分区：一个大表orders（1亿行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 需要扫描整个表（1亿行）

-- 分区：按月分成12个分区表（每个月约800万行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 只扫描4月的分区（800万行）
```

**分区表的价值**：
- **查询优化**：只扫描相关分区，减少I/O
- **维护便利**：可以单独删除、备份、恢复某个分区
- **扩展性**：可以在不同分区使用不同存储策略

#### 一、为什么需要分区表

**第一，按时间查询是大表的常见场景**

**场景**：订单查询
```sql
-- 查询今天的订单
SELECT * FROM orders WHERE date(created_at) = CURRENT_DATE;

-- 查询本月的订单
SELECT * FROM orders
WHERE created_at >= date_trunc('month', CURRENT_DATE);

-- 查询去年的订单
SELECT * FROM orders
WHERE created_at >= '2025-01-01' AND created_at < '2026-01-01';
```

**问题**：
- 即使有索引，也可能需要扫描大量数据
- 索引维护成本高
- 删除旧数据需要扫描全表

**如果按月分区**：
```sql
-- 查询今天的订单：只扫描当前月的分区
-- 查询本月的订单：只扫描当前月的分区
-- 查询去年的订单：只扫描去年12个分区
```

**第二，数据生命周期管理需要物理边界**

**场景**：日志数据归档

**不分区**：
```sql
-- 删除一年前的日志（需要扫描全表）
DELETE FROM events WHERE event_time < CURRENT_DATE - INTERVAL '1 year';
-- 问题：
--   1. 需要扫描全表（数十亿行）
--   2. 产生大量的WAL日志
--   3. 锁表时间长
--   4. 需要VACUUM回收空间
```

**按月分区**：
```sql
-- 删除一年前的日志（直接DROP分区）
DROP TABLE events_202504;
-- 优势：
--   1. 直接删除分区文件，不需要扫描数据
--   2. 不产生WAL日志
--   3. 不锁表（只锁分区）
--   4. 不需要VACUUM
```

**第三，不同时间的数据有不同访问模式**

**场景**：订单数据
```yaml
最近3个月：频繁访问（热数据）
3-12个月：偶尔访问（温数据）
12个月以上：很少访问（冷数据）
```

**分区后可以优化**：
```yaml
热数据分区：
  - 放在SSD上
  - 更多的内存
  - 更激进的索引

冷数据分区：
  - 放在HDD上
  - 压缩存储
  - 较少的索引
```

**结论**：
> 分区表的价值在于：通过物理边界，让查询、维护、存储优化成为可能。

#### 二、核心判断：分区表不是简单拆表，而是定义访问边界

> 分区表的核心判断是：通过分区键（partition key）定义数据的物理边界，让查询只访问相关分区，从而提升查询性能、简化维护操作、优化存储成本。

这个判断说明：
- **分区键**：定义数据如何分布（通常是时间、ID等）
- **物理边界**：每个分区是独立的物理文件
- **查询优化**：分区裁剪（partition pruning）
- **维护便利**：分区级别的操作

#### 三、分区表的类型

##### 3.1 RANGE分区（范围分区）

**适用场景**：按时间、ID范围等有序字段分区

**示例**：按月分区
```sql
-- 创建分区表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 创建分区（每月一个分区）
CREATE TABLE orders_202601 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_202602 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE orders_202603 PARTITION OF orders
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 查询时自动分区裁剪
SELECT * FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';
-- 只扫描orders_202603分区
```

**优势**：
- 按时间查询性能好
- 删除旧数据简单（DROP分区）
- 符合数据生命周期

##### 3.2 LIST分区（列表分区）

**适用场景**：按离散值分区（如地区、状态）

**示例**：按地区分区
```sql
-- 创建分区表
CREATE TABLE users (
    user_id BIGINT,
    name VARCHAR(100),
    region VARCHAR(50),
    registered_at TIMESTAMP
) PARTITION BY LIST (region);

-- 创建分区（每个地区一个分区）
CREATE TABLE_users_east PARTITION OF users
    FOR VALUES IN ('beijing', 'shanghai', 'hangzhou');

CREATE TABLE users_west PARTITION OF users
    FOR VALUES IN ('chengdu', 'xian', 'chongqing');

CREATE TABLE users_south PARTITION OF users
    FOR VALUES IN ('guangzhou', 'shenzhen', 'nanning');

-- 查询时自动分区裁剪
SELECT * FROM users WHERE region = 'beijing';
-- 只扫描users_east分区
```

**优势**：
- 按地区查询性能好
- 地区数据隔离
- 便于地域化部署

##### 3.3 HASH分区（哈希分区）

**适用场景**：均匀分布数据，避免热点

**示例**：按用户ID哈希分区
```sql
-- 创建分区表（4个分区）
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_name VARCHAR(100),
    event_time TIMESTAMP
) PARTITION BY HASH (user_id);

-- 创建分区
CREATE TABLE events_0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);

-- 写入时自动路由到对应分区
INSERT INTO events (event_id, user_id, event_name, event_time) VALUES (1, 123, 'login', NOW());
-- user_id=123，123 % 4 = 3，写入events_3分区
```

**优势**：
- 数据均匀分布
- 避免热点
- 适合并行写入

#### 四、分区表的实战应用

##### 4.1 按日期分区（最常见）

**场景**：订单表按月分区

```sql
-- 1. 创建主表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 2. 创建默认分区（可选，防止数据写入失败）
CREATE TABLE orders_default PARTITION OF orders DEFAULT;

-- 3. 创建分区（可以用脚本自动创建）
CREATE TABLE orders_202601 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_202602 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 4. 查询（自动分区裁剪）
EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-02-15' AND created_at < '2026-02-16';

-- 执行计划显示只扫描orders_202602分区
```

**自动创建分区的脚本**：
```sql
-- 创建一个函数自动创建下个月的分区
CREATE OR REPLACE FUNCTION create_monthly_partition()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_date TEXT;
    end_date TEXT;
BEGIN
    partition_name := 'orders_' || to_char(CURRENT_DATE + INTERVAL '1 month', 'YYYYMM');
    start_date := to_char(CURRENT_DATE + INTERVAL '1 month', 'YYYY-MM-DD');
    end_date := to_char(CURRENT_DATE + INTERVAL '2 months', 'YYYY-MM-DD');

    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF orders
        FOR VALUES FROM (%L) TO (%L)
    ', partition_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- 定期执行（如每月1号）
SELECT create_monthly_partition();
```

##### 4.2 分区表的索引

**全局索引 vs 分区索引**

```sql
-- 创建分区表
CREATE TABLE orders (...) PARTITION BY RANGE (created_at);

-- 方式1：在主表创建索引（自动为每个分区创建索引）
CREATE INDEX idx_orders_user_id ON orders(user_id);
-- 结果：每个分区都有idx_orders_user_id

-- 方式2：在单个分区创建索引
CREATE INDEX idx_orders_202601_paid_at ON orders_202601(paid_at);
-- 结果：只有orders_202601分区有这个索引
```

**注意事项**：
- 主表上的索引会自动应用到所有分区
- 可以在单个分区上创建额外索引
- 跨分区查询需要查询所有分区的索引

##### 4.3 分区表的约束

**主键和唯一约束**

```sql
-- 问题：分区表的主键必须包含分区键
CREATE TABLE orders (
    order_id BIGINT,  -- 主键不包含分区键
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 错误：unique constraint on partition key must include the partition key
ALTER TABLE orders ADD PRIMARY KEY (order_id);

-- 正确：主键包含分区键
ALTER TABLE orders ADD PRIMARY KEY (order_id, created_at);

-- 或者：主键包含分区键
CREATE TABLE orders (
    order_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)
) PARTITION BY RANGE (created_at);
```

**外键约束**

```sql
-- 分区表可以有外键
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT REFERENCES users(user_id),
    created_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)
) PARTITION BY RANGE (created_at);
```

**注意事项**：
- 分区表的主键必须包含分区键
- 分区表的外键不需要包含分区键
- 建议主键设计：(业务键, 分区键)

#### 五、分区表的性能优化

##### 5.1 分区裁剪（Partition Pruning）

**什么是分区裁剪**：
- 查询时只扫描相关的分区
- 优化器自动识别哪些分区需要扫描
- 大幅减少I/O

**示例**：
```sql
-- 查询4月的订单
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01';

-- 执行计划显示：
-- Append
--   -> Seq Scan on orders_202604  (cost=... rows=...)
-- 只扫描orders_202604分区
```

**确保分区裁剪生效**：
```sql
-- 好的查询：分区键在WHERE条件中
SELECT * FROM orders WHERE created_at >= '2026-04-01';

-- 不好的查询：分区键被函数包装，无法裁剪
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 可能无法裁剪，需要扫描所有分区
```

##### 5.2 分区表的执行计划

**查看分区扫描**：
```sql
-- 查询跨多个分区
EXPLAIN SELECT * FROM orders
WHERE created_at >= '2026-03-01' AND created_at < '2026-05-01';

-- 执行计划显示：
-- Append
--   -> Seq Scan on orders_202603
--   -> Seq Scan on orders_202604
-- 只扫描2个分区，而不是全年12个分区
```

##### 5.3 分区表的并行查询

**PostgreSQL支持并行查询**：
```sql
-- 启用并行查询
SET max_parallel_workers_per_gather = 4;

-- 查询多个分区时，可以并行扫描
EXPLAIN SELECT * FROM orders
WHERE created_at >= '2026-01-01' AND created_at < '2026-04-01';

-- 执行计划显示：
-- Append
--   -> Parallel Seq Scan on orders_202601
--   -> Parallel Seq Scan on orders_202602
--   -> Parallel Seq Scan on orders_202603
-- 3个分区并行扫描
```

#### 六、分区表的维护

##### 6.1 创建新分区

**手动创建**：
```sql
-- 创建下个月的分区
CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
```

**自动创建**：
```sql
-- 使用定时任务（如pg_cron）
CREATE EXTENSION pg_cron;

-- 每月1号自动创建分区
SELECT cron.schedule('create-monthly-partition', '0 0 1 * *', 'SELECT create_monthly_partition()');
```

##### 6.2 删除旧分区

**直接删除**：
```sql
-- 删除一年前的分区
DROP TABLE orders_202504;

-- 优势：
-- 1. 快速（直接删除文件）
-- 2. 不产生WAL日志
-- 3. 不锁表（只锁分区）
```

**先备份再删除**：
```sql
-- 1. 先归档
CREATE TABLE orders_archive_202501 AS SELECT * FROM orders_202501;

-- 2. 再删除分区
DROP TABLE orders_202501;
```

##### 6.3 分区表的备份和恢复

**备份单个分区**：
```bash
# 备份orders_202601分区
pg_dump -t orders_202601 -f orders_202601.sql
```

**恢复单个分区**：
```bash
# 恢复orders_202601分区
psql -f orders_202601.sql
```

##### 6.4 分区表的监控

**监控分区大小**：
```sql
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'orders_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

**监控分区行数**：
```sql
SELECT
    'orders_202601' as partition_name,
    count(*) as row_count
FROM orders_202601
UNION ALL
SELECT
    'orders_202602' as partition_name,
    count(*) as row_count
FROM orders_202602;
-- 或者使用pg_stat_user_tables
```

#### 七、分区表的限制和注意事项

##### 7.1 主键限制

**问题**：主键必须包含分区键

```sql
-- 错误
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,  -- 主键不包含分区键
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 正确
CREATE TABLE orders (
    order_id BIGINT,
    created_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)  -- 主键包含分区键
) PARTITION BY RANGE (created_at);
```

**影响**：
- 业务查询需要同时提供order_id和created_at
- 可能需要调整查询逻辑

##### 7.2 更新分区键

**问题**：更新分区键可能导致行移动

```sql
-- 更新created_at（分区键）
UPDATE orders SET created_at = '2026-05-01' WHERE order_id = 123;

-- 如果2026-04-01的订单更新到2026-05-01
-- 行需要从orders_202604分区移动到orders_202605分区
-- 这个操作可能很慢
```

**建议**：
- 避免更新分区键
- 如果必须更新，考虑删除后重新插入

##### 7.3 分区数量

**问题**：分区数量不是越多越好

**太多分区的问题**：
- 查询规划器需要评估更多分区
- 内存占用增加
- 文件句柄占用多

**建议**：
```yaml
按月分区：1-3年的数据（12-36个分区）
按日分区：1个月的数据（30个分区）
按ID分区：根据数据量，通常是4-32个分区
```

#### 八、常见误区

**误区一：分区表一定能提升性能**

- **说明**：分区表只对特定查询提升性能，不是万能的
- **后果**：盲目分区，性能反而下降
- **正确理解**：
  - 按分区键查询：性能提升
  - 不按分区键查询：性能可能下降
  - 分区数量太多：查询规划慢

**误区二：所有大表都需要分区**

- **说明**：分区表有适用场景，不是所有大表都需要
- **后果**：过度分区，增加复杂度
- **正确理解**：
  - <1000万行：通常不需要分区
  - 1000万-1亿行：考虑分区
  - >1亿行：建议分区

**误区三：分区键可以随便选**

- **说明**：分区键的选择至关重要，影响分区裁剪效果
- **后果**：分区键选择不当，无法裁剪
- **正确理解**：
  - 按时间查询：选时间字段作为分区键
  - 按ID查询：选ID字段作为分区键
  - 按地区查询：选地区字段作为分区键

**误区四：分区后不需要索引**

- **说明**：分区表仍然需要索引，只是索引在各个分区内
- **后果**：不创建索引，查询慢
- **正确理解**：
  - 分区表需要在主表创建索引
  - 索引会自动应用到所有分区
  - 可以在单个分区创建额外索引

**误区五：分区表的维护很简单**

- **说明**：分区表减少了维护成本，但仍然需要维护
- **后果**：不维护，分区表性能下降
- **正确理解**：
  - 需要定期创建新分区
  - 需要定期删除旧分区
  - 需要监控分区大小和性能
  - 需要定期VACUUM和ANALYZE

#### 九、实战任务

**任务1：创建分区表**

创建一个按月分区的orders表：

```sql
-- 1. 创建主表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)
) PARTITION BY RANGE (created_at);

-- 2. 创建最近3个月的分区
CREATE TABLE orders_202604 PARTITION OF orders
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE orders_202606 PARTITION OF orders
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- 3. 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);

-- 4. 插入测试数据
INSERT INTO orders (order_id, user_id, order_status, total_amount, created_at, paid_at)
VALUES (1, 123, 'paid', 100.00, '2026-05-15 10:00:00', '2026-05-15 10:05:00');

-- 5. 查询（验证分区裁剪）
EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-05-01' AND created_at < '2026-06-01';
```

**观察**：
- 执行计划只扫描orders_202605分区？
- 插入数据是否自动路由到正确分区？

**任务2：分区维护**

模拟分区维护操作：

```sql
-- 1. 创建下个月的分区
CREATE TABLE orders_202607 PARTITION OF orders
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

-- 2. 删除旧分区（先备份）
CREATE TABLE orders_202604_backup AS SELECT * FROM orders_202604;
DROP TABLE orders_202604;

-- 3. 查看分区大小
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'orders_%'
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

**任务3：分区裁剪验证**

验证分区裁剪是否生效：

```sql
-- 查询1：按分区键查询（应该裁剪）
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= '2026-05-15' AND created_at < '2026-05-16';

-- 查询2：不按分区键查询（可能不裁剪）
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 查询3：跨分区查询（应该扫描多个分区）
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= '2026-04-01' AND created_at < '2026-06-01';
```

**对比**：
- 哪些查询能裁剪？
- 哪些查询不能裁剪？
- 性能差异多大？

#### 十、小结

分区表让大表具有物理边界。

核心要点：
- 分区表通过分区键定义物理边界
- 常见分区类型：RANGE、LIST、HASH
- 按时间分区是最常见的场景
- 分区裁剪能显著提升查询性能
- 分区表便于维护（删除旧数据、备份单个分区）
- 分区表有限制（主键必须包含分区键）
- 分区表仍然需要索引和维护

下一节将进入表空间与存储策略：如何通过存储优化进一步提升分区表的价值。
