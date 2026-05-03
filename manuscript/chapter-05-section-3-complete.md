### 5.3 数仓的基本术语

前两节学习了为什么业务库不能直接做分析，以及数据仓库的核心概念。

现在学习数据仓库的基本术语。

**场景**：
```yaml
数据仓库项目启动会：
  
技术经理："我们需要建设数据仓库"
  
数据分析师："我需要GMV报表、用户留存分析、转化漏斗"
  
你："好，我们需要设计事实表和维度表..."
  
新同事："什么是事实表？什么是维度表？什么是度量？"
```

**问题**：
- 数据仓库有哪些基本术语？
- 这些术语是什么意思？
- 如何理解和使用这些术语？

**答案**：**掌握数据仓库的核心术语，是设计数据仓库的基础**

#### 一、维度和度量

##### 1.1 维度（Dimension）

**定义**：描述业务的角度或视角

**特点**：
```yaml
描述性：
  - 描述业务的"是什么"
  - 例如：谁、什么、哪里、什么时候
  
离散值：
  - 有限个值
  - 例如：城市（北京、上海、深圳）
  
用于分组和过滤：
  - GROUP BY
  - WHERE
```

**示例**：
```sql
-- 日期维度
SELECT
    year,
    month,
    day,
    quarter,
    is_holiday
FROM dim_date;

-- 用户维度
SELECT
    user_id,
    user_name,
    user_city,
    user_segment
FROM dim_users;

-- 商品维度
SELECT
    product_id,
    product_name,
    product_category,
    product_brand
FROM dim_products;
```

**常见维度**：
```yaml
时间维度：
  - 年、季度、月、周、日
  - 是否节假日
  - 星期几

地理维度：
  - 国家、省份、城市
  - 区域（华东、华南、华北）

产品维度：
  - 产品名称
  - 产品类别
  - 产品品牌

客户维度：
  - 客户姓名
  - 客户等级
  - 客户类型
```

##### 1.2 度量（Measure）

**定义**：可以度量的数值，用于聚合计算

**特点**：
```yaml
数值型：
  - 可以聚合（SUM、COUNT、AVG）
  - 例如：金额、数量、利润
  
连续值：
  - 连续的数值范围
  - 例如：金额（0-10000元）
  
用于聚合计算：
  - SUM（求和）
  - COUNT（计数）
  - AVG（平均）
  - MAX/MIN（最大/最小）
```

**示例**：
```sql
-- 订单金额（度量）
SELECT sum(order_amount) FROM fact_orders;
-- GMV：1000万元

-- 订单数量（度量）
SELECT count(*) FROM fact_orders;
-- 订单量：10万笔

-- 订单利润（度量）
SELECT sum(order_profit) FROM fact_orders;
-- 利润：100万元
```

**常见度量**：
```yaml
销售指标：
  - 销售额（GMV）
  - 销售数量
  - 利润
  - 利润率

用户指标：
  - 用户数
  - 活跃用户数
  - 留存率

网站指标：
  - 访问量（PV）
  - 访客数（UV）
  - 跳出率
```

##### 1.3 维度 vs 度量

| 维度 | 度量 |
|------|------|
| **性质** | 描述性 | 数值型 |
| **值** | 离散值 | 连续值 |
| **用途** | 分组、过滤 | 聚合计算 |
| **SQL** | GROUP BY | SUM/COUNT/AVG |
| **示例** | 日期、城市、产品 | 金额、数量、利润 |

**查询示例**：
```sql
-- 维度：日期、城市
-- 度量：GMV、订单量
SELECT
    date(order_date) as 维度_日期,      -- 维度
    user_city as 维度_城市,              -- 维度
    sum(order_amount) as 度量_GMV,        -- 度量
    count(*) as 度量_订单量               -- 度量
FROM fact_orders f
JOIN dim_users u ON f.user_id = u.user_id
WHERE order_date >= '2026-01-01'          -- 维度过滤
GROUP BY date(order_date), user_city       -- 维度分组
ORDER BY date(order_date), 度量_GMV DESC;
```

#### 二、事实表和维度表

##### 2.1 事实表（Fact Table）

**定义**：存储业务事件和度量数据

**特点**：
```yaml
数据量大：
  - 每天增长
  - 例如：订单事实表每天1000万行
  
包含度量：
  - 数值型字段
  - 可聚合
  
包含维度外键：
  - 关联维度表
  - 例如：date_id, user_id, product_id
  
记录业务事件：
  - 每一行是一个业务事件
  - 例如：一个订单、一次点击
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
    
    -- 度量
    order_amount NUMERIC(10,2),   -- 订单金额
    order_quantity INT,           -- 订单数量
    order_profit NUMERIC(10,2)    -- 订单利润
);
```

**事实表类型**：
```yaml
事务事实表：
  - 记录业务事件
  - 例如：订单、支付、物流
  
周期快照事实表：
  - 记录定期快照
  - 例如：库存快照（每天）、账户快照（每月）
  
累积快照事实表：
  - 记录过程全生命周期
  - 例如：订单从创建到完成的全过程
```

##### 2.2 维度表（Dimension Table）

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
  
层级关系：
  - 可能有层级
  - 例如：年→季度→月→日
```

**示例**：
```sql
-- 日期维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    quarter INT,
    month INT,
    day INT,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN
);

-- 用户维度表
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),
    user_city VARCHAR(100),
    user_province VARCHAR(100),
    user_segment VARCHAR(50),  -- 客户分群
    registered_at DATE
);

-- 商品维度表
CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    product_category VARCHAR(100),
    product_brand VARCHAR(100),
    product_price NUMERIC(10,2)
);
```

**维度表类型**：
```yaml
时间维度：
  - 年、季度、月、日
  - 是否节假日
  
地理维度：
  - 国家、省份、城市
  - 层级关系
  
产品维度：
  - 产品名称、类别、品牌
  - 层级关系（一级分类、二级分类）
  
客户维度：
  - 客户基本信息
  - 客户分群
```

##### 2.3 事实表 vs 维度表

| 维度 | 事实表 | 维度表 |
|------|--------|--------|
| **数据量** | 大（百万到亿行） | 小（万到十万行） |
| **内容** | 度量（数值） | 描述（文本、日期） |
| **用途** | 聚合计算 | 分组、过滤 |
| **变化** | 增量追加（很少修改） | 相对稳定 |
| **关系** | 关联维度表 | 被事实表关联 |

#### 三、星型模型和雪花模型

##### 3.1 星型模型（Star Schema）

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
-- 星型模型示例
-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    channel_id INT,
    order_amount NUMERIC(10,2)
);

-- 维度表
CREATE TABLE dim_date (...);
CREATE TABLE dim_users (...);
CREATE TABLE dim_products (...);
CREATE TABLE dim_channels (...);

-- 查询：只需要JOIN维度表
SELECT
    d.year,
    d.month,
    u.user_city,
    p.product_category,
    c.channel_name,
    sum(f.order_amount) as gmv
FROM fact_orders f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_products p ON f.product_id = p.product_id
JOIN dim_channels c ON f.channel_id = c.channel_id
GROUP BY d.year, d.month, u.user_city, p.product_category, c.channel_name;
```

##### 3.2 雪花模型（Snowflake Schema）

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
  - 需要多次JOIN
  
节省空间：
  - 减少数据冗余
  - 节省存储空间
```

**示例**：
```sql
-- 雪花模型示例
-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    order_amount NUMERIC(10,2)
);

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

-- 查询：需要JOIN更多表
SELECT
    p.product_name,
    c.category_name,
    sum(f.order_amount) as gmv
FROM fact_orders f
JOIN dim_products p ON f.product_id = p.product_id
JOIN dim_categories c ON p.category_id = c.category_id
GROUP BY p.product_name, c.category_name;
```

##### 3.3 星型 vs 雪花

| 维度 | 星型模型 | 雪花模型 |
|------|----------|----------|
| **结构** | 维度表反规范化 | 维度表规范化 |
| **JOIN数量** | 少 | 多 |
| **查询性能** | 好 | 一般 |
| **存储空间** | 大 | 小 |
| **维护复杂度** | 低 | 高 |

**选择建议**：
```yaml
优先星型模型：
  - 查询性能优先
  - 维度表相对较小
  - 维度属性不经常变化
  
使用雪花模型：
  - 维度表很大
  - 维度属性经常变化
  - 存储空间有限
```

#### 四、粒度（Granularity）

##### 4.1 粒度定义

**定义**：数据的详细程度

**示例**：
```yaml
时间粒度：
  - 年（最粗）
  - 季度
  - 月
  - 日
  - 小时
  - 秒（最细）
  
商品粒度：
  - 一级分类（电子产品）
  - 二级分类（手机）
  - 三级分类（iPhone）
  - 单个商品（iPhone 15 Pro）
  
用户粒度：
  - 全部用户
  - 用户分群（高价值、中等、低价值）
  - 单个用户
```

##### 4.2 粒度选择

**原则**：根据业务需求选择合适的粒度

**示例**：
```sql
-- 粗粒度：每日GMV
SELECT
    order_date,
    sum(order_amount) as gmv
FROM fact_orders
GROUP BY order_date;

-- 细粒度：每小时GMV
SELECT
    date_trunc('hour', order_time) as order_hour,
    sum(order_amount) as gmv
FROM fact_orders
GROUP BY date_trunc('hour', order_time);

-- 更细粒度：每笔订单
SELECT
    order_id,
    order_time,
    order_amount
FROM fact_orders;
```

**选择建议**：
```yaml
粗粒度：
  - 用于高层分析
  - 数据量小
  - 查询快
  
细粒度：
  - 用于明细查询
  - 数据量大
  - 查询慢
  
建议：
  - 同时存储粗细粒度数据
  - 根据需求选择
```

#### 五、其他核心术语

##### 5.1 数据立方体（Data Cube）

**定义**：多维数据结构

**示例**：
```yaml
三维数据立方体：
  - 维度1：时间（年、月、日）
  - 维度2：地区（北京、上海、深圳）
  - 维度3：产品（电子产品、服装、食品）
  - 度量：GMV
  
可以：
  - 切片（Slice）：固定一个维度
  - 切块（Dice）：固定多个维度
  - 旋转（Pivot）：转换维度
  - 下钻（Drill-down）：从粗到细
  - 上卷（Roll-up）：从细到粗
```

##### 5.2 下钻和上卷

**下钻（Drill-down）**：
```yaml
定义：
  - 从粗粒度到细粒度
  
示例：
  - 年 → 季度 → 月 → 日
  - 一级分类 → 二级分类 → 三级分类
```

**上卷（Roll-up）**：
```yaml
定义：
  - 从细粒度到粗粒度
  
示例：
  - 日 → 月 → 季度 → 年
  - 三级分类 → 二级分类 → 一级分类
```

##### 5.3 聚合和预计算

**聚合（Aggregation）**：
```sql
-- 原始数据（明细）
SELECT
    order_id,
    user_id,
    order_amount
FROM fact_orders;

-- 聚合数据（汇总）
SELECT
    user_id,
    sum(order_amount) as total_gmv,
    count(*) as order_count
FROM fact_orders
GROUP BY user_id;
```

**预计算（Pre-computation）**：
```sql
-- 创建物化视图（预计算）
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT
    order_date,
    sum(order_amount) as gmv
FROM fact_orders
GROUP BY order_date;

-- 查询物化视图（快）
SELECT * FROM mv_daily_gmv
WHERE order_date >= '2026-01-01';
```

#### 六、常见误区

**误区一：维度只能是文本**

- **说明**：维度可以是文本、日期、数值等，只要用于分组和过滤
- **后果**：设计错误
- **正确理解**：
  - 维度是描述性属性
  - 可以是文本（城市）、日期（日期）、数值（年龄）
  - 关键用于GROUP BY和WHERE

**误区二：度量只能是金额**

- **说明**：度量可以是任何可聚合的数值
- **后果**：设计局限
- **正确理解**：
  - 金额、数量、利润
  - 计数、百分比
  - 只要可聚合

**误区三：事实表只能有一个**

- **说明**：可以有多个事实表，每个事实表对应一个业务主题
- **后果**：设计局限
- **正确理解**：
  - 订单事实表
  - 用户行为事实表
  - 库存事实表
  - 可以有多个

**误区四：维度表必须很小**

- **说明**：维度表可以很大，但相对事实表较小
- **后果**：理解偏差
- **正确理解**：
  - 用户维度表可能有1000万行
  - 但订单事实表有1亿行
  - 相对较小

**误区五：星型模型一定比雪花模型好**

- **说明**：星型模型和雪花模型各有优劣
- **后果**：选择错误
- **正确理解**：
  - 星型模型：查询性能好
  - 雪花模型：节省空间
  - 根据场景选择

#### 七、实战任务

**任务1：识别维度和度量**

识别以下字段是维度还是度量：

```yaml
订单表字段：
  - order_id：无（既不是维度也不是度量，是主键）
  - order_date：维度（时间维度）
  - user_id：维度（用户维度）
  - product_id：维度（商品维度）
  - order_amount：度量（可聚合）
  - order_quantity：度量（可聚合）
  - order_profit：度量（可聚合）
  - order_status：维度（订单状态）
```

**任务2：设计星型模型**

设计一个电商星型模型：

```sql
-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,           -- 维度外键
    user_id BIGINT,        -- 维度外键
    product_id BIGINT,     -- 维度外键
    channel_id INT,        -- 维度外键
    
    -- 度量
    order_amount NUMERIC(10,2),
    order_quantity INT,
    order_profit NUMERIC(10,2)
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
    user_name VARCHAR(100),
    user_city VARCHAR(100),
    user_segment VARCHAR(50)
);

CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    product_category VARCHAR(100),
    product_brand VARCHAR(100)
);

CREATE TABLE dim_channels (
    channel_id INT PRIMARY KEY,
    channel_name VARCHAR(50),
    channel_type VARCHAR(50)
);
```

**任务3：查询星型模型**

查询星型模型：

```sql
-- 查询：按日期、城市、类别分析GMV
SELECT
    d.year,
    d.month,
    u.user_city,
    p.product_category,
    sum(f.order_amount) as gmv,
    sum(f.order_quantity) as quantity,
    sum(f.order_profit) as profit
FROM fact_orders f
JOIN dim_date d ON f.date_id = d.date_id
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_products p ON f.product_id = p.product_id
WHERE d.year = 2026
GROUP BY d.year, d.month, u.user_city, p.product_category
ORDER BY d.year, d.month, gmv DESC;
```

#### 八、小结

数据仓库的基本术语是设计数据仓库的基础。

核心要点：
- 维度：描述性属性，用于分组和过滤
- 度量：数值型指标，用于聚合计算
- 事实表：存储业务事件和度量
- 维度表：存储维度描述信息
- 星型模型：事实表在中心，维度表围绕
- 雪花模型：维度表规范化，有层级
- 粒度：数据的详细程度
- 其他术语：数据立方体、下钻、上卷、聚合、预计算

下一节将进入数仓分层的必要性，了解为什么需要分层、分层的好处等。
