### 5.5 常见分层模型详解

上一节学习了数仓分层的必要性，了解了为什么需要分层以及分层的好处。

现在深入学习常见的分层模型。

**场景**：
```yaml
数据仓库项目启动：
  
架构师："我们需要设计分层架构"
  
你："好的，我来设计ODS、DWD、DWS、ADS四层架构"
  
新同事："等等，ODS是什么？DWD是什么？DWS是什么？ADS是什么？"
  
你："让我详细解释一下..."
```

**问题**：
- 每一层具体做什么？
- 每一层如何设计？
- 每一层之间如何配合？

**答案**：**每层有明确的职责和设计原则，逐层加工数据**

#### 一、ODS层（操作数据存储）

##### 1.1 ODS层定义

**定义**：操作数据存储（Operational Data Store）

**定位**：
```yaml
最接近数据源：
  - 数据从源系统直接同步过来
  - 几乎不做处理
  
原始数据副本：
  - 保存源系统的原始数据
  - 作为数据备份
  
数据缓冲：
  - 作为数据仓库的缓冲层
  - 隔离源系统和数据仓库
```

##### 1.2 ODS层特点

**特点1：数据结构一致**
```yaml
与源系统一致：
  - 表结构与源系统相同
  - 字段类型与源系统相同
  - 字段名称与源系统相同
  
不做转换：
  - 不做数据类型转换
  - 不做字段重命名
  - 不做数据清洗
```

**示例**：
```sql
-- 源系统（MySQL）
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    total_amount DECIMAL(10,2),
    order_status VARCHAR(50),
    created_at DATETIME,
    updated_at DATETIME
);

-- ODS层（PostgreSQL）
CREATE TABLE ods_orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    total_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
-- 结构与源系统一致（类型可能略有不同）
```

**特点2：保留原始数据**
```yaml
不做过滤：
  - 不过滤无效数据
  - 不过滤删除数据
  - 不过滤测试数据
  
不做修改：
  - 不修改数据值
  - 不补充缺失值
  - 不修正错误数据
```

**特点3：同步时间戳**
```sql
-- 添加同步时间戳字段
ALTER TABLE ods_orders ADD COLUMN etl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE ods_orders ADD COLUMN etl_source VARCHAR(100) DEFAULT 'mysql_orders';
```

##### 1.3 ODS层设计原则

**原则1：保持简单**
```yaml
不做复杂处理：
  - 只做简单的同步
  - 不做复杂转换
  - 不做数据清洗
  
快速同步：
  - 同步速度要快
  - 减少对源系统的影响
```

**原则2：全量+增量**
```yaml
全量同步：
  - 首次：全量同步
  - 后续：定期全量同步（例如每周）
  
增量同步：
  - 每日：增量同步
  - 基于updated_at字段
```

**原则3：分区存储**
```sql
-- 按同步日期分区
CREATE TABLE ods_orders (
    ...
) PARTITION BY RANGE (etl_time);

-- 创建分区
CREATE TABLE ods_orders_20260101 PARTITION OF ods_orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-01-02');
```

#### 二、DWD层（明细数据层）

##### 2.1 DWD层定义

**定义**：数据仓库明细层（Data Warehouse Detail）

**定位**：
```yaml
数据清洗：
  - 清洗无效数据
  - 补全缺失数据
  - 修正错误数据
  
数据统一：
  - 统一数据编码
  - 统一数据格式
  - 统一数据定义
  
数据关联：
  - 关联维度表
  - 丰富维度信息
```

##### 2.2 DWD层数据清洗

**清洗1：过滤无效数据**
```sql
-- ODS层：原始数据（包含无效数据）
SELECT * FROM ods_orders;

-- DWD层：过滤无效数据
INSERT INTO dwd_fact_orders
SELECT
    order_id,
    user_id,
    product_id,
    amount
FROM ods_orders
WHERE order_status IN ('completed', 'paid')  -- 过滤未完成订单
  AND user_id IS NOT NULL                     -- 过滤无效用户
  AND amount > 0;                             -- 过滤无效金额
```

**清洗2：补全缺失数据**
```sql
-- 补全默认值
INSERT INTO dwd_fact_orders
SELECT
    order_id,
    user_id,
    product_id,
    COALESCE(amount, 0) as amount,           -- 补全默认值0
    COALESCE(discount, 0) as discount,       -- 补全默认值0
    COALESCE(created_at, CURRENT_TIMESTAMP)  -- 补全当前时间
FROM ods_orders;
```

**清洗3：修正错误数据**
```sql
-- 修正数据类型
INSERT INTO dwd_fact_orders
SELECT
    order_id,
    user_id,
    product_id,
    CAST(amount AS NUMERIC(10,2)),          -- 转换数据类型
    CAST(created_at AS TIMESTAMP)            -- 转换数据类型
FROM ods_orders;
```

##### 2.3 DWD层数据统一

**统一1：统一编码**
```sql
-- ODS层：不同系统的编码不一致
-- 订单系统：性别 0/1
-- 用户系统：性别 M/F
-- 商品系统：性别 男/女

-- DWD层：统一编码
INSERT INTO dwd_dim_users
SELECT
    user_id,
    CASE gender                          -- 统一性别编码
        WHEN '0' THEN 'M'                -- 0 → M
        WHEN '1' THEN 'F'                -- 1 → F
        WHEN '男' THEN 'M'               -- 男 → M
        WHEN '女' THEN 'F'               -- 女 → F
        ELSE 'U'                         -- 其他 → U（未知）
    END as gender
FROM ods_users;
```

**统一2：统一格式**
```sql
-- 统一日期格式
INSERT INTO dwd_fact_orders
SELECT
    order_id,
    to_date(created_at) as order_date,    -- 统一为DATE类型
    user_id,
    product_id,
    amount
FROM ods_orders;
```

**统一3：统一命名**
```sql
-- 统一字段命名
INSERT INTO dwd_dim_products
SELECT
    product_id,
    product_name,
    product_price,
    product_category,
    product_brand
FROM (
    -- 源系统1：商品表
    SELECT 
        prod_id as product_id,
        prod_name as product_name,
        prod_price as product_price,
        prod_cat as product_category,
        prod_brand as product_brand
    FROM mysql_products
    
    UNION ALL
    
    -- 源系统2：库存表
    SELECT 
        item_id as product_id,
        item_name as product_name,
        item_price as product_price,
        item_cat as product_category,
        item_brand as product_brand
    FROM oracle_inventory
) t;
```

##### 2.4 DWD层数据关联

**关联维度表**
```sql
-- DWD层：关联维度表
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

#### 三、DWS层（汇总数据层）

##### 3.1 DWS层定义

**定义**：数据仓库汇总层（Data Warehouse Summary）

**定位**：
```yaml
数据汇总：
  - 按维度汇总数据
  - 预计算常用指标
  
数据聚合：
  - 日期汇总（日、周、月）
  - 用户汇总
  - 商品汇总
  
公共汇总：
  - 多个应用复用
  - 减少重复计算
```

##### 3.2 DWS层汇总类型

**类型1：按时间汇总**
```sql
-- 每日汇总
CREATE TABLE dws_daily_gmv AS
SELECT
    order_date,
    sum(order_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as user_count,
    avg(order_amount) as avg_order_value
FROM dwd_fact_orders
GROUP BY order_date;

-- 每周汇总
CREATE TABLE dws_weekly_gmv AS
SELECT
    date_trunc('week', order_date) as week_date,
    sum(gmv) as gmv,
    sum(order_count) as order_count
FROM dws_daily_gmv
GROUP BY date_trunc('week', order_date);

-- 每月汇总
CREATE TABLE dws_monthly_gmv AS
SELECT
    date_trunc('month', order_date) as month_date,
    sum(gmv) as gmv,
    sum(order_count) as order_count
FROM dws_daily_gmv
GROUP BY date_trunc('month', order_date);
```

**类型2：按用户汇总**
```sql
-- 用户GMV汇总
CREATE TABLE dws_user_gmv AS
SELECT
    user_id,
    sum(order_amount) as total_gmv,
    count(*) as order_count,
    min(order_date) as first_order_date,
    max(order_date) as last_order_date,
    avg(order_amount) as avg_order_value
FROM dwd_fact_orders
GROUP BY user_id;
```

**类型3：按商品汇总**
```sql
-- 商品GMV汇总
CREATE TABLE dws_product_gmv AS
SELECT
    product_id,
    sum(order_amount) as total_gmv,
    count(*) as order_count,
    sum(order_quantity) as total_quantity,
    avg(order_amount) as avg_order_value
FROM dwd_fact_orders
GROUP BY product_id;
```

##### 3.3 DWS层设计原则

**原则1：预计算常用指标**
```yaml
常用指标：
  - 每日GMV
  - 用户GMV排名
  - 商品GMV排名
  
预计算：
  - 提前计算好
  - 查询时直接使用
```

**原则2：保持适度汇总**
```yaml
不要过度汇总：
  - 不是所有指标都需要汇总
  - 根据查询频率决定
  
适度汇总：
  - 高频查询：汇总
  - 低频查询：不汇总
```

**原则3：定期更新**
```sql
-- 每天更新汇总表
INSERT INTO dws_daily_gmv
SELECT
    CURRENT_DATE as order_date,
    sum(order_amount) as gmv,
    count(*) as order_count
FROM dwd_fact_orders
WHERE order_date = CURRENT_DATE
GROUP BY CURRENT_DATE;
```

#### 四、ADS层（应用数据层）

##### 4.1 ADS层定义

**定义**：应用数据存储（Application Data Store）

**定位**：
```yaml
面向应用：
  - 面向具体报表
  - 面向具体仪表板
  - 面向具体API
  
结果数据：
  - 数据已经准备好
  - 直接用于展示
  
业务逻辑：
  - 包含业务逻辑
  - 符合业务需求
```

##### 4.2 ADS层设计类型

**类型1：报表数据**
```sql
-- 月度GMV报表
CREATE TABLE ads_monthly_gmv_report AS
SELECT
    date_part('year', order_date) as year,
    date_part('month', order_date) as month,
    sum(gmv) as gmv,
    sum(order_count) as order_count,
    lag(sum(gmv), 12) OVER (ORDER BY date_part('year', order_date), date_part('month', order_date)) as last_year_gmv,
    (sum(gmv) - lag(sum(gmv), 12) OVER (...)) / lag(sum(gmv), 12) OVER (...) as yoy_growth_rate
FROM dws_daily_gmv
GROUP BY date_part('year', order_date), date_part('month', order_date);
```

**类型2：排行榜**
```sql
-- 商品销量排名
CREATE TABLE ads_product_sales_ranking AS
SELECT
    product_id,
    product_name,
    total_sales,
    rank() OVER (ORDER BY total_sales DESC) as sales_rank
FROM (
    SELECT
        p.product_id,
        p.product_name,
        sum(f.order_quantity) as total_sales
    FROM dwd_fact_orders f
    JOIN dim_products p ON f.product_id = p.product_id
    GROUP BY p.product_id, p.product_name
) t;
```

**类型3：留存分析**
```sql
-- 用户留存报表
CREATE TABLE ads_user_retention_report AS
WITH cohort_users AS (
    SELECT
        user_id,
        min(order_date) as cohort_date
    FROM dwd_fact_orders
    GROUP BY user_id
),
retention AS (
    SELECT
        c.user_id,
        c.cohort_date,
        count(DISTINCT date(f.order_date)) as active_days
    FROM cohort_users c
    LEFT JOIN dwd_fact_orders f ON c.user_id = f.user_id
        AND f.order_date >= c.cohort_date
        AND f.order_date < c.cohort_date + INTERVAL '30 days'
    GROUP BY c.user_id, c.cohort_date
)
SELECT
    cohort_date,
    count(*) as cohort_size,
    count(*) FILTER (WHERE active_days >= 1) as day1_retention,
    count(*) FILTER (WHERE active_days >= 7) as day7_retention,
    count(*) FILTER (WHERE active_days >= 30) as day30_retention
FROM retention
GROUP BY cohort_date;
```

##### 4.3 ADS层设计原则

**原则1：面向应用**
```yaml
每个应用一个表：
  - 一个报表 → 一个ADS表
  - 一个仪表板 → 多个ADS表
  
字段名称友好：
  - 使用业务语言
  - 便于理解
```

**原则2：结果数据**
```yaml
数据已经计算好：
  - 不需要再聚合
  - 不需要再JOIN
  - 直接查询即可
```

**原则3：定期刷新**
```sql
-- 每天刷新报表数据
REFRESH MATERIALIZED VIEW ads_monthly_gmv_report;
```

#### 五、数据流转示例

##### 5.1 完整流程

**场景**：从订单到GMV报表

**ODS层**：
```sql
-- 原始订单数据
CREATE TABLE ods_orders AS
SELECT * FROM source_orders;
```

**DWD层**：
```sql
-- 清洗后的订单事实表
CREATE TABLE dwd_fact_orders AS
SELECT
    order_id,
    to_date(created_at) as order_date,
    user_id,
    product_id,
    amount
FROM ods_orders
WHERE status = 'completed';
```

**DWS层**：
```sql
-- 每日GMV汇总
CREATE TABLE dws_daily_gmv AS
SELECT
    order_date,
    sum(amount) as gmv,
    count(*) as order_count
FROM dwd_fact_orders
GROUP BY order_date;
```

**ADS层**：
```sql
-- 月度GMV报表
CREATE TABLE ads_monthly_gmv_report AS
SELECT
    date_part('year', order_date) as year,
    date_part('month', order_date) as month,
    sum(gmv) as gmv
FROM dws_daily_gmv
GROUP BY date_part('year', order_date), date_part('month', order_date);
```

##### 5.2 查询性能对比

**查询：2026年1月的GMV**

**不使用DWS层**：
```sql
-- 直接查询DWD层
SELECT sum(amount) as gmv
FROM dwd_fact_orders
WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01';
-- 扫描：3000万行
-- 执行时间：10秒
```

**使用DWS层**：
```sql
-- 查询DWS层
SELECT sum(gmv) as gmv
FROM dws_daily_gmv
WHERE order_date >= '2026-01-01' AND order_date < '2026-02-01';
-- 扫描：31行
-- 执行时间：100ms
```

**性能提升**：100倍

#### 六、常见误区

**误区一：ODS层可以省略**

- **说明**：ODS层有重要价值，不应该省略
- **后果**：无法回溯数据
- **正确理解**：
  - ODS层：数据备份
  - 出问题时可以重新加载
  - 建议保留

**误区二：DWD层可以做所有事情**

- **说明**：DWD层只负责清洗，不应该做汇总
- **后果**：职责混乱
- **正确理解**：
  - DWD层：数据清洗
  - DWS层：数据汇总
  - ADS层：应用数据

**误区三：DWS层汇总越细越好**

- **说明**：DWS层应该根据需求汇总，不是越细越好
- **后果**：存储浪费
- **正确理解**：
  - 根据查询频率决定
  - 高频查询：汇总
  - 低频查询：不汇总

**误区四：ADS层可以替代DWS层**

- **说明**：ADS层是应用数据，DWS层是公共汇总，不能替代
- **后果**：复用性差
- **正确理解**：
  - DWS层：公共汇总
  - ADS层：特定应用
  - 各司其职

**误区五：分层越多性能越好**

- **说明**：分层不直接提升性能，预计算才能提升性能
- **后果**：期望过高
- **正确理解**：
  - 分层主要是降低复杂度
  - 预计算才能提升性能
  - 合理设计DWS层

#### 七、实战任务

**任务1：设计ODS层**

设计订单表的ODS层：

```sql
-- ODS层：原始订单数据
CREATE TABLE ods_orders (
    -- 与源系统保持一致
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    product_id BIGINT,
    order_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    
    -- 同步时间
    etl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    etl_source VARCHAR(100) DEFAULT 'order_system'
) PARTITION BY RANGE (etl_time);

-- 创建分区
CREATE TABLE ods_orders_20260101 PARTITION OF ods_orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-01-02');
```

**任务2：设计DWD层**

设计订单事实表的DWD层：

```sql
-- DWD层：清洗后的订单事实表
CREATE TABLE dwd_fact_orders (
    -- 维度外键
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    
    -- 度量
    order_amount NUMERIC(10,2),
    order_quantity INT,
    order_profit NUMERIC(10,2),
    
    -- 技术字段
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 数据清洗
INSERT INTO dwd_fact_orders
SELECT
    order_id,
    d.date_id,
    o.user_id,
    o.product_id,
    o.order_amount,
    o.order_quantity,
    o.order_amount * 0.2 as order_profit,  -- 计算利润（假设利润率20%）
    o.created_at,
    o.updated_at
FROM ods_orders o
JOIN dim_date d ON to_date(o.created_at) = d.date_value
WHERE o.order_status = 'completed'  -- 过滤未完成订单
  AND o.order_amount > 0;           -- 过滤无效金额
```

**任务3：设计DWS层**

设计每日GMV汇总的DWS层：

```sql
-- DWS层：每日GMV汇总
CREATE TABLE dws_daily_gmv (
    date_id INT PRIMARY KEY,
    gmv NUMERIC(20,2),
    order_count BIGINT,
    user_count BIGINT,
    avg_order_value NUMERIC(10,2),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 每天更新
INSERT INTO dws_daily_gmv
SELECT
    d.date_id,
    sum(f.order_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT f.user_id) as user_count,
    avg(f.order_amount) as avg_order_value,
    CURRENT_TIMESTAMP as updated_at
FROM dwd_fact_orders f
WHERE f.created_at >= CURRENT_DATE
GROUP BY d.date_id
ON CONFLICT (date_id) DO UPDATE SET
    gmv = EXCLUDED.gmv,
    order_count = EXCLUDED.order_count,
    user_count = EXCLUDED.user_count,
    avg_order_value = EXCLUDED.avg_order_value,
    updated_at = EXCLUDED.updated_at;
```

#### 八、小结

常见分层模型详细介绍了ODS、DWD、DWS、ADS四层的职责、设计和配合。

核心要点：
- ODS层：原始数据副本，结构与源系统一致
- DWD层：数据清洗、数据统一、数据关联
- DWS层：数据汇总、数据聚合、预计算
- ADS层：面向应用、结果数据、业务逻辑
- 数据流转：源→ODS→DWD→DWS→ADS→应用
- 查询性能：使用DWS层后，性能提升100倍

下一节将进入分层的实施策略，了解如何实施分层架构。
