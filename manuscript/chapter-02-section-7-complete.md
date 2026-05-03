### 2.7 指标计算：从SQL到指标

前面学习了SQL的基础能力：查询、聚合、关联、复杂分析。

但业务同学问的不是"你会写SQL吗"，而是"今天的GMV是多少"、"DAU多少"、"转化率多少"。

这些就是指标。

**指标和SQL查询有什么区别？**

```sql
-- SQL查询：返回数据
SELECT sum(total_amount) FROM orders WHERE created_at = '2026-04-01';

-- 指标：GMV = 2026年4月1日所有已支付订单的金额总和
-- 定义：sum(orders.total_amount) where orders.paid_at = '2026-04-01'
```

看起来一样，但指标有更严格的定义：
- **业务口径**：什么是GMV？包括未支付订单吗？
- **计算逻辑**：用哪个字段？created_at 还是 paid_at？
- **取数范围**：哪些订单算入？取消的算吗？
- **更新频率**：实时？每小时？每天？
- **数据来源**：哪个表？哪个字段？

从SQL到指标，是从"能算出数"到"算出可信的指标"。

#### 一、为什么需要指标体系

**第一，SQL查询结果不一致**

同一个"GMV"指标，不同人写出不同SQL：

```sql
-- 方式A：按订单创建时间
SELECT sum(total_amount) FROM orders WHERE date(created_at) = '2026-04-01';

-- 方式B：按订单支付时间
SELECT sum(total_amount) FROM orders WHERE date(paid_at) = '2026-04-01';

-- 方式C：只统计已支付订单
SELECT sum(total_amount) FROM orders
WHERE order_status = 'paid'
AND date(created_at) = '2026-04-01';
```

**结果**：三个SQL算出不同数字。

**问题**：
- 哪个是正确的GMV？
- 业务同学该信哪个？
- 数据团队该维护哪个？

**第二，业务需要统一的指标语言**

运营同学说"今天GMV"，产品经理说"今天GMV"，数据分析师说"今天GMV"。

如果没有统一口径：
- 每个人理解不同
- 数据对不上
- 决策基于错误的数字

**第三，指标需要持续维护和迭代**

指标不是定义一次就完了：
- 业务变化（新增业务线）
- 数据变化（表结构变化）
- 需求变化（需要更细粒度）

如果没有指标体系：
- 指标散落在各个SQL和报表中
- 修改成本高
- 难以追踪变化

**结论**：
> 指标体系是数据团队和业务团队的共同语言，是所有数据分析的基础。

#### 二、核心判断：指标不是SQL查询结果，而是标准化的业务度量

> 指标计算的核心判断是：通过明确的业务口径、计算逻辑、取数范围、更新频率，将SQL查询转化为可信赖、可复用、可追溯的业务指标。

这个判断说明：
- **SQL查询**：能算出数字
- **指标**：数字 + 口径 + 逻辑 + 来源
- **价值**：可信、复用、追溯
- **目的**：统一业务语言

#### 三、指标的构成要素

##### 3.1 指标的定义结构

**完整的指标定义**：
```yaml
指标名称：GMV（Gross Merchandise Volume，成交总额）
业务口径：所有已支付订单的金额总和
计算逻辑：sum(orders.total_amount)
取数范围：orders.order_status = 'paid'
时间口径：按订单支付时间（paid_at）
更新频率：每小时更新一次
数据来源：production.orders 表
负责人：数据团队-电商业务组
```

**为什么每个要素都重要？**

**业务口径**：
- 说明"是什么"
- 避免歧义（GMV包括取消订单吗？）
- 业务理解的基础

**计算逻辑**：
- 说明"怎么算"
- sum(total_amount) 还是 sum(item_amount)？
- 确保计算方式一致

**取数范围**：
- 说明"算哪些"
- 只算已支付订单
- 排除测试订单

**时间口径**：
- 说明"按什么时间"
- created_at（下单时间）
- paid_at（支付时间）
- 完成时间不同，指标不同

**更新频率**：
- 说明"什么时候更新"
- 实时：适合监控告警
- 每小时：适合运营看板
- 每天：适合财务报表

**数据来源**：
- 说明"数据从哪来"
- 哪个库？哪个表？
- 数据链路变化时知道影响范围

##### 3.2 指标的类型

**绝对指标**：
- 定义：直接计数的指标
- 示例：GMV、订单数、用户数
- 特点：可累加

**相对指标**：
- 定义：两个绝对指标的比值
- 示例：转化率、复购率、客单价
- 特点：不可累加，需要重新计算

**示例**：
```sql
-- 绝对指标：GMV
SELECT sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
AND date(paid_at) = '2026-04-01';

-- 相对指标：转化率
SELECT
    count(DISTINCT CASE WHEN event_name = 'place_order' THEN user_id END) ::numeric /
    count(DISTINCT CASE WHEN event_name = 'view_product' THEN user_id END) as conversion_rate
FROM events
WHERE date(event_time) = '2026-04-01';
```

##### 3.3 指标的粒度

**时间粒度**：
- 实时：秒级更新
- 小时：每小时汇总
- 天：每天汇总
- 月：每月汇总

**维度粒度**：
- 全局：整体指标
- 按渠道：不同渠道的指标
- 按地区：不同地区的指标
- 按类目：不同类目的指标

**示例**：
```sql
-- 时间粒度：每天GMV
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date(paid_at);

-- 维度粒度：每个渠道的GMV
SELECT
    channel,
    sum(total_amount) as gmv
FROM orders o
JOIN users u ON o.user_id = u.user_id
WHERE o.order_status = 'paid'
AND date(o.paid_at) = '2026-04-01'
GROUP BY channel;
```

#### 四、指标的生命周期

##### 4.1 指标的设计

**步骤1：理解业务需求**
- 业务问题：什么决策需要这个指标？
- 指标用途：监控、分析、考核？
- 使用人群：运营、产品、管理层？

**步骤2：明确指标口径**
- 指标定义：这个指标是什么？
- 计算逻辑：怎么算？
- 取数范围：算哪些数据？

**步骤3：选择数据来源**
- 哪个表有这些数据？
- 数据质量如何？
- 更新频率如何？

**步骤4：设计计算SQL**
- 写出计算逻辑
- 验证结果准确性
- 考虑性能优化

##### 4.2 指标的开发

**开发流程**：
```sql
-- 1. 写SQL
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(paid_at);

-- 2. 测试验证
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';

-- 3. 对比验证
-- 与旧数据、业务报表对比
-- 确认结果可信

-- 4. 上线发布
-- 创建定时任务，每小时更新
```

##### 4.3 指标的维护

**维护工作**：
- **监控**：指标是否正常更新？
- **验证**：数据是否异常？
- **迭代**：业务变化，指标是否需要调整？

**示例**：
```sql
-- 监控指标更新时间
SELECT
    table_name,
    max(last_update) as last_refresh_time
FROM metadata.table_update_log
WHERE table_name = 'daily_gmv';

-- 验证指标数据
SELECT
    order_date,
    gmv,
    lag(gmv, 1) OVER (ORDER BY order_date) as prev_gmv,
    (gmv - lag(gmv, 1) OVER (ORDER BY order_date)) / lag(gmv, 1) OVER (ORDER BY order_date) as growth_rate
FROM daily_gmv
ORDER BY order_date DESC
LIMIT 7;
```

#### 五、常见指标的计算模式

##### 5.1 转化类指标

**漏斗转化率**：
```sql
WITH funnel_counts AS (
    SELECT
        count(DISTINCT CASE WHEN event_name = 'view_product' THEN user_id END) as view_users,
        count(DISTINCT CASE WHEN event_name = 'add_to_cart' THEN user_id END) as cart_users,
        count(DISTINCT CASE WHEN event_name = 'place_order' THEN user_id END) as order_users,
        count(DISTINCT CASE WHEN event_name = 'payment' THEN user_id END) as payment_users
    FROM events
    WHERE date(event_time) = '2026-04-01'
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

##### 5.2 留存类指标

**次日留存率**：
```sql
WITH day1_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE date(event_time) = '2026-04-01'
),
day2_users AS (
    SELECT DISTINCT user_id
    FROM events
    WHERE date(event_time) = '2026-04-02'
)
SELECT
    count(*) as day1_total,
    count(d2.user_id) as day2_retained,
    count(d2.user_id)::numeric / count(*) as day1_retention_rate
FROM day1_users d1
LEFT JOIN day2_users d2 ON d1.user_id = d2.user_id;
```

##### 5.3 增长类指标

**同比增长率**：
```sql
WITH monthly_gmv AS (
    SELECT
        date_trunc('month', paid_at) as month,
        sum(total_amount) as gmv
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY date_trunc('month', paid_at)
)
SELECT
    month,
    gmv,
    lag(gmv, 12) OVER (ORDER BY month) as same_month_last_year,
    (gmv - lag(gmv, 12) OVER (ORDER BY month)) / lag(gmv, 12) OVER (ORDER BY month) as yoy_growth_rate
FROM monthly_gmv
ORDER BY month DESC
LIMIT 12;
```

##### 5.4 用户行为类指标

**客单价**：
```sql
SELECT
    date(paid_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    sum(total_amount) / count(*) as avg_order_value
FROM orders
WHERE order_status = 'paid'
GROUP BY date(paid_at)
ORDER BY order_date DESC;
```

#### 六、指标管理的最佳实践

##### 6.1 指标命名规范

**命名原则**：
- 明确：看到名字就知道是什么
- 一致：同类指标命名一致
- 简洁：不过长

**命名示例**：
```
好的命名：
- daily_gmv（每日GMV）
- user_retention_d1（次日留存率）
- conversion_rate_checkout（结算转化率）

不好的命名：
- gmv（不清楚是什么粒度）
- retention（留存率？哪个留存？）
- rate（什么比率？）
```

##### 6.2 指标文档化

**指标字典**：
```yaml
指标ID: METRIC-001
指标名称: GMV
指标英文名: Gross Merchandise Volume
指标定义: 所有已支付订单的金额总和
计算公式: sum(orders.total_amount)
计算粒度: 按天
取数条件: orders.order_status = 'paid'
时间口径: 订单支付时间（paid_at）
数据来源: production.orders
负责团队: 数据团队
更新频率: 每小时
创建时间: 2026-01-01
最后修改: 2026-04-01
```

##### 6.3 指标血缘追踪

**为什么需要血缘追踪？**
- 数据链路变化时，知道影响哪些指标
- 发现数据问题时，快速定位源头
- 指标迭代时，了解依赖关系

**血缘记录**：
```sql
-- 指标血缘表
CREATE TABLE metric_lineage (
    metric_id VARCHAR(50),
    source_table VARCHAR(100),
    source_column VARCHAR(100),
    transformation TEXT,
    created_at TIMESTAMP
);

-- 示例记录
INSERT INTO metric_lineage VALUES
('METRIC-001', 'orders', 'total_amount', 'sum(total_amount) WHERE order_status = paid', NOW());
```

#### 七、常见误区

**误区一：指标就是SQL查询**

- **说明**：指标是标准化的业务度量，包含口径、逻辑、来源等，不只是SQL
- **后果**：指标不一致，无法复用，难以维护
- **正确理解**：
  - 指标 = SQL + 业务口径 + 计算逻辑 + 取数范围 + 更新频率
  - 指标需要文档化和版本管理
  - 指标需要持续维护

**误区二：指标越多越好**

- **说明**：指标价值在于对业务的支持，不是数量
- **后果**：指标爆炸，业务不知道看哪个，维护成本高
- **正确理解**：
  - 核心指标：5-10个
  - 过程指标：补充核心指标
  - 定期清理无用指标

**误区三：指标定义一次就行了**

- **说明**：业务在变化，指标也需要迭代
- **后果**：指标过时，不再反映业务真实情况
- **正确理解**：
  - 定期review指标
  - 业务变化时调整指标
  - 记录指标变更历史

**误区四：相对指标可以累加**

- **说明**：转化率、留存率等相对指标不能累加
- **后果**：错误计算（如"月转化率"不是"日转化率"的平均）
- **正确理解**：
  - 相对指标需要重新计算
  - 不能简单平均或累加
  - 注意指标的聚合方式

**误区五：指标更新越快越好**

- **说明**：实时指标成本高，不是所有指标都需要实时
- **后果**：系统负载高，成本浪费
- **正确理解**：
  - 监控告警类指标需要实时
  - 运营分析类指标每小时或每天
  - 财务报表类指标每周或每月
  - 根据需求选择更新频率

#### 八、实战任务

**任务1：指标定义练习**

为以下指标写完整定义：

**指标1：DAU（日活跃用户数）**
```yaml
指标名称：DAU（Daily Active Users）
业务口径：每天至少发生一次行为事件的不同用户数
计算逻辑：count(DISTINCT user_id)
取数范围：events 表，任意事件
时间口径：事件时间（event_time）
更新频率：每小时
数据来源：production.events 表
```

**指标2：客单价**
```yaml
指标名称：客单价（Average Order Value）
业务口径：平均每笔订单的金额
计算逻辑：sum(total_amount) / count(*)
取数范围：已支付订单
时间口径：订单支付时间（paid_at）
更新频率：每天
数据来源：production.orders 表
```

**任务2：指标计算**

实现以下指标的SQL：

**指标1：复购率**
```sql
WITH user_order_count AS (
    SELECT
        user_id,
        count(*) as order_count
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
)
SELECT
    count(*) as total_users,
    count(CASE WHEN order_count >= 2 THEN 1 END) as repeat_users,
    count(CASE WHEN order_count >= 2 THEN 1 END)::numeric / count(*) as repeat_rate
FROM user_order_count;
```

**指标2：月度流失率**
```sql
WITH user_last_order AS (
    SELECT
        user_id,
        max(date(paid_at)) as last_order_date
    FROM orders
    WHERE order_status = 'paid'
    GROUP BY user_id
),
churn_users AS (
    SELECT
        last_order_date,
        count(*) as user_count
    FROM user_last_order
    WHERE last_order_date < CURRENT_DATE - INTERVAL '90 days'
    GROUP BY last_order_date
)
SELECT
    sum(user_count) as churn_users,
    (SELECT count(DISTINCT user_id) FROM orders) as total_users,
    sum(user_count)::numeric / (SELECT count(DISTINCT user_id) FROM orders) as churn_rate
FROM churn_users;
```

**任务3：指标验证**

验证"GMV"指标的准确性：

**步骤1**：用两种方式计算GMV
```sql
-- 方式A：从订单表直接统计
SELECT sum(total_amount) as gmv_a
FROM orders
WHERE order_status = 'paid'
AND date(paid_at) = '2026-04-01';

-- 方式B：从订单明细汇总
SELECT sum(oi.item_amount) as gmv_b
FROM order_items oi
JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_status = 'paid'
AND date(o.paid_at) = '2026-04-01';
```

**步骤2**：对比结果
- 两个结果是否一致？
- 如果不一致，原因是什么？

**步骤3**：验证边界情况
- 取消的订单算入吗？
- 退款订单算入吗？
- 测试订单算入吗？

#### 九、小结

SQL是计算工具，指标是业务语言。

从SQL到指标，是从"能算出数"到"算出可信的、可复用的、可追溯的业务度量"。

核心要点：
- 指标 = 口径 + 逻辑 + 范围 + 频率 + 来源
- 指标需要标准化定义和文档化
- 指标有生命周期：设计→开发→维护→迭代
- 常见指标类型：转化、留存、增长、用户行为
- 指标管理需要命名规范、文档化、血缘追踪

下一节将进入常见指标SQL实战：实际业务中最常用的指标如何用SQL实现。
