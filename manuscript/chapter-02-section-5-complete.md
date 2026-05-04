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

如果用一个SQL写完，会很复杂且难以理解。如果把步骤拆开，又难以在一个SQL中完成。

如何既保持可读性，又在一个查询中完成多步骤分析？这就是CTE要解决的问题。

#### 一、嵌套子查询的困境

业务分析很少能一步完成。每个用户的平均客单价需要先计算总金额除以订单数，哪个类目的复购率最高需要先计算复购用户数除以总用户数，每天的活跃用户留存率需要先计算今天活跃的用户中明天还活跃的比例。

如果用嵌套子查询写，可读性会很差：

```sql
-- 可读性差
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

嵌套层次深，别名多，调试困难——你不知道哪一步出错了。

#### 二、CTE的基本用法

CTE（Common Table Expression）定义临时的命名结果集，可在后续查询中引用。用CTE重写复购率查询：

```sql
WITH user_orders AS (
    SELECT
        user_id,
        count(*) as order_count,
        count(DISTINCT date(created_at)) as distinct_days
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
)
SELECT
    user_id, order_count, distinct_days,
    (order_count - distinct_days)::numeric / order_count as repeat_rate
FROM user_orders
WHERE order_count > 1
ORDER BY repeat_rate DESC;
```

每个步骤清晰命名，逻辑分层，易于理解。可以单独运行每个CTE来调试。

多个CTE串联：

```sql
WITH user_avg AS (
    SELECT user_id, avg(total_amount) as avg_amount
    FROM orders WHERE order_status = 'paid'
    GROUP BY user_id
),
global_avg AS (
    SELECT avg(avg_amount) as overall_avg
    FROM user_avg
)
SELECT
    u.user_id, u.avg_amount, g.overall_avg,
    u.avg_amount / g.overall_avg as ratio
FROM user_avg u
CROSS JOIN global_avg g
WHERE u.avg_amount > g.overall_avg
ORDER BY ratio DESC;
```

CTE还可以递归使用，适合层级结构查询：

```sql
WITH RECURSIVE subordinates AS (
    SELECT employee_id, name, manager_id
    FROM employees
    WHERE employee_id = 100

    UNION ALL

    SELECT e.employee_id, e.name, e.manager_id
    FROM employees e
    JOIN subordinates s ON e.manager_id = s.employee_id
)
SELECT * FROM subordinates;
```

#### 三、常见分析模式

**漏斗分析**（浏览→加购→下单→支付）：
```sql
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
    view_count, cart_count,
    cart_count::numeric / view_count as view_to_cart_rate,
    order_count,
    order_count::numeric / cart_count as cart_to_order_rate,
    payment_count,
    payment_count::numeric / order_count as order_to_payment_rate
FROM funnel;
```

**同群分析**（按注册月份分组看留存）：
```sql
WITH cohorts AS (
    SELECT user_id, date_trunc('month', registered_at) as cohort_month
    FROM users
),
user_activities AS (
    SELECT DISTINCT user_id, date_trunc('month', event_time) as activity_month
    FROM events
),
cohort_retention AS (
    SELECT
        c.cohort_month, u.activity_month,
        EXTRACT(month FROM age(u.activity_month, c.cohort_month)) as month_number,
        count(DISTINCT c.user_id) as user_count
    FROM cohorts c
    JOIN user_activities u ON c.user_id = u.user_id
    GROUP BY c.cohort_month, u.activity_month
)
SELECT cohort_month, month_number, user_count
FROM cohort_retention
ORDER BY cohort_month, month_number;
```

#### 四、CTE vs 窗口函数

窗口函数适合排名、累计、移动平均；CTE适合多步骤清洗和中间结果复用。两者可以配合使用。例如先用CTE做数据清洗，再在清洗结果上用窗口函数计算排名。

#### 五、性能优化的原则

尽早过滤：先过滤再JOIN，减少后续所有步骤的数据量。避免在多个CTE中重复计算相同的条件——先定义一个CTE，后续CTE引用它。

如果一个复杂CTE频繁使用，考虑用物化视图缓存：

```sql
CREATE MATERIALIZED VIEW user_daily_stats AS
SELECT
    user_id, date(created_at) as order_date,
    count(*) as order_count, sum(total_amount) as total_amount
FROM orders
GROUP BY user_id, date(created_at);
```

#### 六、常见误区

**以为CTE比子查询快**。CTE和子查询在PostgreSQL中的性能没有本质区别，都是语法糖。CTE是为了可读性，不是为了性能。用EXPLAIN分析实际执行计划来判断。

**复杂SQL越长越厉害**。SQL的价值在于清晰表达业务逻辑。把复杂的SQL拆分成多个CTE，每个CTE完成一个明确任务。可读性优先于简洁性。

**窗口函数和CTE互斥**。它们是互补工具。组内排序和累计用窗口函数，多步骤清洗用CTE。两者经常配合使用。

#### 七、小结

基础查询、聚合分析、多表关联是SQL的基础。复杂分析SQL是把这些能力组合起来，解决多步骤的业务问题。

核心要点：
- 用CTE把中间过程清晰表达
- 每个CTE完成一个明确的任务
- 复杂逻辑拆分成多个步骤
- 窗口函数和CTE配合使用
- 物化视图缓存频繁使用的CTE

下一节将进入窗口函数：在保留明细的同时做组内分析。
