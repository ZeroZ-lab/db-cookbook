### 3.7 查询优化基础：执行计划分析与优化

前面学习了索引（B-tree、BRIN、GIN、GiST），知道索引能加速查询。

但有两个问题：

**问题1**：什么时候需要创建索引？
- 创建索引前，如何知道查询慢？
- 如何找出性能瓶颈？

**问题2**：索引创建后，是否真的使用了？
- 如何验证索引是否被使用？
- 如果没有使用，为什么？

这就需要**查询优化**：通过分析执行计划，找出性能瓶颈，优化查询。

**什么是执行计划？**

执行计划是数据库执行SQL的具体步骤，包括：
- 使用了哪个索引？
- 扫描了多少行？
- JOIN的顺序是什么？
- 每一步的成本是多少？

通过分析执行计划，可以：
1. 找出慢查询的原因
2. 验证索引是否被使用
3. 优化查询逻辑
4. 提升查询性能

#### 一、为什么需要查询优化

**第一，查询可能很慢但不明显**

**示例**：
```sql
-- 这个查询看起来很简单
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 执行时间：30秒
-- 为什么慢？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 可能发现：
-- 1. orders表全表扫描（Seq Scan）
-- 2. 没有使用索引
-- 3. 扫描了1亿行
```

**优化方案**：
```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次查询
-- 执行时间：0.5秒
-- 性能提升：60倍
```

**第二，索引可能未被使用**

**示例**：
```sql
-- 创建了索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 但查询还是慢
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 执行时间：25秒
-- 为什么？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 可能发现：
-- 1. 全表扫描（Seq Scan）
-- 2. 没有使用idx_orders_user_id索引
-- 3. 原因：WHERE条件中有函数，无法使用索引
```

**优化方案**：
```sql
-- 创建表达式索引
CREATE INDEX idx_orders_created_date ON orders(date(created_at));

-- 再次查询
-- 执行时间：0.1秒
-- 性能提升：250倍
```

**第三，查询逻辑可能不优**

**示例**：
```sql
-- 先JOIN再过滤
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 执行时间：20秒
-- 为什么？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 可能发现：
-- 1. 先JOIN（扫描所有orders）
-- 2. 再过滤created_at
-- 3. 如果大部分订单是2026年前的，JOIN浪费
```

**优化方案**：
```sql
-- 先过滤再JOIN
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-04-01'
) o ON u.user_id = o.user_id;

-- 再次查询
-- 执行时间：2秒
-- 性能提升：10倍
```

**结论**：
> 查询优化的核心是：通过分析执行计划，找出性能瓶颈（全表扫描、索引未使用、JOIN顺序不当），针对性地优化查询或索引。

#### 二、核心判断：优化不是"试错"，而是"分析"

> 查询优化的核心判断是：通过EXPLAIN ANALYZE分析执行计划，找出性能瓶颈（扫描行数、JOIN成本、索引使用），针对性地优化查询逻辑或创建索引，而不是盲目试错。

这个判断说明：
- **工具**：EXPLAIN ANALYZE
- **分析**：找出瓶颈
- **优化**：针对性改进
- **验证**：对比优化效果

#### 三、EXPLAIN ANALYZE基础

##### 3.1 什么是执行计划

**定义**：数据库执行SQL的具体步骤

**作用**：
- 显示SQL如何执行
- 显示每一步的成本
- 显示实际执行时间

**使用方法**：
```sql
-- 基础EXPLAIN（只显示计划，不执行）
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 完整EXPLAIN ANALYZE（执行并显示实际时间）
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

##### 3.2 执行计划的结构

**执行计划示例**：
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200) (actual time=0.021..0.123 rows=100 loops=1)
  Index Cond: (user_id = 123)
Planning Time: 0.123 ms
Execution Time: 0.456 ms
```

**关键指标**：
- **Index Scan**：索引扫描（好）
- **Seq Scan**：顺序扫描（全表扫描，通常不好）
- **cost**：预估成本（0.42..123.45，越低越好）
- **rows**：预估行数（100行）
- **actual time**：实际执行时间（0.021..0.123 ms，越低越好）
- **loops**：循环次数（1次）

**执行计划的层级**：
```sql
EXPLAIN ANALYZE
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Hash Join  (cost=123.45..234.56 rows=100 width=200) (actual time=1.234..5.678 rows=100 loops=1)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o  (cost=0.00..123.45 rows=10000 width=100) (actual time=0.123..2.345 rows=10000 loops=1)
  ->  Hash  (cost=1.23..123.45 rows=100 width=100) (actual time=0.456..0.789 rows=100 loops=1)
        ->  Index Scan using idx_users_user_id on users u  (cost=0.42..1.23 rows=1 width=100) (actual time=0.012..0.034 rows=1 loops=1)
Planning Time: 0.234 ms
Execution Time: 6.123 ms
```

**说明**：
- 最外层：Hash Join
- 内层1：Seq Scan on orders（扫描整个orders表）
- 内层2：Index Scan on users（通过索引查找用户）

#### 四、执行计划的读取

##### 4.1 扫描方式

**Seq Scan（顺序扫描）**：
```sql
Seq Scan on orders  (cost=0.00..12345.67 rows=1000000 width=200)
```

**特点**：
- 从头到尾扫描整个表
- 成本高（cost大）
- 适合：返回大量数据（>表大小的5%）
- 不适合：只返回少量数据

**Index Scan（索引扫描）**：
```sql
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
```

**特点**：
- 通过索引快速定位数据
- 成本低（cost小）
- 适合：返回少量数据（<表大小的1%）
- 不适合：返回大量数据

**Bitmap Index Scan（位图索引扫描）**：
```sql
Bitmap Heap Scan on orders  (cost=123.45..234.56 rows=10000 width=200)
  Recheck Cond: (user_id = ANY (ARRAY[123, 456, 789]))
  ->  Bitmap Index Scan on idx_orders_user_id  (cost=0.00..123.45 rows=10000 width=0)
```

**特点**：
- 先用索引找到所有符合条件的row_id
- 再批量读取表数据
- 适合：多个OR条件、范围查询

##### 4.2 JOIN方式

**Nested Loop（嵌套循环）**：
```sql
Nested Loop  (cost=0.00..1234567.89 rows=1000000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Seq Scan on users u
  ->  Seq Scan on orders o
```

**特点**：
- 对users的每一行，扫描整个orders表
- 复杂度：O(users × orders)
- 适合：小表JOIN、有索引
- 不适合：大表JOIN

**Hash Join（哈希连接）**：
```sql
Hash Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
  ->  Hash
        ->  Seq Scan on users u
```

**特点**：
- 对users表构建哈希表
- 用orders表的user_id去哈希表中查找
- 适合：大表JOIN、等值连接
- 不适合：范围连接、非等值连接

**Merge Join（归并连接）**：
```sql
Merge Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Merge Cond: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u
  ->  Index Scan using idx_orders_user_id on orders o
```

**特点**：
- 两个表都按user_id排序
- 类似归并排序
- 适合：大表JOIN、已经排序
- 不适合：小表JOIN

##### 4.3 聚合方式

**HashAggregate**：
```sql
HashAggregate  (cost=123.45..234.56 rows=100 width=200)
  Group Key: u.user_id
  ->  Nested Loop  (cost=0.00..123.45 rows=10000 width=150)
```

**特点**：
- 使用哈希表进行聚合
- 适合：少量GROUP BY字段
- 不适合：大量GROUP BY字段

**GroupAggregate**：
```sql
GroupAggregate  (cost=123.45..234.56 rows=100 width=200)
  Group Key: u.user_id, u.name
  ->  Sort  (cost=123.45..234.56 rows=10000 width=150)
        Sort Key: u.user_id, u.name
```

**特点**：
- 先排序，再聚合
- 适合：大量GROUP BY字段
- 不适合：少量GROUP BY字段

#### 五、执行计划的优化

##### 5.1 识别全表扫描

**问题**：全表扫描（Seq Scan）

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Seq Scan on orders  (cost=0.00..12345.67 rows=100 width=200)
  Filter: (user_id = 123)
```

**优化**：创建索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次执行
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
```

##### 5.2 识别高成本查询

**问题**：cost很高

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 OR user_id = 456;

-- 输出：
Seq Scan on orders  (cost=0.00..12345.67 rows=200 width=200)
  Filter: (user_id = 123 OR user_id = 456)
```

**优化**：改用IN
```sql
-- 使用IN（可能使用索引）
SELECT * FROM orders WHERE user_id IN (123, 456);

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.84..246.90 rows=200 width=200)
  Index Cond: (user_id = ANY (ARRAY[123, 456]))
```

##### 5.3 识别低效的JOIN

**问题**：Nested Loop（嵌套循环）

```sql
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Nested Loop  (cost=0.00..1234567.89 rows=100000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u  (cost=0.42..8.44 rows=1 width=100)
        Index Cond: (user_id = 123)
  ->  Seq Scan on orders o  (cost=0.00..12345.67 rows=100000 width=300)
```

**优化**：为orders.user_id创建索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次执行
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Nested Loop  (cost=0.42..123.45 rows=100 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u  (cost=0.42..8.44 rows=1 width=100)
        Index Cond: (user_id = 123)
  ->  Index Scan using idx_orders_user_id on orders o  (cost=0.42..123.45 rows=100 width=300)
        Index Cond: (user_id = 123)
```

##### 5.4 识别排序开销

**问题**：额外排序

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
  Sort Key: created_at
  Sort Method: quicksort  Memory: 25kB
```

**优化**：创建组合索引
```sql
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 再次执行
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 输出：
Index Scan using idx_orders_user_date on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
```

**说明**：索引已经按created_at排序，不需要额外排序

#### 六、查询优化的步骤

##### 6.1 识别慢查询

**方法1：查看pg_stat_statements**
```sql
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**方法2：查看日志**
```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询

-- 重载配置
SELECT pg_reload_conf();
```

##### 6.2 分析执行计划

**步骤**：
```sql
-- 1. 使用EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 找出瓶颈
-- - 全表扫描（Seq Scan）
-- - 高成本（cost大）
-- - 扫描行数多（rows大）

-- 3. 确认索引情况
SELECT * FROM pg_indexes WHERE tablename = 'orders';
```

##### 6.3 优化方案

**方案1：创建索引**
```sql
-- 针对全表扫描
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**方案2：重写查询**
```sql
-- 针对低效JOIN
-- 原来：先JOIN再过滤
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 优化：先过滤再JOIN
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-04-01'
) o ON u.user_id = o.user_id;
```

**方案3：使用物化视图**
```sql
-- 针对复杂聚合
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

##### 6.4 验证效果

**步骤**：
```sql
-- 1. 再次EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 对比优化前后
-- 优化前：30秒
-- 优化后：0.1秒
-- 性能提升：300倍

-- 3. 对比cost
-- 优化前：12345.67
-- 优化后：123.45
```

#### 七、常见的性能问题

##### 7.1 全表扫描

**症状**：Seq Scan

**原因**：
- 没有索引
- 索引不适用
- 返回大量数据

**优化**：
- 创建索引
- 重写查询
- 使用分区表

##### 7.2 索引未使用

**症状**：有索引但执行计划显示Seq Scan

**原因**：
- 索引选择性低
- WHERE条件中有函数
- 返回大量数据

**优化**：
- 创建表达式索引
- 重写查询（避免函数）
- 创建部分索引

##### 7.3 低效JOIN

**症状**：Nested Loop，cost很高

**原因**：
- 缺少索引
- JOIN顺序不当
- 数据量太大

**优化**：
- 为JOIN字段创建索引
- 重写查询（先过滤再JOIN）
- 使用Hash Join或Merge Join

##### 7.4 过度排序

**症状**：Sort，Memory很大

**原因**：
- 缺少组合索引
- ORDER BY字段未索引

**优化**：
- 创建组合索引
- 调整查询逻辑

#### 八、常见误区

**误区一：EXPLAIN的结果就是准确的**

- **说明**：EXPLAIN显示的是预估，不一定准确
- **后果**：只看EXPLAIN，不看EXPLAIN ANALYZE
- **正确理解**：
  - EXPLAIN：只显示计划，不执行
  - EXPLAIN ANALYZE：执行并显示实际时间
  - 必须用EXPLAIN ANALYZE验证

**误区二：cost越小越好**

- **说明**：cost是优化器的估算，不是实际执行时间
- **后果**：只看cost，不看actual time
- **正确理解**：
  - cost：估算成本
  - actual time：实际执行时间
  - 主要看actual time

**误区三：Seq Scan一定不好**

- **说明**：Seq Scan在某些场景下是最优选择
- **后果**：看到Seq Scan就优化
- **正确理解**：
  - 返回大量数据（>5%）：Seq Scan更好
  - 返回少量数据（<1%）：Index Scan更好
  - 根据实际场景判断

**误区四：索引越多查询越快**

- **说明**：索引能加速查询，但优化器需要评估所有索引
- **后果**：索引太多，查询规划时间长
- **正确理解**：
  - 合理的索引数量
  - 删除无用索引
  - 定期review索引

**误区五：优化一次就够了**

- **说明**：查询优化是持续工作，数据变化后需要重新优化
- **后果**：优化后不再关注，性能再次下降
- **正确理解**：
  - 定期检查慢查询
  - 数据增长后重新优化
  - 持续监控和维护

#### 九、实战任务

**任务1：分析慢查询**

找出并优化慢查询：

```sql
-- 1. 找出慢查询
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 2. 分析最慢的查询
EXPLAIN ANALYZE <最慢的查询>;

-- 3. 识别瓶颈
-- - 全表扫描？
-- - 缺少索引？
-- - JOIN效率低？

-- 4. 优化
-- 创建索引
-- 重写查询
-- 使用物化视图

-- 5. 验证效果
EXPLAIN ANALYZE <优化后的查询>;
```

**任务2：优化JOIN查询**

优化以下JOIN查询：

```sql
-- 原查询（慢）
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name
ORDER BY order_count DESC;

-- 分析执行计划
EXPLAIN ANALYZE <原查询>;

-- 优化：为orders.user_id创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 验证效果
EXPLAIN ANALYZE <优化后的查询>;
```

**任务3：优化聚合查询**

优化以下聚合查询：

```sql
-- 原查询（慢）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 分析执行计划
EXPLAIN ANALYZE <原查询>;

-- 优化：创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 刷新物化视图
REFRESH MATERIALIZED VIEW daily_gmv;

-- 查询物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

#### 十、小结

查询优化是通过分析执行计划，找出性能瓶颈。

核心要点：
- 使用EXPLAIN ANALYZE分析执行计划
- 关键指标：扫描方式、cost、rows、actual time
- 常见瓶颈：全表扫描、索引未使用、低效JOIN、过度排序
- 优化方法：创建索引、重写查询、使用物化视图
- 验证效果：对比优化前后的执行时间和cost
- 优化是持续工作，需要定期review

下一节将进入物化视图：把重复计算提前做掉，进一步提升查询性能。
