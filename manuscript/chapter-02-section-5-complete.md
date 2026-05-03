### 2.5 复杂分析SQL：把中间过程表达清楚

基础查询从单表取数据，聚合分析计算统计指标，多表关联恢复业务事实。

但现实分析往往需要多个步骤：

```text
问题：哪个用户复购率最高？

步骤分解：
1. 计算每个用户的订单数
2. 计算每个用户的购买天数（去重）
3. 复购率 = (订单数 - 购买天数) / 订单数
4. 按复购率排序
```

如果用一个 SQL 写完，会很复杂且难以理解。

如果把步骤拆开，又难以在一个 SQL 中完成。

如何既保持 SQL 的可读性，又在一个查询中完成多步骤分析？

这就是复杂分析 SQL 要解决的问题。

#### 一、为什么需要把中间过程表达清楚

**第一，复杂分析天然是多步骤的**

业务分析很少能一步完成：

```sql
-- 问题：每个用户的平均客单价是多少？
-- 这需要先计算：每个用户的总金额 / 订单数

-- 问题：哪个类目的复购率最高？
-- 这需要先计算：每个类目的复购用户数 / 总用户数

-- 问题：每天的活跃用户留存率是多少？
-- 这需要先计算：今天活跃的用户，明天还活跃的比例
```

这些都是多步骤分析，很难用单个 SELECT 完成。

**第二，嵌套子查询难以阅读**

如果用嵌套子查询：

```sql
-- 可读性差的写法
SELECT user_id, order_count / distinct_days as repeat_rate
FROM (
    SELECT user_id, count(*) as order_count, count(DISTINCT date(created_at)) as distinct_days
    FROM (
        SELECT user_id, created_at
        FROM orders
        WHERE order_status = 'paid'
    ) o
    GROUP BY user_id
) t
WHERE order_count > 1;
```

**问题**：
- 嵌套层次深，难以理解
- 别名多，容易混淆
- 调试困难：不知道哪一步出错了

**第三，中间结果需要复用**

有些分析中，中间结果需要多次使用：

```sql
-- 示例：计算订单的各种统计指标
-- 中间结果：每个用户的订单统计
WITH user_stats AS (
    SELECT user_id, count(*) as order_count, sum(total_amount) as total_amount
    FROM orders
    GROUP BY user_id
)
-- 复用1：高价值用户
SELECT * FROM user_stats WHERE total_amount > 1000;
-- 复用2：高频用户
SELECT * FROM user_stats WHERE order_count > 10;
```

用 CTE（Common Table Expression）可以定义一次，复用多次。

**结论**：
> 复杂分析 SQL 的核心是：把中间过程清晰地表达出来，让每个步骤都一目了然，便于理解、调试和优化。

#### 二、核心判断：复杂SQL不是写得越长越好，而是分层清晰

> 复杂分析 SQL 的核心判断是：通过 CTE 或子查询，把分析过程分解成清晰的步骤，每个步骤完成一个明确的任务，最终组装成完整的分析。

这个判断说明：
- **输入**：原始业务表
- **分解**：按逻辑拆分成多个步骤
- **表达**：用 CTE 或子 query 定义中间步骤
- **组装**：最后的 SELECT 组装所有步骤
- **价值**：可读性、可维护性、可调试性

#### 三、CTE（Common Table Expression）

##### 3.1 CTE的基本语法

**作用**：定义临时的命名结果集，可在后续查询中引用

**语法**：
```sql
WITH cte_name AS (
    -- 查询语句
    SELECT ...
)
SELECT ...
FROM cte_name;
```

**示例**：
```sql
-- 用 CTE 重写复购率查询
WITH user_orders AS (
    -- 步骤1：计算每个用户的订单统计
    SELECT
        user_id,
        count(*) as order_count,
        count(DISTINCT date(created_at)) as distinct_days
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
)
SELECT
    user_id,
    order_count,
    distinct_days,
    (order_count - distinct_days)::numeric / order_count as repeat_rate
FROM user_orders
WHERE order_count > 1
ORDER BY repeat_rate DESC;
```

**好处**：
- 每个步骤清晰命名
- 逻辑分层，易于理解
- 便于调试（可以单独运行每个 CTE）

##### 3.2 多个CTE串联

**作用**：定义多个中间步骤，逐步计算

**示例**：
```sql
-- 问题：哪些用户的客单价高于平均水平？
WITH user_avg AS (
    -- 步骤1：计算每个用户的平均订单金额
    SELECT
        user_id,
        avg(total_amount) as avg_amount
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
),
global_avg AS (
    -- 步骤2：计算全局平均客单价
    SELECT avg(avg_amount) as overall_avg
    FROM user_avg
)
SELECT
    u.user_id,
    u.avg_amount,
    g.overall_avg,
    u.avg_amount / g.overall_avg as ratio
FROM user_avg u
CROSS JOIN global_avg g
WHERE u.avg_amount > g.overall_avg
ORDER BY ratio DESC;
```

**好处**：
- 每个步骤职责单一
- 逐步推导，易于验证
- 可以复用中间结果

##### 3.3 CTE的递归使用

**作用**：CTE 可以引用自己，实现递归查询

**示例**：查询组织架构中的所有下属
```sql
WITH RECURSIVE subordinates AS (
    -- 初始：某个员工
    SELECT employee_id, name, manager_id
    FROM employees
    WHERE employee_id = 100

    UNION ALL

    -- 递归：查找下属
    SELECT e.employee_id, e.name, e.manager_id
    FROM employees e
    JOIN subordinates s ON e.manager_id = s.employee_id
)
SELECT * FROM subordinates;
```

**使用场景**：
- 层级结构查询（组织架构、分类树）
- 路径查找（图的最短路径）
- 日期序列生成

#### 四、复杂分析的常见模式

##### 4.1 漏斗分析

**场景**：浏览→加购→下单→支付的转化漏斗

```sql
-- 步骤1：每个环节的用户数
WITH funnel AS (
    SELECT
        count(DISTINCT user_id) as view_count,
        count(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN user_id END) as cart_count,
        count(DISTINCT CASE WHEN event_name = 'place_order' THEN user_id END) as order_count,
        count(DISTINCT CASE WHEN event_name = 'payment' THEN user_id END) as payment_count
    FROM events
    WHERE event_time >= '2026-04-01'
)
SELECT
    view_count,
    cart_count,
    cart_count::numeric / view_count as view_to_cart_rate,
    order_count,
    order_count::numeric / cart_count as cart_to_order_rate,
    payment_count,
    payment_count::numeric / order_count as order_to_payment_rate
FROM funnel;
```

##### 4.2 同群分析（Cohort Analysis）

**场景**：按注册月份分组，看不同月份用户的留存情况

```sql
WITH cohorts AS (
    -- 步骤1：标记用户的注册月份
    SELECT
        user_id,
        date_trunc('month', registered_at) as cohort_month
    FROM users
),
user_activities AS (
    -- 步骤2：计算每个用户的活跃月份
    SELECT DISTINCT
        user_id,
        date_trunc('month', event_time) as activity_month
    FROM events
),
cohort_retention AS (
    -- 步骤3：计算每个cohort在各月的留存
    SELECT
        c.cohort_month,
        u.activity_month,
        EXTRACT(month FROM age(u.activity_month, c.cohort_month)) as month_number,
        count(DISTINCT c.user_id) as user_count
    FROM cohorts c
    JOIN user_activities u ON c.user_id = u.user_id
    GROUP BY c.cohort_month, u.activity_month
)
SELECT
    cohort_month,
    month_number,
    user_count
FROM cohort_retention
ORDER BY cohort_month, month_number;
```

##### 4.3 留存分析

**场景**：计算用户的次日留存、7日留存、30日留存

```sql
WITH first_activity AS (
    -- 步骤1：每个用户的首次活跃日期
    SELECT
        user_id,
        min(date(event_time)) as first_date
    FROM events
    GROUP BY user_id
),
retention_days AS (
    -- 步骤2：计算每个用户的活跃日期与首次活跃的天数差
    SELECT
        fa.user_id,
        fa.first_date,
        e.event_date,
        EXTRACT(day FROM age(e.event_date, fa.first_date)) as days_since_first
    FROM first_activity fa
    JOIN (
        SELECT DISTINCT user_id, date(event_time) as event_date
        FROM events
    ) e ON fa.user_id = e.user_id
)
SELECT
    first_date,
    count(DISTINCT CASE WHEN days_since_first = 1 THEN user_id END) as day1_retention,
    count(DISTINCT CASE WHEN days_since_first = 7 THEN user_id END) as day7_retention,
    count(DISTINCT CASE WHEN days_since_first = 30 THEN user_id END) as day30_retention,
    count(DISTINCT user_id) as total_users
FROM retention_days
GROUP BY first_date
ORDER BY first_date;
```

#### 五、窗口函数 vs 复杂子查询

##### 5.1 用窗口函数简化逻辑

**场景**：计算每个订单的排名

**不用窗口函数**（复杂）：
```sql
WITH order_amounts AS (
    SELECT
        order_id,
        total_amount,
        (
            SELECT count(*)
            FROM orders o2
            WHERE o2.total_amount >= o1.total_amount
        ) as rank
    FROM orders o1
)
SELECT * FROM order_amounts;
```

**用窗口函数**（简洁）：
```sql
SELECT
    order_id,
    total_amount,
    rank() OVER (ORDER BY total_amount DESC) as rank
FROM orders;
```

##### 5.2 什么时候用窗口函数

**用窗口函数的场景**：
- 排名（ROW_NUMBER、RANK、DENSE_RANK）
- 计算移动平均
- 计算累计值
- 组内统计

**用 CTE 的场景**：
- 多步骤数据清洗
- 复杂的业务逻辑
- 中间结果需要复用

#### 六、复杂SQL的性能优化

##### 6.1 优化原则

**原则1：尽早过滤**
```sql
-- 不好：先JOIN再过滤
WITH all_data AS (
    SELECT o.*, u.*
    FROM orders o
    JOIN users u ON o.user_id = u.user_id
)
SELECT * FROM all_data WHERE o.created_at >= '2026-01-01';

-- 好：先过滤再JOIN
WITH filtered_orders AS (
    SELECT * FROM orders WHERE created_at >= '2026-01-01'
)
SELECT o.*, u.*
FROM filtered_orders o
JOIN users u ON o.user_id = u.user_id;
```

**原则2：避免重复计算**
```sql
-- 不好：重复计算相同的条件
WITH expensive_orders AS (
    SELECT * FROM orders WHERE total_amount > 1000
),
fast_orders AS (
    SELECT * FROM orders WHERE total_amount > 1000
)
SELECT * FROM expensive_orders
UNION ALL
SELECT * FROM fast_orders;

-- 好：复用CTE
WITH expensive_orders AS (
    SELECT * FROM orders WHERE total_amount > 1000
)
SELECT * FROM expensive_orders
UNION ALL
SELECT * FROM expensive_orders;
```

**原则3：使用物化视图缓存复杂计算**
```sql
-- 如果某个复杂CTE频繁使用，考虑物化视图
CREATE MATERIALIZED VIEW user_daily_stats AS
WITH daily_stats AS (
    SELECT
        user_id,
        date(created_at) as order_date,
        count(*) as order_count,
        sum(total_amount) as total_amount
    FROM orders
    GROUP BY user_id, date(created_at)
)
SELECT * FROM daily_stats;
```

#### 七、常见误区

**误区一：CTE 比子查询快**

- **说明**：CTE 和子查询在性能上没有本质区别，都是语法糖
- **后果**：以为用了 CTE 就会自动变快，实际上没有优化效果
- **正确理解**：
  - CTE 是为了可读性，不是为了性能
  - PostgreSQL 会优化 CTE，但不保证比子查询快
  - 用 EXPLAIN 分析实际执行计划

**误区二：复杂 SQL 越长越厉害**

- **说明**：SQL 的价值在于清晰表达业务逻辑，不是越长越好
- **后果**：写出难以理解的 SQL，别人看不懂，自己也看不懂
- **正确理解**：
  - 把复杂的 SQL 拆分成多个简单 SQL
  - 用 CTE 让每个步骤清晰
  - 可读性 > 简洁性

**误区三：JOIN 越多数据越准确**

- **说明**：JOIN 会改变粒度，可能导致数据膨胀或丢失
- **后果**：统计结果不准确
- **正确理解**：
  - 先明确业务问题需要哪些数据
  - 只 JOIN 必要的表
  - 先聚合再 JOIN 避免膨胀

**误区四：窗口函数和 CTE 互斥**

- **说明**：窗口函数和 CTE 可以配合使用，各有优势
- **后果**：只用一种方式，写出复杂的 SQL
- **正确理解**：
  - 组内排序、累计用窗口函数
  - 多步骤清洗用 CTE
  - 两者可以配合

**误区五：复杂 SQL 不需要注释**

- **说明**：复杂 SQL 逻辑多，更需要注释说明
- **后果**：别人看不懂，自己过一段时间也看不懂
- **正确理解**：
  - 每个 CTE 加注释说明用途
  - 复杂逻辑加注释说明
  - 业务背景加注释说明

#### 八、实战任务

**任务1：基础CTE练习**

用 CTE 重写以下查询：

原查询（嵌套子查询）：
```sql
SELECT user_id, avg_amount
FROM (
    SELECT user_id, avg(total_amount) as avg_amount
    FROM (
        SELECT user_id, total_amount
        FROM orders
        WHERE order_status = 'paid'
    ) o
    GROUP BY user_id
) t
WHERE avg_amount > 100;
```

**重写后（CTE）**：
```sql
WITH paid_orders AS (
    -- 步骤1：过滤已支付订单
    SELECT user_id, total_amount
    FROM orders
    WHERE order_status = 'paid'
),
user_avg AS (
    -- 步骤2：计算每个用户的平均订单金额
    SELECT user_id, avg(total_amount) as avg_amount
    FROM paid_orders
    GROUP BY user_id
)
SELECT * FROM user_avg WHERE avg_amount > 100;
```

**对比**：
- 哪种写法更清晰？
- 如何单独调试每个步骤？

**任务2：漏斗分析**

计算以下转化漏斗：
- 浏览商品（event_name = 'view_product'）
- 加购物车（event_name = 'add_to_cart'）
- 下单（event_name = 'place_order'）
- 支付（event_name = 'payment'）

**要求**：
```sql
WITH funnel_events AS (
    SELECT
        user_id,
        event_name,
        event_time
    FROM events
    WHERE event_time >= '2026-04-01'
),
funnel_counts AS (
    SELECT
        count(DISTINCT CASE WHEN event_name = 'view_product' THEN user_id END) as view_users,
        count(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN user_id END) as cart_users,
        count(DISTINCT CASE WHEN event_name = 'place_order' THEN user_id END) as order_users,
        count(DISTINCT CASE WHEN event_name = 'payment' THEN user_id END) as payment_users
    FROM funnel_events
)
SELECT
    view_users,
    cart_users,
    cart_users::numeric / view_users as view_to_cart_rate,
    order_users,
    order_users::numeric / cart_users as cart_to_order_rate,
    payment_users,
    payment_users::numeric / order_users as order_to_payment_rate
FROM funnel_counts;
```

**观察指标**：
- 每个环节的转化率
- 哪个环节流失最多？

**任务3：复购率计算**

计算每个用户的复购率：
- 复购率 = (订单数 - 购买天数) / 订单数
- 只计算下单超过1次的用户

**要求**：
```sql
WITH user_order_stats AS (
    SELECT
        user_id,
        count(*) as order_count,
        count(DISTINCT date(created_at)) as distinct_days
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
    HAVING count(*) > 1
)
SELECT
    user_id,
    order_count,
    distinct_days,
    (order_count - distinct_days)::numeric / order_count as repeat_rate
FROM user_order_stats
ORDER BY repeat_rate DESC;
```

**分析**：
- 复购率最高的用户特征是什么？
- 复购率分布如何？

#### 九、小结

基础查询、聚合分析、多表关联是 SQL 的基础。

复杂分析 SQL 是把这些能力组合起来，解决多步骤的业务问题。

核心要点：
- 用 CTE 把中间过程清晰表达
- 每个 CTE 完成一个明确的任务
- 复杂逻辑拆分成多个步骤
- 窗口函数和 CTE 配合使用
- 性能优化：尽早过滤、避免重复计算

下一节将进入窗口函数：在保留明细的同时做组内分析，这是高级分析的重要工具。
