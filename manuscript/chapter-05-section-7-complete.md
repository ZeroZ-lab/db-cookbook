### 5.7 维度建模基础

前面学习了数据仓库的分层架构（ODS、DWD、DWS、ADS）和实施策略。

现在学习维度建模的基础知识。

**场景**：
```yaml
数据仓库DWD层设计：
  
数据分析师："我需要分析GMV、用户留存、转化漏斗..."
  
你："好的，我来设计事实表和维度表"
  
新同事："什么是维度建模？和规范化建模有什么区别？"
```

**问题**：
- 什么是维度建模？
- 维度建模和规范化建模有什么区别？
- 如何设计维度模型？

**答案**：**维度建模是面向分析的数据建模方法，通过事实表和维度表构建星型模型或雪花模型**

#### 一、为什么需要维度建模

**第一，分析需求不同于业务需求**

**业务需求（规范化建模）**：
```yaml
目标：
  - 支撑业务运行
  - 数据一致性
  - 快速响应
  
建模方法：
  - 规范化设计（3NF）
  - 减少数据冗余
  - 消除更新异常
```

**分析需求（维度建模）**：
```yaml
目标：
  - 支撑数据分析
  - 查询性能
  - 灵活分析
  
建模方法：
  - 维度建模（星型模型）
  - 适度冗余
  - 优化查询性能
```

**第二，分析查询模式不同于业务查询模式**

**业务查询**：
```sql
-- 查询单个订单
SELECT * FROM orders WHERE order_id = 123;

-- 查询用户订单
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 10;

-- 特点：
-- - 简单查询
-- - 返回少量数据
-- - 通过索引快速定位
```

**分析查询**：
```sql
-- 查询GMV趋势
SELECT
    date(created_at) as order_date,
    sum(amount) as gmv
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY date(created_at);

-- 查询用户留存
WITH cohort_users AS (...),
     retention AS (...)
SELECT * FROM retention;

-- 特点：
-- - 复杂查询
-- - 扫描大量数据
-- - 聚合计算
```

**第三，分析性能要求不同于业务性能要求**

**业务性能**：
```yaml
响应时间：
  - <100ms
  
并发量：
  - 每秒数千次
  
优化方向：
  - 索引优化
  - 事务优化
  - 减少锁时间
```

**分析性能**：
```yaml
响应时间：
  - 秒级到分钟级可接受
  
并发量：
  - 每小时几次
  
优化方向：
  - 分区优化
  - 物化视图
  - 并行计算
```

#### 二、核心判断：维度建模是"面向分析"的建模方法

> 维度建模的核心判断是：维度建模是面向分析查询的建模方法，通过事实表（存储业务指标）和维度表（存储描述信息）构建星型模型或雪花模型，优化分析查询性能，提升灵活性。

这个判断说明：
- **面向分析**：优化分析查询，不是业务事务
- **事实表**：存储业务指标和度量
- **维度表**：存储描述信息和属性
- **星型模型**：事实表在中心，维度表围绕

#### 三、维度建模 vs 规范化建模

##### 3.1 规范化建模

**定义**：通过规范化减少数据冗余

**示例**：
```sql
-- 规范化设计（3NF）
-- 用户表
CREATE TABLE users (
    user_id INT PRIMARY KEY,
    name VARCHAR(100),
    email VARCHAR(255),
    city VARCHAR(100)
);

-- 商品表
CREATE TABLE products (
    product_id INT PRIMARY KEY,
    name VARCHAR(100),
    price NUMERIC(10,2),
    category VARCHAR(100)
);

-- 订单表
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    user_id INT REFERENCES users(user_id),
    product_id INT REFERENCES products(product_id),
    amount NUMERIC(10,2),
    created_at TIMESTAMP
);
```

**特点**：
```yaml
规范化：
  - 3NF（第三范式）
  - 减少冗余
  
复杂查询：
  - 需要JOIN多个表
  - 分析查询慢
  
数据一致性：
  - 强一致性
  - ACID事务
```

##### 3.2 维度建模

**定义**：通过事实表和维度表构建星型模型

**示例**：
```sql
-- 维度建模（星型模型）
-- 订单事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,           -- 维度外键
    user_id BIGINT,        -- 维度外键
    product_id BIGINT,     -- 维度外键
    amount NUMERIC(10,2),  -- 度量
    quantity INT,          -- 度量
    profit NUMERIC(10,2)   -- 度量
);

-- 日期维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    month INT,
    day INT
);

-- 用户维度表
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    segment VARCHAR(50)
);

-- 商品维度表
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(100),
    price NUMERIC(10,2)
);
```

**特点**：
```yaml
维度建模：
  - 星型模型
  - 适度冗余
  
简单查询：
  - JOIN表少
  - 分析查询快
  
灵活性：
  - 多维度分析
  - 灵活组合
```

##### 3.3 对比总结

| 维度 | 规范化建模 | 维度建模 |
|------|-----------|---------|
| **目标** | 业务事务 | 分析查询 |
| **模型** | 3NF | 星型模型 |
| **表数量** | 多 | 少 |
| **数据冗余** | 无 | 适度冗余 |
| **查询** | 简单查询 | 复杂查询 |
| **性能** | 写入性能好 | 查询性能好 |
| **一致性** | 强一致性 | 最终一致性 |
| **使用场景** | OLTP | OLAP |

#### 四、维度建模核心概念

##### 4.1 事实表

**定义**：存储业务事件和度量数据

**特点**：
```yaml
数据量大：
  - 每天增长
  - 例如：订单事实表每天1000万行
  
包含度量：
  - 数值型字段
  - 可聚合（SUM、COUNT、AVG）
  
包含维度外键：
  - 关联维度表
  - 例如：date_id, user_id, product_id
  
记录业务事件：
  - 每一行是一个业务事件
  - 例如：一个订单
```

**示例**：
```sql
-- 订单事实表
CREATE TABLE fact_orders (
    -- 维度外键
    order_id BIGINT,
    date_id INT,           -- 日期维度外键
    user_id BIGINT,        -- 用户维度外键
    product_id BIGINT,     -- 商品维度外键
    channel_id INT,        -- 渠道维度外键
    
    -- 度量
    amount NUMERIC(10,2),  -- 订单金额
    quantity INT,          -- 订单数量
    profit NUMERIC(10,2),  -- 订单利润
    discount NUMERIC(10,2) -- 订单折扣
);
```

##### 4.2 维度表

**定义**：存储维度描述信息

**特点**：
```yaml
数据量小：
  - 相对较小
  - 例如：商品维度表10万行
  
包含描述属性：
  - 文本、日期等
  - 例如：产品名称、类别
  
作为分析角度：
  - 用于GROUP BY
  - 用于WHERE过滤
```

**示例**：
```sql
-- 日期维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    month INT,
    day INT,
    quarter INT,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN
);

-- 用户维度表
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    segment VARCHAR(50),     -- 客户分群
    register_date DATE
);

-- 商品维度表
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(100),
    brand VARCHAR(100),
    price NUMERIC(10,2)
);
```

##### 4.3 星型模型

**定义**：事实表在中心，维度表围绕

**结构**：
```text
        商品维度表
              |
              |
    用户维度表 - 事实表 - 日期维度表
              |
              |
          渠道维度表
```

**特点**：
```yaml
事实表：
  - 在中心
  - 连接所有维度表
  
维度表：
  - 围绕事实表
  - 直接连接事实表
  
反规范化：
  - 维度表可能冗余
  - 为了查询性能
```

**示例**：
```sql
-- 查询：星型模型
SELECT
    d.year,
    d.month,
    u.city,
    p.category,
    c.channel_name,
    sum(f.amount) as gmv,
    sum(f.quantity) as quantity
FROM fact_orders f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_products p ON f.product_id = p.product_id
JOIN dim_channels c ON f.channel_id = c.channel_id
WHERE d.year = 2026
GROUP BY d.year, d.month, u.city, p.category, c.channel_name;
```

##### 4.4 雪花模型

**定义**：维度表也可以规范化，有层级关系

**结构**：
```text
        商品子类别维度表
              |
        商品类别维度表
              |
    用户维度表 - 事实表 - 日期维度表
```

**特点**：
```yaml
维度表：
  - 规范化
  - 可以有层级
  
节省空间：
  - 减少数据冗余
  - 节省存储空间
```

**示例**：
```sql
-- 商品维度表（规范化）
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    category_id INT
);

-- 商品类别维度表
CREATE TABLE dim_categories (
    category_id INT PRIMARY KEY,
    category_name VARCHAR(100),
    parent_category_id INT
);

-- 查询：雪花模型
SELECT
    p.product_name,
    c.category_name,
    sum(f.amount) as gmv
FROM fact_orders f
JOIN dim_products p ON f.product_id = p.product_id
JOIN dim_categories c ON p.category_id = c.category_id
GROUP BY p.product_name, c.category_name;
```

#### 五、维度建模设计原则

##### 5.1 原则1：事实表围绕业务过程

**定义**：事实表对应一个业务过程

**示例**：
```yaml
业务过程1：用户下单
  → 事实表：fact_orders
  
业务过程2：用户浏览
  → 事实表：fact_page_views
  
业务过程3：用户加入购物车
  → 事实表：fact_cart_events
```

##### 5.2 原则2：维度表描述业务环境

**定义**：维度表描述业务的环境信息

**示例**：
```yaml
维度1：时间维度
  → 描述：什么时候发生的
  
维度2：用户维度
  → 描述：谁发生的
  
维度3：商品维度
  → 描述：什么商品
  
维度4：渠道维度
  → 描述：通过什么渠道
```

##### 5.3 原则3：度量可聚合

**定义**：事实表中的度量可以聚合计算

**示例**：
```sql
-- 可聚合的度量
SELECT sum(amount) FROM fact_orders;
SELECT avg(amount) FROM fact_orders;
SELECT count(*) FROM fact_orders;

-- 不可聚合的度量（例如：比率）
SELECT sum(profit_rate) FROM fact_orders;  -- 错误！
-- 正确做法：
SELECT sum(profit) / sum(amount) FROM fact_orders;  -- 正确！
```

##### 5.4 原则4：维度表可以冗余

**定义**：维度表可以适度冗余，提升查询性能

**示例**：
```sql
-- 冗余维度表
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),   -- 冗余（可以从city推导）
    region VARCHAR(50),      -- 冗余（可以从province推导）
    segment VARCHAR(50)
);
```

**优势**：
```yaml
查询性能：
  - 不需要JOIN其他表
  - 查询更快
  
使用便利：
  - 直接使用
  - 不需要计算
```

#### 六、常见误区

**误区一：维度建模就是简单的表设计**

- **说明**：维度建模有系统的理论和方法，不是简单的表设计
- **后果**：设计错误，效果差
- **正确理解**：
  - 遵循维度建模原则
  - 使用事实表和维度表
  - 构建星型模型

**误区二：维度建模不需要规范化**

- **说明**：维度建模也需要规范化，但程度不同
- **后果**：过度冗余
- **正确理解**：
  - 星型模型：适度冗余
  - 雪花模型：维度表规范化
  - 根据场景选择

**误区三：维度建模不能有外键**

- **说明**：维度建模也需要外键，但外键的作用不同
- **后果**：理解错误
- **正确理解**：
  - 维度建模有外键
  - 但主要用于关联，不是强约束
  - 可以通过应用层保证

**误区四：维度建模不需要更新**

- **说明**：维度表也需要更新，但更新频率低
- **后果**：数据过时
- **正确理解**：
  - 维度表可以更新
  - 但更新频率低（每天或每周）
  - 需要考虑更新策略

**误区五：维度建模只适用于大数据**

- **说明**：维度建模适用于所有分析场景，不管数据量大小
- **后果**：小项目不敢用
- **正确理解**：
  - 维度建模适用于所有分析场景
  - 小项目也可以用
  - 根据需求选择

#### 七、实战任务

**任务1：设计星型模型**

设计一个电商的星型模型：

```sql
-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    channel_id INT,
    
    -- 度量
    amount NUMERIC(10,2),
    quantity INT,
    profit NUMERIC(10,2)
);

-- 维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    month INT,
    day INT
);

CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    segment VARCHAR(50)
);

CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    category VARCHAR(100),
    brand VARCHAR(100)
);

CREATE TABLE dim_channels (
    channel_id INT PRIMARY KEY,
    channel_name VARCHAR(50),
    channel_type VARCHAR(50)
);
```

**任务2：对比维度建模和规范化建模**

对比查询性能：

```sql
-- 维度建模（星型模型）
SELECT
    d.year,
    d.month,
    u.city,
    p.category,
    sum(f.amount) as gmv
FROM fact_orders f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_products p ON f.product_id = p.product_id
GROUP BY d.year, d.month, u.city, p.category;
-- 执行时间：5秒

-- 规范化建模（3NF）
SELECT
    date_part('year', o.created_at) as year,
    date_part('month', o.created_at) as month,
    u.city,
    p.category,
    sum(o.amount) as gmv
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
GROUP BY date_part('year', o.created_at), date_part('month', o.created_at), u.city, p.category;
-- 执行时间：30秒

-- 性能差异：6倍
```

**任务3：设计维度表层级**

设计商品维度的层级：

```sql
-- 方案1：扁平维度（星型模型）
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    category_l1 VARCHAR(50),   -- 一级分类
    category_l2 VARCHAR(50),   -- 二级分类
    category_l3 VARCHAR(50)    -- 三级分类
);

-- 方案2：层级维度（雪花模型）
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    category_l3_id INT
);

CREATE TABLE dim_category_l3 (
    category_l3_id INT PRIMARY KEY,
    category_l3_name VARCHAR(50),
    category_l2_id INT
);

CREATE TABLE dim_category_l2 (
    category_l2_id INT PRIMARY KEY,
    category_l2_name VARCHAR(50),
    category_l1_id INT
);

CREATE TABLE dim_category_l1 (
    category_l1_id INT PRIMARY KEY,
    category_l1_name VARCHAR(50)
);

-- 选择：
-- 简单场景：扁平维度（星型模型）
-- 复杂场景：层级维度（雪花模型）
```

#### 八、小结

维度建模是面向分析查询的数据建模方法，通过事实表和维度表构建星型模型或雪花模型。

核心要点：
- 为什么需要维度建模：分析需求不同于业务需求
- 核心判断：面向分析的建模方法
- vs规范化建模：目标、模型、特点不同
- 核心概念：事实表、维度表、星型模型、雪花模型
- 设计原则：事实表围绕业务过程、维度表描述业务环境
- 常见误区：不是简单表设计、需要规范化、可以有外键

下一节将进入事实表设计，了解事实表的类型、设计原则、设计方法等。
