### 3.5 索引基础：B-tree与查询加速

前几节讨论了大表性能问题的根本原因：磁盘I/O慢。

解决磁盘I/O慢的核心手段之一是：**索引（Index）**。

**什么是索引？**

生活中的索引：
- 书的目录：快速找到章节，不用从第一页翻到最后一页
- 字典：按字母顺序排列，快速查到单词
- 通讯录：按姓名排序，快速找到联系人

数据库中的索引：
- 数据结构：B-tree、Hash、GiST、GIN等
- 作用：快速定位数据，避免全表扫描
- 代价：占用存储空间，降低写入速度

**为什么需要索引？**

```sql
-- 无索引：全表扫描（慢）
SELECT * FROM orders WHERE user_id = 123;
-- 扫描1亿行，需要30秒

-- 有索引：索引扫描（快）
SELECT * FROM orders WHERE user_id = 123;
-- 通过索引直接定位到user_id=123的记录，只需0.1秒
```

**性能差异**：300倍！

但索引不是万能的，需要理解其原理和适用场景。

#### 一、为什么需要索引

**第一，全表扫描成本高**

**场景**：查询单个用户的订单

**无索引**：
```sql
-- 全表扫描
SELECT * FROM orders WHERE user_id = 123;

-- 执行计划
Seq Scan on orders  (cost=0.00..1234567.89 rows=100 width=200)
  Filter: (user_id = 123)

-- 执行时间：30秒（1亿行）
```

**问题**：
- 从头到尾扫描整个表
- 即使只有100行符合条件，也要扫描1亿行
- 磁盘I/O成本高

**有索引**：
```sql
-- 索引扫描
CREATE INDEX idx_orders_user_id ON orders(user_id);

SELECT * FROM orders WHERE user_id = 123;

-- 执行计划
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)

-- 执行时间：0.1秒
```

**优势**：
- 通过索引直接定位到user_id=123的记录
- 不需要扫描全表
- 磁盘I/O大幅减少

**第二，索引能加速排序**

**场景**：按用户ID查询，并按订单时间排序

**无索引**：
```sql
-- 先过滤，再排序
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 执行步骤：
-- 1. 全表扫描找到user_id=123的记录
-- 2. 对结果排序
-- 执行时间：35秒
```

**有索引**：
```sql
-- 组合索引（user_id, created_at）
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 执行步骤：
-- 1. 索引直接找到user_id=123的记录
-- 2. 索引已经按created_at排序
-- 执行时间：0.1秒
```

**优势**：
- 索引本身是有序的
- 不需要额外排序
- 直接返回有序结果

**第三，索引能加速JOIN**

**场景**：关联查询用户和订单

**无索引**：
```sql
-- 嵌套循环JOIN
SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 执行计划
Nested Loop  (cost=0.00..12345678.90 rows=1000000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Seq Scan on users u
  ->  Seq Scan on orders o

-- 执行时间：10分钟
```

**问题**：
- 对users的每一行，都扫描整个orders表
- 复杂度：O(users × orders)

**有索引**：
```sql
-- 为orders.user_id创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 执行计划
Hash Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
  ->  Hash
        ->  Seq Scan on users u

-- 执行时间：5秒
```

**优势**：
- 优化器选择Hash Join
- 索引加速JOIN过程

**结论**：
> 索引是通过有序数据结构加速查询、排序、JOIN的核心手段，是大表优化的基础。

#### 二、核心判断：索引不是"越多越好"，而是"按需创建"

> 索引的核心判断是：通过牺牲写入性能和存储空间，换取查询性能的提升，因此需要根据查询模式创建合适的索引，避免过度索引。

这个判断说明：
- **收益**：查询性能大幅提升
- **代价**：写入性能下降、存储空间增加
- **原则**：按需创建，不是越多越好
- **策略**：分析查询模式，创建必要索引

#### 三、B-tree索引原理

##### 3.1 什么是B-tree

**定义**：B-tree是一种平衡树数据结构，PostgreSQL的默认索引类型

**特点**：
- **平衡**：所有叶子节点在同一层
- **有序**：数据按键值有序存储
- **多路**：每个节点可以有多个子节点（PostgreSQL默认是几万个）

**结构**：
```
                    [根节点]
                   /    |    \
              [内部节点1] [内部节点2] [内部节点3]
              /   |   \
        [叶子1] [叶子2] [叶子3] ...
```

**查找过程**：
1. 从根节点开始
2. 根据键值选择合适的子节点
3. 递归查找，直到叶子节点
4. 在叶子节点中找到数据

**时间复杂度**：O(log n)
- 100万行：约3-4次I/O
- 1亿行：约4-5次I/O
- 100亿行：约5-6次I/O

##### 3.2 B-tree索引的存储

**索引结构**：
```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- PostgreSQL会在文件系统上创建索引文件
-- 例如：base/16384/16385 INDEX (idx_orders_user_id)
```

**索引内容**：
```
user_id | row_id (CTID)
--------|------------
1       | (0,1)
1       | (0,2)
2       | (0,3)
3       | (0,4)
...
```

**说明**：
- 索引存储：user_id + row_id（指向表数据的物理位置）
- 有序：按user_id排序
- 压缩：PostgreSQL会压缩索引

##### 3.3 B-tree索引的查找

**等值查询**：
```sql
SELECT * FROM orders WHERE user_id = 123;
```

**查找过程**：
1. 在B-tree中查找user_id=123
2. 找到对应的row_id（可能有多个）
3. 通过row_id从表中读取完整行

**范围查询**：
```sql
SELECT * FROM orders WHERE user_id BETWEEN 100 AND 200;
```

**查找过程**：
1. 在B-tree中找到user_id=100的位置
2. 从这个位置开始，顺序扫描到user_id=200
3. 收集所有row_id
4. 从表中读取完整行

**排序查询**：
```sql
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;
```

**查找过程**：
1. 如果有组合索引(user_id, created_at)
2. 索引已经按created_at排序（在user_id=123的范围内）
3. 直接返回有序结果

#### 四、索引的使用场景

##### 4.1 适合索引的场景

**场景1：等值查询**
```sql
-- 适合
SELECT * FROM orders WHERE user_id = 123;
SELECT * FROM orders WHERE order_status = 'paid';

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
```

**场景2：范围查询**
```sql
-- 适合
SELECT * FROM orders WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01';
SELECT * FROM orders WHERE total_amount > 1000;

-- 创建索引
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_amount ON orders(total_amount);
```

**场景3：排序查询**
```sql
-- 适合
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;
SELECT * FROM orders ORDER BY user_id, created_at;

-- 创建索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

**场景4：JOIN查询**
```sql
-- 适合
SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

##### 4.2 不适合索引的场景

**场景1：低选择性字段**
```sql
-- 不适合（order_status只有5个不同值）
SELECT * FROM orders WHERE order_status = 'paid';

-- 原因：选择性低，索引效果差
-- 优化器可能选择全表扫描
```

**选择性计算**：
```sql
-- 高选择性（适合索引）
SELECT count(DISTINCT user_id) / count(*) FROM orders;
-- 结果：0.9（90%的行都是不同的）

-- 低选择性（不适合索引）
SELECT count(DISTINCT order_status) / count(*) FROM orders;
-- 结果：0.000005（只有5个不同状态）
```

**场景2：频繁更新的表**
```sql
-- 不适合（写入频繁，索引维护成本高）
INSERT INTO events (user_id, event_name, event_time) VALUES (?, ?, ?);
-- 每秒1000次写入，如果有索引，每次写入都要更新索引

-- 建议减少索引数量
```

**场景3：小表**
```sql
-- 不适合（表太小，全表扫描更快）
SELECT * FROM status WHERE code = 'active';
-- 只有10行，全表扫描比索引扫描还快
```

**场景4：返回大量数据**
```sql
-- 不适合（返回>10%的数据，全表扫描更快）
SELECT * FROM orders WHERE created_at >= '2020-01-01';
-- 返回90%的数据，全表扫描更快
```

#### 五、索引的类型

##### 5.1 单列索引

**定义**：在一个字段上创建的索引

```sql
-- 创建单列索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

**使用场景**：
- 单字段查询
- 单字段排序

**限制**：
- 无法优化多字段查询
- 可能产生索引重叠

##### 5.2 组合索引

**定义**：在多个字段上创建的索引

```sql
-- 创建组合索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

**使用场景**：
```sql
-- 能优化
SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01';
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 不能优化（created_at在前，user_id在后）
SELECT * FROM orders WHERE created_at >= '2026-04-01' AND user_id = 123;
```

**最左前缀原则**：
```sql
-- 索引：(user_id, created_at, order_status)

-- 能使用索引
WHERE user_id = 123
WHERE user_id = 123 AND created_at >= '2026-04-01'
WHERE user_id = 123 AND created_at >= '2026-04-01' AND order_status = 'paid'

-- 不能使用索引（或部分使用）
WHERE created_at >= '2026-04-01'
WHERE order_status = 'paid'
```

**建议**：
- 将最常用的查询字段放在前面
- 将选择性高的字段放在前面
- 避免过多字段（通常<5个）

##### 5.3 唯一索引

**定义**：确保字段值唯一的索引

```sql
-- 创建唯一索引
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 或者在创建表时定义
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100)
);
```

**作用**：
- 保证数据唯一性
- 加速查询

**使用场景**：
- 主键（PRIMARY KEY）
- 邮箱、手机号等唯一字段
- 业务键（如订单号）

##### 5.4 部分索引

**定义**：只对表中符合条件的行创建索引

```sql
-- 创建部分索引（只索引已支付订单）
CREATE INDEX idx_orders_paid ON orders(user_id) WHERE order_status = 'paid';

-- 使用索引
SELECT * FROM orders WHERE user_id = 123 AND order_status = 'paid';
```

**优势**：
- 减少索引大小
- 节省存储空间
- 加速索引扫描

**使用场景**：
- 只查询特定条件的数据（如已支付订单）
- 数据分布不均（大部分是未支付订单）

##### 5.5 表达式索引

**定义**：在函数或表达式上创建的索引

```sql
-- 创建表达式索引
CREATE INDEX idx_orders_date ON orders(date(created_at));
CREATE INDEX idx_orders_email_lower ON users(LOWER(email));

-- 使用索引
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';
```

**使用场景**：
- 需要在函数或表达式上查询
- 无法修改查询逻辑

#### 六、索引的维护

##### 6.1 查看索引

**查看表的索引**：
```sql
-- 查看orders表的所有索引
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders';

-- 查看索引大小
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND relname = 'orders';
```

##### 6.2 索引的使用统计

**查看索引使用情况**：
```sql
-- 查看索引扫描次数
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- 分析：
-- idx_scan = 0：索引从未使用，考虑删除
-- idx_scan很少：索引使用频率低，考虑是否需要
```

##### 6.3 重建索引

**什么时候需要重建索引**：
- 索引膨胀（size很大）
- 索引碎片化
- 性能下降

**重建索引**：
```sql
-- 方法1：REINDEX
REINDEX INDEX idx_orders_user_id;

-- 方法2：CREATE INDEX CONCURRENTLY
DROP INDEX idx_orders_user_id;
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- 注意：
-- - REINDEX会锁表
-- - CREATE INDEX CONCURRENTLY不锁表，但耗时更长
```

##### 6.4 删除无用索引

**查找未使用的索引**：
```sql
-- 查找从未使用的索引
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%_pkey';
```

**删除索引**：
```sql
-- 删除前确认
-- 1. 索引确实未被使用
-- 2. 不是主键或唯一约束
-- 3. 不影响查询性能

DROP INDEX idx_orders_unused;
```

#### 七、索引的性能影响

##### 7.1 索引对查询的影响

**正面影响**：
- 查询速度提升10-1000倍
- 排序加速
- JOIN加速

**负面影响**：
- 占用存储空间（通常是表的10%-50%）
- 降低写入性能（INSERT、UPDATE、DELETE需要更新索引）

##### 7.2 索引对写入的影响

**写入过程**：
```sql
INSERT INTO orders (user_id, total_amount) VALUES (123, 100.00);
```

**有索引时**：
1. 写入表数据
2. 更新所有索引（每个索引都需要更新）
3. 如果有3个索引，需要写入4次（1次表 + 3次索引）

**写入性能**：
- 无索引：1000行/秒
- 有3个索引：300行/秒
- 性能下降3倍

**平衡**：
- 查询频繁的表：多索引
- 写入频繁的表：少索引
- 分析场景：可以有很多索引
- 事务场景：索引要少

#### 八、常见误区

**误区一：索引越多查询越快**

- **说明**：索引能加速查询，但优化器需要评估所有索引，索引太多反而慢
- **后果**：查询优化时间长，索引维护成本高
- **正确理解**：
  - 只为常用查询创建索引
  - 定期清理无用索引
  - 避免重叠索引

**误区二：所有字段都需要索引**

- **说明**：只有查询、排序、JOIN的字段需要索引
- **后果**：索引太多，写入慢，存储浪费
- **正确理解**：
  - WHERE条件中的字段
  - ORDER BY中的字段
  - JOIN条件中的字段
  - 其他字段不需要索引

**误区三：索引能解决所有性能问题**

- **说明**：索引只解决特定类型的性能问题，不是万能的
- **后果**：过度依赖索引，忽视其他优化手段
- **正确理解**：
  - 索引优化：查询性能
  - 分区优化：数据访问模式
  - 缓存优化：热点数据
  - 综合优化

**误区四：索引一旦创建就不管了**

- **说明**：索引需要维护，需要定期检查和优化
- **后果**：索引膨胀、碎片化，性能下降
- **正确理解**：
  - 定期查看索引使用情况
  - 删除无用索引
  - 重建膨胀的索引
  - 根据查询模式调整索引

**误区五：索引名称不重要**

- **说明**：索引名称很重要，需要能看出索引的用途
- **后果**：难以维护，不知道索引是干什么的
- **正确理解**：
  - 使用有意义的命名（如idx_orders_user_id）
  - 避免自动生成的名称（如idx_12345）
  - 便于查看和维护

#### 九、实战任务

**任务1：创建索引优化查询**

为以下查询创建合适的索引：

```sql
-- 查询1：查询单个用户的订单
SELECT * FROM orders WHERE user_id = 123;

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 查询2：查询某天的订单
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 创建索引
CREATE INDEX idx_orders_created_date ON orders(date(created_at));

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 查询3：查询用户在某个时间段的订单
SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01' AND created_at < '2026-05-01';

-- 创建组合索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01' AND created_at < '2026-05-01';
```

**任务2：查找无用索引**

查找并删除无用索引：

```sql
-- 1. 查看所有索引
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- 2. 找出从未使用的索引
-- idx_scan = 0 且不是主键

-- 3. 删除前确认
-- - 查看索引定义
SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_orders_unused';

-- - 确认是否是约束索引
SELECT * FROM pg_constraint WHERE conname = 'idx_orders_unused';

-- 4. 删除无用索引
DROP INDEX IF EXISTS idx_orders_unused;
```

**任务3：监控索引性能**

监控索引的使用情况和性能：

```sql
-- 1. 查看索引使用统计
SELECT
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 2. 查看索引大小
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
    (pg_indexes_size(schemaname||'.'||tablename)::numeric / pg_total_relation_size(schemaname||'.'||tablename)) * 100 as index_ratio
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_indexes_size(schemaname||'.'||tablename) DESC;

-- 3. 分析：
-- - 哪些索引使用最频繁？
-- - 哪些索引从未使用？
-- - 索引占多少空间？（通常<表大小的50%）
```

#### 十、小结

索引是大表优化的基础。

核心要点：
- B-tree是PostgreSQL的默认索引类型
- 索引通过有序数据结构加速查询、排序、JOIN
- 索引的类型：单列、组合、唯一、部分、表达式
- 索引有代价：写入性能下降、存储空间增加
- 按需创建索引，不是越多越好
- 定期维护索引：查看使用情况、删除无用索引、重建膨胀索引

下一节将进入索引进阶：BRIN、GIN、GiST等特殊索引类型，针对特定场景优化。
