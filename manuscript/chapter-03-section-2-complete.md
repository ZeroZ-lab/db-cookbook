### 3.2 PostgreSQL的单机边界：能做什么，不能做什么

上一节讨论了大表为什么慢，核心问题是数据量增长导致的访问效率下降。

但这引出一个更根本的问题：**PostgreSQL能处理多大规模的数据？**

```text
单表1亿行：PostgreSQL能处理吗？
单表1TB：PostgreSQL能处理吗？
总数据100TB：PostgreSQL能处理吗？
并发1000 QPS：PostgreSQL能处理吗？
并发10000 QPS：PostgreSQL能处理吗？
```

**答案是：看场景。**

有些场景PostgreSQL能轻松应对，有些场景则超出PostgreSQL的能力边界。

理解PostgreSQL的能力边界，才能：
- 选择合适的场景使用PostgreSQL
- 知道何时需要其他方案（如分库分表、OLAP数据库）
- 避免过度设计或欠设计

#### 一、为什么需要理解边界

**第一，避免过度设计**

**场景**：创业公司的订单系统

**过度设计**：
```yaml
架构：分库分表 + Redis + 消息队列
理由：担心将来数据量太大
问题：
  - 开发复杂度增加
  - 维护成本高
  - 实际数据量只有100万行
  - PostgreSQL单机完全够用
```

**合理设计**：
```yaml
架构：PostgreSQL单机
理由：当前数据量100万行，PostgreSQL轻松应对
好处：
  - 开发简单
  - 维护成本低
  - 性能足够
  - 未来可以扩展
```

**第二，避免欠设计**

**场景**：用户行为分析系统，每天1亿行事件数据

**欠设计**：
```yaml
架构：PostgreSQL单机
理由：简单
问题：
  - 一年后数据量365亿行
  - 查询很慢（几分钟到几小时）
  - 存储成本高
  - 不适合分析场景
```

**合理设计**：
```yaml
架构：ClickHouse集群
理由：
  - 分析场景（不是事务场景）
  - 数据量大（每天1亿行）
  - 需要快速聚合查询
好处：
  - 查询快（秒级）
  - 压缩比高（存储成本低）
  - 适合分析场景
```

**第三，知道何时升级**

**PostgreSQL能应对的阶段**：
```yaml
数据量：< 10亿行
并发：< 1000 QPS
场景：OLTP（事务处理）
```

**需要升级的阶段**：
```yaml
数据量：> 10亿行
并发：> 1000 QPS
场景：OLAP（分析查询）
→ 需要分库分表或OLAP数据库
```

**结论**：
> 理解PostgreSQL的能力边界，是为了在合适的场景使用合适的工具，避免过度设计和欠设计。

#### 二、核心判断：PostgreSQL不是万能的，但有明确的适用边界

> PostgreSQL单机边界的核心判断是：PostgreSQL擅长OLTP（事务处理）和轻量级OLAP（分析查询），但当数据量或并发超过一定阈值时，需要分库分表或迁移到专用系统。

这个判断说明：
- **擅长**：OLTP、轻量级分析
- **边界**：数据量、并发、场景
- **扩展**：分库分表、迁移到专用系统
- **判断**：根据实际需求和规模选择

#### 三、PostgreSQL的能力边界

##### 3.1 数据量边界

**单表规模**：

| 规模 | 行数 | 大小 | 性能 | 建议 |
|------|------|------|------|------|
| 小表 | < 100万 | < 1GB | 毫秒级 | 无需优化 |
| 中表 | 100万-1000万 | 1GB-10GB | 秒级 | 需要索引 |
| 大表 | 1000万-1亿 | 10GB-100GB | 秒级到分钟级 | 需要分区 |
| 超大表 | > 1亿 | > 100GB | 分钟级以上 | 考虑分库分表 |

**总数据量**：

| 规模 | 大小 | 性能 | 建议 |
|------|------|------|------|
| 小型 | < 100GB | 毫秒级 | 单机即可 |
| 中型 | 100GB-1TB | 秒级 | 单机 + 分区 |
| 大型 | 1TB-10TB | 秒级到分钟级 | 考虑分库分表 |
| 超大型 | > 10TB | 分钟级以上 | 需要专用系统 |

**示例**：
```sql
-- 场景1：订单表（5000万行，20GB）
-- 结论：PostgreSQL单机可以应对
-- 建议：创建索引，考虑按日期分区

-- 场景2：事件表（每天1亿行，每天30GB）
-- 结论：PostgreSQL单机不适合
-- 建议：使用ClickHouse等OLAP数据库

-- 场景3：日志表（每天10亿行，每天300GB）
-- 结论：PostgreSQL完全不适合
-- 建议：使用Elasticsearch或日志系统
```

##### 3.2 并发边界

**QPS（Query Per Second）**：

| 并发级别 | QPS | 响应时间 | 建议 |
|---------|-----|----------|------|
| 低并发 | < 100 | 毫秒级 | 单机即可 |
| 中并发 | 100-1000 | 毫秒级到秒级 | 需要连接池、索引优化 |
| 高并发 | 1000-10000 | 秒级 | 需要读写分离、缓存 |
| 超高并发 | > 10000 | 秒级到分钟级 | 需要分库分表 |

**示例**：
```yaml
# 场景1：内部系统（100 QPS）
架构：PostgreSQL单机
优化：索引优化、连接池
结果：轻松应对

# 场景2：Web应用（1000 QPS）
架构：PostgreSQL主从 + Redis
优化：读写分离、缓存
结果：可以应对

# 场景3：高并发API（10000 QPS）
架构：分库分表 + Redis集群
优化：分片、缓存、消息队列
结果：需要专业架构
```

##### 3.3 场景边界

**OLTP（Online Transaction Processing）**：
```yaml
特点：
  - 事务性要求高（ACID）
  - 单次查询涉及少量数据
  - 并发写入多

示例：
  - 订单系统
  - 支付系统
  - 库存系统

PostgreSQL：✅ 擅长
原因：支持完整的ACID事务，行级锁
```

**OLAP（Online Analytical Processing）**：
```yaml
特点：
  - 分析查询为主
  - 单次查询涉及大量数据
  - 聚合计算多

示例：
  - 用户行为分析
  - 销售数据分析
  - 留存分析

PostgreSQL：🟡 可以，但不擅长
原因：
  - 行式存储不适合分析
  - 聚合查询慢
  - 需要：分区表、物化视图、列式存储扩展
```

**混合场景**：
```yaml
特点：
  - 同时有OLTP和OLAP需求

解决方案：
  - PostgreSQL做OLTP
  - ClickHouse/Doris做OLAP
  - 通过ETL同步数据
```

#### 四、PostgreSQL的优势场景

##### 4.1 事务处理（OLTP）

**场景**：电商订单系统

```sql
-- 创建订单（事务）
BEGIN;
INSERT INTO orders (order_id, user_id, total_amount) VALUES (1, 123, 100);
UPDATE inventory SET stock = stock - 1 WHERE product_id = 456;
UPDATE users SET balance = balance - 100 WHERE user_id = 123;
COMMIT;
```

**PostgreSQL优势**：
- ✅ 完整的ACID事务支持
- ✅ 行级锁，并发性能好
- ✅ MVCC（多版本并发控制）
- ✅ 外键约束保证数据一致性

##### 4.2 复杂查询

**场景**：用户行为分析

```sql
-- 复杂的关联查询
WITH user_orders AS (
    SELECT user_id, count(*) as order_count, sum(total_amount) as total_amount
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
),
user_events AS (
    SELECT user_id, count(*) as event_count
    FROM events
    WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY user_id
)
SELECT
    u.user_id,
    u.name,
    coalesce(o.order_count, 0) as order_count,
    coalesce(o.total_amount, 0) as total_amount,
    coalesce(e.event_count, 0) as event_count
FROM users u
LEFT JOIN user_orders o ON u.user_id = o.user_id
LEFT JOIN user_events e ON u.user_id = e.user_id;
```

**PostgreSQL优势**：
- ✅ 强大的SQL支持（CTE、窗口函数）
- ✅ 丰富的数据类型（JSON、数组）
- ✅ 复杂JOIN优化器

##### 4.3 地理信息（PostGIS）

**场景**：附近的人

```sql
-- 查询附近的店铺
SELECT name, address
FROM shops
WHERE ST_DWithin(
    location,
    ST_MakePoint(121.4737, 31.2304)::geography,
    1000  -- 1km范围
);
```

**PostgreSQL优势**：
- ✅ PostGIS扩展
- ✅ 地理索引（GiST）
- ✅ 空间查询优化

##### 4.4 全文搜索

**场景**：文章搜索

```sql
-- 全文搜索
SELECT title, content
FROM articles
WHERE to_tsvector('chinese', title || ' ' || content) @@ to_tsquery('chinese', 'PostgreSQL');
```

**PostgreSQL优势**：
- ✅ 内置全文搜索
- ✅ 支持中文分词
- ✅ Gin索引加速

#### 五、PostgreSQL的劣势场景

##### 5.1 大规模数据分析

**场景**：每天1亿行事件数据的分析

```sql
-- 这个查询在PostgreSQL上可能需要几分钟
SELECT
    date(event_time) as event_date,
    count(*) as event_count,
    count(DISTINCT user_id) as unique_users
FROM events
WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(event_time);
```

**PostgreSQL劣势**：
- ❌ 行式存储不适合分析
- ❌ 聚合查询慢
- ❌ 压缩比低

**建议**：使用ClickHouse、Doris等OLAP数据库

##### 5.2 超高并发写入

**场景**：每秒10000次写入

```sql
-- 每秒10000次INSERT
INSERT INTO events (user_id, event_name, event_time) VALUES (?, ?, ?);
```

**PostgreSQL劣势**：
- ❌ 单机写入能力有限（几千TPS）
- ❌ 需要分库分表

**建议**：
- 分库分表
- 使用Kafka等消息队列缓冲
- 使用时序数据库（InfluxDB、TimescaleDB）

##### 5.3 海量数据存储

**场景**：PB级数据存储

**PostgreSQL劣势**：
- ❌ 单机存储上限（几十TB）
- ❌ 成本高

**建议**：
- 数据归档
- 使用对象存储（S3、OSS）
- 使用数据湖

#### 六、何时需要分库分表

##### 6.1 分库分表的信号

**数据量信号**：
```yaml
单表超过1亿行
单表超过100GB
总数据量超过1TB
→ 考虑分库分表
```

**性能信号**：
```yaml
查询时间超过10秒
索引无法优化
数据库连接数不够
→ 考虑分库分表
```

**并发信号**：
```yaml
QPS超过5000
主从复制延迟
锁等待严重
→ 考虑分库分表
```

##### 6.2 分库分表的方案

**垂直分库（按业务）**：
```yaml
# 原来的架构
一个数据库：users + orders + products + payments

# 垂直分库后
数据库1：users（用户库）
数据库2：orders（订单库）
数据库3：products（商品库）
数据库4：payments（支付库）

优点：
  - 业务隔离
  - 便于扩展
  - 降低单库压力
```

**水平分表（按数据量）**：
```yaml
# 原来的架构
一个表：orders（1亿行）

# 水平分表后
表1：orders_0（1000万行）
表2：orders_1（1000万行）
表3：orders_2（1000万行）
表4：orders_3（1000万行）
...

分片规则：user_id % 10

优点：
  - 单表数据量可控
  - 查询性能提升
  - 便于扩展
```

**分库分表的挑战**：
```yaml
挑战1：分布式事务
  → 解决：最终一致性、补偿机制

挑战2：跨库JOIN
  → 解决：应用层JOIN、数据冗余

挑战3：数据迁移
  → 解决：双写、在线迁移
```

#### 七、何时需要迁移到专用系统

##### 7.1 迁移到OLAP数据库

**信号**：
```yaml
分析查询慢（>10秒）
聚合查询多
数据量大（>10亿行）
→ 考虑迁移到ClickHouse/Doris/BigQuery
```

**方案**：
```yaml
PostgreSQL：继续处理OLTP（订单、用户）
ClickHouse：处理OLAP（用户行为分析、报表）
通过ETL同步数据
```

##### 7.2 迁移到缓存系统

**信号**：
```yaml
热点数据查询频繁
实时性要求高（<10ms）
→ 考虑使用Redis
```

**方案**：
```yaml
Redis：缓存热点数据（用户信息、商品信息）
PostgreSQL：持久化存储
```

##### 7.3 迁移到搜索引擎

**信号**：
```yaml
全文搜索需求复杂
模糊搜索、相关性排序
→ 考虑使用Elasticsearch
```

**方案**：
```yaml
Elasticsearch：全文搜索
PostgreSQL：结构化数据存储
```

#### 八、常见误区

**误区一：PostgreSQL能处理所有场景**

- **说明**：PostgreSQL是通用数据库，但不是所有场景的最优选择
- **后果**：在不适合的场景强行使用PostgreSQL，性能差、成本高
- **正确理解**：
  - PostgreSQL擅长OLTP和轻量级OLAP
  - 大规模分析考虑OLAP数据库
  - 超高并发考虑分库分表

**误区二：数据量大了就一定要分库分表**

- **说明**：分库分表是手段，不是目的，要看场景
- **后果**：过度设计，增加复杂度
- **正确理解**：
  - <1亿行：通常不需要分库分表
  - 1-10亿行：考虑分区表
  - >10亿行：考虑分库分表

**误区三：PostgreSQL不适合分析查询**

- **说明**：PostgreSQL可以做分析查询，但不是最优选择
- **后果**：完全不用PostgreSQL做分析，浪费其能力
- **正确理解**：
  - 轻量级分析（<1000万行）：PostgreSQL够用
  - 中等规模分析（1000万-1亿行）：PostgreSQL + 物化视图
  - 大规模分析（>1亿行）：考虑OLAP数据库

**误区四：迁移到其他系统很难**

- **说明**：迁移有成本，但不是不可行
- **后果**：不敢迁移，继续在不适用的场景挣扎
- **正确理解**：
  - 迁移前做好规划
  - 分阶段迁移
  - 双写保证数据一致性
  - 工具支持迁移

**误区五：单机一定比集群差**

- **说明**：单机有优势，集群不是万能的
- **后果**：盲目上集群，增加复杂度
- **正确理解**：
  - 小规模（<100GB）：单机更简单
  - 中规模（100GB-1TB）：单机 + 分区
  - 大规模（>1TB）：考虑集群

#### 九、实战任务

**任务1：评估PostgreSQL是否适合**

评估以下场景是否适合使用PostgreSQL：

**场景1**：博客系统
```yaml
数据量：文章10万篇，评论100万条
并发：100 QPS
需求：发布文章、评论、点赞
```

**评估**：
- ✅ 适合PostgreSQL
- 原因：数据量小，并发低，OLTP场景

**场景2**：用户行为分析
```yaml
数据量：每天1亿行事件数据
并发：50个分析查询/小时
需求：分析用户行为、留存、转化
```

**评估**：
- ❌ 不适合PostgreSQL
- 原因：分析场景，数据量大
- 建议：使用ClickHouse

**场景3**：订单系统
```yaml
数据量：订单5000万笔
并发：1000 QPS
需求：下单、支付、退款
```

**评估**：
- ✅ 适合PostgreSQL
- 原因：OLTP场景，数据量可控
- 优化：创建索引，考虑主从复制

**任务2：监控PostgreSQL性能**

监控以下指标，判断是否需要优化：

```sql
-- 1. 查看表大小
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 10;

-- 2. 查看慢查询
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 3. 查看数据库连接数
SELECT count(*) FROM pg_stat_activity;

-- 4. 查看锁等待
SELECT * FROM pg_stat_activity WHERE wait_event_type = 'Lock';

-- 5. 查看缓存命中率
SELECT
    sum(blks_hit) / (sum(blks_hit) + sum(blks_read)) as cache_hit_ratio
FROM pg_stat_database;
```

**分析**：
- 表大小是否超过100GB？
- 是否有慢查询（>10秒）？
- 连接数是否接近上限？
- 锁等待是否严重？
- 缓存命中率是否低于95%？

**任务3：制定扩展方案**

给定以下场景，制定扩展方案：

**场景**：电商系统
```yaml
当前状态：
  - 订单表：5000万行（50GB）
  - 用户行为表：每天1000万行（每天3GB）
  - QPS：500

预期增长：
  - 一年后：订单表2亿行，用户行为表每天3000万行
  - QPS：2000
```

**扩展方案**：
```yaml
订单表（OLTP）：
  - 当前：PostgreSQL单机
  - 优化：创建索引、主从复制
  - 未来：考虑按用户ID分片

用户行为表（OLAP）：
  - 当前：PostgreSQL单机
  - 问题：聚合查询慢
  - 建议：迁移到ClickHouse

缓存：
  - 热点数据：用户信息、商品信息
  - 方案：Redis缓存
```

#### 十、小结

PostgreSQL不是万能的，但有明确的适用边界。

核心要点：
- PostgreSQL擅长OLTP和轻量级OLAP
- 数据量边界：单表<1亿行，总数据量<1TB
- 并发边界：QPS<1000
- 超出边界：考虑分库分表或专用系统
- 分库分表有成本，要权衡
- 迁移到专用系统要规划

下一节将进入分区表：让大表具有物理边界，在不迁移的情况下提升大表性能。
