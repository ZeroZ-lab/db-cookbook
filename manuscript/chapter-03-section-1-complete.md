### 3.1 大表为什么慢：从现象到本质

第2章学习了SQL分析能力，假设数据表规模合理，查询能快速返回。

但现实业务中，数据会持续增长：

```text
订单表：从10万行 → 100万行 → 1000万行 → 1亿行
用户行为表：每天100万行 → 一个月3000万行
日志表：每天1000万行 → 一个月3亿行
```

当表越来越大，你会发现：

**现象1**：查询变慢
```sql
-- 以前：10万行，查询只需0.1秒
SELECT count(*) FROM orders;

-- 现在：1亿行，查询需要30秒
SELECT count(*) FROM orders;
```

**现象2**：索引失效
```sql
-- 以前：索引查询很快
SELECT * FROM orders WHERE user_id = 123;

-- 现在：即使有索引，查询还是很慢
-- 优化器选择全表扫描而不是索引扫描
```

**现象3**：存储和备份困难
```sql
-- 表大小：100GB → 1TB
-- 备份时间：10分钟 → 2小时
-- 恢复时间：30分钟 → 6小时
```

**为什么大表会变慢？**

是因为数据多吗？不完全是因为数据多，而是因为：
- 数据库需要扫描更多数据
- 索引变得庞大且低效
- 内存装不下数据和索引
- 磁盘I/O成为瓶颈

理解大表为什么慢，是解决大表问题的第一步。

#### 一、为什么大表会变慢

**第一，数据量增加导致扫描时间增长**

**COUNT(*)查询的时间复杂度**：
```sql
-- 10万行：0.1秒
-- 100万行：1秒
-- 1000万行：10秒
-- 1亿行：100秒
```

**原因**：
- COUNT(*)需要扫描全表
- 时间与行数成正比
- 磁盘I/O是主要瓶颈

**即使有索引，COUNT(*)也慢**：
```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 这个查询能使用索引（快）
SELECT count(*) FROM orders WHERE user_id = 123;

-- 这个查询不能使用索引（慢）
SELECT count(*) FROM orders;
```

**为什么？**
- WHERE user_id = 123：索引直接定位到user_id=123的记录
- COUNT(*)：需要统计所有行，索引无法减少扫描量

**第二，索引变得庞大且低效**

**索引大小增长**：
```text
10万行：索引10MB
100万行：索引100MB
1000万行：索引1GB
1亿行：索引10GB
```

**问题**：
- 索引太大，内存装不下
- 需要频繁的磁盘I/O
- 索引扫描变慢

**B-Tree索引的查找成本**：
```
10万行：树高度3，需要3次磁盘I/O
1000万行：树高度4，需要4次磁盘I/O
1亿行：树高度5，需要5次磁盘I/O
```

**每次I/O约10ms，5次I/O就是50ms，再加上数据扫描，查询就慢了。**

**第三，内存不足导致频繁磁盘I/O**

**PostgreSQL的共享缓冲区（shared_buffers）**：
```yaml
默认配置：128MB
推荐配置：系统内存的25%
大型服务器：8GB-32GB
```

**问题场景**：
```sql
-- 表大小：100GB
-- 内存：8GB
-- 查询需要扫描全表
-- 结果：频繁的磁盘I/O，查询很慢
```

**理想场景**：
```sql
-- 表大小：10GB
-- 内存：32GB
-- 查询需要扫描全表
-- 结果：数据可以缓存在内存，查询较快
```

**第四，锁竞争和并发问题**

**大表的更新和删除**：
```sql
-- 删除一个月前的旧数据（1000万行）
DELETE FROM events WHERE event_time < '2026-03-01';

-- 问题：
-- 1. 执行时间长（可能需要数小时）
-- 2. 锁定表，影响其他查询
-- 3. 产生大量的WAL日志
-- 4. 表膨胀（需要VACUUM回收空间）
```

**大表的导入**：
```sql
-- 导入1亿行数据
COPY orders FROM 'orders.csv';

-- 问题：
-- 1. 执行时间长
-- 2. 索引维护成本高
-- 3. 影响其他查询
```

**结论**：
> 大表变慢的根本原因是：数据量增长导致磁盘I/O增加、内存不足、索引效率下降、锁竞争加剧。

#### 二、核心判断：大表慢不是"数据多"而是"访问效率低"

> 大表性能问题的核心判断是：大表慢不是因为数据量大，而是因为访问模式不适合数据规模，需要通过分区、索引、缓存、归档等手段提升访问效率。

这个判断说明：
- **数据量增长**：是业务发展的自然结果
- **性能问题**：是访问模式不匹配导致的
- **解决方案**：优化访问模式，而不是减少数据
- **目标**：让查询只访问需要的数据

#### 三、大表性能问题的本质

##### 3.1 磁盘I/O是主要瓶颈

**磁盘I/O速度**：
```
顺序读取：100-200 MB/s
随机读取：1-5 MB/s
内存访问：几GB/s
```

**查询时间对比**：
```sql
-- 内存中的数据（缓存命中）：0.1ms
-- 磁盘顺序读取：10ms
-- 磁盘随机读取：100ms
```

**差距**：磁盘比内存慢100-1000倍

**大表的问题**：
- 数据太大，无法全部装入内存
- 需要频繁的磁盘I/O
- 查询时间主要由磁盘I/O决定

##### 3.2 全表扫描 vs 索引扫描

**全表扫描（Seq Scan）**：
```sql
-- 没有索引或索引不适用
EXPLAIN SELECT * FROM orders WHERE total_amount > 1000;

-- 执行计划
Seq Scan on orders  (cost=0.00..123456.78 rows=10000 width=200)
  Filter: (total_amount > 1000)
```

**特点**：
- 从头到尾扫描整个表
- 适合：返回大量数据（如>表大小的5%）
- 不适合：只返回少量数据

**索引扫描（Index Scan）**：
```sql
-- 有索引且适用
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 执行计划
Index Scan using idx_orders_user_id on orders  (cost=0.42..8.44 rows=100 width=200)
  Index Cond: (user_id = 123)
```

**特点**：
- 通过索引快速定位数据
- 适合：只返回少量数据（如<表大小的1%）
- 不适合：返回大量数据

**索引扫描的代价**：
- 需要先读索引（磁盘I/O）
- 再读表数据（磁盘I/O）
- 如果返回大量数据，索引扫描反而更慢

##### 3.3 索引的选择性

**索引选择性**：唯一值比例

**高选择性**：
```sql
-- user_id有100万个不同值
SELECT count(DISTINCT user_id) / count(*) FROM orders;
-- 结果：0.9（90%的行都是不同的）
-- 适合索引
```

**低选择性**：
```sql
-- order_status只有5个不同值
SELECT count(DISTINCT order_status) / count(*) FROM orders;
-- 结果：0.000005（只有5个不同状态）
-- 不适合索引
```

**PostgreSQL的优化器决策**：
```sql
-- 高选择性查询：使用索引
SELECT * FROM orders WHERE user_id = 123;
-- 优化器认为只返回0.0001%的数据，用索引快

-- 低选择性查询：不使用索引
SELECT * FROM orders WHERE order_status = 'paid';
-- 优化器认为返回50%的数据，全表扫描更快
```

##### 3.4 数据分布的影响

**数据倾斜**：
```sql
-- 大部分订单集中在少数用户
user_id=1: 100万笔订单
user_id=2: 50万笔订单
user_id=3-1000000: 1笔订单

-- 查询user_id=1：很慢（即使有索引）
SELECT * FROM orders WHERE user_id = 1;
-- 原因：需要扫描100万行，索引扫描不如全表扫描
```

**时间局部性**：
```sql
-- 最近的数据经常被查询
SELECT * FROM orders WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 旧数据很少被查询
SELECT * FROM orders WHERE created_at < '2020-01-01';
```

**如果分区，可以只扫描最近7天的分区，而不是整个表。**

#### 四、大表性能问题的分类

##### 4.1 查询性能问题

**症状**：
- SELECT查询慢
- 执行时间长
- 资源占用高

**原因**：
- 全表扫描
- 索引不适用
- 数据量大
- JOIN复杂

**示例**：
```sql
-- 慢查询
SELECT
    u.user_id,
    u.name,
    o.order_id,
    o.total_amount
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-01-01';
-- 问题：需要扫描整个orders表
```

##### 4.2 写入性能问题

**症状**：
- INSERT慢
- UPDATE慢
- DELETE慢
- 锁等待

**原因**：
- 索引维护成本高
- 表锁竞争
- WAL日志量大
- 磁盘I/O瓶颈

**示例**：
```sql
-- 删除旧数据很慢
DELETE FROM events WHERE event_time < '2026-01-01';
-- 问题：需要扫描全表，产生大量WAL，锁表
```

##### 4.3 维护性能问题

**症状**：
- VACUUM慢
- 备份慢
- 恢复慢
- 索引重建慢

**原因**：
- 表太大
- 死元组多
- 磁盘I/O瓶颈

**示例**：
```sql
-- VACUUM FULL需要很长时间
VACUUM FULL orders;
-- 问题：需要重写整个表，锁表
```

#### 五、大表性能优化思路

##### 5.1 减少扫描的数据量

**方法1：分区表**
```sql
-- 按日期分区
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 查询时只扫描相关分区
SELECT * FROM orders WHERE created_at = '2026-04-01';
-- 只扫描2026-04-01的分区
```

**方法2：时间归档**
```sql
-- 将旧数据移到归档表
INSERT INTO orders_archive SELECT * FROM orders WHERE created_at < '2020-01-01';
DELETE FROM orders WHERE created_at < '2020-01-01';
```

**方法3：冷热分离**
```sql
-- 热数据：最近3个月（频繁访问）
-- 温数据：3-12个月（偶尔访问）
-- 冷数据：12个月以上（很少访问）
```

##### 5.2 提升索引效率

**方法1：创建合适的索引**
```sql
-- 单列索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 组合索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 部分索引
CREATE INDEX idx_orders_paid ON orders(user_id) WHERE order_status = 'paid';
```

**方法2：使用覆盖索引**
```sql
-- 索引包含查询需要的所有字段
CREATE INDEX idx_orders_covering ON orders(user_id, total_amount, created_at);

-- 查询只需要读索引，不需要读表
SELECT user_id, sum(total_amount)
FROM orders
WHERE user_id = 123
GROUP BY user_id;
```

##### 5.3 优化查询方式

**方法1：尽早过滤**
```sql
-- 不好：先JOIN再过滤
SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id WHERE o.created_at >= '2026-01-01';

-- 好：先过滤再JOIN
SELECT * FROM users u JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-01-01'
) o ON u.user_id = o.user_id;
```

**方法2：使用物化视图**
```sql
-- 预计算常用的聚合结果
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询物化视图（快）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

##### 5.4 硬件优化

**方法1：增加内存**
```yaml
-- shared_buffers：8GB → 32GB
-- effective_cache_size：24GB → 96GB
```

**方法2：使用SSD**
```yaml
-- HDD：随机读取100 IOPS
-- SSD：随机读取10000 IOPS
-- 性能提升：100倍
```

**方法3：增加CPU**
```yaml
-- 更多CPU核心 → 并行查询
```

#### 六、常见误区

**误区一：大表一定要分区**

- **说明**：分区表有适用场景，不是所有大表都需要分区
- **后果**：不当分区导致性能更差
- **正确理解**：
  - 按时间范围查询：适合分区
  - 按ID查询：不需要分区
  - 数据量<1000万：通常不需要分区

**误区二：索引越多越快**

- **说明**：索引加速查询，但降低写入速度
- **后果**：索引太多，写入慢，空间浪费
- **正确理解**：
  - 只为常用查询创建索引
  - 定期清理无用索引
  - 平衡查询和写入性能

**误区三：删除旧数据就能解决问题**

- **说明**：删除数据只是暂时缓解问题，不解决根本
- **后果**：数据继续增长，问题重复出现
- **正确理解**：
  - 需要建立数据归档策略
  - 需要分区表管理数据生命周期
  - 需要从架构上解决

**误区四：升级硬件就能解决**

- **说明**：硬件升级能缓解问题，但有成本和上限
- **后果**：硬件成本高，问题依然存在
- **正确理解**：
  - 先优化SQL和索引
  - 再考虑分区和归档
  - 最后才升级硬件

**误区五：大表问题可以一次性解决**

- **说明**：大表优化是持续工作，不是一次性项目
- **后果**：优化后不再关注，性能再次恶化
- **正确理解**：
  - 定期监控表大小和查询性能
  - 定期维护索引和统计信息
  - 持续优化和迭代

#### 七、实战任务

**任务1：分析大表性能问题**

给定orders表（1亿行），分析以下查询的性能问题：

```sql
-- 查询1：统计订单总数
SELECT count(*) FROM orders;

-- 查询2：查询某个用户的订单
SELECT * FROM orders WHERE user_id = 123;

-- 查询3：查询某天的订单
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 查询4：统计每天GMV
SELECT date(created_at), sum(total_amount) FROM orders GROUP BY date(created_at);
```

**分析步骤**：
1. 使用EXPLAIN ANALYZE分析执行计划
2. 识别全表扫描和索引扫描
3. 找出性能瓶颈
4. 提出优化建议

**任务2：测试索引效果**

创建索引前后的性能对比：

```sql
-- 步骤1：查看表大小
SELECT pg_size_pretty(pg_total_relation_size('orders'));

-- 步骤2：无索引查询
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 步骤3：创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 步骤4：有索引查询
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 步骤5：对比执行时间和执行计划
```

**观察指标**：
- 执行时间差异
- 扫描行数差异
- 使用了哪个索引

**任务3：监控表增长**

监控orders表的增长情况：

```sql
-- 查询表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
    pg_total_relation_size(schemaname||'.'||tablename) as size_bytes
FROM pg_tables
WHERE tablename = 'orders';

-- 查询行数
SELECT count(*) FROM orders;

-- 查询最早和最晚的记录
SELECT min(created_at), max(created_at) FROM orders;

-- 计算每天的数据增长量
SELECT
    date(created_at) as order_date,
    count(*) as daily_rows
FROM orders
GROUP BY date(created_at)
ORDER BY order_date DESC
LIMIT 30;
```

**分析**：
- 表增长速度如何？
- 是否需要优化？
- 何时需要考虑分区？

#### 八、小结

大表变慢是业务发展的自然结果。

核心要点：
- 大表慢不是因为数据多，而是访问效率低
- 磁盘I/O是主要瓶颈，比内存慢100-1000倍
- 索引不是万能的，有选择性要求
- 优化思路：减少扫描量、提升索引效率、优化查询方式
- 大表优化是持续工作，需要监控和维护

下一节将进入PostgreSQL的单机边界：理解PostgreSQL能做什么，不能做什么，帮助判断何时需要其他方案。
