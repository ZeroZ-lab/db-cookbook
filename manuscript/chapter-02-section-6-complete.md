### 2.6 窗口函数：在保留明细的同时做组内分析

聚合分析会压缩明细，计算统计指标。

但有些分析需要既保留明细，又在组内做计算：

```text
每个用户的订单金额排名
每个商品在各月的销量排名
每个用户的累计消费金额
每天的订单金额与7天移动平均
每个用户的下一次订单时间
```

GROUP BY会丢失明细，看不到每笔订单的具体情况。不GROUP BY则无法按用户分组计算排名和累计。

窗口函数就是用来解决这个矛盾的：在保留所有明细的同时，按分组做组内计算。

#### 一、不用窗口函数的替代方案有多差

计算每个用户的订单金额排名，不用窗口函数需要自关联：

```sql
SELECT
    o1.order_id, o1.user_id, o1.total_amount,
    (SELECT count(*)
     FROM orders o2
     WHERE o2.user_id = o1.user_id
     AND o2.total_amount >= o1.total_amount) as rank
FROM orders o1;
```

问题很明显：自关联复杂，每个订单都扫描一次用户的所有订单，性能差，不易扩展。

#### 二、窗口函数的基本语法

```sql
<窗口函数>(<字段>) OVER (
    PARTITION BY <分组字段>
    ORDER BY <排序字段>
    [ROWS/RANGE BETWEEN <开始> AND <结束>]
)
```

简单示例——计算每个用户的订单金额排名：

```sql
SELECT
    order_id, user_id, total_amount,
    rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as order_rank
FROM orders;
```

结果保留了所有订单明细，每个用户内部按金额排名，不同用户的排名独立计算。

#### 三、常用窗口函数

排名函数有三个，差别在于相同值怎么处理：

```sql
-- ROW_NUMBER：连续排名（1, 2, 3...），相同值按顺序继续排
row_number() OVER (PARTITION BY user_id ORDER BY total_amount DESC)

-- RANK：跳跃排名（1, 2, 2, 4...），相同值排名相同、下一个跳跃
rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC)

-- DENSE_RANK：密集排名（1, 2, 2, 3...），相同值排名相同、下一个连续
dense_rank() OVER (PARTITION BY user_id ORDER BY total_amount DESC)
```

对比：金额1000/800/800/500时，ROW_NUMBER给出1/2/3/4，RANK给出1/2/2/4，DENSE_RANK给出1/2/2/3。

聚合函数做窗口函数：

```sql
-- SUM作为累计求和
SELECT
    order_id, user_id, total_amount,
    sum(total_amount) OVER (
        PARTITION BY user_id ORDER BY created_at
    ) as cumulative_amount
FROM orders;

-- AVG作为移动平均（当前行+前2行，共3行）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as daily_gmv,
    avg(sum(total_amount)) OVER (
        ORDER BY date(created_at)
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as ma3_gmv
FROM orders
GROUP BY date(created_at);
```

偏移函数LAG和LEAD：

```sql
-- LAG：取前一个值，计算距上次下单的天数
SELECT
    order_id, user_id, created_at,
    created_at - lag(created_at, 1) OVER (
        PARTITION BY user_id ORDER BY created_at
    ) as days_since_prev
FROM orders;

-- LEAD：取后一个值，查看下一笔订单金额
SELECT
    order_id, user_id, total_amount,
    lead(total_amount, 1) OVER (
        PARTITION BY user_id ORDER BY created_at
    ) as next_amount
FROM orders;
```

#### 四、窗口边界：ROWS vs RANGE

ROWS按物理行数定义窗口。计算3天移动平均：`ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`表示当前行加前2行，共3行。

RANGE按值范围定义窗口。例如金额在`[total_amount-100, total_amount+100]`范围内的订单：`RANGE BETWEEN 100 PRECEDING AND 100 FOLLOWING`。

默认窗口（当指定ORDER BY但不指定ROWS/RANGE时）是从分组的第一行到当前行，适合累计求和。

#### 五、常见应用场景

Top N查询——每个用户的前3笔订单：

```sql
WITH user_order_rank AS (
    SELECT
        order_id, user_id, total_amount,
        row_number() OVER (PARTITION BY user_id ORDER BY total_amount DESC) as rn
    FROM orders
)
SELECT * FROM user_order_rank WHERE rn <= 3;
```

连续登录天数计算：

```sql
WITH user_login_dates AS (
    SELECT DISTINCT user_id, date(event_time) as login_date
    FROM events WHERE event_name = 'login'
),
login_rank AS (
    SELECT
        user_id, login_date,
        date_trunc('day', login_date) - row_number() OVER (
            PARTITION BY user_id ORDER BY login_date
        ) * interval '1 day' as date_group
    FROM user_login_dates
),
continuous_days AS (
    SELECT user_id, date_group, count(*) as continuous_days
    FROM login_rank
    GROUP BY user_id, date_group
)
SELECT user_id, max(continuous_days) as max_continuous_days
FROM continuous_days
GROUP BY user_id;
```

#### 六、窗口函数 vs GROUP BY

| 维度 | GROUP BY | 窗口函数 |
|------|----------|----------|
| 明细 | 压缩明细，每组返回一行 | 保留所有明细 |
| 计算粒度 | 组级别统计 | 组内每行都计算 |
| 排名 | 无法直接排名 | 可以排名 |
| 累计 | 无法累计 | 可以累计 |

使用建议：需要统计指标用GROUP BY，需要保留明细用窗口函数，需要Top N用窗口函数加WHERE，需要累计和移动平均用窗口函数。

#### 七、常见误区

**窗口函数可以替代GROUP BY**。它们解决不同问题，不能互相替代。需要压缩明细用GROUP BY，需要保留明细用窗口函数。两者可以配合使用。

**窗口函数总是慢**。窗口函数比自关联高效。确保窗口字段有索引，用EXPLAIN分析性能。

**PARTITION BY和GROUP BY一样**。PARTITION BY定义分组但不压缩明细，GROUP BY会压缩明细。目的不同，不能混淆。

**不定义窗口边界导致结果错误**。累计求和用`ORDER BY`（默认从第一行到当前行），移动平均需要`ROWS BETWEEN N PRECEDING AND CURRENT ROW`，全窗口计算用`ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING`。

#### 八、小结

窗口函数在保留明细的同时做组内分析。

核心要点：
- ROW_NUMBER、RANK、DENSE_RANK用于排名，区别在于相同值的处理
- SUM、AVG等聚合函数可作为窗口函数实现累计和移动平均
- LAG、LEAD用于取前后值
- ROWS定义物理边界，RANGE定义逻辑边界
- 窗口函数比自关联更高效

下一节将进入指标计算：从SQL到指标，理解如何将SQL查询转化为业务指标。
