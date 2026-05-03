### 6.3 数据转换

上一节学习了数据抽取，了解了全量抽取、增量抽取、CDC等方法。

数据抽取到ODS层后，需要进行数据转换（Transform），生成DWD层和DWS层的数据。

**场景**：
```yaml
数据仓库项目：
  
数据分析师："ODS层的数据太脏了，有很多无效数据"
  
数据工程师："我来清洗和转换数据"
  
新同事："什么是数据转换？需要做哪些转换？"
```

**问题**：
- 什么是数据转换？
- 数据转换包含哪些操作？
- 如何设计数据转换流程？
- 如何保证数据质量？

**答案**：**数据转换是对抽取的数据进行清洗、格式化、关联、聚合等操作，生成高质量的数据**

#### 一、为什么需要数据转换

**第一，源数据质量不高**

```yaml
问题1：数据不完整
  示例：user_id为空、order_amount为NULL
  影响：无法分析
  
问题2：数据不准确
  示例：order_amount为负数、日期格式错误
  影响：分析结果错误
  
问题3：数据不一致
  示例：status字段有'completed'和'complete'两种值
  影响：聚合错误
```

**第二，源数据不适合直接分析**

```yaml
问题1：数据分散
  示例：订单表只有user_id，没有用户城市
  解决：关联用户维度表
  
问题2：粒度不符合
  示例：源表是明细数据，需要每日汇总
  解决：聚合计算
  
问题3：格式不统一
  示例：日期格式有'2026-01-01'和'01/01/2026'
  解决：统一格式
```

**第三，业务规则需要应用**

```yaml
规则1：数据过滤
  示例：只分析已完成订单
  转换：过滤order_status='completed'
  
规则2：数据计算
  示例：GMV = 订单金额 - 退款金额
  转换：计算GMV
  
规则3：数据分类
  示例：用户分群（VIP、普通）
  转换：根据订单金额分类
```

#### 二、数据转换的类型

##### 2.1 数据清洗（Data Cleaning）

**定义**：过滤或修正无效数据

**示例1：过滤空值**
```sql
-- 过滤user_id为空的订单
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE user_id IS NOT NULL;  -- 清洗：过滤user_id为空的记录
```

**示例2：过滤异常值**
```sql
-- 过滤order_amount为负数的订单
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE order_amount > 0;  -- 清洗：过滤订单金额为负数的记录
```

**示例3：修正格式**
```sql
-- 修正日期格式
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    TO_DATE(created_at_text, 'YYYY-MM-DD') as created_at  -- 清洗：修正日期格式
FROM ods_orders;
```

**示例4：去重**
```sql
-- 去除重复订单
CREATE TABLE dwd_fact_orders AS
SELECT DISTINCT
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders;
```

##### 2.2 数据格式化（Data Formatting）

**定义**：统一数据格式

**示例1：日期格式化**
```sql
-- 统一日期格式为date_id（整数）
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    created_at,
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,  -- 格式化：2026-01-01 → 20260101
    EXTRACT(YEAR FROM created_at) as order_year,
    EXTRACT(MONTH FROM created_at) as order_month,
    EXTRACT(DAY FROM created_at) as order_day
FROM ods_orders;
```

**示例2：金额格式化**
```sql
-- 统一金额精度（保留2位小数）
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    ROUND(order_amount, 2) as order_amount,  -- 格式化：保留2位小数
    ROUND(discount_amount, 2) as discount_amount
FROM ods_orders;
```

**示例3：文本格式化**
```sql
-- 统一文本格式（大写、小写、去空格）
CREATE TABLE dim_users AS
SELECT 
    user_id,
    TRIM(name) as name,                              -- 格式化：去空格
    LOWER(email) as email,                           -- 格式化：转小写
    UPPER(city) as city                              -- 格式化：转大写
FROM ods_users;
```

**示例4：布尔值格式化**
```sql
-- 统一布尔值格式
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    order_amount,
    CASE 
        WHEN is_vip = 'true' THEN TRUE
        WHEN is_vip = '1' THEN TRUE
        WHEN is_vip = 'yes' THEN TRUE
        ELSE FALSE
    END as is_vip  -- 格式化：统一布尔值
FROM ods_orders;
```

##### 2.3 数据关联（Data Joining）

**定义**：关联多个表，丰富数据维度

**示例1：关联维度表**
```sql
-- 关联用户维度表
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.date_id,
    o.user_id,
    o.order_amount,
    u.city,              -- 关联：获取用户城市
    u.province,          -- 关联：获取用户省份
    u.segment            -- 关联：获取用户分群
FROM ods_orders o
JOIN dim_users u ON o.user_id = u.user_id;  -- 关联用户维度表
```

**示例2：关联多个维度表**
```sql
-- 关联多个维度表
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.date_id,
    o.user_id,
    o.product_id,
    o.order_amount,
    u.city,              -- 用户维度
    p.category,          -- 商品维度
    c.channel_name       -- 渠道维度
FROM ods_orders o
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_channels c ON o.channel_id = c.channel_id;
```

**示例3：关联层级维度**
```sql
-- 关联商品分类层级
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.product_id,
    p.product_name,
    c1.category_name as category_l1,  -- 一级分类
    c2.category_name as category_l2,  -- 二级分类
    c3.category_name as category_l3   -- 三级分类
FROM ods_orders o
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_categories c3 ON p.category_id = c3.category_id
JOIN dim_categories c2 ON c3.parent_id = c2.category_id
JOIN dim_categories c1 ON c2.parent_id = c1.category_id;
```

##### 2.4 数据聚合（Data Aggregation）

**定义**：对明细数据进行汇总

**示例1：按日期聚合**
```sql
-- 每日GMV汇总（DWS层）
CREATE TABLE dws_daily_gmv AS
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    AVG(order_amount) as avg_order_amount
FROM dwd_fact_orders
GROUP BY date_id;
```

**示例2：按多维度聚合**
```sql
-- 每日GMV汇总（按城市）
CREATE TABLE dws_daily_gmv_by_city AS
SELECT 
    date_id,
    city,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM dwd_fact_orders
GROUP BY date_id, city;
```

**示例3：滚动聚合**
```sql
-- 7日滚动GMV
CREATE TABLE dws_7day_gmv AS
SELECT 
    date_id,
    SUM(order_amount) OVER (
        ORDER BY date_id
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as gmv_7day
FROM dwd_daily_gmv;
```

**示例4：累计聚合**
```sql
-- 累计GMV
CREATE TABLE dws_cumulative_gmv AS
SELECT 
    date_id,
    gmv,
    SUM(gmv) OVER (
        ORDER BY date_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_gmv
FROM dws_daily_gmv;
```

##### 2.5 数据计算（Data Calculation）

**定义**：基于现有字段计算新字段

**示例1：计算派生字段**
```sql
-- 计算客单价
CREATE TABLE dws_daily_metrics AS
SELECT 
    date_id,
    gmv,
    order_count,
    gmv / order_count as avg_order_amount  -- 计算：客单价 = GMV / 订单数
FROM dws_daily_gmv;
```

**示例2：计算比率**
```sql
-- 计算转化率
CREATE TABLE dws_daily_conversion AS
SELECT 
    date_id,
    visitor_count,
    conversion_user_count,
    conversion_user_count * 100.0 / visitor_count as conversion_rate  -- 计算：转化率
FROM dws_daily_traffic;
```

**示例3：计算时间间隔**
```sql
-- 计算订单到发货的天数
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    created_at,
    shipped_at,
    DATE_PART('day', shipped_at - created_at) as days_to_ship  -- 计算：发货天数
FROM ods_orders;
```

**示例4：计算条件字段**
```sql
-- 计算用户分群
CREATE TABLE dim_users AS
SELECT 
    user_id,
    total_order_amount,
    CASE 
        WHEN total_order_amount >= 10000 THEN 'VIP'
        WHEN total_order_amount >= 1000 THEN '高价值'
        WHEN total_order_amount >= 100 THEN '普通'
        ELSE '低价值'
    END as user_segment  -- 计算：用户分群
FROM ods_users;
```

#### 三、数据转换的分层设计

##### 3.1 ODS层 → DWD层

**转换内容**：
```yaml
数据清洗：
  - 过滤无效数据
  - 修正数据格式
  - 去除重复数据
  
数据关联：
  - 关联维度表
  - 获取维度属性
  
数据格式化：
  - 统一日期格式
  - 统一金额精度
  - 统一文本格式
```

**示例**：
```sql
-- ODS层 → DWD层
CREATE TABLE dwd_fact_orders AS
SELECT 
    -- 主键
    o.order_id,
    
    -- 维度外键
    TO_CHAR(o.created_at, 'YYYYMMDD')::INT as date_id,
    o.user_id,
    o.product_id,
    o.channel_id,
    
    -- 关联维度表
    u.city,
    u.province,
    u.segment as user_segment,
    p.category,
    p.brand,
    c.channel_name,
    
    -- 度量
    o.order_amount,
    o.order_quantity,
    o.order_profit,
    o.discount_amount,
    
    -- 技术字段
    o.created_at,
    o.updated_at
FROM ods_orders o
-- 关联维度表
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
LEFT JOIN dim_channels c ON o.channel_id = c.channel_id
-- 数据清洗
WHERE o.order_amount > 0
  AND o.user_id IS NOT NULL
  AND o.order_status = 'completed';
```

##### 3.2 DWD层 → DWS层

**转换内容**：
```yaml
数据聚合：
  - 按日期聚合
  - 按维度聚合
  - 滚动聚合
  - 累计聚合
  
数据计算：
  - 计算派生指标
  - 计算比率
  - 计算排名
```

**示例**：
```sql
-- DWD层 → DWS层（每日汇总）
CREATE TABLE dws_daily_gmv AS
SELECT 
    -- 维度
    date_id,
    city,
    category,
    
    -- 度量
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    SUM(order_quantity) as total_quantity,
    AVG(order_amount) as avg_order_amount,
    MAX(order_amount) as max_order_amount,
    MIN(order_amount) as min_order_amount
FROM dwd_fact_orders
GROUP BY date_id, city, category;
```

##### 3.3 DWS层 → ADS层

**转换内容**：
```yaml
数据聚合：
  - 按月聚合
  - 按季度聚合
  - 按年聚合
  
复杂计算：
  - 同比计算
  - 环比计算
  - 排名计算
```

**示例**：
```sql
-- DWS层 → ADS层（月度报表）
CREATE TABLE ads_monthly_report AS
SELECT 
    -- 维度
    TO_CHAR(TO_DATE(date_id::TEXT, 'YYYYMMDD'), 'YYYY-MM') as month,
    city,
    category,
    
    -- 度量
    SUM(gmv) as monthly_gmv,
    SUM(order_count) as monthly_order_count,
    
    -- 环比
    SUM(gmv) / LAG(SUM(gmv)) OVER (PARTITION BY city, category ORDER BY date_id) - 1 as gvw_mom,
    
    -- 同比
    SUM(gmv) / LAG(SUM(gmv), 12) OVER (PARTITION BY city, category ORDER BY date_id) - 1 as gvw_yoy,
    
    -- 排名
    RANK() OVER (PARTITION BY city ORDER BY SUM(gmv) DESC) as category_rank_in_city
FROM dws_daily_gmv
GROUP BY city, category, date_id;
```

#### 四、数据转换的最佳实践

##### 4.1 幂等性

**定义**：多次执行结果相同

```sql
-- 不好的设计（非幂等）
CREATE TABLE dwd_fact_orders AS
SELECT ... FROM ods_orders;

-- 好的设计（幂等）
CREATE TABLE IF NOT EXISTS dwd_fact_orders AS
SELECT ... FROM ods_orders;

-- 或者使用事务
BEGIN;
DELETE FROM dwd_fact_orders WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders
SELECT ... FROM ods_orders WHERE date_id = 20260101;
COMMIT;
```

##### 4.2 可追溯性

**定义**：记录转换过程

```sql
-- 创建ETL日志表
CREATE TABLE etl_logs (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    operation VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    row_count BIGINT,
    status VARCHAR(50),
    error_message TEXT
);

-- 记录转换日志
INSERT INTO etl_logs (table_name, operation, start_time, status)
VALUES ('dwd_fact_orders', 'transform', NOW(), 'running');

-- 执行转换
...

-- 更新日志
UPDATE etl_logs 
SET end_time = NOW(), 
    row_count = (SELECT count(*) FROM dwd_fact_orders),
    status = 'success'
WHERE table_name = 'dwd_fact_orders' 
  AND operation = 'transform' 
  AND status = 'running';
```

##### 4.3 分区处理

**定义**：按分区处理，提高性能

```sql
-- 按天处理
CREATE TABLE dwd_fact_orders (
    order_id BIGINT,
    date_id INT,
    ...
) PARTITION BY RANGE (date_id);

-- 创建分区
CREATE TABLE dwd_fact_orders_202601 PARTITION OF dwd_fact_orders
    FOR VALUES FROM (20260101) TO (20260201);

-- 处理单天数据
DELETE FROM dwd_fact_orders_202601 WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders_202601
SELECT ... FROM ods_orders WHERE date_id = 20260101;
```

#### 五、常见误区

**误区一：转换逻辑越复杂越好**

- **说明**：转换逻辑要简洁，避免过度复杂
- **后果**：难以维护，性能差
- **正确理解**：
  - 保持转换逻辑简洁
  - 避免过度嵌套
  - 分步实现

**误区二：转换不影响性能**

- **说明**：转换可能很耗时
- **后果**：性能差，影响数据新鲜度
- **正确理解**：
  - 转换可能很耗时
  - 需要优化SQL
  - 使用索引、分区

**误区三：转换不需要测试**

- **说明**：转换逻辑需要测试
- **后果**：数据错误
- **正确理解**：
  - 需要单元测试
  - 需要数据质量检查
  - 需要验证结果

**误区四：转换可以随意修改**

- **说明**：转换逻辑修改会影响下游
- **后果**：下游数据不一致
- **正确理解**：
  - 修改需要评估
  - 需要通知下游
  - 需要版本控制

**误区五：转换一次就完成**

- **说明**：转换需要持续优化
- **后果**：性能退化
- **正确理解**：
  - 定期优化SQL
  - 监控转换性能
  - 持续改进

#### 六、实战任务

**任务1：设计ODS → DWD转换**

```sql
-- 需求：将ODS层的订单表转换为DWD层的事实表

CREATE TABLE dwd_fact_orders AS
SELECT 
    -- 主键
    order_id,
    
    -- 维度外键
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
    EXTRACT(HOUR FROM created_at) as hour_id,
    user_id,
    product_id,
    channel_id,
    
    -- 关联维度表
    u.city,
    u.province,
    u.segment as user_segment,
    p.category,
    p.brand,
    c.channel_name,
    
    -- 度量
    order_amount,
    order_quantity,
    profit,
    discount,
    
    -- 技术字段
    created_at,
    updated_at
FROM ods_orders o
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
LEFT JOIN dim_channels c ON o.channel_id = c.channel_id
-- 数据清洗
WHERE order_amount > 0
  AND user_id IS NOT NULL
  AND order_status = 'completed'
  AND is_refunded = false;
```

**任务2：设计DWD → DWS转换**

```sql
-- 需求：将DWD层的事实表转换为DWS层的每日汇总

CREATE TABLE dws_daily_gmv AS
SELECT 
    -- 维度
    date_id,
    city,
    category,
    
    -- 度量
    COUNT(DISTINCT order_id) as order_count,
    SUM(order_amount) as gmv,
    SUM(order_quantity) as total_quantity,
    AVG(order_amount) as avg_order_amount,
    COUNT(DISTINCT user_id) as user_count
FROM dwd_fact_orders
GROUP BY date_id, city, category;

-- 创建索引
CREATE INDEX idx_dws_daily_gmv_date ON dws_daily_gmv(date_id);
CREATE INDEX idx_dws_daily_gmv_city ON dws_daily_gmv(city);
```

**任务3：设计转换流程**

```sql
-- 第1步：ODS → DWD
BEGIN;
DELETE FROM dwd_fact_orders WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders
SELECT ... FROM ods_orders WHERE date_id = 20260101;
COMMIT;

-- 第2步：DWD → DWS
BEGIN;
DELETE FROM dws_daily_gmv WHERE date_id = 20260101;
INSERT INTO dws_daily_gmv
SELECT ... FROM dwd_fact_orders WHERE date_id = 20260101;
COMMIT;

-- 第3步：记录日志
INSERT INTO etl_logs (table_name, operation, status, row_count)
VALUES 
('dwd_fact_orders', 'transform', 'success', (SELECT count(*) FROM dwd_fact_orders WHERE date_id = 20260101)),
('dws_daily_gmv', 'transform', 'success', (SELECT count(*) FROM dws_daily_gmv WHERE date_id = 20260101));
```

#### 七、小结

数据转换是对抽取的数据进行清洗、格式化、关联、聚合等操作，生成高质量的数据。

核心要点：
- 数据清洗：过滤无效数据、修正格式、去重
- 数据格式化：统一日期、金额、文本格式
- 数据关联：关联维度表，丰富数据维度
- 数据聚合：按维度汇总，生成汇总表
- 数据计算：计算派生字段、比率、排名
- 分层设计：ODS → DWD → DWS → ADS
- 最佳实践：幂等性、可追溯性、分区处理

下一节将学习数据加载，了解如何将转换后的数据加载到目标系统。
