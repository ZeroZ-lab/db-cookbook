### 2.6 窗口函数：在保留明细的同时做组内分析

聚合分析会压缩明细，计算统计指标。

但有些分析需要既保留明细，又在组内做计算：

```text
问题示例：
- 每个用户的订单金额排名
- 每个商品在各月的销量排名
- 每个用户的累计消费金额
- 每天的订单金额与7天移动平均
- 每个用户的下一个订单时间
```

如果用 GROUP BY 聚合：
- 会丢失明细，看不到每笔订单的具体情况

如果不用 GROUP BY：
- 无法按用户分组计算排名、累计等

如何既保留明细，又在组内（如按用户分组）做分析？

这就是窗口函数（Window Functions）要解决的问题。

#### 一、为什么需要窗口函数

**第一，聚合会丢失明细**

**场景**：计算每个用户的订单金额排名

**用 GROUP BY**（聚合）：
```sql
-- 问题：只能看到每个用户的总金额，看不到每笔订单
SELECT user_id, sum(total_amount) as total_amount
FROM orders
GROUP BY user_id;
```

**问题**：
- 无法看到每笔订单的金额
- 无法计算每笔订单在用户内的排名
- 无法计算每笔订单占用户总消费的比例

**第二，自关联复杂且低效**

**不用窗口函数**（自关联）：
```sql
-- 问题：计算每个用户的订单排名，需要复杂自关联
SELECT
    o1.order_id,
    o1.user_id,
    o1.total_amount,
    (
        SELECT count(*)
        FROM orders o2
        WHERE o2.user_id = o1.user_id
        AND o2.total_amount >= o1.total_amount
    ) as rank
FROM orders o1;
```

**问题**：
- 自关联复杂，难以理解
- 性能差（每个订单都扫描一次用户的所有订单）
- 不易扩展（如计算累计值更复杂）

**第三，组内分析是常见需求**

**常见场景**：
```sql
-- 排名：每个用户的订单金额排名
-- 累计：每个用户的累计消费金额
-- 移动平均：每天的7天平均GMV
-- 前后值：每个用户的上一次下单时间
-- 组内统计：每个类目的平均商品价格
```

这些都是"在组内计算，但保留明细"的场景。

**结论**：
> 窗口函数的核心价值是：在不压缩明细的情况下，按分组（窗口）做计算，实现组内排名、累计、移动平均等分析。

#### 二、核心判断：窗口函数回答"如何在保留明细的同时做组内分析"

> 窗口函数的核心判断是：通过 OVER 子句定义窗口（分组），在保留所有明细记录的同时，在窗口内进行排名、累计、移动平均等计算。

这个判断说明：
- **输入**：明细记录
- **窗口**：按 OVER 子句定义的分组
- **计算**：在窗口内做聚合、排名、偏移等计算
- **输出**：保留所有明细，增加计算结果列
- **目的**：实现组内分析，同时保留明细

#### 三、窗口函数的基本语法

##### 3.1 语法结构

```sql
<窗口函数>(<字段>) OVER (
    PARTITION BY <分组字段>
    ORDER BY <排序字段>
    [ROWS/RANGE BETWEEN <开始> AND <结束>]
)
```

**关键部分**：
- **窗口函数**：要计算的函数（如 ROW_NUMBER、SUM、AVG）
- **PARTITION BY**：如何分组（类似 GROUP BY）
- **ORDER BY**：如何在组内排序
- **ROWS/RANGE**：窗口的边界（可选）

##### 3.2 简单示例

**示例1：计算每个用户的订单金额排名**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as order_rank
FROM orders;
```

**结果**：
```
order_id | user_id | total_amount | order_rank
---------|---------|--------------|------------
1        | 1       | 500          | 1
2        | 1       | 300          | 2
3        | 1       | 200          | 3
4        | 2       | 1000         | 1
5        | 2       | 800          | 2
```

**说明**：
- 保留了所有订单明细
- 每个用户内部按金额排名
- 不同用户的排名独立计算

#### 四、常用窗口函数

##### 4.1 排名函数

**ROW_NUMBER：连续排名**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    row_number() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as rn
FROM orders;
```

**特点**：
- 排名连续（1, 2, 3, ...）
- 遇到相同值，按顺序继续排
- 适合：取 Top N（如每个用户的前3笔订单）

**RANK：跳跃排名**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as rnk
FROM orders;
```

**特点**：
- 相同值排名相同
- 下一个排名跳跃（1, 2, 2, 4, ...）
- 适合：竞赛排名（并列第1，下个是第3）

**DENSE_RANK：密集排名**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    dense_rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as dense_rnk
FROM orders;
```

**特点**：
- 相同值排名相同
- 下一个排名连续（1, 2, 2, 3, ...）
- 适合：不想跳跃的排名

**对比示例**：
```
金额    | ROW_NUMBER | RANK | DENSE_RANK
--------|------------|------|------------
1000    | 1          | 1    | 1
800     | 2          | 2    | 2
800     | 3          | 2    | 2
500     | 4          | 4    | 3
```

##### 4.2 聚合函数作为窗口函数

**SUM：累计求和**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    sum(total_amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as cumulative_amount
FROM orders;
```

**结果**：
```
order_id | user_id | total_amount | cumulative_amount
---------|---------|--------------|-------------------
1        | 1       | 200          | 200
2        | 1       | 300          | 500  (200+300)
3        | 1       | 500          | 1000 (200+300+500)
```

**AVG：移动平均**
```sql
SELECT
    date(created_at) as order_date,
    sum(total_amount) as daily_gmv,
    avg(sum(total_amount)) OVER (
        ORDER BY date(created_at)
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as ma7_gmv
FROM orders
GROUP BY date(created_at);
```

**说明**：
- 计算3天移动平均（当天+前2天）
- ROWS BETWEEN 2 PRECEDING AND CURRENT ROW 定义窗口边界

##### 4.3 偏移函数

**LAG：取前一个值**
```sql
SELECT
    order_id,
    user_id,
    created_at,
    lag(created_at, 1) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as prev_order_time,
    created_at - lag(created_at, 1) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as days_since_prev
FROM orders;
```

**作用**：
- 计算每个用户距离上次下单的天数
- LAG(field, n) 取前第 n 个值

**LEAD：取后一个值**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    lead(total_amount, 1) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as next_amount
FROM orders;
```

**作用**：
- 查看每个用户的下一笔订单金额
- LEAD(field, n) 取后第 n 个值

##### 4.4 取值函数

**FIRST_VALUE：取第一个值**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    first_value(total_amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as first_amount
FROM orders;
```

**LAST_VALUE：取最后一个值**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    last_value(total_amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
    ) as last_amount
FROM orders;
```

**NTH_VALUE：取第N个值**
```sql
SELECT
    order_id,
    user_id,
    total_amount,
    nth_value(total_amount, 2) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as second_amount
FROM orders;
```

#### 五、窗口边界（ROWS vs RANGE）

##### 5.1 ROWS：物理行边界

**作用**：按物理行数定义窗口

**示例**：3天移动平均
```sql
SELECT
    order_date,
    daily_gmv,
    avg(daily_gmv) OVER (
        ORDER BY order_date
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as ma3_gmv
FROM daily_sales;
```

**说明**：
- 窗口包括：当前行 + 前2行（共3行）
- ROWS 是物理边界

##### 5.2 RANGE：逻辑值边界

**作用**：按值范围定义窗口

**示例**：金额±100范围内的平均
```sql
SELECT
    order_id,
    total_amount,
    avg(total_amount) OVER (
        ORDER BY total_amount
        RANGE BETWEEN 100 PRECEDING AND 100 FOLLOWING
    ) as nearby_avg
FROM orders;
```

**说明**：
- 窗口包括：金额在 [total_amount-100, total_amount+100] 范围内的订单
- RANGE 是逻辑边界

#### 六、常见应用场景

##### 6.1 Top N查询

**场景**：每个用户的前3笔订单

```sql
WITH user_order_rank AS (
    SELECT
        order_id,
        user_id,
        total_amount,
        row_number() OVER (
            PARTITION BY user_id
            ORDER BY total_amount DESC
        ) as rn
    FROM orders
)
SELECT * FROM user_order_rank WHERE rn <= 3;
```

##### 6.2 留存分析

**场景**：计算用户的连续登录天数

```sql
WITH user_login_dates AS (
    SELECT DISTINCT
        user_id,
        date(event_time) as login_date
    FROM events
    WHERE event_name = 'login'
),
login_rank AS (
    SELECT
        user_id,
        login_date,
        date_trunc('day', login_date) - row_number() OVER (
            PARTITION BY user_id
            ORDER BY login_date
        ) * interval '1 day' as date_group
    FROM user_login_dates
),
continuous_days AS (
    SELECT
        user_id,
        date_group,
        count(*) as continuous_days
    FROM login_rank
    GROUP BY user_id, date_group
)
SELECT
    user_id,
    max(continuous_days) as max_continuous_days
FROM continuous_days
GROUP BY user_id;
```

##### 6.3 订单间隔分析

**场景**：计算每个用户两次订单的平均间隔天数

```sql
WITH order_intervals AS (
    SELECT
        user_id,
        created_at,
        lag(created_at, 1) OVER (
            PARTITION BY user_id
            ORDER BY created_at
        ) as prev_order_time,
        EXTRACT(day FROM age(created_at, lag(created_at, 1) OVER (
            PARTITION BY user_id
            ORDER BY created_at
        ))) as days_since_prev
    FROM orders
)
SELECT
    user_id,
    avg(days_since_prev) as avg_interval_days
FROM order_intervals
WHERE days_since_prev IS NOT NULL
GROUP BY user_id;
```

#### 七、窗口函数 vs GROUP BY

| 维度 | GROUP BY | 窗口函数 |
|------|----------|----------|
| 明细 | 压缩明细，每組返回一行 | 保留所有明细 |
| 计算粒度 | 组级别统计 | 组内每行都计算 |
| 排名 | 无法直接排名 | 可以排名 |
| 累计 | 无法累计 | 可以累计 |
| 性能 | 相对快 | 稍慢（需要排序） |

**使用建议**：
- 需要统计指标（总和、平均）→ GROUP BY
- 需要保留明细 → 窗口函数
- 需要 Top N → 窗口函数 + WHERE
- 需要累计、排名、移动平均 → 窗口函数

#### 八、常见误区

**误区一：窗口函数可以替代 GROUP BY**

- **说明**：窗口函数和 GROUP BY 解决不同问题，不能互相替代
- **后果**：错误使用导致性能差或逻辑错误
- **正确理解**：
  - 需要压缩明细 → GROUP BY
  - 需要保留明细 → 窗口函数
  - 两者可以配合使用

**误区二：窗口函数总是慢**

- **说明**：窗口函数需要排序，但合理使用性能可接受
- **后果**：避免使用窗口函数，写出复杂的自关联 SQL
- **正确理解**：
  - 窗口函数比自关联高效
  - 确保窗口字段有索引
  - 用 EXPLAIN 分析性能

**误区三：所有聚合函数都能做窗口函数**

- **说明**：大部分聚合函数可以做窗口函数，但有些不行
- **后果**：误用导致语法错误
- **正确理解**：
  - SUM、AVG、COUNT、MIN、MAX 可以
  - ARRAY_AGG、STRING_AGG 可以
  - GROUP_CONCAT（MySQL）可以
  - 但要考虑性能

**误区四：PARTITION BY 和 GROUP BY 一样**

- **说明**：PARTITION BY 定义分组，但不压缩明细；GROUP BY 会压缩明细
- **后果**：混淆导致逻辑错误
- **正确理解**：
  - PARTITION BY：窗口函数的分组，保留明细
  - GROUP BY：聚合的分组，压缩明细
  - 目的不同，不能混淆

**误区五：窗口边界不重要**

- **说明**：ROWS/RANGE 定义窗口边界，影响计算结果
- **后果**：不定义窗口边界导致结果不符合预期
- **正确理解**：
  - 累计求和：ORDER BY created_at（默认从第一行到当前行）
  - 移动平均：ROWS BETWEEN N PRECEDING AND CURRENT ROW
  - 全窗口：ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING

#### 九、实战任务

**任务1：基础窗口函数练习**

完成以下分析：

1. 每个用户的订单金额排名：
```sql
SELECT
    user_id,
    order_id,
    total_amount,
    rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as amount_rank
FROM orders;
```

2. 每个用户的累计消费金额：
```sql
SELECT
    user_id,
    order_id,
    total_amount,
    sum(total_amount) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as cumulative_amount
FROM orders;
```

3. 每个用户的下单间隔天数：
```sql
SELECT
    user_id,
    order_id,
    created_at,
    created_at - lag(created_at, 1) OVER (
        PARTITION BY user_id
        ORDER BY created_at
    ) as days_since_prev
FROM orders;
```

**任务2：Top N分析**

找出每个用户的前3笔订单：

```sql
WITH user_orders AS (
    SELECT
        user_id,
        order_id,
        total_amount,
        row_number() OVER (
            PARTITION BY user_id
            ORDER BY total_amount DESC
        ) as rn
    FROM orders
)
SELECT
    user_id,
    order_id,
    total_amount
FROM user_orders
WHERE rn <= 3
ORDER BY user_id, rn;
```

**观察指标**：
- 每个用户的大额订单特征
- 前3笔订单占比

**任务3：移动平均**

计算每天的GMV及7天移动平均：

```sql
WITH daily_gmv AS (
    SELECT
        date(created_at) as order_date,
        sum(total_amount) as gmv
    FROM orders
    GROUP BY date(created_at)
)
SELECT
    order_date,
    gmv,
    avg(gmv) OVER (
        ORDER BY order_date
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as ma7_gmv
FROM daily_gmv
ORDER BY order_date;
```

**分析**：
- 7天移动平均如何平滑波动？
- 哪些天GMV异常？

#### 十、小结

基础查询、聚合分析、多表关联、复杂 CTE 是 SQL 的基础。

窗口函数在保留明细的同时做组内分析。

核心要点：
- 窗口函数保留所有明细，同时在组内计算
- ROW_NUMBER、RANK、DENSE_RANK 用于排名
- SUM、AVG 等聚合函数可作为窗口函数
- LAG、LEAD 用于取前后值
- ROWS/RANGE 定义窗口边界
- 窗口函数比自关联更高效

下一节将进入指标计算：从 SQL 到指标，理解如何将 SQL 查询转化为业务指标。
