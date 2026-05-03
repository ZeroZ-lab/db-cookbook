### 5.9 维度表设计

上一节学习了事实表设计，了解了事实表的类型、设计原则和设计步骤。

现在学习维度表的设计。

**场景**：
```yaml
数据仓库DWD层设计：
  
你："事实表设计好了，现在设计维度表"
  
数据分析师："我需要按日期、用户、商品、渠道分析"
  
你："好的，我们需要设计对应的维度表"
  
新同事："维度表应该包含哪些字段？"
```

**问题**：
- 维度表有哪些类型？
- 如何设计不同类型的维度表？
- 设计维度表需要注意什么？

**答案**：**维度表存储描述信息，提供分析的视角，应该简洁、完整、易理解**

#### 一、维度表的类型

##### 1.1 时间维度

**定义**：描述时间相关的信息

**特点**：
```yaml
层级结构：
  - 年 → 季度 → 月 → 日
  
属性丰富：
  - 日期值
  - 星期几
  - 是否节假日
  - 是否工作日
```

**示例**：
```sql
-- 时间维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,  -- 格式：20260101
    date_value DATE,          -- 日期值：2026-01-01
    year INT,                 -- 年：2026
    quarter INT,              -- 季度：1
    month INT,                -- 月：1
    day INT,                  -- 日：1
    day_of_week INT,          -- 星期几：1-7
    day_name VARCHAR(10),      -- 星期名称：Monday
    is_holiday BOOLEAN,       -- 是否节假日
    is_weekend BOOLEAN,       -- 是否周末
    week_of_year INT,         -- 年第几周：1-52
    day_of_year INT           -- 年第几天：1-365
);

-- 预填充数据
INSERT INTO dim_date VALUES
    (20260101, '2026-01-01', 2026, 1, 1, 1, 5, 'Friday', false, false, 1, 1),
    (20260102, '2026-01-02', 2026, 1, 2, 2, 6, 'Saturday', false, true, 1, 2),
    (20260103, '2026-01-03', 2026, 1, 3, 3, 7, 'Sunday', false, true, 1, 3);
```

##### 1.2 地理维度

**定义**：描述地理位置相关的信息

**特点**：
```yaml
层级结构：
  - 国家 → 省/州 → 城市
  
详细程度：
  - 根据需求确定
  - 例如：只到城市级
```

**示例**：
```sql
-- 地理维度表
CREATE TABLE dim_geography (
    geo_id INT PRIMARY KEY,
    country VARCHAR(50),       -- 国家：China
    province VARCHAR(50),      -- 省份：Beijing
    city VARCHAR(50),          -- 城市：Beijing
    district VARCHAR(50),      -- 区：Chaoyang
    continent VARCHAR(50),     -- 大洲：Asia
    region VARCHAR(50)          -- 地区：North
);

-- 层级关系
-- country → province → city → district
```

##### 1.3 产品维度

**定义**：描述产品相关的信息

**特点**：
```yaml
层级结构：
  - 一级分类 → 二级分类 → 三级分类
  
属性丰富：
  - 产品名称
  - 产品类别
  - 产品品牌
```

**示例**：
```sql
-- 产品维度表
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(200),   -- 产品名称
    product_category_l1 VARCHAR(50),   -- 一级分类：电子产品
    product_category_l2 VARCHAR(50),   -- 二级分类：手机
    product_category_l3 VARCHAR(50),   -- 三级分类：iPhone
    product_brand VARCHAR(100),  -- 产品品牌：Apple
    product_price NUMERIC(10,2),    -- 产品价格
    product_cost NUMERIC(10,2),     -- 产品成本
    product_status VARCHAR(50),     -- 产品状态：active, inactive
    launch_date DATE             -- 上市日期
);
```

##### 1.4 用户维度

**定义**：描述用户相关的信息

**特点**：
```yaml
属性丰富：
  - 基本信息
  - 人口统计学信息
  - 行为特征
```

**示例**：
```sql
-- 用户维度表
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),     -- 用户姓名
    user_gender VARCHAR(10),    -- 用户性别：M/F
    user_age INT,              -- 用户年龄
    user_city VARCHAR(100),    -- 用户城市
    user_province VARCHAR(100), -- 用户省份
    user_segment VARCHAR(50),   -- 用户分群：高价值、中等、低价值
    register_date DATE,        -- 注册日期
    user_level VARCHAR(50),     -- 用户等级：bronze, silver, gold
    is_active BOOLEAN,         -- 是否活跃
    last_order_date DATE       -- 最后下单日期
);
```

#### 二、维度表设计原则

##### 2.1 原则1：维度表保持简洁

**定义**：维度表应该只包含必要的描述信息

**示例**：
```sql
-- 好的维度表：简洁
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),
    user_city VARCHAR(100),
    user_segment VARCHAR(50)
);

-- 不好的维度表：包含太多字段
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),
    user_email VARCHAR(255),
    user_phone VARCHAR(20),
    user_address TEXT,
    user_city VARCHAR(100),
    user_province VARCHAR(100),
    user_id_card VARCHAR(18),
    -- ... 太多字段
);
```

**原因**：
```yaml
字段太多：
  - 表太大
  - 加载慢
  
使用频率：
  - 很多字段在分析中不使用
  - 只保留必要字段
```

##### 2.2 原则2：维度表保持稳定

**定义**：维度表应该相对稳定，不频繁变化

**示例**：
```sql
-- 好的维度表：稳定
-- 产品名称、类别很少变化

-- 不好的维度表：频繁变化
-- 用户级别可能每天变化
-- 更新策略：每天或每周更新
```

**更新策略**：
```yaml
缓慢变化维度（SCD）：
  - 类型1：覆盖更新（Type 1）
  - 类型2：保留历史（Type 2）
  - 类型3：完整历史（Type 3）
```

##### 2.3 原则3：维度表可以有层级

**定义**：维度表可以有层级关系

**示例**：
```sql
-- 层级维度表：产品类别
CREATE TABLE dim_category (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100),
    category_level INT,         -- 层级：1,2,3
    parent_category_id INT       -- 父级类别ID
);

-- 数据示例
INSERT INTO dim_category VALUES
    (1, '电子产品', 1, NULL),           -- 一级分类
    (11, '手机', 2, 1),                 -- 二级分类
    (111, 'iPhone', 3, 11);              -- 三级分类

-- 查询：从顶级到子级
SELECT 
    category_id,
    category_name,
    category_level
FROM dim_category
ORDER BY category_id;
```

##### 2.4 原则4：维度表可以适度冗余

**定义**：维度表可以适度冗余，提升查询性能

**示例**：
```sql
-- 冗余维度表：包含派生字段
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_city VARCHAR(100),
    user_province VARCHAR(100),   -- 冗余（可以从city推导）
    user_region VARCHAR(50)       -- 冗余（可以从province推导）
);

-- 好处：
-- 1. 查询时不需要JOIN
-- 2. 不需要计算派生字段
-- 3. 查询更快
```

**权衡**：
```yaml
优势：
  - 查询性能好
  
劣势：
  - 数据冗余
  - 维护成本高（更新时需要同步）
  
建议：
  - 根据查询频率决定是否冗余
  - 高频查询：冗余
  - 低频查询：不冗余
```

#### 三、缓慢变化维度（SCD）

##### 3.1 SCD定义

**定义**：维度数据会缓慢变化，需要处理变化

**场景**：
```yaml
用户级别变化：
  - 用户从"青铜"升级到"白银"
  - 用户从"白银"升级到"黄金"
  
产品价格变化：
  - 产品价格调整
  - 产品成本调整
```

##### 3.2 SCD类型

**类型1：Type 1 - 覆盖更新**

**定义**：直接覆盖旧值，不保留历史

**示例**：
```sql
-- 原始数据
user_id | user_level
--------|------------
1       | bronze

-- 变化后：直接覆盖
UPDATE dim_users SET user_level = 'silver' WHERE user_id = 1;

-- 结果：
user_id | user_level
--------|------------
1       | silver

-- 特点：
-- - 简单
-- - 不保留历史
-- - 适用于不需要历史的场景
```

**类型2：Type 2 - 保留历史**

**定义**：添加新版本，保留历史版本

**示例**：
```sql
-- 添加版本号和生效时间字段
ALTER TABLE dim_users ADD COLUMN version INT;
ALTER TABLE dim_users ADD COLUMN effective_date DATE;
ALTER TABLE dim_users ADD COLUMN expiry_date DATE;

-- 原始数据
user_id | user_level | version | effective_date | expiry_date
--------|-----------|---------|----------------|------------
1       | bronze    | 1       | 2026-01-01    | NULL

-- 变化后：添加新版本
INSERT INTO dim_users (user_id, user_level, version, effective_date, expiry_date)
VALUES (1, 'silver', 2, '2026-01-15', NULL);

-- 更新旧版本的过期时间
UPDATE dim_users SET expiry_date = '2026-01-14'
WHERE user_id = 1 AND version = 1;

-- 结果：
user_id | user_level | version | effective_date | expiry_date
--------|-----------|---------|----------------|------------
1       | bronze    | 1       | 2026-01-01    | 2026-01-14
1       | silver    | 2       | 2026-01-15    | NULL

-- 特点：
-- - 保留历史
-- - 可以查询某个时间点的状态
-- - 需要添加版本控制字段
```

**类型3：Type 3 - 完整历史**

**定义**：每次变化都记录，形成完整历史

**示例**：
```sql
-- 创建历史表
CREATE TABLE dim_users_history (
    history_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    user_level VARCHAR(50),
    effective_date DATE,
    record_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 记录每次变化
INSERT INTO dim_users_history (user_id, user_level, effective_date)
VALUES
    (1, 'bronze', '2026-01-01'),
    (1, 'silver', '2026-01-15'),
    (1, 'gold', '2026-02-01');

-- 查询历史
SELECT *
FROM dim_users_history
WHERE user_id = 1
ORDER BY effective_date;

-- 特点：
-- - 完整历史
-- - 可以分析变化趋势
-- - 数据量大
```

##### 3.3 SCD实现

**策略1：Type 2实现**

**步骤**：
```sql
-- 1. 创建维度表（带版本控制）
CREATE TABLE dim_users (
    user_id BIGINT,
    user_level VARCHAR(50),
    version INT,
    effective_date DATE,
    expiry_date DATE,
    is_current BOOLEAN
);

-- 2. 更新时：添加新版本
INSERT INTO dim_users (user_id, user_level, version, effective_date, is_current)
VALUES (1, 'silver', 2, CURRENT_DATE, true);

-- 3. 更新旧版本
UPDATE dim_users 
SET expiry_date = CURRENT_DATE - INTERVAL '1 day',
    is_current = false
WHERE user_id = 1 
  AND version = 1
  AND is_current = true;
```

#### 四、维度表设计步骤

##### 4.1 步骤1：确定维度

**目标**：明确需要哪些维度

**示例**：
```yaml
订单分析的维度：
  - 时间维度（什么时候）
  - 用户维度（谁）
  - 产品维度（什么产品）
  - 渠道维度（通过什么渠道）
```

##### 4.2 步骤2：确定维度属性

**目标**：明确每个维度包含哪些属性

**示例**：
```yaml
时间维度属性：
  - date_id
  - date_value
  - year, quarter, month, day
  - day_of_week, day_name
  - is_holiday, is_weekend
  
用户维度属性：
  - user_id
  - user_name
  - user_city
  - user_segment
  - register_date
```

##### 4.3 步骤3：确定层级关系

**目标**：明确维度是否有层级

**示例**：
```yaml
产品维度层级：
  - 一级分类（电子产品）
  - 二级分类（手机）
  - 三级分类（iPhone）
  
地理维度层级：
  - 国家（China）
  - 省份（Beijing）
  - 城市（Beijing）
```

##### 4.4 步骤4：确定更新策略

**目标**：明确维度如何更新

**示例**：
```yaml
用户维度更新：
  - 用户级别变化：使用Type 2（保留历史）
  - 用户城市变化：使用Type 1（覆盖更新）
  
产品维度更新：
  - 产品价格调整：使用Type 1（覆盖更新）
  - 新产品上市：插入新记录
```

#### 五、维度表设计示例

##### 5.1 示例1：时间维度

**设计**：
```sql
-- 时间维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    quarter INT,
    month INT,
    day INT,
    day_of_week INT,
    day_name VARCHAR(10),
    is_holiday BOOLEAN,
    is_weekend BOOLEAN,
    week_of_year INT,
    day_of_year INT
);

-- 预填充数据
INSERT INTO dim_date
SELECT
    (EXTRACT(YEAR FROM d)::INT * 10000 +
     EXTRACT(MONTH FROM d)::INT * 100 +
     EXTRACT(DAY FROM d)::INT) as date_id,
    d as date_value,
    EXTRACT(YEAR FROM d)::INT as year,
    EXTRACT(QUARTER FROM d)::INT as quarter,
    EXTRACT(MONTH FROM d)::INT as month,
    EXTRACT(DAY FROM d)::INT as day,
    EXTRACT(DOW FROM d) as day_of_week,
    TO_CHAR(d, 'Day') as day_name,
    is_holiday(d) as is_holiday,
    EXTRACT(DOW FROM d) IN (6, 7) as is_weekend,
    EXTRACT(WEEK FROM d) as week_of_year,
    EXTRACT(DOY FROM d) as day_of_year
FROM (
    SELECT CURRENT_DATE - INTERVAL '30 days' + i * INTERVAL '1 day' as d
    FROM generate_series(0, 29) i
) t;
```

##### 5.2 示例2：用户维度

**设计**：
```sql
-- 用户维度表（使用Type 2 SCD）
CREATE TABLE dim_users (
    user_id BIGINT,
    user_name VARCHAR(100),
    user_city VARCHAR(100),
    user_province VARCHAR(100),
    user_segment VARCHAR(50),
    version INT,
    effective_date DATE,
    expiry_date DATE,
    is_current BOOLEAN
);

-- 插入初始数据
INSERT INTO dim_users 
VALUES
    (1, '张三', '北京', '北京', '高价值', 1, '2026-01-01', NULL, true);

-- 更新用户分群（Type 2）
INSERT INTO dim_users (user_id, user_name, user_city, user_province, user_segment, version, effective_date, is_current)
VALUES (1, '张三', '北京', '北京', '中价值', 2, '2026-01-15', true);

UPDATE dim_users 
SET expiry_date = '2026-01-14', is_current = false
WHERE user_id = 1 AND version = 1;
```

##### 5.3 示例3：产品维度

**设计**：
```sql
-- 产品维度表（带层级）
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(200),
    category_id INT,
    product_brand VARCHAR(100),
    product_price NUMERIC(10,2),
    product_status VARCHAR(50)
);

-- 产品类别层级表
CREATE TABLE dim_category (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100),
    category_level INT,
    parent_category_id INT
);

-- 填充类别数据
INSERT INTO dim_category VALUES
    (1, '电子产品', 1, NULL),           -- 一级
    (11, '手机', 2, 1),                 -- 二级
    (111, 'iPhone', 3, 11),              -- 三级
    (112, 'Samsung', 3, 11);             -- 三级

-- 填充产品数据
INSERT INTO dim_products 
SELECT
    111 as product_id,
    'iPhone 15 Pro' as product_name,
    111 as category_id,
    'Apple' as product_brand,
    7999.00 as product_price,
    'active' as product_status;
```

#### 六、常见误区

**误区一：维度表越大越好**

- **说明**：维度表应该只包含必要的属性
- **后果**：表太大，加载慢
- **正确理解**：
  - 只包含分析需要的属性
  - 避免过度冗余
  - 保持简洁

**误区二：维度表必须规范化**

- **说明**：维度表可以适度冗余，提升查询性能
- **后果**：查询性能差
- **正确理解**：
  - 可以适度冗余
  - 根据查询频率决定
  - 权衡性能和维护成本

**误区三：维度表不需要更新**

- **说明**：维度表需要更新，但更新频率低
- **后果**：数据过时
- **正确理解**：
  - 维度表需要更新
  - 更新频率低（每天或每周）
  - 需要考虑SCD

**误区四：所有维度都需要SCD**

- **说明**：只有缓慢变化的维度需要SCD
- **后果**：过度设计
- **正确理解**：
  - 根据变化频率选择
  - 频繁变化：Type 1（覆盖）
  - 缓慢变化：Type 2（保留历史）

**误区五：维度表不能有计算字段**

- **说明**：维度表可以有计算字段，提升查询性能
- **后果**：查询复杂
- **正确理解**：
  - 可以添加派生字段
  - 例如：从city推导province
  - 但要注意维护成本

#### 七、实战任务

**任务1：设计时间维度表**

设计一个时间维度表：

```sql
-- 时间维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    quarter INT,
    month INT,
    day INT,
    day_of_week INT,
    day_name VARCHAR(10),
    is_holiday BOOLEAN DEFAULT false,
    is_weekend BOOLEAN DEFAULT false,
    week_of_year INT,
    day_of_year INT
);

-- 预填充数据
INSERT INTO dim_date
SELECT
    (EXTRACT(YEAR FROM d)::INT * 10000 +
     EXTRACT(MONTH FROM d)::INT * 100 +
     EXTRACT(DAY FROM d)::INT) as date_id,
    d as date_value,
    EXTRACT(YEAR FROM d)::INT as year,
    EXTRACT(QUARTER FROM d)::INT as quarter,
    EXTRACT(MONTH FROM d)::INT as month,
    EXTRACT(DAY FROM d)::INT as day,
    EXTRACT(DOW FROM d) as day_of_week,
    TO_CHAR(d, 'Day') as day_name,
    false as is_holiday,
    EXTRACT(DOW FROM d) IN (6, 7) as is_weekend,
    EXTRACT(WEEK FROM d) as week_of_year,
    EXTRACT(DOY FROM d) as day_of_year
FROM (
    SELECT CURRENT_DATE - INTERVAL '365 days' + i * INTERVAL '1 day' as d
    FROM generate_series(0, 364) i
) t;
```

**任务2：实现SCD Type 2**

实现用户维度的SCD Type 2：

```sql
-- 用户维度表（Type 2）
CREATE TABLE dim_users (
    user_id BIGINT,
    user_name VARCHAR(100),
    user_segment VARCHAR(50),
    version INT,
    effective_date DATE,
    expiry_date DATE,
    is_current BOOLEAN
);

-- 初始数据
INSERT INTO dim_users VALUES
    (1, '张三', '青铜', 1, '2026-01-01', NULL, true);

-- 更新用户分群（Type 2）
INSERT INTO dim_users (user_id, user_name, user_segment, version, effective_date, is_current)
VALUES (1, '张三', '白银', 2, '2026-01-15', true);

UPDATE dim_users 
SET expiry_date = '2026-01-14', is_current = false
WHERE user_id = 1 AND version = 1;

-- 验证
SELECT * FROM dim_users WHERE user_id = 1 ORDER BY version;
```

**任务3：设计产品维度层级**

设计产品维度的层级：

```sql
-- 产品维度表
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(200),
    category_id INT,
    product_brand VARCHAR(100),
    product_price NUMERIC(10,2)
);

-- 产品类别层级表
CREATE TABLE dim_category (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100),
    category_level INT,
    parent_category_id INT
);

-- 填充层级数据
INSERT INTO dim_category VALUES
    (1, '电子产品', 1, NULL),           -- 一级分类
    (11, '手机', 2, 1),                 -- 二级分类
    (12, '电脑', 2, 1),                 -- 二级分类
    (111, 'iPhone', 3, 11),              -- 三级分类
    (112, 'Samsung Galaxy', 3, 11),   -- 三级分类
    (121, 'MacBook', 3, 12),            -- 三级分类
    (122, 'ThinkPad', 3, 12);           -- 三级分类

-- 填充产品数据
INSERT INTO dim_products 
SELECT
    111 as product_id,
    'iPhone 15 Pro' as product_name,
    111 as category_id,
    'Apple' as product_brand,
    7999.00 as product_price
UNION ALL
SELECT
    121 as product_id,
    'MacBook Pro' as product_name,
    121 as category_id,
    'Apple' as product_brand,
    12999.00 as product_price;

-- 查询：按层级查询
SELECT
    c1.category_name as l1_category,
    c2.category_name as l2_category,
    p.product_name
FROM dim_products p
JOIN dim_category c2 ON p.category_id = c2.category_id
JOIN dim_category c1 ON c2.parent_category_id = c1.category_id;
```

#### 八、小结

维度表设计存储描述信息，提供分析的视角，应该简洁、完整、易理解。

核心要点：
- 维度表类型：时间维度、地理维度、产品维度、用户维度
- 设计原则：保持简洁、保持稳定、可以有层级、可以适度冗余
- SCD类型：Type 1（覆盖）、Type 2（保留历史）、Type 3（完整历史）
- 设计步骤：确定维度 → 确定属性 → 确定层级 → 确定更新策略
- 设计示例：时间维度、用户维度（SCD）、产品维度（层级）
- 常见误区：不是越大越好、可以适度冗余、需要更新

下一节将进入常见建模模式，了解常见的建模模式及其应用场景。
