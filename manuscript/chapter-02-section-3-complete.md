### 2.3 聚合分析：从明细记录到统计指标

基础查询回答的是"哪些记录符合条件"。

聚合分析回答的是"这些记录合起来说明什么"。

假设`orders`表一行代表一笔订单：

```text
orders
├── order_id
├── user_id
├── order_status
├── total_amount
├── created_at
└── paid_at
```

如果只看明细，你可以知道最近20笔订单是什么。但业务通常更关心：

```text
今天有多少订单？
这个月GMV是多少？
平均每笔订单多少钱？
哪个商品销量最高？
每天订单量趋势如何？
哪些用户发生了复购？
```

这就需要聚合。

#### 一、为什么只看明细不够

**第一，明细无法回答宏观问题**

运营同学关心的是整体情况：
- "今天成交额怎么样？"
- "这个月增长了吗？"
- "哪个类目表现最好？"

这些问题都不是单条订单能回答的，需要对大量订单进行统计。

**第二，明细数据量太大，难以理解**

如果你有1000万行订单，逐行查看几乎不可能。你需要的是：
- 1000万行订单 → 1个GMV数字
- 1000万行订单 → 30天的每日GMV
- 1000万行订单 → Top10商品排行

聚合让大数据变成可理解的指标。

**第三，业务决策基于统计，不是明细**

业务决策的依据通常是：
- GMV是否达标
- 增长率是否健康
- 用户留存是否良好

这些都需要聚合分析。

**结论**：
> 聚合分析是SQL分析能力的核心，也是所有统计报表的基础。

#### 二、核心判断：聚合回答"这些记录合起来说明什么"

> 聚合分析的核心判断是：从大量明细记录中，按照特定维度分组，计算统计指标，回答业务问题。

这个判断说明：
- **输入**：大量明细记录
- **过程**：分组（GROUP BY）+ 计算（聚合函数）
- **输出**：统计指标
- **目的**：支持业务决策

#### 三、聚合函数详解

##### 3.1 COUNT：计数

**作用**：计算记录数

**常见用法**：
```sql
-- 统计所有记录数
SELECT count(*) FROM orders;

-- 统计非NULL值数
SELECT count(user_id) FROM orders;

-- 统计去重后的记录数
SELECT count(DISTINCT user_id) FROM orders;
```

**注意事项**：
- `COUNT(*)`：包括NULL，统计所有行
- `COUNT(字段)`：不包括NULL
- `COUNT(DISTINCT 字段)`：去重后计数

**实战场景**：
```sql
-- 订单总数
SELECT count(*) FROM orders;

-- 下单用户数（去重）
SELECT count(DISTINCT user_id) FROM orders;

-- 有支付的用户数
SELECT count(DISTINCT user_id) FROM orders WHERE paid_at IS NOT NULL;
```

##### 3.2 SUM：求和

**作用**：计算数值的总和

**常见用法**：
```sql
-- 订单总金额
SELECT sum(total_amount) FROM orders;

-- 按状态求和
SELECT order_status, sum(total_amount) FROM orders GROUP BY order_status;

-- 处理NULL
SELECT sum(COALESCE(total_amount, 0)) FROM orders;
```

**注意事项**：
- SUM忽略NULL值
- 如果所有值都是NULL，返回NULL
- 使用COALESCE处理NULL

##### 3.3 AVG：平均值

**作用**：计算平均值

**实现方式**：
```sql
-- AVG会自动忽略NULL
SELECT avg(total_amount) FROM orders;

-- 等价于：SUM / COUNT
SELECT sum(total_amount) / count(*) FROM orders;
```

**注意事项**：
- AVG自动排除NULL
- 可能被异常值影响
- 考虑使用中位数MEDIAN（PostgreSQL 12+）

##### 3.4 MAX/MIN：最大值/最小值

**作用**：找出极值

**常见用法**：
```sql
-- 最大订单金额
SELECT max(total_amount) FROM orders;

-- 最小订单金额
SELECT min(total_amount) FROM orders WHERE order_status = 'paid';

-- 每个用户的最大订单金额
SELECT user_id, max(total_amount) FROM orders GROUP BY user_id;
```

#### 四、GROUP BY与分组维度

##### 4.1 GROUP BY的基本用法

**作用**：按照维度分组统计

**示例**：
```sql
-- 按日期统计
SELECT 
    date(created_at) as order_date,
    count(*) as order_count,
    sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);
```

**关键理解**：分组维度决定粒度

**不同分组粒度**：
```sql
-- 按日统计（一行一天）
SELECT date(created_at), count(*) FROM orders GROUP BY date(created_at);

-- 按月统计（一行一月）
SELECT date_trunc('month', created_at), count(*) FROM orders GROUP BY date_trunc('month', created_at);

-- 按用户统计（一行一个用户）
SELECT user_id, count(*) FROM orders GROUP BY user_id;
```

##### 4.2 GROUP BY的粒度问题

**粒度混乱的后果**：
```sql
-- 错误示例：混合粒度
SELECT 
    user_id,
    date(created_at),      -- 按天分组
    date_trunc('month', created_at),  -- 按月分组（嵌套在天里）
    count(*)
FROM orders
GROUP BY user_id, date(created_at), date_trunc('month', created_at);
```

**问题**：按月分组嵌套在天分组里，逻辑混乱

**正确做法**：明确一个分组维度
```sql
-- 选择按天分组
SELECT user_id, date(created_at), count(*)
FROM orders
GROUP BY user_id, date(created_at);

-- 或选择按月分组
SELECT user_id, date_trunc('month', created_at), count(*)
FROM orders
GROUP BY user_id, date_trunc('month', created_at);
```

##### 4.3 HAVING：分组后过滤

**作用**：对聚合结果进行过滤

**WHERE vs HAVING**：
```sql
-- WHERE：聚合前过滤
SELECT user_id, count(*) as order_count
FROM orders
WHERE total_amount > 100
GROUP BY user_id;

-- HAVING：聚合后过滤
SELECT user_id, count(*) as order_count
FROM orders
GROUP BY user_id
HAVING count(*) > 5;
```

**使用场景**：
- WHERE：过滤明细记录（如：只看已支付订单）
- HAVING：过滤聚合结果（如：只看下单超过5次的用户）

##### 4.4 聚合的粒度陷阱

**陷阱1：粒度变化**

**问题场景**：
```sql
SELECT 
    o.order_id,
    o.order_status,
    oi.product_id,
    sum(oi.item_amount) as total_amount
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, o.order_status, oi.product_id;
```

**分析**：
- orders：一行一笔订单
- JOIN order_items后：一行一个订单商品明细
- SUM(order_item.item_amount)：订单商品粒度的金额
- **问题**：如果直接用SUM(total_amount)统计，会重复计算订单金额

**正确做法**：
```sql
-- 方法1：先按订单聚合，再JOIN
WITH order_totals AS (
    SELECT order_id, sum(item_amount) as order_amount
    FROM order_items
    GROUP BY order_id
)
SELECT o.order_id, o.order_status, ot.order_amount
FROM orders o
JOIN order_totals ot ON o.order_id = ot.order_id;

-- 方法2：从订单表直接统计
SELECT order_id, order_status, total_amount
FROM orders;
```

**陷阱2：去重时机**

**问题场景**：统计每日活跃用户数（DAU）

```sql
-- 错误：先用DISTINCT再JOIN
SELECT count(DISTINCT e.user_id)
FROM events e
JOIN users u ON e.user_id = u.user_id
WHERE date(e.event_time) = '2026-04-01';

-- 问题：JOIN可能导致用户数重复计算或丢失
```

**正确做法**：
```sql
-- 直接在events上统计
SELECT count(DISTINCT user_id)
FROM events
WHERE date(event_time) = '2026-04-01';
```

#### 五、常见误区

**误区一：聚合结果有数字就正确**

- **说明**：聚合函数能算出数字，但数字是否可信取决于过滤条件、去重口径、时间字段、JOIN粒度
- **后果**：不同人、不同SQL算出不同结果，指标口径不一致
- **正确理解**：必须明确定义：
  - 取数边界：哪些记录算入？
  - 过滤条件：哪些记录排除？
  - 时间口径：按创建时间还是支付时间？
  - 去重口径：用COUNT(*)还是COUNT(DISTINCT)？

**误区二：GROUP BY的字段可以随便选**

- **说明**：GROUP BY的字段决定分组维度和指标含义
- **后果**：分组维度混乱，指标口径不一致
- **正确理解**：
  - GROUP BY的字段就是分析维度
  - 不同分组维度得出不同指标
  - 必须明确当前分析是按什么维度聚合

**误区三：COUNT(*)和COUNT(字段)一样**

- **说明**：COUNT(*)包括NULL，COUNT(字段)不包括NULL
- **后果**：统计结果可能不符合预期
- **正确理解**：
  - COUNT(*)：统计所有行
  - COUNT(字段)：统计非NULL值
  - 要根据需求选择

**误区四：AVG就是算术平均，不考虑异常值**

- **说明**：AVG会被异常值影响，可能不代表典型情况
- **后果**：指标被极端值扭曲
- **正确理解**：
  - 简单场景用AVG即可
  - 有极端值时，考虑中位数MEDIAN或百分位数
  - 也可以先用WHERE过滤极端值再聚合

**误区五：HAVING和WHERE作用一样**

- **说明**：WHERE过滤明细记录，HAVING过滤聚合结果
- **后果**：逻辑错误或性能问题
- **正确理解**：
  - WHERE：在聚合前过滤
  - HAVING：在聚合后过滤
  - 顺序：WHERE → GROUP BY → HAVING

#### 六、实战任务

**任务1：基础聚合练习**

给定orders表，完成以下聚合：

1. 按订单状态统计订单数和GMV：
```sql
SELECT 
    order_status,
    count(*) as order_count,
    sum(total_amount) as gmv
FROM orders
GROUP BY order_status;
```

2. 按日期统计每日订单数和GMV：
```sql
SELECT 
    date(created_at) as order_date,
    count(*) as order_count,
    sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at)
ORDER BY order_date;
```

3. 统计每个用户的订单数和消费金额：
```sql
SELECT 
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
GROUP BY user_id
ORDER BY total_amount DESC
LIMIT 10;
```

**任务2：对比实验**

同一个GMV指标，用两种方式计算：

**方式A**：
```sql
SELECT sum(total_amount) as gmv FROM orders;
```

**方式B**：
```sql
SELECT sum(total_amount) as gmv FROM orders WHERE order_status = 'paid';
```

**对比**：
- 两个结果差多少？
- 哪个更符合业务？
- 差异说明了什么？

**任务3：粒度实验**

同一个"商品销量"指标，用三种分组粒度：

**粒度1：按商品**
```sql
SELECT product_id, sum(quantity) FROM order_items GROUP BY product_id;
```

**粒度2：按类目**
```sql
SELECT category_id, sum(quantity) FROM order_items GROUP BY category_id;
```

**粒度3：按地区**
```sql
SELECT region_id, sum(quantity) FROM order_items GROUP BY region_id;
```

**分析**：
- 不同分组粒度回答不同的业务问题
- 每种粒度的适用场景

#### 七、小结

基础查询回答"哪些记录符合条件"。

聚合分析回答"这些记录合起来说明什么"。

核心要点：
- 聚合函数（COUNT、SUM、AVG、MAX、MIN）是聚合的基础
- GROUP BY定义分组维度，不同的维度得出不同的指标
- HAVING对聚合结果进行过滤
- 聚合的粒度陷阱：JOIN会改变粒度，要注意重复计算
- 聚合结果有数字不代表正确，必须明确口径

下一节将进入多表关联：现实数据通常不会在一张表里，需要从多表中恢复完整的业务事实。
