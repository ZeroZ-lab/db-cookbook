### 2.9 SQL性能基础：写出高效的SQL查询

前面学习了SQL的各项能力：查询、聚合、关联、窗口函数、复杂分析。

也学习了如何计算常见指标。

但还有一个关键问题：**性能**。

```sql
-- 这个SQL能算出结果，但需要10分钟
SELECT count(*) FROM orders WHERE total_amount > 100;

-- 这个SQL也能算出结果，但只需要0.1秒
SELECT count(*) FROM orders WHERE total_amount > 100;
```

**为什么同样的查询，性能差异这么大？**

差异在于：
- 是否使用了索引
- JOIN的顺序是否合理
- 是否过滤了不必要的数据
- 是否使用了物化视图

写出正确的SQL还不够，还要写出高效的SQL。

#### 一、为什么SQL性能很重要

**第一，性能直接影响用户体验**

**场景**：运营同学看GMV报表

**慢查询**（30秒）：
- 运营点击"查询"
- 等待30秒
- 可能以为页面卡死
- 重复点击，加重系统负担

**快查询**（0.5秒）：
- 运营点击"查询"
- 0.5秒后看到结果
- 可以交互式分析
- 体验好

**第二，性能影响系统成本**

**慢查询的影响**：
- 占用数据库连接
- 消耗CPU和内存
- 阻塞其他查询
- 导致系统负载高

**成本对比**：
```yaml
慢查询方案：
- 需要更多的数据库服务器
- CPU、内存资源消耗大
- 成本高

快查询方案：
- 较少的数据库服务器
- 资源消耗小
- 成本低
```

**第三，性能影响数据及时性**

**实时分析场景**：
```text
运营决策：今天是否要加大投放？
需要：实时的GMV数据

慢查询：数据延迟30分钟
→ 决策滞后
→ 错失机会

快查询：数据延迟1分钟
→ 及时决策
→ 抓住机会
```

**结论**：
> SQL性能不只关乎技术体验，更直接影响业务价值、系统成本、数据及时性。

#### 二、核心判断：性能优化不是"试错"，而是"理解执行计划"

> SQL性能优化的核心判断是：通过理解数据库的执行计划，找出性能瓶颈，通过索引优化、查询重写、物化缓存等手段，提升查询效率。

这个判断说明：
- **基础**：理解执行计划（EXPLAIN）
- **方法**：索引、重写、缓存
- **目标**：减少扫描的数据量
- **结果**：查询更快、负载更低

#### 三、执行计划分析

##### 3.1 什么是执行计划

**定义**：数据库执行SQL的具体步骤

**作用**：
- 看SQL如何执行
- 找出性能瓶颈
- 验证优化效果

**如何查看**：
```sql
-- PostgreSQL
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- MySQL
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

##### 3.2 执行计划的关键指标

**PostgreSQL的EXPLAIN ANALYZE输出**：
```text
Index Scan using orders_user_id_idx on orders  (cost=0.42..8.44 rows=1 width=200) (actual time=0.021..0.022 rows=1 loops=1)
  Index Cond: (user_id = 123)
Planning Time: 0.123 ms
Execution Time: 0.045 ms
```

**关键指标**：
- **Index Scan**：使用索引扫描（好）
- **Seq Scan**：全表扫描（通常不好）
- **cost**：预估成本（越低越好）
- **rows**：预估行数
- **actual time**：实际执行时间（越低越好）
- **loops**：循环次数

**对比示例**：

**无索引**（慢）：
```text
Seq Scan on orders  (cost=0.00..12345.67 rows=1000 width=200)
  Filter: (user_id = 123)
Execution Time: 123.456 ms
```

**有索引**（快）：
```text
Index Scan using orders_user_id_idx on orders  (cost=0.42..8.44 rows=1 width=200)
  Index Cond: (user_id = 123)
Execution Time: 0.045 ms
```

**性能差异**：123.456 ms vs 0.045 ms，快了2700多倍！

##### 3.3 常见的执行计划问题

**问题1：全表扫描（Seq Scan）**

**示例**：
```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;
```

**输出**：
```text
Seq Scan on orders  (cost=0.00..12345.67 rows=1000 width=200)
  Filter: (user_id = 123)
```

**问题**：
- 扫描了整个表
- 即使只需要1行，也要扫描100万行

**解决**：创建索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**问题2：Nested Loop（嵌套循环）**

**示例**：
```sql
EXPLAIN SELECT * FROM orders o JOIN users u ON o.user_id = u.user_id;
```

**输出**：
```text
Nested Loop  (cost=0.00..1234567.89 rows=1000000 width=400)
  Join Filter: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
  ->  Seq Scan on users u
```

**问题**：
- 对orders的每一行，都扫描users表
- 复杂度：O(orders × users)

**解决**：确保JOIN字段有索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_users_user_id ON users(user_id);
```

**问题3：Filter过滤太晚**

**示例**：
```sql
EXPLAIN SELECT * FROM orders o JOIN users u ON o.user_id = u.user_id WHERE o.created_at >= '2026-01-01';
```

**输出**：
```text
Hash Join  (cost=12345.67..234567.89 rows=1000000 width=400)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
        Filter: (created_at >= '2026-01-01')
  ->  Hash
        ->  Seq Scan on users u
```

**问题**：
- 先JOIN，再过滤
- 如果大部分订单是2026年前的，JOIN浪费

**解决**：先过滤再JOIN
```sql
EXPLAIN SELECT * FROM (
    SELECT * FROM orders WHERE created_at >= '2026-01-01'
) o
JOIN users u ON o.user_id = u.user_id;
```

#### 四、索引优化

##### 4.1 什么是索引

**类比**：书的目录
- 没有目录：从第一页翻到最后一页找内容
- 有目录：直接翻到对应页码

**技术定义**：索引是一种数据结构（通常是B-Tree），加速数据查找

##### 4.2 什么时候需要索引

**原则**：经常用于查询条件的字段需要索引

**示例**：
```sql
-- user_id 经常用于查询
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- created_at 经常用于时间范围查询
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- order_status 经常用于过滤
CREATE INDEX idx_orders_status ON orders(order_status);

-- 组合索引：多个字段经常一起查询
CREATE INDEX idx_orders_user_status ON orders(user_id, order_status);
```

##### 4.3 索引的类型

**单列索引**：
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**组合索引**：
```sql
CREATE INDEX idx_orders_user_status ON orders(user_id, order_status);
```

**注意事项**：
- 组合索引遵循"最左前缀"原则
- WHERE user_id = 123 能用索引
- WHERE order_status = 'paid' 不能用索引
- WHERE user_id = 123 AND order_status = 'paid' 能用索引

**部分索引**：
```sql
-- 只索引已支付订单
CREATE INDEX idx_orders_paid ON orders(user_id) WHERE order_status = 'paid';
```

**表达式索引**：
```sql
-- 索引日期部分
CREATE INDEX idx_orders_created_date ON orders(date(created_at));
```

##### 4.4 索引的代价

**好处**：
- 加速查询
- 减少全表扫描

**代价**：
- 占用存储空间
- 降低写入速度（INSERT、UPDATE、DELETE需要更新索引）
- 索引越多，写入越慢

**平衡**：
- 不是所有字段都需要索引
- 查询频繁的字段建索引
- 写入频繁的表，索引要少

#### 五、查询重写优化

##### 5.1 尽早过滤数据

**不好的写法**：
```sql
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-01-01';
```

**好的写法**：
```sql
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-01-01'
) o ON u.user_id = o.user_id;
```

**原因**：先过滤再JOIN，减少JOIN的数据量

##### 5.2 避免SELECT *

**不好的写法**：
```sql
SELECT * FROM orders WHERE user_id = 123;
```

**好的写法**：
```sql
SELECT order_id, total_amount, created_at FROM orders WHERE user_id = 123;
```

**原因**：
- SELECT * 返回所有列，包括不需要的列
- 可能导致覆盖索引失效
- 增加网络传输

##### 5.3 使用EXISTS代替IN

**不好的写法**：
```sql
SELECT * FROM orders o
WHERE o.user_id IN (
    SELECT user_id FROM premium_users
);
```

**好的写法**：
```sql
SELECT * FROM orders o
WHERE EXISTS (
    SELECT 1 FROM premium_users pu WHERE pu.user_id = o.user_id
);
```

**原因**：
- EXISTS 找到一个匹配就停止
- IN 需要扫描所有匹配

##### 5.4 避免使用OR

**不好的写法**：
```sql
SELECT * FROM orders
WHERE user_id = 123 OR user_id = 456;
```

**好的写法**：
```sql
SELECT * FROM orders
WHERE user_id IN (123, 456);
```

**原因**：IN更容易使用索引

##### 5.5 使用UNION ALL代替UNION

**不好的写法**：
```sql
SELECT user_id FROM orders WHERE total_amount > 1000
UNION
SELECT user_id FROM orders WHERE total_amount < 10;
```

**好的写法**：
```sql
SELECT user_id FROM orders WHERE total_amount > 1000
UNION ALL
SELECT user_id FROM orders WHERE total_amount < 10;
```

**原因**：
- UNION会去重，需要排序
- UNION ALL不去重，更快
- 如果确定没有重复，用UNION ALL

#### 六、物化视图与缓存

##### 6.1 物化视图

**作用**：预计算并存储查询结果

**示例**：
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(paid_at);

-- 查询物化视图（快）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';

-- 刷新物化视图
REFRESH MATERIALIZED VIEW daily_gmv;
```

**优点**：
- 查询非常快
- 减少实时计算

**缺点**：
- 数据有延迟（需要刷新）
- 占用存储空间

##### 6.2 查询缓存

**PostgreSQL的prepared statement**：
```sql
-- 准备语句
PREPARE get_user_orders(int) AS
SELECT * FROM orders WHERE user_id = $1;

-- 执行（快）
EXECUTE get_user_orders(123);
```

**应用层缓存**：
- Redis缓存热点数据
- 应用内存缓存计算结果

#### 七、性能优化的步骤

##### 7.1 识别慢查询

**方法1：查看数据库日志**
```sql
-- PostgreSQL
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**方法2：监控工具**
- Prometheus + Grafana
- DataDog
- 自定义监控

##### 7.2 分析执行计划

**步骤**：
```sql
-- 1. 使用EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 找出瓶颈
-- - 全表扫描（Seq Scan）
-- - Nested Loop
-- - 高cost

-- 3. 确认索引情况
SELECT * FROM pg_indexes WHERE tablename = 'orders';
```

##### 7.3 优化SQL

**方法**：
- 创建索引
- 重写SQL
- 使用物化视图
- 分区表

##### 7.4 验证效果

**步骤**：
```sql
-- 1. 再次EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 对比执行时间
-- - 从100ms降到1ms，优化成功

-- 3. 对比cost
-- - cost从10000降到10
```

#### 八、常见误区

**误区一：索引越多越快**

- **说明**：索引加速查询，但降低写入速度，占用存储
- **后果**：索引太多，写入慢，存储浪费
- **正确理解**：
  - 只为查询频繁的字段建索引
  - 定期清理无用索引
  - 平衡查询和写入性能

**误区二：复杂SQL一定慢**

- **说明**：SQL复杂度不是性能的唯一因素，执行计划更重要
- **后果**：过度简化SQL，反而更慢
- **正确理解**：
  - 复杂但有索引的SQL可能很快
  - 简单但全表扫描的SQL可能很慢
  - 用EXPLAIN分析，不要凭直觉

**误区三：物化视图万能**

- **说明**：物化视图能加速查询，但有数据延迟和存储成本
- **后果**：过度使用，数据不及时，存储浪费
- **正确理解**：
  - 适合聚合统计类查询
  - 不适合实时性要求高的场景
  - 需要定期刷新

**误区四：不用EXPLAIN直接优化**

- **说明**：没有EXPLAIN，不知道真正的瓶颈在哪里
- **后果**：优化方向错误，浪费精力
- **正确理解**：
  - 先EXPLAIN，找出瓶颈
  - 针对性优化
  - 验证优化效果

**误区五：性能优化是一次性工作**

- **说明**：随着数据增长、业务变化，性能问题会重新出现
- **后果**：优化后不再关注，性能再次恶化
- **正确理解**：
  - 定期监控慢查询
  - 定期review执行计划
  - 持续优化和迭代

#### 九、实战任务

**任务1：找出慢查询**

从pg_stat_statements找出最慢的10个查询：

```sql
SELECT
    query,
    calls,
    total_exec_time,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**观察指标**：
- 哪些查询最慢？
- 执行次数多吗？
- 是否可以优化？

**任务2：优化索引**

为orders表创建合适的索引：

```sql
-- 查看当前索引
SELECT * FROM pg_indexes WHERE tablename = 'orders';

-- 分析常见查询
-- Q1：按user_id查询
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- Q2：按日期范围查询
EXPLAIN ANALYZE SELECT * FROM orders WHERE created_at >= '2026-04-01';

-- Q3：按状态查询
EXPLAIN ANALYZE SELECT * FROM orders WHERE order_status = 'paid';

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(order_status);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

**对比优化前后**：
- 执行时间减少多少？
- 是否从Seq Scan变成Index Scan？

**任务3：优化查询重写**

优化以下慢查询：

**原查询**（慢）：
```sql
SELECT u.name, o.order_id, o.total_amount
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01'
AND o.order_status = 'paid';
```

**优化后**：
```sql
SELECT u.name, o.order_id, o.total_amount
FROM users u
JOIN (
    SELECT order_id, user_id, total_amount
    FROM orders
    WHERE created_at >= '2026-04-01'
    AND order_status = 'paid'
) o ON u.user_id = o.user_id;
```

**验证**：
```sql
EXPLAIN ANALYZE [原查询];
EXPLAIN ANALYZE [优化后查询];
```

**对比**：
- cost差异？
- 执行时间差异？

#### 十、小结

SQL性能优化是数据能力的重要组成部分。

核心要点：
- 性能影响用户体验、系统成本、数据及时性
- 使用EXPLAIN ANALYZE分析执行计划
- 索引是最有效的优化手段
- 查询重写能显著提升性能
- 物化视图适合聚合统计类查询
- 性能优化是持续工作，不是一次性任务

下一节将进入SQL在不同系统中的迁移：SQL语法有差异，如何在不同数据库系统间迁移？
