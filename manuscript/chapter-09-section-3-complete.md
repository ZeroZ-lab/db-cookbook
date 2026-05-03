### 9.3 OLAP查询优化

前面学习了OLAP数据模型与存储，了解了如何设计表结构和优化存储。

如何优化OLAP查询性能？如何让查询跑得更快？如何识别和解决性能瓶颈？

**场景**：
```yaml
查询性能问题：

数据分析师："查询太慢了，等10分钟"

数据工程师："哪里慢？怎么优化？"

架构师："需要系统化优化方法"
```

**问题**：
- OLAP查询慢在哪里？
- 如何分析和诊断查询性能？
- 如何优化查询SQL？
- 如何优化表设计？
- 如何利用系统特性加速查询？

**答案**：**OLAP查询优化需要从SQL优化、表设计优化、系统配置优化三个层面入手，通过理解查询执行计划、利用分区分桶、使用物化视图、调整并行度等技术手段，显著提升查询性能**

---

## 查询性能分析

### 查询执行流程

```
用户提交SQL
    ↓
解析SQL（Parser）
    ↓
生成逻辑计划（Logical Plan）
    ↓
优化逻辑计划（Optimizer）
    ↓
生成物理计划（Physical Plan）
    ↓
分布式调度（Scheduler）
    ↓
并行执行（Executor）
    ↓
汇总结果（Collector）
    ↓
返回用户
```

### 查看执行计划

```sql
-- 查看查询执行计划
EXPLAIN SELECT 
    category,
    SUM(amount) AS total_sales
FROM sales_wide
WHERE sale_time >= '2025-01-01'
GROUP BY category;

-- 输出示例
+--------------------------------------------------+
| Explain String                                   |
+--------------------------------------------------+
| Aggregate (SUM(amount))                         |
|   -> Hash Group By (category)                   |
|      -> Scan on sales_wide                      |
|         Filters: sale_time >= '2025-01-01'      |
|         Partitions: 3/12 (partition pruning)    |
|         PushDown: category, amount              |
+--------------------------------------------------+

-- 详细执行计划
EXPLAIN VERBOSE SELECT 
    category,
    SUM(amount) AS total_sales
FROM sales_wide
WHERE sale_time >= '2025-01-01'
GROUP BY category;

-- 输出包含：
-- - 扫描行数
-- - 扫描字节数
-- - 内存使用
-- - 各阶段耗时
-- - 分布式执行信息
```

### 性能瓶颈识别

```sql
-- 1. 查看正在运行的查询
SHOW PROCESSLIST;

+-------+---------+-----------+---------+---------+-------+
| Id    | User    | Host      | db      | Command | Time  |
+-------+---------+-----------+---------+---------+-------+
| 1001  | analyst | localhost | sales   | Query   | 120   |
| 1002  | analyst | localhost | sales   | Query   | 45    |
+-------+---------+-----------+---------+---------+-------+

-- 2. 查看查询统计
SELECT 
    query_id,
    query_text,
    duration_ms,
    scan_rows,
    scan_bytes,
    memory_used_bytes
FROM query_log
WHERE start_time >= NOW() - INTERVAL 1 HOUR
ORDER BY duration_ms DESC
LIMIT 10;

-- 3. 识别瓶颈
-- - duration_ms长：执行慢
-- - scan_rows多：扫描数据多
-- - scan_bytes多：读取数据多
-- - memory_used_bytes多：内存占用高
```

**常见瓶颈**：
```yaml
全表扫描：
- 表现：scan_rows接近表总行数
- 原因：缺少分区、缺少索引
- 影响：IO大、耗时长
- 解决：增加分区、增加索引

数据倾斜：
- 表现：某些节点耗时远超其他节点
- 原因：数据分布不均
- 影响：整体被拖慢
- 解决：调整分桶、盐化

内存溢出：
- 表现：查询失败、报OOM
- 原因：聚合数据量大、JOIN数据量大
- 影响：查询失败
- 解决：增加内存、优化SQL

网络传输：
- 表现：网络传输数据量大
- 原因：多表JOIN、数据重分布
- 影响：网络瓶颈
- 解决：本地JOIN、Colocation
```

## SQL查询优化

### 避免SELECT *

```sql
-- 不好的写法：SELECT *
SELECT * FROM sales_wide
WHERE sale_time >= '2025-01-01';

-- 问题：
-- 1. 读取所有列，IO浪费
-- 2. 网络传输数据量大
-- 3. 内存占用大

-- 好的写法：只查询需要的列
SELECT 
    category,
    amount
FROM sales_wide
WHERE sale_time >= '2025-01-01';

-- 优势：
-- 1. 只读取需要的列，IO减少
-- 2. 列式存储优势明显
-- 3. 网络传输量减少
-- 预期性能提升：5-10倍
```

### 合理使用WHERE条件

```sql
-- 不好的写法：WHERE条件过滤率低
SELECT 
    category,
    SUM(amount)
FROM sales_wide
WHERE sale_time >= '2025-01-01'
  AND user_id > 0  -- 几乎所有记录都满足
GROUP BY category;

-- 好的写法：WHERE条件过滤率高
SELECT 
    category,
    SUM(amount)
FROM sales_wide
WHERE sale_time >= '2025-01-01'
  AND category IN ('Electronics', 'Furniture')  -- 过滤率高
GROUP BY category;

-- 技巧：
-- 1. 先过滤后聚合
-- 2. 利用分区裁剪
-- 3. 利用索引
-- 4. 选择高过滤率条件
```

### 优化JOIN

```sql
-- 不好的写法：大表JOIN大表
SELECT 
    s.category,
    c.city,
    SUM(s.amount)
FROM sales_wide s  -- 100亿行
JOIN customer_wide c ON s.customer_id = c.customer_id  -- 10亿行
WHERE s.sale_time >= '2025-01-01'
GROUP BY s.category, c.city;

-- 问题：
-- 1. 数据重分布：网络传输大
-- 2. JOIN耗时长
-- 3. 内存占用高

-- 优化方案1：小表JOIN大表
-- 先把小表过滤到最小
WITH filtered_customer AS (
    SELECT DISTINCT customer_id, city
    FROM customer_wide
    WHERE province = 'Beijing'  -- 小表
)
SELECT 
    s.category,
    c.city,
    SUM(s.amount)
FROM sales_wide s
JOIN filtered_customer c ON s.customer_id = c.customer_id
GROUP BY s.category, c.city;

-- 优化方案2：利用Colocation
-- 创建表时指定colocation group
CREATE TABLE sales_colocate (
    sale_id BIGINT,
    customer_id INT,
    category VARCHAR(50),
    amount DECIMAL(10,2)
) COLOCATE WITH customer_colocate;

-- 同一分桶key的数据在同一节点
-- JOIN不需要数据重分布
-- 性能提升：3-5倍
```

### 优化聚合

```sql
-- 不好的写法：多维度GROUP BY
SELECT 
    DATE(sale_time) AS sale_date,
    category,
    brand,
    store_id,
    customer_city,
    customer_segment,
    SUM(amount),
    AVG(amount),
    COUNT(DISTINCT customer_id)
FROM sales_wide
WHERE sale_time >= '2025-01-01'
GROUP BY 
    sale_date, category, brand, 
    store_id, customer_city, customer_segment;

-- 问题：
-- 1. 聚合维度多，计算量大
-- 2. GROUP BY数据量大，内存占用高
-- 3. 查询耗时长

-- 优化方案1：减少聚合维度
-- 分层查询，按需聚合
SELECT 
    sale_date,
    category,
    SUM(amount) AS total_amount
FROM (
    SELECT 
        DATE(sale_time) AS sale_date,
        category,
        amount
    FROM sales_wide
    WHERE sale_time >= '2025-01-01'
) t
GROUP BY sale_date, category;

-- 优化方案2：使用物化视图
CREATE MATERIALIZED VIEW mv_daily_sales AS
SELECT 
    DATE(sale_time) AS sale_date,
    category,
    SUM(amount) AS total_amount,
    COUNT(*) AS order_count
FROM sales_wide
GROUP BY sale_date, category;

-- 查询直接用物化视图
SELECT * FROM mv_daily_sales
WHERE sale_date >= '2025-01-01';
-- 查询从分钟级降到毫秒级
```

### 分页优化

```sql
-- 不好的写法：OFFSET大
SELECT * FROM sales_wide
WHERE sale_time >= '2025-01-01'
ORDER BY sale_time DESC
LIMIT 20 OFFSET 10000;

-- 问题：
-- 1. 需要扫描前10020行
-- 2. 随着OFFSET增大，性能下降
-- 3. OFFSET=1000000几乎无法执行

-- 优化方案：使用游标分页
-- 第一页
SELECT * FROM sales_wide
WHERE sale_time >= '2025-01-01'
ORDER BY sale_time DESC
LIMIT 20;
-- 记录最后一条记录的sale_time

-- 下一页：用上页最后一条记录作为起点
SELECT * FROM sales_wide
WHERE sale_time >= '2025-01-01'
  AND sale_time < '2025-01-15 10:30:00'  -- 上页最后一条
ORDER BY sale_time DESC
LIMIT 20;

-- 优势：
-- 1. 不需要扫描OFFSET行
-- 2. 性能稳定，与页码无关
-- 3. 适合无限滚动场景
```

## 表设计优化

### 分区裁剪

```sql
-- 创建时合理分区
CREATE TABLE sales_wide (
    sale_time TIMESTAMP,
    category VARCHAR(50),
    amount DECIMAL(10,2)
) PARTITION BY RANGE(sale_time) (
    PARTITION p202501 VALUES LESS THAN ('2025-02-01'),
    PARTITION p202502 VALUES LESS THAN ('2025-03-01'),
    PARTITION p202503 VALUES LESS THAN ('2025-04-01')
);

-- 查询利用分区裁剪
SELECT * FROM sales_wide
WHERE sale_time >= '2025-02-01' 
  AND sale_time < '2025-03-01';
-- 只扫描p202502分区

-- 查看分区裁剪效果
EXPLAIN SELECT * FROM sales_wide
WHERE sale_time >= '2025-02-01';

-- 输出：
-- Partitions: 1/3 (p202502)
-- 只扫描1/3的分区
```

### 分桶裁剪

```sql
-- 创建时分桶
CREATE TABLE sales_wide (
    sale_id BIGINT,
    customer_id INT,
    amount DECIMAL(10,2)
) DISTRIBUTED BY HASH(customer_id) BUCKETS 32;

-- 查询单个customer
SELECT * FROM sales_wide
WHERE customer_id = 12345;
-- 只需要扫描bucket_id = hash(12345) % 32
-- 只扫描1/32的数据

-- 查询多个customer
SELECT * FROM sales_wide
WHERE customer_id IN (12345, 12346, 12347);
-- 只需要扫描3个bucket
-- 只扫描3/32的数据
```

### 排序键设计

```sql
-- ClickHouse：ORDER BY指定排序
CREATE TABLE events (
    event_time TIMESTAMP,
    event_type VARCHAR(50),
    user_id INT,
    event_data STRING
) ENGINE = MergeTree()
ORDER BY (event_time, event_type, user_id);

-- 查询利用排序
SELECT * FROM events
WHERE event_time >= '2025-02-01'
  AND event_time < '2025-02-02'
  AND event_type = 'page_view';
-- 数据在磁盘上是按(event_time, event_type, user_id)有序存储
-- 可以连续读取，性能好

-- 排序键选择原则：
-- 1. 查询条件中最常用的列
-- 2. 范围查询的列
-- 3. 高基数的列
-- 4. 不宜过多（1-3个）
```

### 跳数索引

```sql
-- ClickHouse：跳数索引
CREATE TABLE events (
    event_time Timestamp,
    event_type String,
    user_id UInt64,
    event_data String
) ENGINE = MergeTree()
ORDER BY (event_time, event_type)
SETTINGS index_granularity = 8192;

-- 添加minmax索引
ALTER TABLE events 
ADD INDEX idx_event_time_minmax event_time TYPE minmax GRANULARITY 4;

-- 添加set索引
ALTER TABLE events 
ADD INDEX idx_event_type_set event_type TYPE set(10) GRANULARITY 4;

-- 查询利用跳数索引
SELECT * FROM events
WHERE event_time >= '2025-02-01'
  AND event_type = 'page_view';
-- 可以跳过大量不相关的数据块
-- 性能提升：5-10倍
```

## 系统配置优化

### 并发度优化

```sql
-- 查看当前并发度
SHOW VARIABLES LIKE '%parallel%';

-- 调整并发度
SET parallel_fragment_exec_instance_num = 8;

-- 原理：
-- 每个查询的每个算子可以并行执行
-- 并发度 = CPU核心数 × 2-3
-- 并发度过高：上下文切换开销大
-- 并发度过低：资源利用率低

-- 推荐配置：
-- 小查询（<1s）：并发度 = CPU核心数
-- 大查询（>10s）：并发度 = CPU核心数 × 2
-- 混合负载：并发度 = CPU核心数 × 1.5
```

### 内存优化

```sql
-- 查看内存配置
SHOW VARIABLES LIKE '%mem%';

-- 调整单查询内存限制
SET exec_mem_limit = 8589934592;  -- 8GB

-- 原理：
-- 每个查询有内存限制
-- 超过限制会溢出到磁盘或失败
-- 限制过小：大查询失败
-- 限制过大：OOM风险

-- 推荐配置：
-- 单机内存 / 预期并发数 / 2
-- 例如：64GB内存，预期并发16查询
-- 单查询限制 = 64GB / 16 / 2 = 2GB
```

### 缓存优化

```sql
-- 开启查询缓存
SET enable_query_cache = true;

-- 查看缓存命中率
SHOW VARIABLES LIKE '%cache%';
SELECT * FROM information_schema.query_cache;

-- 缓存策略：
-- 1. 结果缓存：相同查询直接返回结果
-- 2. 数据缓存：热数据缓存在内存
-- 3. 元数据缓存：表结构缓存

-- 适用场景：
-- - 重复查询多
-- - 数据更新少
-- - 延迟敏感

-- 不适用场景：
-- - 即席查询（Ad-hoc）
-- - 实时数据更新
-- - 内存紧张
```

## 查询优化检查清单

```yaml
查询编写：
□ 避免SELECT *
□ WHERE条件先过滤
□ 减少JOIN表数
□ 减少GROUP BY维度
□ 使用物化视图
□ 使用游标分页

表设计：
□ 合理分区
□ 合理分桶
□ 排序键优化
□ 跳数索引
□ 物化视图
□ 列类型优化

系统配置：
□ 并发度配置
□ 内存限制
□ 缓存配置
□ 统计信息更新

监控验证：
□ 查看执行计划
□ 测量查询时间
□ 监控资源使用
□ 对比优化前后
```

## 实战案例

### 案例1：全表扫描优化

**问题**：
```sql
-- 查询耗时：5分钟
SELECT 
    category,
    SUM(amount)
FROM sales_wide
WHERE sale_time >= '2025-01-01'
GROUP BY category;

-- 执行计划显示：全表扫描
```

**分析**：
```sql
-- 查看表分区
SHOW PARTITIONS sales_wide;
-- 发现：只有1个分区，没有分区裁剪

-- 查看表大小
SELECT 
    TABLE_NAME,
    SUM(ROW_COUNT) AS total_rows,
    SUM(DATA_LENGTH) AS total_bytes
FROM information_schema.TABLES
WHERE TABLE_NAME = 'sales_wide';
-- 发现：表有100亿行，1TB数据
```

**优化**：
```sql
-- 1. 重建表，增加分区
CREATE TABLE sales_wide_partitioned (
    sale_time TIMESTAMP,
    category VARCHAR(50),
    amount DECIMAL(10,2)
) PARTITION BY RANGE(sale_time) ();

-- 2. 导入数据到新表
INSERT INTO sales_wide_partitioned 
SELECT * FROM sales_wide;

-- 3. 查询优化后
SELECT 
    category,
    SUM(amount)
FROM sales_wide_partitioned
WHERE sale_time >= '2025-01-01'
GROUP BY category;

-- 结果：5分钟 → 10秒（30倍提升）
```

### 案例2：JOIN性能优化

**问题**：
```sql
-- 查询耗时：15分钟
SELECT 
    s.category,
    c.city,
    SUM(s.amount)
FROM sales_wide s
JOIN customer_wide c ON s.customer_id = c.customer_id
WHERE s.sale_time >= '2025-01-01'
GROUP BY s.category, c.city;
```

**分析**：
```sql
-- 查看执行计划
EXPLAIN SELECT ...
-- 发现：数据重分布，网络传输大

-- 查看表大小
SELECT COUNT(*) FROM sales_wide;  -- 100亿
SELECT COUNT(*) FROM customer_wide;  -- 10亿
```

**优化**：
```sql
-- 方案：利用Colocation
-- 1. 创建colocation group
CREATE TABLE sales_colocate (
    sale_id BIGINT,
    customer_id INT,
    category VARCHAR(50),
    amount DECIMAL(10,2)
) COLOCATE WITH customer_colocate;

-- 2. 导入数据
INSERT INTO sales_colocate SELECT * FROM sales_wide;

-- 3. 查询优化后
SELECT 
    s.category,
    c.city,
    SUM(s.amount)
FROM sales_colocate s
JOIN customer_colocate c ON s.customer_id = c.customer_id
WHERE s.sale_time >= '2025-01-01'
GROUP BY s.category, c.city;

-- 结果：15分钟 → 2分钟（7.5倍提升）
```

## 总结

**OLAP查询优化核心要点**：
1. **理解执行计划**：诊断瓶颈
2. **SQL层面优化**：减少扫描、减少JOIN、减少聚合
3. **表设计优化**：分区分桶、索引、物化视图
4. **系统配置优化**：并发度、内存、缓存

**优化路径**：
1. 先看执行计划，识别瓶颈
2. 再优化SQL写法
3. 然后优化表设计
4. 最后调整系统配置

**验证方法**：
1. 对比优化前后执行时间
2. 查看资源使用情况
3. 监控查询统计信息
