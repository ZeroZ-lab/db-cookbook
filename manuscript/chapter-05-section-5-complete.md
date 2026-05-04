### 5.5 常见分层模型详解

上一节讲了分层的必要性。这一节展开 ODS、DWD、DWS、ADS 四层各自该怎么做。

#### ODS 层：原始副本，不做加工

ODS（Operational Data Store）的职责只有一个：把源数据搬过来，原封不动存好。

设计原则很简单。表结构跟源系统保持一致，不做字段重命名、不做类型转换、不做 CASE WHEN。唯一新增的是 `etl_time`（同步时间戳）和 `etl_source`（来源标识）。ODS 可以按同步日期分区，方便按天管理：

```sql
CREATE TABLE ods_orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    total_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    created_at TIMESTAMP,
    -- 技术字段
    etl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source VARCHAR(100) DEFAULT 'mysql_orders'
) PARTITION BY RANGE (etl_time);
```

同步策略建议全量加增量组合：首次全量同步，之后每天增量同步（基于源表的 `updated_at` 字段拉取变化数据）。不要直接在 ODS 上做 CDC 实时同步——ODS 的定位是批处理层面的缓冲层，实时同步应该直接对接流处理通道（第 8 章）。

#### DWD 层：数据清洗和维度关联

DWD（Data Warehouse Detail）是整个数仓质量的生命线。这里做三件事。

**数据清洗**——三种典型操作：

```sql
-- 1. 过滤无效数据
WHERE order_status IN ('completed', 'paid')
  AND user_id IS NOT NULL
  AND amount > 0

-- 2. 补全缺失值
COALESCE(amount, 0) as amount
COALESCE(created_at, CURRENT_TIMESTAMP) as created_at

-- 3. 修正数据类型
CAST(amount AS NUMERIC(10,2))
CAST(created_at AS TIMESTAMP)
```

**数据统一**——处理多源异构：

```sql
-- 性别编码统一
CASE gender
    WHEN '0' THEN 'M'
    WHEN '1' THEN 'F'
    WHEN '男' THEN 'M'
    WHEN '女' THEN 'F'
    ELSE 'U'
END as gender

-- 字段命名统一（两个源系统的不同字段名 → 同一个输出字段）
SELECT prod_id as product_id, prod_name as product_name FROM mysql_products
UNION ALL
SELECT item_id as product_id, item_name as product_name FROM oracle_inventory
```

**数据关联**——JOIN 维度表，补充维度外键。这一步的意义在于：DWD 层之后的查询不再需要 JOIN 维度表做关联，直接按维度外键过滤即可。

```sql
INSERT INTO dwd_fact_orders
SELECT
    o.order_id,
    d.date_id,
    u.user_id,
    p.product_id,
    o.amount
FROM ods_orders o
JOIN dim_date d ON to_date(o.created_at) = d.date_value
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id;
```

#### DWS 层：预计算常用汇总

DWS（Data Warehouse Summary）解决的核心矛盾：DWD 层数据量太大（亿级），每次查询都聚合太慢。解决方法——把高频查询的聚合结果提前算好。

三种最常见的汇总维度：

```sql
-- 按时间汇总：每日 GMV
CREATE TABLE dws_daily_gmv AS
SELECT order_date,
       sum(order_amount) as gmv,
       count(*) as order_count,
       count(DISTINCT user_id) as user_count
FROM dwd_fact_orders
GROUP BY order_date;

-- 按用户汇总：每个用户的累计消费
CREATE TABLE dws_user_gmv AS
SELECT user_id,
       sum(order_amount) as total_gmv,
       count(*) as order_count,
       min(order_date) as first_order_date,
       max(order_date) as last_order_date
FROM dwd_fact_orders
GROUP BY user_id;

-- 按商品汇总：每个商品的销量
CREATE TABLE dws_product_gmv AS
SELECT product_id,
       sum(order_amount) as total_gmv,
       sum(order_quantity) as total_quantity
FROM dwd_fact_orders
GROUP BY product_id;
```

DWS 层的取舍原则：高频查询（每天被查 5 次以上）必须预计算，低频查询（每周查一次）可以实时聚合。不要把所有能汇总的都提前算好——存储成本和管理成本也是成本。

#### ADS 层：面向应用交付

ADS（Application Data Store）是数据仓库的"门面"。这一层的表直接对接 BI 工具、报表系统和管理驾驶舱。

ADS 层的表应该做到"拿来即用"——不需要 JOIN、不需要 GROUP BY、不需要窗口函数。每个报表对应一张或几张 ADS 表。

几个典型设计：

```sql
-- 月度 GMV 报表：同比分析
CREATE TABLE ads_monthly_gmv_report AS
SELECT
    year, month,
    sum(gmv) as gmv,
    -- 同比：去年同月 GMV 和增长率
    lag(sum(gmv), 12) OVER (ORDER BY year, month) as last_year_gmv,
    (sum(gmv) - lag(sum(gmv), 12) OVER (ORDER BY year, month))
        / lag(sum(gmv), 12) OVER (ORDER BY year, month) as yoy_growth_rate
FROM dws_daily_gmv
GROUP BY year, month;

-- 商品销量排名
CREATE TABLE ads_product_sales_ranking AS
SELECT
    p.product_id, p.product_name,
    sum(f.order_quantity) as total_sales,
    rank() OVER (ORDER BY sum(f.order_quantity) DESC) as sales_rank
FROM dwd_fact_orders f
JOIN dim_products p ON f.product_id = p.product_id
GROUP BY p.product_id, p.product_name;

-- 用户留存报表
CREATE TABLE ads_user_retention AS
WITH cohort_users AS (
    SELECT user_id, min(order_date) as cohort_date
    FROM dwd_fact_orders
    GROUP BY user_id
),
retention AS (
    SELECT c.user_id, c.cohort_date,
           count(DISTINCT f.order_date) as active_days
    FROM cohort_users c
    LEFT JOIN dwd_fact_orders f ON c.user_id = f.user_id
        AND f.order_date >= c.cohort_date
        AND f.order_date < c.cohort_date + INTERVAL '30 days'
    GROUP BY c.user_id, c.cohort_date
)
SELECT cohort_date,
       count(*) as cohort_size,
       count(*) FILTER (WHERE active_days >= 1) as day1_retention,
       count(*) FILTER (WHERE active_days >= 7) as day7_retention,
       count(*) FILTER (WHERE active_days >= 30) as day30_retention
FROM retention
GROUP BY cohort_date;
```

#### 完整数据流示例

从源订单到 GMV 报表的完整路径：

```sql
-- ODS: 原始订单
CREATE TABLE ods_orders AS SELECT * FROM source_orders;

-- DWD: 清洗 + 关联维度
CREATE TABLE dwd_fact_orders AS
SELECT order_id, to_date(created_at) as order_date,
       user_id, product_id, amount
FROM ods_orders
WHERE status = 'completed';

-- DWS: 每日 GMV
CREATE TABLE dws_daily_gmv AS
SELECT order_date, sum(amount) as gmv, count(*) as order_count
FROM dwd_fact_orders
GROUP BY order_date;

-- ADS: 月度 GMV 报表
CREATE TABLE ads_monthly_gmv_report AS
SELECT date_part('year', order_date) as year,
       date_part('month', order_date) as month,
       sum(gmv) as gmv
FROM dws_daily_gmv
GROUP BY year, month;
```

查询 GMV 的性能对比：直接查 DWD 层 = 扫描 3000 万行，10 秒。查 DWS 层 = 扫描 31 行，100ms。100 倍提升，这就是 DWS 层预计算的价值。

#### 常见误区

**"ODS 层可以省略"**。建议保留。ODS 是你唯一能回溯数据的地方。DWD 处理出错，不用重新从源库拉数据（源库可能已经变化了甚至数据被删了），直接从 ODS 重做。

**"DWD 层也可以做汇总"**。不行。DWD 管清洗，DWS 管汇总，职责要分离。混在一起会导致：别人不知道你的 DWD 表到底干不干净（是原始明细还是已经汇总过了），不敢复用。

**"DWS 层汇总越细越好"**。只预计算高频查询。一个数仓可能有 50 个维度的排列组合，你不可能全算好。用"每天被查询超过 5 次"做筛选标准。

**"ADS 可以替代 DWS"**。ADS 是应用专用的（一张表给一个报表），DWS 是公用的（一张表给多个报表复用）。把 DWS 的汇总直接放到 ADS 里也行，但其他报表想用这个汇总就得重算一遍。

#### 小结

ODS 做原始备份，DWD 做数据清洗，DWS 做预计算，ADS 做应用交付。四层各有清晰边界，数据单向流动。一个中等规模数仓（10 个报表、5 张源表），分层后代码量减少约 80%，维护成本降低约 90%。下一节讨论如何实施这套分层架构——自底向上还是自顶向下，怎么分阶段推进。
