### 3.9 并行查询：利用多核CPU加速大表查询

前面学习了多种优化手段：
- 分区表：通过物理边界优化查询
- 索引：加速数据查找
- 物化视图：预计算查询结果

但这些优化都是在单线程、单核CPU上执行的。

**问题**：现代服务器通常有多核CPU（8核、16核、32核），如何利用多核加速查询？

**示例**：
```sql
-- 单线程扫描1亿行数据
SELECT count(*) FROM orders;

-- 执行时间：30秒（单核）
-- 如果能利用8核，理论上可以降到4秒（30/8）
```

**PostgreSQL的并行查询**：
```sql
-- 设置并行度
SET max_parallel_workers_per_gather = 4;

-- 再次查询
SELECT count(*) FROM orders;

-- 执行时间：8秒（4核并行）
-- 性能提升：3.75倍
```

**这就是并行查询的价值**：通过利用多核CPU，加速大表扫描和聚合计算。

#### 一、为什么需要并行查询

**第一，单核CPU性能有限**

**单核瓶颈**：
```sql
-- 单核扫描1亿行
SELECT count(*) FROM orders;

-- 执行时间：30秒
-- CPU使用率：100%（单核）
-- 其他7核空闲
```

**潜力**：
```yaml
8核CPU：
  - 单核：30秒
  - 8核理论：4秒（30/8）
  - 8核实际：8秒（考虑并行开销）

32核CPU：
  - 单核：30秒
  - 32核理论：1秒（30/32）
  - 32核实际：3秒（考虑并行开销）
```

**第二，大表扫描天然适合并行**

**示例**：
```sql
-- 扫描1亿行，计算GMV
SELECT sum(total_amount) FROM orders;
```

**单线程执行**：
1. 扫描第1行-第1000万行
2. 扫描第1000万行-第2000万行
3. 扫描第2000万行-第3000万行
4. 扫描第3000万行-第1亿行
总时间：30秒

**4核并行执行**：
- Worker1：扫描第1行-第2500万行
- Worker2：扫描第2500万行-第5000万行
- Worker3：扫描第5000万行-第7500万行
- Worker4：扫描第7500万行-第1亿行
总时间：8秒

**说明**：
- 每个Worker扫描一部分数据
- Leader进程汇总结果
- 总时间 = 单个Worker的时间

**第三，聚合计算适合并行**

**示例**：
```sql
-- 计算每天的GMV
SELECT date(created_at), sum(total_amount) FROM orders GROUP BY date(created_at);
```

**单线程执行**：
1. 扫描所有数据
2. 按date(created_at)分组
3. 计算SUM
总时间：40秒

**4核并行执行**：
- Worker1：扫描第1季度数据，按date分组，计算SUM
- Worker2：扫描第2季度数据，按date分组，计算SUM
- Worker3：扫描第3季度数据，按date分组，计算SUM
- Worker4：扫描第4季度数据，按date分组，计算SUM
- Leader：汇总4个Worker的结果
总时间：12秒

**结论**：
> 并行查询通过利用多核CPU，加速大表扫描和聚合计算，是大表优化的重要手段。

#### 二、核心判断：并行查询是"多核协同"，不是"所有查询都适合"

> 并行查询的核心判断是：通过多个Worker进程并行处理数据，利用多核CPU加速查询，但只适合数据量大、计算成本高的查询，小查询反而可能更慢。

这个判断说明：
- **适用场景**：大表扫描、复杂聚合
- **不适用场景**：小表、简单查询
- **核心参数**：max_parallel_workers_per_gather
- **权衡**：并行开销 vs 并行收益

#### 三、并行查询的基础

##### 3.1 启用并行查询

**配置参数**：
```sql
-- 1. 设置最大并行Worker数（每个查询）
SET max_parallel_workers_per_gather = 4;

-- 2. 设置全局并行Worker数
SET max_parallel_workers = 8;

-- 3. 设置并行阈值（表大小超过此值才考虑并行）
SET min_parallel_table_scan_size = '8MB';

-- 4. 启用并行计划
SET parallel_setup_cost = 100;
SET parallel_tuple_cost = 0.1;
```

**配置文件（postgresql.conf）**：
```ini
# 并行查询配置
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
min_parallel_table_scan_size = 8MB
parallel_setup_cost = 100
parallel_tuple_cost = 0.1
```

##### 3.2 查看并行度

**当前配置**：
```sql
-- 查看当前并行度
SHOW max_parallel_workers_per_gather;

-- 查看全局配置
SHOW max_parallel_workers;
```

##### 3.3 强制使用并行

**强制并行**：
```sql
-- 设置并行度为2
SET max_parallel_workers_per_gather = 2;

-- 或者强制并行计划
SET parallel_setup_cost = 0;
SET parallel_tuple_cost = 0;
```

#### 四、并行查询的执行计划

##### 4.1 并行Seq Scan

**单线程**：
```sql
EXPLAIN SELECT count(*) FROM orders;

-- 执行计划：
Aggregate  (cost=12345.67..12345.89 rows=1 width=8)
  ->  Seq Scan on orders  (cost=0.00..12345.67 rows=1000000 width=0)

-- 单个Seq Scan
```

**并行**：
```sql
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT count(*) FROM orders;

-- 执行计划：
Aggregate  (cost=1234.56..1234.78 rows=1 width=8)
  ->  Gather  (cost=1234.00..1234.56 rows=1 width=8)
        Workers Planned: 4
        ->  Partial Aggregate  (cost=234.00..234.56 rows=1 width=8)
              ->  Parallel Seq Scan on orders  (cost=0.00..12345.67 rows=250000 width=0)

-- 4个Worker并行扫描
```

**说明**：
- **Gather**：收集并行Worker的结果
- **Workers Planned**：计划使用4个Worker
- **Parallel Seq Scan**：并行顺序扫描
- **Partial Aggregate**：部分聚合（每个Worker先聚合自己的数据）

##### 4.2 并行JOIN

**示例**：
```sql
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT u.name, count(o.order_id)
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 执行计划：
Finalize Aggregate  (cost=1234.56..1234.78 rows=100 width=200)
  ->  Gather  (cost=1234.00..1234.56 rows=100 width=200)
        Workers Planned: 4
        ->  Partial HashAggregate  (cost=234.00..234.56 rows=100 width=200)
              Group Key: u.user_id, u.name
              ->  Hash Join  (cost=100.00..200.00 rows=1000 width=150)
                    Hash Cond: (o.user_id = u.user_id)
                    ->  Parallel Seq Scan on orders o
                    ->  Hash
                          ->  Parallel Seq Scan on users u
```

**说明**：
- 两个表都并行扫描
- 4个Worker各自执行Hash Join
- Leader汇总结果

#### 五、并行查询的适用场景

##### 5.1 适合并行的场景

**场景1：大表扫描**
```sql
-- 表大小：1亿行（10GB）
SELECT count(*) FROM orders;
```

**单线程**：30秒
**4核并行**：8秒

**场景2：复杂聚合**
```sql
-- 表大小：1亿行
SELECT
    date(created_at),
    sum(total_amount),
    count(*),
    count(DISTINCT user_id),
    avg(total_amount)
FROM orders
GROUP BY date(created_at);
```

**单线程**：60秒
**4核并行**：18秒

**场景3：大表JOIN**
```sql
-- 两个大表：1亿行 vs 1000万行
SELECT u.name, sum(o.total_amount)
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id;
```

**单线程**：120秒
**4核并行**：40秒

##### 5.2 不适合并行的场景

**场景1：小表**
```sql
-- 表大小：1万行（<1MB）
SELECT count(*) FROM small_table;
```

**单线程**：0.01秒
**4核并行**：0.05秒（并行开销>并行收益）

**场景2：快速查询**
```sql
-- 通过索引快速定位
SELECT * FROM orders WHERE user_id = 123;
```

**单线程**：0.1秒
**4核并行**：0.15秒（不需要并行）

**场景3：瓶颈不在CPU**
```sql
-- 瓶颈在I/O或网络
SELECT * FROM large_table WHERE column = 'value';
```

**并行查询**：无法加速I/O或网络瓶颈

#### 六、并行查询的优化

##### 6.1 调整并行度

**原则**：
```yaml
CPU核数少（2-4核）：并行度2
CPU核数多（8-16核）：并行度4
CPU核数很多（32+核）：并行度8
```

**方法**：
```sql
-- 设置并行度
SET max_parallel_workers_per_gather = 4;

-- 或者按会话设置
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
SELECT pg_reload_conf();
```

##### 6.2 调整并行成本

**并行成本估算**：
```sql
-- 查看当前配置
SHOW parallel_setup_cost;    -- 默认1000
SHOW parallel_tuple_cost;     -- 默认0.1

-- 调整（让优化器更倾向于使用并行）
SET parallel_setup_cost = 100;
SET parallel_tuple_cost = 0.01;
```

**说明**：
- **parallel_setup_cost**：启动并行进程的成本
- **parallel_tuple_cost**：并行处理每行的成本
- 调低这些值，优化器更倾向于使用并行

##### 6.3 分区表 + 并行查询

**示例**：
```sql
-- 分区表 + 并行查询
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-01-01';

-- 执行计划：
Gather  (cost=100.00..200.00 rows=1000 width=200)
  Workers Planned: 4
  ->  Append  (cost=0.00..100.00 rows=250 width=200)
        ->  Parallel Seq Scan on orders_202601
        ->  Parallel Seq Scan on orders_202602
        ...
```

**说明**：
- 每个Worker扫描不同的分区
- 并行度 = Worker数 × 分区数

#### 七、并行查询的限制

##### 7.1 限制条件

**不适合并行的查询**：
```sql
-- 1. 包含限制的SQL
-- CTE（WITH query）
-- 2. 某些类型的JOIN
-- 3. 写入操作（INSERT/UPDATE/DELETE）
-- 4. 某些类型的函数
```

**示例**：
```sql
-- CTE（不支持并行）
WITH cte AS (
    SELECT * FROM orders
)
SELECT count(*) FROM cte;

-- 执行计划：单线程
```

**解决方法**：
```sql
-- 改写为子查询（可能支持并行）
SELECT count(*) FROM (SELECT * FROM orders) t;
```

##### 7.2 并行开销

**并行开销**：
```yaml
进程启动：
  - 启动Worker进程
  - 分配数据
  - 汇总结果

通信开销：
  - Worker间通信
  - 数据传输
```

**权衡**：
```yaml
小查询：
  - 并行开销 > 并行收益
  - 不适合并行

大查询：
  - 并行收益 > 并行开销
  - 适合并行
```

##### 7.3 资源竞争

**问题**：
```yaml
太多并行查询：
  - 竞争CPU资源
  - 竞争内存资源
  - 系统负载高
```

**配置限制**：
```sql
-- 限制全局并行Worker数
SET max_parallel_workers = 8;

-- 限制每个查询的并行Worker数
SET max_parallel_workers_per_gather = 4;
```

#### 八、常见误区

**误区一：并行度越高越好**

- **说明**：并行度不是越高越好，有并行开销
- **后果**：并行度过高，性能反而下降
- **正确理解**：
  - 根据CPU核数设置并行度
  - 通常2-8个Worker足够
  - 测试不同并行度的性能

**误区二：所有查询都应该并行**

- **说明**：并行查询只适合大表、复杂查询
- **后果**：小查询也并行，性能下降
- **正确理解**：
  - 大表查询：并行
  - 小表查询：单线程
  - 根据表大小和查询复杂度决定

**误区三：并行查询总是比单线程快**

- **说明**：并行有开销，小查询可能更慢
- **后果**：以为并行总是快的，不验证
- **正确理解**：
  - 大查询：并行快
  - 小查询：单线程快
  - 用EXPLAIN ANALYZE验证

**误区四：并行查询不需要配置**

- **说明**：并行查询需要配置参数
- **后果**：默认配置可能不启用并行
- **正确理解**：
  - 配置max_parallel_workers_per_gather
  - 配置max_parallel_workers
  - 配置min_parallel_table_scan_size

**误区五：并行查询和分区表冲突**

- **说明**：并行查询和分区表可以配合使用
- **后果**：以为只能选一个
- **正确理解**：
  - 分区表 + 并行查询：最佳组合
  - 每个Worker扫描不同分区
  - 性能提升最明显

#### 九、实战任务

**任务1：测试并行查询性能**

测试不同并行度的性能：

```sql
-- 1. 单线程查询
SET max_parallel_workers_per_gather = 0;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 2. 2核并行
SET max_parallel_workers_per_gather = 2;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 3. 4核并行
SET max_parallel_workers_per_gather = 4;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 4. 8核并行
SET max_parallel_workers_per_gather = 8;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 5. 对比性能
-- 单线程：30秒
-- 2核：18秒
-- 4核：10秒
-- 8核：8秒
```

**任务2：优化并行度**

找到最优并行度：

```sql
-- 测试不同并行度
SELECT parallel度, 执行时间
FROM (
    SELECT
        CASE
            WHEN max_parallel_workers_per_gather = 0 THEN '单线程'
            WHEN max_parallel_workers_per_gather = 2 THEN '2核'
            WHEN max_parallel_workers_per_gather = 4 THEN '4核'
            WHEN max_parallel_workers_per_gather = 8 THEN '8核'
        END as 并行度,
       (EXPLAIN ANALYZE SELECT count(*) FROM orders)).* as 执行时间
) t
-- 对比结果，选择最优并行度
```

**任务3：分区表 + 并行查询**

测试分区表的并行查询：

```sql
-- 1. 单线程查询分区表
SET max_parallel_workers_per_gather = 0;
EXPLAIN ANALYZE SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';

-- 2. 4核并行查询分区表
SET max_parallel_workers_per_gather = 4;
EXPLAIN ANALYZE SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';

-- 3. 对比性能
-- 单线程：30秒
-- 4核并行：6秒
-- 性能提升：5倍
```

#### 十、小结

并行查询通过利用多核CPU，加速大表扫描和聚合计算。

核心要点：
- 并行查询适合大表、复杂聚合、大表JOIN
- 不适合小表、简单查询、I/O瓶颈
- 核心参数：max_parallel_workers_per_gather
- 并行有开销，需要权衡
- 分区表 + 并行查询：最佳组合
- 根据CPU核数设置并行度
- 用EXPLAIN ANALYZE验证性能

下一节将进入批量操作与数据链路接入：如何高效地导入导出大量数据。
