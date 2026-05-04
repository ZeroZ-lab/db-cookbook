### 3.3 分区表：让大表具有物理边界

前两节讨论了大表为什么慢，以及PostgreSQL的能力边界。结论之一是：当数据量增长时，需要优化访问模式。优化访问模式的一个核心手段是分区表（Partitioning）。

分区表就是把一个大表物理上拆分成多个小表，但逻辑上还是一个大表。

```sql
-- 不分区：一个大表orders（1亿行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 需要扫描整个表（1亿行）

-- 分区：按月分成12个分区表（每个月约800万行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 只扫描4月的分区（800万行）
```

分区表的价值：查询优化（只扫描相关分区，减少I/O）、维护便利（可以单独删除、备份、恢复某个分区）、扩展性（可以在不同分区使用不同存储策略）。

#### 一、为什么需要分区表

按时间查询是大表的常见场景。查询今天的订单、本月的订单、去年的订单，即使有索引也可能需要扫描大量数据。如果按月分区，查询今天的订单只扫描当前月的分区。

数据生命周期管理需要物理边界。不分区时，删除一年前的日志需要扫描全表数十亿行、产生大量WAL日志、锁表时间长、需要VACUUM回收空间。按月分区后，直接`DROP TABLE events_202504`，不产生WAL日志、不锁表、不需要VACUUM。

不同时间的数据有不同访问模式。最近3个月频繁访问（热数据），3-12个月偶尔访问（温数据），12个月以上很少访问（冷数据）。分区后可以将热数据放在SSD、分配更多内存和索引，冷数据放在HDD、压缩存储、较少索引。

分区表的价值在于：通过物理边界，让查询、维护、存储优化成为可能。

#### 二、分区表的类型

**RANGE分区（范围分区）：** 按时间、ID范围等有序字段分区，最常用的是按月分区。

```sql
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_202601 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_202602 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 查询时自动分区裁剪，只扫描orders_202603分区
SELECT * FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';
```

优势是按时间查询性能好、删除旧数据简单（DROP分区）、符合数据生命周期。

**LIST分区（列表分区）：** 按离散值分区（如地区、状态）。

```sql
CREATE TABLE users (
    user_id BIGINT, name VARCHAR(100), region VARCHAR(50), registered_at TIMESTAMP
) PARTITION BY LIST (region);

CREATE TABLE users_east PARTITION OF users
    FOR VALUES IN ('beijing', 'shanghai', 'hangzhou');

CREATE TABLE users_west PARTITION OF users
    FOR VALUES IN ('chengdu', 'xian', 'chongqing');

-- 查询时自动分区裁剪，只扫描users_east分区
SELECT * FROM users WHERE region = 'beijing';
```

优势是按地区查询性能好、地区数据隔离、便于地域化部署。

**HASH分区（哈希分区）：** 按用户ID哈希分区，均匀分布数据避免热点。

```sql
CREATE TABLE events (
    event_id BIGINT, user_id BIGINT, event_name VARCHAR(100), event_time TIMESTAMP
) PARTITION BY HASH (user_id);

CREATE TABLE events_0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

优势是数据均匀分布、避免热点、适合并行写入。

#### 三、分区表的实战应用

按日期分区是最常见的场景。需要创建主表、创建默认分区（防止数据写入失败）、创建分区（可用脚本自动创建）。自动创建分区的函数可以定期执行，如每月1号自动创建下月分区。

分区表的索引需要注意：在主表创建索引会自动为每个分区创建索引，在单个分区可以创建额外索引。跨分区查询需要查询所有分区的索引。

分区表的主键约束是：主键必须包含分区键。`PRIMARY KEY (order_id, created_at)`是正确的写法。外键不需要包含分区键。更新分区键可能导致行在分区之间移动，建议避免更新分区键。

#### 四、分区表的性能优化

分区裁剪（Partition Pruning）是核心优化机制。查询时只扫描相关的分区，大幅减少I/O。确保分区裁剪生效的关键是：分区键在WHERE条件中直接使用，不要被函数包装。`WHERE created_at >= '2026-04-01'`可以裁剪，`WHERE date(created_at) = '2026-04-01'`可能无法裁剪。

分区表支持并行查询。查询跨越多个分区时，`max_parallel_workers_per_gather = 4`配置下3个分区可以并行扫描，每个Worker扫描一个分区。

#### 五、分区表的维护

创建新分区可以手动创建，也可以用pg_cron设置每月1号自动创建。删除旧分区直接DROP TABLE，快速且不产生WAL日志。备份单个分区用`pg_dump -t orders_202601`。

分区数量不宜过多。按月分区1-3年的数据有12-36个分区合理；按日分区同理。太多分区会导致查询规划器需要评估更多分区、内存占用增加、文件句柄占用多。

#### 六、常见误区

**分区表一定能提升性能。** 分区表只对按分区键查询提升性能。不按分区键查询可能性能下降，分区数量太多会导致查询规划慢。

**所有大表都需要分区。** 小于1000万行通常不需要分区，1000万-1亿行考虑分区，超过1亿行建议分区。

**分区后不需要索引。** 分区表仍然需要索引，在主表创建索引会自动应用到所有分区，也可以在单个分区创建额外索引。

**分区表的维护很简单。** 需要定期创建新分区、删除旧分区、监控分区大小和性能、定期VACUUM和ANALYZE。

#### 七、小结

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
