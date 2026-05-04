### 6.3 数据转换

数据抽取到 ODS 层后是"生数据"——编码不统一、包含无效值、字段零散、缺少维度信息。转换这一步把生数据加工成分析可用的"熟数据"。转换发生在 ODS → DWD → DWS → ADS 的每一层之间。

#### 五种转换操作

**数据清洗**。干掉不该进入数仓的数据：

```sql
-- 过滤空值、异常值
WHERE user_id IS NOT NULL           -- 用户缺失的订单，删
  AND order_amount > 0              -- 负数金额，删
  AND order_status = 'completed'    -- 只看已完成
  AND is_deleted = false            -- 软删除的数据，排除

-- 去重（源系统可能出现重复订单号）
SELECT DISTINCT ON (order_id) order_id, ...
```

清洗的核心判断不是"能不能过滤"，而是"过滤标准要统一且可追溯"。如果上半年的 GMV 不含退款、下半年的 GMX 含退款，跨期对比就没有意义。清洗规则必须在全公司范围内达成一致，并记录在 dim_metrics 元数据表里。

**数据格式化**。统一不同源系统之间的数据格式差异：

```sql
-- 日期统一：多种格式 → YYYYMMDD 整数
TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id

-- 性别统一：0/1、M/F、男/女 → M/F
CASE gender
    WHEN '0' THEN 'M' WHEN '1' THEN 'F'
    WHEN '男' THEN 'M' WHEN '女' THEN 'F'
    ELSE 'U'
END as gender

-- 布尔值统一：true/1/yes → TRUE
CASE WHEN is_vip IN ('true', '1', 'yes') THEN TRUE ELSE FALSE END as is_vip
```

**数据关联**。JOIN 维度表，把维度属性补到事实表上：

```sql
CREATE TABLE dwd_fact_orders AS
SELECT o.order_id, o.date_id, o.user_id, o.product_id, o.order_amount,
       u.city, u.province, u.segment,       -- 用户维度信息
       p.category, p.brand,                   -- 商品维度信息
       c.channel_name                         -- 渠道维度信息
FROM ods_orders o
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
LEFT JOIN dim_channels c ON o.channel_id = c.channel_id;
```

注意这里用 LEFT JOIN 而不是 INNER JOIN。如果某个订单的 user_id 在用户维度表里暂时找不到（维度表更新慢于事实表），INNER JOIN 会直接丢弃这条订单——这可能导致 GMV 数据丢失。LEFT JOIN 保留订单，用户属性字段留 NULL，后续可以补。

**数据聚合**。从 DWD 的明细数据汇总到 DWS 层：

```sql
-- 每日 GMV
CREATE TABLE dws_daily_gmv AS
SELECT date_id,
       COUNT(*) as order_count,
       SUM(order_amount) as gmv,
       AVG(order_amount) as avg_order_amount,
       COUNT(DISTINCT user_id) as user_count
FROM dwd_fact_orders
GROUP BY date_id;

-- 7 日滚动 GMV
SELECT date_id,
       SUM(gmv) OVER (ORDER BY date_id ROWS BETWEEN 6 PRECEDING AND CURRENT ROW) as gmv_7d
FROM dws_daily_gmv;

-- 累计 GMV（至今总 GMV）
SELECT date_id,
       SUM(gmv) OVER (ORDER BY date_id ROWS UNBOUNDED PRECEDING) as cumulative_gmv
FROM dws_daily_gmv;
```

**数据计算**。派生字段和业务指标：

```sql
-- 客单价 = GMV / 订单数
gmv / NULLIF(order_count, 0) as avg_order_amount

-- 转化率
conversion_user_count * 100.0 / NULLIF(visitor_count, 0) as conversion_rate

-- 用户分群
CASE
    WHEN total_order_amount >= 10000 THEN 'VIP'
    WHEN total_order_amount >= 1000 THEN '高价值'
    WHEN total_order_amount >= 100 THEN '普通'
    ELSE '低价值'
END as user_segment
```

注意 `NULLIF` 的使用——当分母为 0 时避免除零错误，返回 NULL 比直接报错更安全。

#### 转换的分层设计

每层之间的转换有明确的职责边界：

**ODS → DWD**：清洗 + 格式化 + 关联维度。输入是原始副本，输出是干净的明细数据。

```sql
CREATE TABLE dwd_fact_orders AS
SELECT o.order_id,
       TO_CHAR(o.created_at, 'YYYYMMDD')::INT as date_id,
       o.user_id, o.product_id, o.channel_id,
       u.city, u.segment,     -- 维度属性
       p.category, p.brand,   -- 维度属性
       o.order_amount, o.order_quantity
FROM ods_orders o
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
WHERE o.order_amount > 0 AND o.user_id IS NOT NULL AND o.order_status = 'completed';
```

**DWD → DWS**：聚合 + 计算派生指标。输入是明细数据，输出是按维度预汇总的数据。

```sql
CREATE TABLE dws_daily_gmv AS
SELECT date_id, city, category,
       COUNT(*) as order_count, SUM(order_amount) as gmv,
       AVG(order_amount) as avg_order_amount
FROM dwd_fact_orders
GROUP BY date_id, city, category;
```

**DWS → ADS**：面向应用的聚合 + 同比环比计算。输入是汇总数据，输出是可直接展示的报表数据。

```sql
CREATE TABLE ads_monthly_report AS
SELECT TO_CHAR(TO_DATE(date_id::TEXT, 'YYYYMMDD'), 'YYYY-MM') as month,
       city, category,
       SUM(gmv) as monthly_gmv,
       SUM(gmv) / LAG(SUM(gmv)) OVER (PARTITION BY city, category ORDER BY date_id) - 1 as gmv_mom
FROM dws_daily_gmv
GROUP BY month, city, category;
```

#### 转换的三个工程原则

**幂等性**。同样的输入跑两次，输出完全一致。实现方式：按分区处理——每天跑之前先 DELETE 当天的数据，再 INSERT，而不是直接 INSERT 叠加。

```sql
BEGIN;
DELETE FROM dwd_fact_orders WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders SELECT ... FROM ods_orders WHERE date_id = 20260101;
COMMIT;
```

**可追溯性**。每个转换步骤记录日志：哪个表、哪一天、处理了多少行、花了多长时间、成功还是失败。

```sql
INSERT INTO etl_logs (table_name, operation, start_time, end_time, row_count, status)
VALUES ('dwd_fact_orders', 'transform', NOW(), NOW(),
        (SELECT count(*) FROM dwd_fact_orders WHERE date_id = 20260101), 'success');
```

**分区处理**。大表按日期分区——处理单天数据只操作一个分区，不影响其他分区的查询。

```sql
CREATE TABLE dwd_fact_orders (...) PARTITION BY RANGE (date_id);
CREATE TABLE dwd_fact_orders_202601 PARTITION OF dwd_fact_orders
    FOR VALUES FROM (20260101) TO (20260201);
```

#### 常见误区

**"转换逻辑越复杂越好"**。转换的目标是输出高质量、可复用的数据，不是展示 SQL 技巧。一个 200 行的转换 SQL 不如拆成 3 个 30 行的分步转换——每个步骤可测试、可验证、可复用。

**"转换不需要测试"**。转换 SQL 也是代码，会出错。最少做三方面验证：行数对比（源表过滤条件后的预期行数 vs 实际输出行数）、金额合计对比（ODS 层 sum(order_amount) vs DWD 层 sum(order_amount) 是否一致）、空值检查（关键字段 user_id、date_id 不能为 NULL）。

**"转换一次就完成"**。业务规则会变（GMV 定义从"不含退款"变成"含退款"）、源系统会变（新增字段）、数据量会变（需要调整分区）。数仓的转换逻辑是持续维护的，不是一次性工程。

#### 小结

五种转换操作：清洗（过滤无效数据）、格式化（统一编码格式）、关联（JOIN 维度表）、聚合（GROUP BY 汇总）、计算（派生字段和指标）。三个工程原则：幂等性、可追溯性、分区处理。ODS → DWD（清洗关联）、DWD → DWS（聚合计算）、DWS → ADS（应用交付）是数据在数仓内的三层加工流。下一节讲转换完了之后怎么把数据加载进目标表。
