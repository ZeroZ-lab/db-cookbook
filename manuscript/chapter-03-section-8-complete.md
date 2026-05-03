### 3.8 物化视图：把重复计算提前做掉

前几节学习了多种优化手段：
- 分区表：通过物理边界优化查询
- 索引：加速数据查找
- 查询优化：分析执行计划，优化查询逻辑

但这些优化都是针对单个查询的。

**问题**：如果一个复杂查询被频繁执行怎么办？

**场景**：
```sql
-- 复杂聚合查询（每天执行1000次）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 执行时间：5秒
-- 总时间：5秒 × 1000次 = 5000秒（约1.4小时）
```

**问题**：
- 每次都重新计算
- 浪费CPU资源
- 响应时间慢

**解决方案**：**物化视图（Materialized View）**

**什么是物化视图？**

普通视图（View）：
```sql
-- 只存储查询逻辑，不存储数据
CREATE VIEW daily_gmv_view AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询时重新计算
SELECT * FROM daily_gmv_view WHERE order_date = '2026-04-01';
-- 执行时间：5秒（每次都计算）
```

物化视图（Materialized View）：
```sql
-- 存储查询结果（物理存储）
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询时直接读取预计算结果
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- 执行时间：0.01秒（直接读取）
```

**性能差异**：500倍！

#### 一、为什么需要物化视图

**第一，复杂聚合查询计算成本高**

**场景**：每日GMV统计

**计算内容**：
```sql
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users,
    avg(total_amount) as avg_amount,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount) as median_amount
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);
```

**问题**：
- 需要扫描大量数据（可能数亿行）
- 需要多个聚合函数（SUM、COUNT、AVG、百分位数）
- 需要去重计算（DISTINCT）
- 每次查询都重新计算

**成本**：
- 执行时间：10秒
- CPU占用：高
- 磁盘I/O：高

**物化视图**：
```sql
CREATE MATERIALIZED VIEW daily_gmv_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users,
    avg(total_amount) as avg_amount,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount) as median_amount
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 查询时直接读取
SELECT * FROM daily_gmv_stats WHERE order_date = '2026-04-01';
-- 执行时间：0.01秒
```

**第二，报表查询需要固定数据**

**场景**：运营看板

**需求**：
```yaml
实时性：每小时更新一次
查询频率：每天1000次
数据范围：最近30天
```

**问题**：
- 每次查询都重新计算30天的数据
- 浪费资源
- 响应慢

**物化视图**：
```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at);

-- 每小时刷新一次
REFRESH MATERIALIZED VIEW dashboard_stats;

-- 查询时直接读取
SELECT * FROM dashboard_stats ORDER BY order_date DESC;
```

**第三，JOIN查询可以预计算**

**场景**：用户订单统计

**查询**：
```sql
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;
```

**问题**：
- 需要JOIN两个大表
- 需要聚合计算
- 每次都重新计算

**物化视图**：
```sql
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 定期刷新
REFRESH MATERIALIZED VIEW user_order_stats;

-- 查询时直接读取
SELECT * FROM user_order_stats WHERE user_id = 123;
```

**结论**：
> 物化视图通过预计算和存储查询结果，将复杂查询的时间从秒级降到毫秒级，特别适合报表、看板、统计分析等场景。

#### 二、核心判断：物化视图用空间换时间

> 物化视图的核心判断是：通过预计算并存储查询结果，牺牲存储空间和实时性，换取查询性能的大幅提升，适合重复执行、计算成本高的查询。

这个判断说明：
- **预计算**：提前执行复杂查询
- **存储**：存储查询结果
- **代价**：占用存储空间、数据有延迟
- **收益**：查询性能大幅提升

#### 三、物化视图的基础

##### 3.1 创建物化视图

**基本语法**：
```sql
CREATE MATERIALIZED VIEW mv_name AS
SELECT ...
FROM ...
WHERE ...
GROUP BY ...;
```

**示例**：
```sql
-- 创建每日GMV物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 查看物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

**查看物化视图**：
```sql
-- 查看所有物化视图
SELECT
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews;
```

##### 3.2 刷新物化视图

**为什么需要刷新？**
- 物化视图存储的是查询结果
- 底表数据变化后，物化视图不会自动更新
- 需要手动刷新

**刷新方式**：
```sql
-- 完全刷新（删除并重新创建）
REFRESH MATERIALIZED VIEW daily_gmv;

-- 并发刷新（PostgreSQL 9.4+）
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_gmv;
```

**区别**：
- 完全刷新：锁定物化视图，刷新期间无法查询
- 并发刷新：不锁定物化视图，刷新期间可以查询

**注意**：
- 并发刷新需要创建UNIQUE索引
- 刷新成本高，不要频繁刷新

##### 3.3 删除物化视图

```sql
-- 删除物化视图
DROP MATERIALIZED VIEW daily_gmv;

-- 删除并重建
DROP MATERIALIZED VIEW IF EXISTS daily_gmv;
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT ...
```

#### 四、物化视图的高级用法

##### 4.1 增量刷新

**问题**：完全刷新成本高

**场景**：
```sql
-- 物化视图有1亿行
-- 每次刷新都要重新计算
-- 刷新时间：30分钟
```

**解决方案**：增量刷新（PostgreSQL 9.4+）

```sql
-- 创建物化视图时指定刷新方式
CREATE MATERIALIZED VIEW daily_gmv WITH (refresh = incremental) AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 增量刷新（只刷新变化的数据）
REFRESH MATERIALIZED VIEW daily_gmv;
```

**注意**：
- 增量刷新需要特定条件
- 需要有UNIQUE索引
- 不是所有场景都支持

##### 4.2 物化视图的索引

**为什么需要索引？**
- 物化视图也是表，可以创建索引
- 加速对物化视图的查询

**示例**：
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 创建索引
CREATE INDEX idx_daily_gmv_date ON daily_gmv(order_date);

-- 查询时使用索引
EXPLAIN SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

##### 4.3 物化视图的分区

**场景**：物化视图也可以分区

```sql
-- 创建分区表
CREATE TABLE orders (...) PARTITION BY RANGE (created_at);

-- 创建分区物化视图
CREATE MATERIALIZED VIEW daily_gmv_partitioned AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 按月分区（手动创建分区）
CREATE TABLE daily_gmv_202601 PARTITION OF daily_gmv_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

#### 五、物化视图的使用场景

##### 5.1 报表和看板

**场景**：运营看板

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at);

-- 每小时刷新一次
REFRESH MATERIALIZED VIEW dashboard_stats;

-- 看板查询
SELECT
    order_date,
    gmv,
    order_count,
    unique_users
FROM dashboard_stats
ORDER BY order_date DESC;
```

##### 5.2 数据聚合

**场景**：用户行为分析

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW user_daily_stats AS
SELECT
    user_id,
    date(event_time) as activity_date,
    count(*) as event_count,
    count(DISTINCT event_name) as unique_events
FROM events
WHERE event_time >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id, date(event_time);

-- 每天刷新一次
REFRESH MATERIALIZED VIEW user_daily_stats;

-- 分析查询
SELECT * FROM user_daily_stats WHERE user_id = 123;
```

##### 5.3 预计算JOIN结果

**场景**：用户订单统计

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount,
    avg(o.total_amount) as avg_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_status = 'paid'
GROUP BY u.user_id, u.name;

-- 每天刷新一次
REFRESH MATERIALIZED VIEW user_order_stats;

-- 查询
SELECT * FROM user_order_stats ORDER BY total_amount DESC LIMIT 10;
```

#### 六、物化视图的维护

##### 6.1 自动刷新

**方法1：使用pg_cron**
```sql
-- 启用扩展
CREATE EXTENSION pg_cron;

-- 每小时刷新一次
SELECT cron.schedule('refresh-daily-gmv', '0 * * * *', 'REFRESH MATERIALIZED VIEW daily_gmv');
```

**方法2：使用系统定时任务**
```bash
# crontab -e
# 每小时刷新一次
0 * * * * psql -d mydb -c "REFRESH MATERIALIZED VIEW daily_gmv"
```

##### 6.2 监控物化视图

**查看物化视图大小**：
```sql
SELECT
    matviewname,
    pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as size
FROM pg_matviews
WHERE matviewname = 'daily_gmv';
```

**查看物化视图的依赖**：
```sql
-- 查看哪些表依赖这个物化视图
SELECT * FROM pg_mv_dependency WHERE matviewid = 'daily_gmv'::regclass;
```

##### 6.3 刷新策略

**刷新频率选择**：
```yaml
实时数据：不使用物化视图
准实时（5分钟）：每5分钟刷新
小时级：每小时刷新
天级：每天刷新
周级：每周刷新
```

**刷新成本**：
```sql
-- 查看刷新时间
EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW daily_gmv;

-- 根据刷新时间决定刷新频率
-- 刷新时间5秒：可以每小时刷新
-- 刷新时间30分钟：只能每天刷新
```

#### 七、物化视图 vs 其他方案

##### 7.1 物化视图 vs 普通视图

| 维度 | 物化视图 | 普通视图 |
|------|---------|---------|
| 存储 | 存储查询结果 | 只存储查询逻辑 |
| 查询速度 | 快（直接读取） | 慢（重新计算） |
| 实时性 | 延迟（需刷新） | 实时 |
| 存储成本 | 高 | 低 |
| 适用场景 | 报表、看板 | 复杂查询封装 |

##### 7.2 物化视图 vs 缓存

| 维度 | 物化视图 | Redis缓存 |
|------|---------|----------|
| 存储 | PostgreSQL | Redis |
| 数据结构 | 表 | KV |
| 查询 | SQL | GET |
| 一致性 | 强（ACID） | 弱（最终一致） |
| 适用场景 | 复杂聚合 | 简单KV查询 |

**建议**：
- 复杂聚合：物化视图
- 简单KV：Redis缓存
- 可以结合使用

##### 7.3 物化视图 vs 定时任务

| 维度 | 物化视图 | 定时任务 |
|------|---------|---------|
| 实现 | SQL | 应用代码 |
| 存储 | PostgreSQL | 应用或数据库 |
| 查询 | SQL | 读取预计算结果 |
| 维护 | SQL刷新 | 任务调度 |
| 适用场景 | 纯SQL场景 | 需要复杂处理的场景 |

#### 八、常见误区

**误区一：物化视图总是比直接查询快**

- **说明**：物化视图预计算了结果，查询快，但数据有延迟
- **后果**：在需要实时数据的场景使用物化视图
- **正确理解**：
  - 报表、看板：物化视图
  - 实时查询：直接查询
  - 根据实时性要求选择

**误区二：物化视图不需要维护**

- **说明**：物化视图需要定期刷新，否则数据过时
- **后果**：数据过时，误导决策
- **正确理解**：
  - 根据业务需求设定刷新频率
  - 监控刷新是否成功
  - 定期review物化视图

**误区三：物化视图可以实时更新**

- **说明**：PostgreSQL的物化视图不支持实时更新（需要手动刷新）
- **后果**：以为物化视图是实时的，数据过时
- **正确理解**：
  - 物化视图有延迟
  - 需要定期刷新
  - 或者使用其他方案（如触发器、应用层计算）

**误区四：所有查询都应该用物化视图**

- **说明**：物化视图占用存储空间，只适合重复执行的查询
- **后果**：创建太多物化视图，存储浪费
- **正确理解**：
  - 重复执行的查询：物化视图
  - 偶尔执行的查询：直接查询
  - 计算成本高的查询：物化视图

**误区五：物化视图不需要索引**

- **说明**：物化视图也是表，可以创建索引
- **后果**：查询物化视图还是很慢
- **正确理解**：
  - 为物化视图创建索引
  - 特别是WHERE条件中的字段
  - 加速对物化视图的查询

#### 九、实战任务

**任务1：创建物化视图**

创建每日GMV物化视图：

```sql
-- 1. 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 2. 创建索引
CREATE INDEX idx_daily_gmv_date ON daily_gmv(order_date);

-- 3. 查询
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';

-- 4. 验证性能
EXPLAIN ANALYZE SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

**任务2：刷新物化视图**

模拟数据变化后的刷新：

```sql
-- 1. 插入新数据
INSERT INTO orders (user_id, order_status, total_amount, created_at)
VALUES (999, 'paid', 100.00, '2026-04-01 10:00:00');

-- 2. 查询物化视图（数据未更新）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- order_count没有变化

-- 3. 刷新物化视图
REFRESH MATERIALIZED VIEW daily_gmv;

-- 4. 再次查询（数据已更新）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- order_count已经更新
```

**任务3：自动刷新**

设置自动刷新：

```sql
-- 1. 启用pg_cron
CREATE EXTENSION pg_cron;

-- 2. 创建定时任务（每小时刷新一次）
SELECT cron.schedule(
    'refresh-daily-gmv',
    '0 * * * *',
    'REFRESH MATERIALIZED VIEW daily_gmv'
);

-- 3. 查看定时任务
SELECT * FROM cron.job WHERE jobname = 'refresh-daily-gmv';

-- 4. 手动触发刷新（测试）
REFRESH MATERIALIZED VIEW daily_gmv;
```

#### 十、小结

物化视图通过预计算和存储查询结果，大幅提升查询性能。

核心要点：
- 物化视图存储查询结果，查询时直接读取
- 用空间换时间，适合重复执行的查询
- 需要定期刷新，数据有延迟
- 可以为物化视图创建索引
- 适合场景：报表、看板、数据聚合
- 刷新策略：根据业务需求设定频率
- 与普通视图、缓存、定时任务各有优劣

下一节将进入并行查询：利用多核CPU加速大表查询。
