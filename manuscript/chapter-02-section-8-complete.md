### 2.8 常见指标SQL实战

前面学习了SQL的各个能力：查询、聚合、关联、窗口函数、复杂分析。

也学习了指标的概念和体系。

现在要把这些能力综合起来，解决实际业务中的常见指标计算。

电商业务中有哪些最常用的指标？

```text
用户指标：
- DAU、MAU
- 新增用户数
- 用户留存率
- 用户流失率

订单指标：
- GMV
- 订单数
- 客单价
- 复购率

商品指标：
- 商品销量
- 商品销售额
- 库存周转率

运营指标：
- 转化率
- ROI（投资回报率）
- LTV（用户生命周期价值）
- CAC（用户获取成本）
```

这些指标如何用SQL实现？需要注意什么问题？

这就是本节要解决的问题。

#### 一、为什么需要实战练习

**第一，实际业务比示例复杂**

教程中的示例：
```sql
-- 简单的GMV计算
SELECT sum(total_amount) FROM orders WHERE order_status = 'paid';
```

实际业务中的GMV：
```sql
-- 复杂的GMV计算
SELECT
    sum(CASE WHEN o.order_status = 'paid'
        AND o.created_at >= '2026-04-01 00:00:00'
        AND o.created_at < '2026-04-02 00:00:00'
        AND o.is_test = false
        AND o.user_id NOT IN (SELECT user_id FROM blacklist_users)
        THEN o.total_amount
        ELSE 0 END) as gmv
FROM orders o
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE r.refund_id IS NULL  -- 排除退款订单
AND o.total_amount > 0;    -- 排除异常订单
```

**差异**：
- 时间边界精确到秒
- 排除测试订单
- 排除黑名单用户
- 排除退款订单
- 排除异常订单

**第二，同一个指标有多种实现方式**

**示例**：DAU的计算

**方式A**：简单统计
```sql
SELECT count(DISTINCT user_id) as dau
FROM events
WHERE date(event_time) = '2026-04-01';
```

**方式B**：只统计核心事件
```sql
SELECT count(DISTINCT user_id) as dau
FROM events
WHERE date(event_time) = '2026-04-01'
AND event_name IN ('login', 'view_product', 'add_to_cart', 'place_order');
```

**方式C**：排除测试用户
```sql
SELECT count(DISTINCT e.user_id) as dau
FROM events e
JOIN users u ON e.user_id = u.user_id
WHERE date(e.event_time) = '2026-04-01'
AND u.is_test = false;
```

**三种方式结果不同，哪个是正确的DAU？**

**第三，实际业务有数据质量问题**

**问题示例**：
- user_id 为 NULL 的记录
- event_time 异常（未来时间、1970年）
- 重复的事件记录
- 测试数据混入生产数据

**如何处理？**
```sql
SELECT count(DISTINCT user_id) as dau
FROM events
WHERE date(event_time) = '2026-04-01'
AND user_id IS NOT NULL           -- 排除NULL
AND event_time >= '2020-01-01'    -- 排除异常时间
AND event_time <= CURRENT_DATE    -- 排除未来时间
AND is_duplicate = false;         -- 排除重复记录
```

**结论**：
> 实战练习的价值在于：面对真实业务的复杂性、多实现方式的选择、数据质量问题，写出正确的SQL。

#### 二、核心判断：实战不是"能算出数"，而是"算出可信的数"

> 常见指标SQL实战的核心判断是：综合运用SQL的各项能力，处理实际业务中的边界情况、数据质量问题、多口径选择，计算出可信的业务指标。

这个判断说明：
- **能力综合**：不只一个SQL技巧，而是多项能力组合
- **问题处理**：边界情况、数据质量、口径选择
- **结果可信**：不只是能算出数，而是数字可信
- **业务价值**：支持业务决策

#### 三、用户类指标实战

##### 3.1 DAU（日活跃用户数）

**定义**：每天至少发生一次行为的去重用户数

**实现**：
```sql
SELECT
    date(event_time) as activity_date,
    count(DISTINCT user_id) as dau
FROM events
WHERE user_id IS NOT NULL
AND event_time >= '2026-04-01'
AND event_time < '2026-05-01'
AND is_test = false
GROUP BY date(event_time)
ORDER BY activity_date;
```

**注意事项**：
- 去重：DISTINCT user_id
- 排除测试用户：is_test = false
- 排除NULL：user_id IS NOT NULL
- 时间范围精确：用 < 而不是 <=

**优化**：如果数据量大，考虑只统计核心事件
```sql
SELECT
    date(event_time) as activity_date,
    count(DISTINCT user_id) as dau
FROM events
WHERE date(event_time) = '2026-04-01'
AND event_name IN (
    'login',
    'view_product',
    'add_to_cart',
    'place_order',
    'payment'
)
AND user_id IS NOT NULL
AND is_test = false
GROUP BY date(event_time);
```

##### 3.2 新增用户数

**定义**：每天新注册的用户数

**实现**：
```sql
SELECT
    date(registered_at) as register_date,
    count(*) as new_users
FROM users
WHERE registered_at >= '2026-04-01'
AND registered_at < '2026-05-01'
AND is_test = false
GROUP BY date(registered_at)
ORDER BY register_date;
```

**注意事项**：
- 新增的定义：是注册时间？还是首次活跃时间？
- 如果按首次活跃时间：
```sql
WITH user_first_active AS (
    SELECT
        user_id,
        min(date(event_time)) as first_active_date
    FROM events
    WHERE is_test = false
    GROUP BY user_id
)
SELECT
    first_active_date,
    count(*) as new_users
FROM user_first_active
WHERE first_active_date >= '2026-04-01'
AND first_active_date < '2026-05-01'
GROUP BY first_active_date
ORDER BY first_active_date;
```

##### 3.3 用户留存率

**定义**：某日活跃的用户在N日后仍活跃的比例

**次日留存率**：
```sql
WITH day1_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE date(event_time) = '2026-04-01'
    AND is_test = false
),
day2_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE date(event_time) = '2026-04-02'
    AND is_test = false
)
SELECT
    count(*) as day1_total,
    count(d2.user_id) as day2_retained,
    count(d2.user_id)::numeric / count(*) as day1_retention_rate
FROM day1_users d1
LEFT JOIN day2_users d2 ON d1.user_id = d2.user_id;
```

**7日留存率**：
```sql
WITH cohort_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE date(event_time) = '2026-04-01'
    AND is_test = false
),
retention_7d AS (
    SELECT
        c.user_id,
        count(DISTINCT CASE
            WHEN date(e.event_time) BETWEEN '2026-04-02' AND '2026-04-08'
            THEN e.event_time
        END) as active_days
    FROM cohort_users c
    LEFT JOIN events e ON c.user_id = e.user_id
        AND date(e.event_time) BETWEEN '2026-04-02' AND '2026-04-08'
        AND e.is_test = false
    GROUP BY c.user_id
)
SELECT
    count(*) as cohort_total,
    count(CASE WHEN active_days > 0 THEN 1 END) as retained_users,
    count(CASE WHEN active_days > 0 THEN 1 END)::numeric / count(*) as retention_7d_rate
FROM retention_7d;
```

#### 四、订单类指标实战

##### 4.1 GMV（成交总额）

**定义**：已支付订单的金额总和

**基础实现**：
```sql
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
AND paid_at >= '2026-04-01'
AND paid_at < '2026-05-01'
AND is_test = false
GROUP BY date(paid_at)
ORDER BY order_date;
```

**复杂实现**：排除退款订单
```sql
SELECT
    date(o.paid_at) as order_date,
    sum(o.total_amount) as gmv
FROM orders o
LEFT JOIN refunds r ON o.order_id = r.order_id
WHERE o.order_status = 'paid'
AND o.paid_at >= '2026-04-01'
AND o.paid_at < '2026-05-01'
AND o.is_test = false
AND r.refund_id IS NULL  -- 排除退款订单
GROUP BY date(o.paid_at)
ORDER BY order_date;
```

**更复杂**：净GMV（GMV - 退款金额）
```sql
WITH order_gmv AS (
    SELECT
        date(paid_at) as order_date,
        sum(total_amount) as gross_gmv
    FROM orders
    WHERE order_status = 'paid'
    AND is_test = false
    GROUP BY date(paid_at)
),
refund_amount AS (
    SELECT
        date(r.refunded_at) as refund_date,
        sum(r.refund_amount) as total_refund
    FROM refunds r
    WHERE r.refund_status = 'success'
    AND r.is_test = false
    GROUP BY date(r.refunded_at)
)
SELECT
    COALESCE(o.order_date, r.refund_date) as date,
    COALESCE(o.gross_gmv, 0) as gross_gmv,
    COALESCE(r.total_refund, 0) as refund_amount,
    COALESCE(o.gross_gmv, 0) - COALESCE(r.total_refund, 0) as net_gmv
FROM order_gmv o
FULL OUTER JOIN refund_amount r ON o.order_date = r.refund_date
ORDER BY date;
```

##### 4.2 客单价（AOV，Average Order Value）

**定义**：平均每笔订单的金额

**实现**：
```sql
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    sum(total_amount) / count(*) as aov
FROM orders
WHERE order_status = 'paid'
AND paid_at >= '2026-04-01'
AND paid_at < '2026-05-01'
AND is_test = false
GROUP BY date(paid_at)
ORDER BY order_date;
```

**客单价的其他口径**：
- 按用户：每个用户的平均消费金额
- 按类目：每个类目的平均订单金额

**按用户的客单价**：
```sql
SELECT
    user_id,
    sum(total_amount) as total_amount,
    count(*) as order_count,
    sum(total_amount) / count(*) as aov_per_user
FROM orders
WHERE order_status = 'paid'
AND paid_at >= '2026-04-01'
AND paid_at < '2026-05-01'
AND is_test = false
GROUP BY user_id
ORDER BY total_amount DESC
LIMIT 10;
```

##### 4.3 复购率

**定义**：有多次购买行为的用户占比

**实现**：
```sql
WITH user_order_count AS (
    SELECT
        user_id,
        count(*) as order_count
    FROM orders
    WHERE order_status = 'paid'
    AND is_test = false
    GROUP BY user_id
)
SELECT
    count(*) as total_users,
    count(CASE WHEN order_count >= 2 THEN 1 END) as repeat_users,
    count(CASE WHEN order_count >= 2 THEN 1 END)::numeric / count(*) as repeat_rate
FROM user_order_count;
```

**复购率的细分**：
- 按时间：新用户复购率 vs 老用户复购率
- 按渠道：不同渠道的复购率
- 按类目：不同类目的复购率

**新用户复购率**（注册后30天内复购）：
```sql
WITH new_users AS (
    SELECT
        user_id,
        date(registered_at) as register_date
    FROM users
    WHERE is_test = false
    AND date(registered_at) >= '2026-03-01'
    AND date(registered_at) < '2026-04-01'
),
user_orders AS (
    SELECT
        u.user_id,
        count(*) as order_count
    FROM new_users u
    JOIN orders o ON u.user_id = o.user_id
        AND o.order_status = 'paid'
        AND o.is_test = false
        AND o.paid_at >= u.register_date
        AND o.paid_at < u.register_date + INTERVAL '30 days'
    GROUP BY u.user_id
)
SELECT
    count(*) as total_new_users,
    count(CASE WHEN order_count >= 2 THEN 1 END) as repeat_users,
    count(CASE WHEN order_count >= 2 THEN 1 END)::numeric / count(*) as repeat_rate_new_users
FROM user_orders;
```

#### 五、商品类指标实战

##### 5.1 商品销量排行

**定义**：按商品销量排序

**实现**：
```sql
SELECT
    p.product_id,
    p.name,
    sum(oi.quantity) as total_quantity,
    rank() OVER (ORDER BY sum(oi.quantity) DESC) as sales_rank
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_status = 'paid'
AND o.is_test = false
AND date(o.paid_at) >= '2026-04-01'
AND date(o.paid_at) < '2026-05-01'
GROUP BY p.product_id, p.name
ORDER BY total_quantity DESC
LIMIT 10;
```

**注意事项**：
- 聚合后再排序
- JOIN 确保只统计已支付订单
- 排除测试数据

##### 5.2 类目销售额占比

**定义**：每个类目的销售额占总销售额的比例

**实现**：
```sql
WITH category_sales AS (
    SELECT
        p.category_id,
        c.name as category_name,
        sum(oi.item_amount) as category_sales
    FROM order_items oi
    JOIN products p ON oi.product_id = p.product_id
    JOIN categories c ON p.category_id = c.category_id
    JOIN orders o ON oi.order_id = o.order_id
    WHERE o.order_status = 'paid'
    AND o.is_test = false
    AND date(o.paid_at) >= '2026-04-01'
    AND date(o.paid_at) < '2026-05-01'
    GROUP BY p.category_id, c.name
),
total_sales AS (
    SELECT sum(category_sales) as total
    FROM category_sales
)
SELECT
    c.category_id,
    c.category_name,
    c.category_sales,
    t.total,
    c.category_sales::numeric / t.total as sales_percentage
FROM category_sales c
CROSS JOIN total_sales t
ORDER BY c.category_sales DESC;
```

#### 六、运营类指标实战

##### 6.1 转化漏斗

**定义**：从浏览到支付的各环节转化率

**实现**：
```sql
WITH funnel_events AS (
    SELECT
        user_id,
        event_name,
        event_time
    FROM events
    WHERE date(event_time) = '2026-04-01'
    AND is_test = false
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
    cart_users::numeric / NULLIF(view_users, 0) as view_to_cart_rate,
    order_users,
    order_users::numeric / NULLIF(cart_users, 0) as cart_to_order_rate,
    payment_users,
    payment_users::numeric / NULLIF(order_users, 0) as order_to_payment_rate,
    payment_users::numeric / NULLIF(view_users, 0) as view_to_payment_rate
FROM funnel_counts;
```

**注意事项**：
- NULLIF 防止除零错误
- 每个环节的转化率要单独计算
- 整体转化率 = 各环节转化率的乘积

##### 6.2 ROI（投资回报率）

**定义**：(收入 - 成本) / 成本

**实现**：
```sql
WITH revenue AS (
    SELECT
        campaign_id,
        sum(o.total_amount) as total_revenue
    FROM orders o
    JOIN order_attributions oa ON o.order_id = oa.order_id
    WHERE o.order_status = 'paid'
    AND o.is_test = false
    AND date(o.paid_at) >= '2026-04-01'
    AND date(o.paid_at) < '2026-05-01'
    GROUP BY campaign_id
),
cost AS (
    SELECT
        campaign_id,
        sum(spend) as total_cost
    FROM campaign_spend
    WHERE date(spend_date) >= '2026-04-01'
    AND date(spend_date) < '2026-05-01'
    GROUP BY campaign_id
)
SELECT
    COALESCE(r.campaign_id, c.campaign_id) as campaign_id,
    COALESCE(r.total_revenue, 0) as revenue,
    COALESCE(c.total_cost, 0) as cost,
    (COALESCE(r.total_revenue, 0) - COALESCE(c.total_cost, 0))::numeric /
        NULLIF(COALESCE(c.total_cost, 0), 0) as roi
FROM revenue r
FULL OUTER JOIN cost c ON r.campaign_id = c.campaign_id
ORDER BY roi DESC;
```

#### 七、常见数据质量问题处理

##### 7.1 排除测试数据

```sql
-- 在 WHERE 子句中排除
WHERE is_test = false

-- 或者在 JOIN 中排除
JOIN users u ON e.user_id = u.user_id AND u.is_test = false
```

##### 7.2 处理NULL值

```sql
-- 统计时排除
WHERE user_id IS NOT NULL

-- 计算时替换
COALESCE(total_amount, 0)

-- 排序时处理
ORDER BY COALESCE(total_amount, 0) DESC
```

##### 7.3 处理异常时间

```sql
-- 排除未来的时间
WHERE event_time <= CURRENT_TIMESTAMP

-- 排除太早的时间
WHERE event_time >= '2020-01-01'

-- 排除明显错误的时间
WHERE event_time BETWEEN '2020-01-01' AND CURRENT_TIMESTAMP
```

##### 7.4 处理重复数据

```sql
-- 使用 DISTINCT
SELECT DISTINCT user_id, event_name FROM events...

-- 使用 GROUP BY
SELECT user_id, event_name, count(*) FROM events... GROUP BY user_id, event_name

-- 使用 ROW_NUMBER 去重
WITH ranked_events AS (
    SELECT
        *,
        row_number() OVER (PARTITION BY user_id, event_name, event_time ORDER BY created_at) as rn
    FROM events
)
SELECT * FROM ranked_events WHERE rn = 1;
```

#### 八、常见误区

**误区一：指标SQL越复杂越准确**

- **说明**：复杂度不是准确性的保证，反而可能引入错误
- **后果**：SQL难以维护，性能差
- **正确理解**：
  - 从简单开始，逐步复杂化
  - 每个复杂步骤都要有明确理由
  - 定期review是否有过度复杂的逻辑

**误区二：不考虑数据质量**

- **说明**：实际数据总有各种问题，必须处理
- **后果**：指标不准确，误导业务决策
- **正确理解**：
  - 排除NULL、异常值
  - 排除测试数据
  - 处理重复数据
  - 验证数据合理性

**误区三：不验证结果**

- **说明**：SQL能运行不代表结果正确，必须验证
- **后果**：错误的指标被使用，造成错误决策
- **正确理解**：
  - 与业务报表对比
  - 与历史数据对比
  - 用不同方法验证
  - 异常值要调查

**误区四：不考虑性能**

- **说明**：指标SQL会频繁运行，性能很重要
- **后果**：查询慢，系统负载高
- **正确理解**：
  - 尽早过滤数据
  - 创建必要的索引
  - 使用物化视图
  - 定期EXPLAIN分析

**误区五：不考虑可维护性**

- **说明**：指标SQL会长期使用，需要可维护
- **后果**：修改困难，问题难定位
- **正确理解**：
  - 代码格式化
  - 添加注释
  - 版本管理
  - 文档化

#### 九、实战任务

**任务1：DAU计算**

计算2026年4月的每日DAU：

```sql
SELECT
    date(event_time) as activity_date,
    count(DISTINCT CASE WHEN user_id IS NOT NULL THEN user_id END) as dau
FROM events
WHERE event_time >= '2026-04-01'
AND event_time < '2026-05-01'
AND is_test = false
GROUP BY date(event_time)
ORDER BY activity_date;
```

**验证**：
- DAU是否合理？（与用户规模对比）
- 是否有明显异常值？
- 周末 vs 工作日是否符合预期？

**任务2：转化漏斗**

计算4月1日的购物转化漏斗：

```sql
WITH funnel_events AS (
    SELECT
        user_id,
        event_name,
        event_time
    FROM events
    WHERE date(event_time) = '2026-04-01'
    AND is_test = false
    AND event_name IN ('view_product', 'add_to_cart', 'place_order', 'payment')
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
    view_users as 浏览用户数,
    cart_users as 加购用户数,
    cart_users::numeric / NULLIF(view_users, 0) as 浏览到加购转化率,
    order_users as 下单用户数,
    order_users::numeric / NULLIF(cart_users, 0) as 加购到下单转化率,
    payment_users as 支付用户数,
    payment_users::numeric / NULLIF(order_users, 0) as 下单到支付转化率,
    payment_users::numeric / NULLIF(view_users, 0) as 整体转化率
FROM funnel_counts;
```

**分析**：
- 哪个环节流失最多？
- 如何提升整体转化率？

**任务3：同期群分析（Cohort Analysis）**

分析2026年4月注册用户的留存情况：

```sql
WITH cohort_users AS (
    SELECT
        user_id,
        date(registered_at) as cohort_date
    FROM users
    WHERE is_test = false
    AND date(registered_at) >= '2026-04-01'
    AND date(registered_at) < '2026-05-01'
),
user_activities AS (
    SELECT DISTINCT
        c.user_id,
        c.cohort_date,
        date(e.event_time) as activity_date,
        EXTRACT(day FROM age(date(e.event_time), c.cohort_date)) as day_number
    FROM cohort_users c
    JOIN events e ON c.user_id = e.user_id
        AND e.event_time >= c.cohort_date
        AND e.is_test = false
        AND date(e.event_time) < c.cohort_date + INTERVAL '30 days'
),
cohort_retention AS (
    SELECT
        cohort_date,
        day_number,
        count(DISTINCT user_id) as retained_users
    FROM user_activities
    GROUP BY cohort_date, day_number
)
SELECT
    cohort_date as 注册日期,
    day_number as 注册后第几天,
    retained_users as 留存用户数
FROM cohort_retention
ORDER BY cohort_date, day_number;
```

**观察**：
- 次日留存率（day_number = 1）
- 7日留存率（day_number = 7）
- 30日留存率（day_number = 30）

#### 十、小结

常见指标SQL实战是将SQL能力应用于实际业务。

核心要点：
- 用户类：DAU、新增、留存、流失
- 订单类：GMV、订单数、客单价、复购率
- 商品类：销量、销售额、类目占比
- 运营类：转化漏斗、ROI、LTV、CAC
- 处理数据质量问题：测试数据、NULL、异常时间、重复数据
- 验证结果：对比、验证、异常分析

下一节将进入SQL性能基础：写出正确的SQL还不够，还要写出高效的SQL。
