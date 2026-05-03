### 4.6 OLAP的本质：面向分析查询

前面学习了OLTP的本质（面向业务事务）和优化策略。

现在进入OLAP的世界。

**场景**：
```yaml
数据分析师：
  - 需要分析最近30天的GMV趋势
  - 需要计算用户留存率
  - 需要分析转化漏斗
  - 需要生成数据报表
```

**这些操作的特点**：
- 查询复杂（多表JOIN、聚合计算）
- 数据量大（扫描数亿行）
- 执行时间长（秒级到分钟级）
- 用户少（每小时几次）

这就是OLAP的本质：**面向分析查询的在线分析处理**。

#### 一、为什么OLAP要面向分析查询

**第一，分析需求复杂**

**场景**：用户留存分析

```sql
-- 分析用户留存
WITH cohort_users AS (
    -- 找出每个用户的注册日期
    SELECT
        user_id,
        date(registered_at) as cohort_date
    FROM users
    WHERE registered_at >= '2026-01-01'
),
retention AS (
    -- 计算每个用户的留存情况
    SELECT
        c.user_id,
        c.cohort_date,
        count(DISTINCT date(o.created_at)) as active_days
    FROM cohort_users c
    LEFT JOIN orders o ON c.user_id = o.user_id
        AND o.created_at >= c.cohort_date
        AND o.created_at < c.cohort_date + INTERVAL '30 days'
    GROUP BY c.user_id, c.cohort_date
)
SELECT
    cohort_date,
    count(*) as cohort_size,
    count(*) FILTER (WHERE active_days >= 1) as day1_retention,
    count(*) FILTER (WHERE active_days >= 7) as day7_retention,
    count(*) FILTER (WHERE active_days >= 30) as day30_retention
FROM retention
GROUP BY cohort_date
ORDER BY cohort_date;
```

**特点**：
- 多个CTE（WITH子句）
- 多个JOIN
- 复杂的聚合计算
- 窗口函数

**OLTP系统不适合**：
- 需要扫描大量数据
- 执行时间长（可能几分钟）
- 影响OLTP业务

**OLAP系统专为此设计**：
- 优化复杂查询
- 支持大规模数据扫描
- 秒级响应

**第二，数据量大**

**场景**：GMV趋势分析

```sql
-- 分析最近30天的GMV趋势
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at)
ORDER BY order_date;
```

**数据量**：
```yaml
订单表：
  - 总数据量：1亿行
  - 最近30天：1000万行
  - 需要扫描：1000万行
```

**OLTP系统**：
```yaml
全表扫描：
  - 扫描1000万行
  - 每行0.01ms
  - 总时间：100秒
```

**OLAP系统**：
```yaml
列式存储：
  - 只扫描created_at和total_amount列
  - 不扫描其他列
  - 总时间：5秒
```

**性能差异**：20倍

**第三，查询模式不同**

**OLTP查询**：
```sql
-- 查询单个订单
SELECT * FROM orders WHERE order_id = 123;
-- 返回：1行
-- 索引：快速定位

-- 查询用户订单
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 10;
-- 返回：10行
-- 索引：快速定位
```

**OLAP查询**：
```sql
-- GMV趋势分析
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY date(created_at);
-- 扫描：1000万行
-- 返回：30行
-- 全表扫描或分区扫描

-- 用户留存分析
WITH cohort_users AS (...),
     retention AS (...)
SELECT ...
FROM retention;
-- 扫描：1亿行
-- 返回：100行
-- 全表扫描
```

**结论**：
> OLAP的核心是面向分析查询，优化复杂查询、大数据量扫描、聚合计算，与OLTP的事务处理完全不同。

#### 二、核心判断：OLAP的本质是"分析查询，不是事务处理"

> OLAP的核心判断是：OLAP面向分析查询，优化复杂查询、大数据量扫描、聚合计算，与OLTP的事务处理完全不同，需要专门的存储和计算引擎。

这个判断说明：
- **分析查询**：复杂SQL、聚合计算、多表JOIN
- **大数据量**：扫描数亿行、TB级数据
- **优化方向**：列式存储、分区表、物化视图、并行计算
- **与OLAP不同**：OLTP优化事务，OLAP优化查询

#### 三、OLAP的核心特性

##### 3.1 复杂查询

**特点**：
```yaml
查询复杂度：
  - 多表JOIN（5-10个表）
  - 子查询
  - 窗口函数
  - 聚合计算（SUM、COUNT、AVG）
  
查询时间：
  - 秒级到分钟级
  - 可接受
```

**示例**：转化漏斗分析

```sql
-- 分析用户转化漏斗
WITH funnel AS (
    -- 每个用户在每个步骤的访问次数
    SELECT
        user_id,
        count(*) FILTER (WHERE event_type = 'view_product') as views,
        count(*) FILTER (WHERE event_type = 'add_to_cart') as adds,
        count(*) FILTER (WHERE event_type = 'checkout') as checkouts,
        count(*) FILTER (WHERE event_type = 'purchase') as purchases
    FROM events
    WHERE created_at >= '2026-01-01'
    GROUP BY user_id
)
SELECT
    count(*) FILTER (WHERE views > 0) as step1_users,
    count(*) FILTER (WHERE adds > 0) as step2_users,
    count(*) FILTER (WHERE checkouts > 0) as step3_users,
    count(*) FILTER (WHERE purchases > 0) as step4_users,
    count(*) FILTER (WHERE adds > 0) * 100.0 / count(*) FILTER (WHERE views > 0) as view_to_add_rate,
    count(*) FILTER (WHERE checkouts > 0) * 100.0 / count(*) FILTER (WHERE adds > 0) as add_to_checkout_rate,
    count(*) FILTER (WHERE purchases > 0) * 100.0 / count(*) FILTER (WHERE checkouts > 0) as checkout_to_purchase_rate
FROM funnel;
```

##### 3.2 大数据量

**特点**：
```yaml
数据量级：
  - 订单表：1亿行（10GB）
  - 用户行为表：100亿行（1TB）
  - 日志表：1000亿行（10TB）
  
扫描量：
  - 每个查询扫描数千万到数亿行
  - 扫描时间：秒级到分钟级
```

**示例**：用户行为分析

```sql
-- 分析用户行为
SELECT
    date(created_at) as event_date,
    event_type,
    count(*) as event_count,
    count(DISTINCT user_id) as unique_users
FROM events
WHERE created_at >= '2026-01-01'
  AND created_at < '2026-02-01'
GROUP BY date(created_at), event_type
ORDER BY event_date, event_type;

-- 扫描：10亿行
-- 执行时间：30秒（OLAP系统）
```

##### 3.3 聚合计算

**特点**：
```yaml
聚合操作：
  - SUM、COUNT、AVG、MAX、MIN
  - 百分位数
  - 直方图
  
聚合级别：
  - 按日期聚合
  - 按类别聚合
  - 按用户聚合
```

**示例**：GMV分析

```sql
-- 按日期聚合
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    avg(total_amount) as avg_order_value
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY date(created_at);

-- 按用户聚合
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_spent,
    avg(total_amount) as avg_order_value
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY user_id
ORDER BY total_spent DESC
LIMIT 100;
```

##### 3.4 低并发

**特点**：
```yaml
并发量：
  - 每小时几次
  - 不是每秒数千次
  
用户群体：
  - 数据分析师
  - 运营经理
  - 管理层
  
响应时间：
  - 秒级到分钟级可接受
```

**与OLTP对比**：
```yaml
OLTP：
  - 每秒数千个事务
  - 响应时间<100ms
  
OLAP：
  - 每小时几个查询
  - 响应时间秒级到分钟级
```

#### 四、OLAP的存储引擎

##### 4.1 列式存储

**行式存储（OLTP）**：
```text
订单表（行式）：
row1: [1, 123, 100.00, 'pending', '2026-01-01']
row2: [2, 124, 200.00, 'paid', '2026-01-02']
row3: [3, 125, 300.00, 'paid', '2026-01-03']
```

**列式存储（OLAP）**：
```text
订单表（列式）：
order_id: [1, 2, 3, ...]
user_id: [123, 124, 125, ...]
total_amount: [100.00, 200.00, 300.00, ...]
status: ['pending', 'paid', 'paid', ...]
created_at: ['2026-01-01', '2026-01-02', '2026-01-03', ...]
```

**优势**：
```yaml
分析查询：
  - 只需要扫描部分列
  - 例如：SUM(total_amount)只扫描total_amount列
  - 不扫描其他列
  
压缩比：
  - 同一列数据类型相同
  - 压缩比更高（5-10倍）
  
查询性能：
  - 扫描数据量更少
  - 查询更快
```

**示例**：
```sql
-- GMV查询
SELECT sum(total_amount) FROM orders WHERE created_at >= '2026-01-01';

-- 行式存储：扫描所有列
-- 扫描量：1亿行 × 5个字段 = 5亿个值

-- 列式存储：只扫描total_amount和created_at列
-- 扫描量：1亿行 × 2个字段 = 2亿个值
-- 性能提升：2.5倍
```

##### 4.2 分区表

**原理**：按时间、类别等维度分区

**示例**：按月分区

```sql
-- 订单表（按月分区）
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- 创建分区
CREATE TABLE orders_2026_01 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_2026_02 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 查询：只扫描相关分区
SELECT sum(total_amount) FROM orders
WHERE created_at >= '2026-01-01' AND created_at < '2026-02-01';
-- 只扫描orders_2026_01分区
-- 不扫描其他分区
```

**优势**：
```yaml
分区剪枝：
  - 只扫描相关分区
  - 不扫描全部数据
  
维护方便：
  - 可以删除整个分区
  - 可以添加新分区
  
查询性能：
  - 扫描数据量减少
  - 查询更快
```

##### 4.3 物化视图

**原理**：预计算查询结果

**示例**：每日GMV

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 查询：直接从物化视图读取
SELECT * FROM daily_gmv
WHERE order_date >= '2026-01-01';
-- 不需要扫描原始订单表
-- 响应时间：毫秒级
```

**优势**：
```yaml
预计算：
  - 提前计算聚合结果
  - 查询时直接读取
  
查询性能：
  - 从分钟级降到毫秒级
  
数据新鲜度：
  - 可以定期刷新
  - 可以增量刷新
```

#### 五、OLAP的计算引擎

##### 5.1 并行计算

**原理**：一个查询拆分成多个任务，并行执行

**示例**：GMV计算

```sql
-- 查询：计算最近30天的GMV
SELECT sum(total_amount) FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- 并行执行：
-- 任务1：计算第1-7天的GMV
-- 任务2：计算第8-14天的GMV
-- 任务3：计算第15-21天的GMV
-- 任务4：计算第22-30天的GMV
-- 最后：汇总4个任务的结果
```

**优势**：
```yaml
并行度：
  - 利用多核CPU
  - 同时执行多个任务
  
性能提升：
  - 4个核心：接近4倍提升
  - 16个核心：接近16倍提升
```

##### 5.2 向量化执行

**原理**：批量处理数据，而不是逐行处理

**逐行处理**：
```python
# 逐行处理
for row in rows:
    result = process(row)
```

**向量化处理**：
```python
# 批量处理
batch = rows[0:1000]
result = process_batch(batch)
```

**优势**：
```yaml
CPU利用率：
  - 批量处理，提高CPU缓存命中率
  - 减少函数调用开销
  
性能提升：
  - 10-100倍提升
```

##### 5.3 延迟物化

**原理**：只在最后一步才物化数据

**示例**：
```sql
-- 查询：只返回GMV
SELECT sum(total_amount) FROM orders WHERE created_at >= '2026-01-01';

-- 延迟物化：
-- 1. 扫描created_at列，过滤数据
-- 2. 扫描total_amount列，计算SUM
-- 3. 只在最后返回结果
-- 不物化中间结果
```

**优势**：
```yaml
内存使用：
  - 中间结果不物化
  - 减少内存占用
  
性能提升：
  - 减少I/O
  - 查询更快
```

#### 六、OLAP vs OLTP对比

| 维度 | OLTP | OLAP |
|------|------|------|
| **用途** | 交易处理 | 分析查询 |
| **用户** | 前台用户 | 数据分析师 |
| **查询** | 简单查询 | 复杂查询 |
| **数据量** | GB级 | TB级 |
| **并发** | 高（每秒数千） | 低（每小时几次） |
| **响应时间** | <100ms | 秒级到分钟级 |
| **存储** | 行式存储 | 列式存储 |
| **优化** | 索引、事务 | 分区、物化视图 |
| **一致性** | 强一致性 | 最终一致性 |
| **事务** | ACID | 不需要 |

#### 七、常见误区

**误区一：OLAP就是数据仓库**

- **说明**：OLAP是分析处理，数据仓库是架构
- **后果**：概念混淆
- **正确理解**：
  - OLAP是一种处理方式
  - 数据仓库是一种架构
  - 数据仓库使用OLAP

**误区二：OLAP不需要索引**

- **说明**：OLAP也需要索引，但索引类型不同
- **后果**：性能差
- **正确理解**：
  - OLAP需要bitmap索引、聚簇索引
  - 索引策略与OLTP不同

**误区三：OLAP查询越快越好**

- **说明**：OLAP查询秒级到分钟级可接受
- **后果**：过度优化，成本高
- **正确理解**：
  - 秒级到分钟级可接受
  - 根据业务需求优化
  - 不是所有查询都要秒级

**误区四：OLAP不需要优化**

- **说明**：OLAP需要优化，但优化策略不同
- **后果**：性能差
- **正确理解**：
  - 优化分区策略
  - 优化物化视图
  - 优化数据分布

**误区五：OLAP可以替代OLTP**

- **说明**：OLAP和OLTP各有所长，不能替代
- **后果**：架构错误
- **正确理解**：
  - OLTP处理业务事务
  - OLAP处理分析查询
  - 两者配合使用

#### 八、实战任务

**任务1：设计OLAP系统**

设计一个电商OLAP系统：

```sql
-- 1. 事实表（订单事实）
CREATE TABLE fact_orders (
    order_id BIGINT,
    user_id BIGINT,
    product_id BIGINT,
    order_date DATE,
    total_amount NUMERIC(10, 2)
) PARTITION BY RANGE (order_date);

-- 2. 创建分区
CREATE TABLE fact_orders_2026_01 PARTITION OF fact_orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 3. 创建物化视图
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT
    order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM fact_orders
GROUP BY order_date;

-- 4. 创建索引
CREATE INDEX idx_fact_orders_date ON fact_orders(order_date);
CREATE INDEX idx_fact_orders_user ON fact_orders(user_id);

-- 5. 查询：GMV趋势
SELECT * FROM mv_daily_gmv
WHERE order_date >= '2026-01-01'
ORDER BY order_date;
-- 响应时间：毫秒级
```

**任务2：优化OLAP查询**

优化慢查询：

```sql
-- 问题：查询慢（30秒）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY date(created_at);

-- 优化1：添加分区
CREATE TABLE orders_partitioned (
    ...
) PARTITION BY RANGE (created_at);

-- 优化2：创建物化视图
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 优化3：查询物化视图
SELECT * FROM mv_daily_gmv
WHERE order_date >= '2026-01-01';
-- 响应时间：毫秒级
```

**任务3：设计数据更新策略**

设计物化视图刷新策略：

```sql
-- 策略1：全量刷新（每天凌晨）
REFRESH MATERIALIZED VIEW mv_daily_gmv;
-- 时间：5分钟
-- 频率：每天一次

-- 策略2：增量刷新（每小时）
CREATE MATERIALIZED VIEW mv_hourly_gmv AS
SELECT
    date_trunc('hour', created_at) as order_hour,
    sum(total_amount) as gmv
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY date_trunc('hour', created_at);

-- 每小时刷新
REFRESH MATERIALIZED VIEW mv_hourly_gmv;
-- 时间：30秒
-- 频率：每小时一次

-- 策略3：实时更新（使用触发器）
-- 数据写入时，同步更新物化视图
-- 延迟：秒级
```

#### 九、小结

OLAP的本质是面向分析查询，优化复杂查询、大数据量扫描、聚合计算。

核心要点：
- 分析查询：复杂SQL、多表JOIN、聚合计算
- 大数据量：扫描数亿行、TB级数据
- 存储引擎：列式存储、分区表、物化视图
- 计算引擎：并行计算、向量化执行、延迟物化
- 与OLTP不同：用途、用户、查询、优化完全不同
- 配合使用：OLTP处理业务，OLAP处理分析

下一节将进入OLAP的数据模型：维度建模与宽表，了解如何设计OLAP数据库的表结构。
