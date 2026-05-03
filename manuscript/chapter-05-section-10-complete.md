### 5.10 常见建模模式

上一节学习了维度表设计，了解了维度表的类型、设计原则、SCD处理等。

现在学习维度建模中的常见设计模式。

**场景**：
```yaml
数据仓库设计过程中的复杂场景：
  
你："订单事实表需要关联商品，但一个订单有多个商品..."
  
数据架构师："用桥接表（Bridge Table）处理多对多关系"
  
你："用户维度表有很多低基数的属性（性别、年龄段...）"
  
数据架构师："用垃圾维度（Junk Dimension）"
  
新同事："什么是桥接表？什么是垃圾维度？"
```

**问题**：
- 什么是常见的维度建模模式？
- 如何处理多对多关系？
- 如何处理低基数属性？
- 如何处理特殊场景？

**答案**：**掌握常见的维度建模模式，根据场景选择合适的模式**

#### 一、维度表常见模式

##### 1.1 垃圾维度（Junk Dimension）

**定义**：将多个低基数的标志字段或属性组合成一个维度表

**场景**：
```yaml
问题：
  - 事实表有很多标志字段（is_new, is_vip, is_active...）
  - 这些字段基数低（通常只有几个值）
  - 如果直接放在事实表，事实表会很大
  - 如果每个字段一个维度表，会有很多小表
  
解决：
  - 将多个低基数字段组合成一个维度表
  - 事实表只保留一个外键
```

**示例**：
```sql
-- 原始设计：事实表包含多个标志字段
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    amount NUMERIC(10,2),
    is_new_user BOOLEAN,        -- 新用户标志
    is_vip_user BOOLEAN,        -- VIP用户标志
    is_first_order BOOLEAN,     -- 首单标志
    has_discount BOOLEAN,       -- 有折扣标志
    payment_type VARCHAR(50),   -- 支付方式（低基数）
    order_source VARCHAR(50)    -- 订单来源（低基数）
);

-- 优化设计：使用垃圾维度
CREATE TABLE dim_order_flags (
    flag_id INT PRIMARY KEY,
    is_new_user BOOLEAN,
    is_vip_user BOOLEAN,
    is_first_order BOOLEAN,
    has_discount BOOLEAN,
    payment_type VARCHAR(50),
    order_source VARCHAR(50)
);

CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    flag_id INT,                -- 垃圾维度外键
    amount NUMERIC(10,2)
);

-- 垃圾维度数据示例
INSERT INTO dim_order_flags VALUES
(1, true, false, true, false, 'alipay', 'app'),
(2, false, true, false, true, 'wechat', 'web'),
(3, false, false, false, false, 'card', 'app'),
...;

-- 查询时关联
SELECT
    f.amount,
    j.is_vip_user,
    j.payment_type
FROM fact_orders f
JOIN dim_order_flags j ON f.flag_id = j.flag_id;
```

**优势**：
```yaml
减少事实表大小：
  - 事实表只保留一个外键
  - 不需要多个标志字段
  
提升查询性能：
  - 减少事实表列数
  - 提升扫描性能
  
便于管理：
  - 集中管理低基数属性
  - 便于维护
```

##### 1.2 角色扮演维度（Role-Playing Dimension）

**定义**：同一个维度表在事实表中扮演不同的角色

**场景**：
```yaml
问题：
  - 订单有订单日期和发货日期
  - 两个日期都是时间维度
  - 但需要区分不同的角色
  
解决：
  - 使用同一个时间维度表
  - 事实表中有两个外键，分别扮演不同角色
```

**示例**：
```sql
-- 时间维度表（只有一个）
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    month INT,
    day INT,
    quarter INT,
    week INT,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN
);

-- 事实表：日期维度扮演不同角色
CREATE TABLE fact_orders (
    order_id BIGINT,
    order_date_id INT,          -- 订单日期（角色1）
    ship_date_id INT,           -- 发货日期（角色2）
    deliver_date_id INT,        -- 送达日期（角色3）
    user_id BIGINT,
    amount NUMERIC(10,2)
);

-- 查询：订单日期到发货日期的间隔
SELECT
    o.order_id,
    order_date.date_value as order_date,
    ship_date.date_value as ship_date,
    (ship_date.date_value - order_date.date_value) as days_to_ship
FROM fact_orders o
JOIN dim_date order_date ON o.order_date_id = order_date.date_id
JOIN dim_date ship_date ON o.ship_date_id = ship_date.date_id;

-- 查询：订单在星期几下单，星期几发货
SELECT
    order_date.week as order_week,
    ship_date.week as ship_week,
    count(*) as order_count
FROM fact_orders o
JOIN dim_date order_date ON o.order_date_id = order_date.date_id
JOIN dim_date ship_date ON o.ship_date_id = ship_date.date_id
GROUP BY order_date.week, ship_date.week;
```

**优势**：
```yaml
复用维度表：
  - 不需要创建多个时间维度表
  - 减少维护成本
  
支持多角度分析：
  - 可以按订单日期分析
  - 可以按发货日期分析
  - 可以按间隔时间分析
```

##### 1.3 缩减维度（Shrunken Dimension）

**定义**：维度表的子集，用于特定的事实表

**场景**：
```yaml
问题：
  - 月度快照事实表只需要部分用户（活跃用户）
  - 但用户维度表包含所有用户
  
解决：
  - 创建缩减维度，只包含需要的用户
  - 月度快照事实表关联缩减维度
```

**示例**：
```sql
-- 完整用户维度
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    segment VARCHAR(50),
    register_date DATE,
    total_orders INT,
    total_amount NUMERIC(10,2)
);

-- 缩减维度：只包含月度活跃用户
CREATE TABLE dim_active_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    segment VARCHAR(50)
);

-- 月度快照事实表
CREATE TABLE fact_monthly_user_snapshot (
    snapshot_id BIGINT,
    snapshot_date_id INT,
    user_id BIGINT,
    month_orders INT,
    month_amount NUMERIC(10,2)
);

-- 查询：关联缩减维度
SELECT
    s.snapshot_date_id,
    u.segment,
    sum(s.month_amount) as total_amount
FROM fact_monthly_user_snapshot s
JOIN dim_active_users u ON s.user_id = u.user_id
GROUP BY s.snapshot_date_id, u.segment;
```

**优势**：
```yaml
减少数据量：
  - 缩减维度只包含需要的维度
  - 减少JOIN的数据量
  
提升性能：
  - 减少JOIN的数据量
  - 提升查询性能
```

##### 1.4 一致性维度（Conformed Dimension）

**定义**：跨多个事实表共享的维度表

**场景**：
```yaml
问题：
  - 订单事实表需要用户维度
  - 用户行为事实表也需要用户维度
  - 两个事实表需要关联分析
  
解决：
  - 使用同一个用户维度表
  - 确保维度定义一致
```

**示例**：
```sql
-- 一致性维度：用户维度
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    city VARCHAR(100),
    segment VARCHAR(50),
    register_date DATE
);

-- 事实表1：订单事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,          -- 关联一致性维度
    product_id BIGINT,
    amount NUMERIC(10,2)
);

-- 事实表2：用户行为事实表
CREATE TABLE fact_events (
    event_id BIGINT,
    date_id INT,
    user_id BIGINT,          -- 关联一致性维度
    event_type VARCHAR(50),
    page_url VARCHAR(500)
);

-- 跨事实表分析：订单用户的特征
SELECT
    u.segment,
    count(DISTINCT o.order_id) as order_count,
    count(DISTINCT e.event_id) as event_count
FROM dim_users u
LEFT JOIN fact_orders o ON u.user_id = o.user_id
LEFT JOIN fact_events e ON u.user_id = e.user_id
GROUP BY u.segment;
```

**优势**：
```yaml
跨事实表分析：
  - 可以关联不同事实表
  - 进行跨业务分析
  
一致性：
  - 维度定义一致
  - 确保数据一致性
```

#### 二、事实表常见模式

##### 2.1 桥接表（Bridge Table）

**定义**：处理多对多关系的中间表

**场景**：
```yaml
问题：
  - 一个订单包含多个商品
  - 事实表粒度是订单，不是订单商品明细
  
解决：
  - 事实表只记录订单级别的度量
  - 桥接表记录订单和商品的多对多关系
```

**示例**：
```sql
-- 订单事实表（粒度：订单）
CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    date_id INT,
    user_id BIGINT,
    amount NUMERIC(10,2),           -- 订单总金额
    quantity INT,                   -- 订单总数量
    discount NUMERIC(10,2)          -- 订单总折扣
);

-- 桥接表：订单-商品多对多关系
CREATE TABLE bridge_order_products (
    order_id BIGINT,
    product_id BIGINT,
    product_quantity INT,           -- 该商品的数量
    product_amount NUMERIC(10,2),   -- 该商品的金额
    PRIMARY KEY (order_id, product_id)
);

-- 查询：订单商品明细
SELECT
    o.order_id,
    p.product_name,
    b.product_quantity,
    b.product_amount
FROM fact_orders o
JOIN bridge_order_products b ON o.order_id = b.order_id
JOIN dim_products p ON b.product_id = p.product_id
WHERE o.order_id = 12345;

-- 查询：包含某个商品的所有订单
SELECT DISTINCT
    o.order_id,
    o.amount
FROM fact_orders o
JOIN bridge_order_products b ON o.order_id = b.order_id
WHERE b.product_id = 999;

-- 查询：商品销售排名
SELECT
    b.product_id,
    p.product_name,
    sum(b.product_quantity) as total_quantity,
    sum(b.product_amount) as total_amount
FROM bridge_order_products b
JOIN dim_products p ON b.product_id = p.product_id
GROUP BY b.product_id, p.product_name
ORDER BY total_amount DESC
LIMIT 10;
```

**优势**：
```yaml
处理多对多：
  - 事实表保持简单
  - 桥接表处理多对多关系
  
灵活分析：
  - 可以按订单分析
  - 可以按商品分析
  - 可以分析订单商品明细
```

##### 2.2 无事实事实表（Factless Fact Table）

**定义**：只有维度外键，没有度量的 fact 表

**场景**：
```yaml
问题：
  - 需要记录事件，但没有数值度量
  - 例如：学生出勤、用户登录、商品浏览
  
解决：
  - 创建无事实事实表
  - 只记录维度外键
```

**示例**：
```sql
-- 无事实事实表：学生出勤
CREATE TABLE fact_student_attendance (
    student_id BIGINT,
    date_id INT,
    class_id INT,
    is_present BOOLEAN,
    PRIMARY KEY (student_id, date_id, class_id)
);

-- 查询：学生出勤天数
SELECT
    s.student_name,
    count(*) FILTER (WHERE f.is_present = true) as present_days,
    count(*) FILTER (WHERE f.is_present = false) as absent_days
FROM fact_student_attendance f
JOIN dim_students s ON f.student_id = s.student_id
WHERE f.date_id >= 20260101 AND f.date_id < 20260201
GROUP BY s.student_name;

-- 无事实事实表：用户登录
CREATE TABLE fact_user_login (
    user_id BIGINT,
    date_id INT,
    session_id VARCHAR(100),
    login_time TIMESTAMP,
    PRIMARY KEY (user_id, date_id, session_id)
);

-- 查询：用户登录次数
SELECT
    user_id,
    date_id,
    count(*) as login_count
FROM fact_user_login
WHERE date_id >= 20260101
GROUP BY user_id, date_id;

-- 无事实事实表：商品浏览
CREATE TABLE fact_product_views (
    user_id BIGINT,
    product_id BIGINT,
    date_id INT,
    view_time TIMESTAMP,
    session_id VARCHAR(100)
);

-- 查询：商品浏览次数
SELECT
    product_id,
    count(*) as view_count,
    count(DISTINCT user_id) as unique_viewers
FROM fact_product_views
WHERE date_id >= 20260101
GROUP BY product_id
ORDER BY view_count DESC;
```

**优势**：
```yaml
记录事件：
  - 记录事件发生
  - 没有数值度量
  
支持分析：
  - 可以分析事件次数
  - 可以分析事件模式
```

##### 2.3 聚合事实表（Aggregate Fact Table）

**定义**：预先聚合的 fact 表

**场景**：
```yaml
问题：
  - 常用查询需要聚合计算
  - 每次查询都聚合很慢
  
解决：
  - 创建聚合事实表
  - 预先计算常用聚合
```

**示例**：
```sql
-- 明细事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2),
    quantity INT
);

-- 聚合事实表：每日GMV
CREATE TABLE fact_daily_gmv (
    date_id INT PRIMARY KEY,
    order_count BIGINT,
    total_amount NUMERIC(20,2),
    total_quantity BIGINT,
    avg_amount NUMERIC(10,2)
);

-- 聚合事实表：用户GMV
CREATE TABLE fact_user_gmv (
    user_id BIGINT PRIMARY KEY,
    order_count BIGINT,
    total_amount NUMERIC(20,2),
    total_quantity BIGINT,
    avg_amount NUMERIC(10,2),
    first_order_date DATE,
    last_order_date DATE
);

-- 聚合事实表：商品GMV
CREATE TABLE fact_product_gmv (
    product_id BIGINT PRIMARY KEY,
    order_count BIGINT,
    total_amount NUMERIC(20,2),
    total_quantity BIGINT,
    avg_amount NUMERIC(10,2)
);

-- 查询：直接使用聚合事实表（快速）
SELECT 
    date_id,
    total_amount as gmv,
    order_count
FROM fact_daily_gmv
WHERE date_id >= 20260101 AND date_id < 20260201
ORDER BY date_id;

-- 不需要：
-- SELECT date_id, sum(amount) as gmv, count(*) as order_count
-- FROM fact_orders
-- WHERE date_id >= 20260101 AND date_id < 20260201
-- GROUP BY date_id;
```

**优势**：
```yaml
提升查询性能：
  - 不需要实时聚合
  - 查询速度更快
  
减轻系统负载：
  - 减少聚合计算
  - 降低系统负载
```

#### 三、高级模式

##### 3.1 退化维度（Degenerate Dimension）

**定义**：没有对应维度表的维度，直接放在事实表中

**场景**：
```yaml
问题：
  - 订单号、发票号等既是维度又是标识
  - 没有额外的属性
  - 不需要单独的维度表
  
解决：
  - 退化维度直接放在事实表中
  - 不创建维度表
```

**示例**：
```sql
-- 事实表：包含退化维度
CREATE TABLE fact_orders (
    order_id BIGINT,                -- 退化维度（没有对应的dim_orders）
    invoice_number VARCHAR(50),     -- 退化维度（没有对应的dim_invoices）
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2)
);

-- 退化维度的作用：作为标识，用于GROUP BY或WHERE
-- 查询：某个订单的详细信息
SELECT * FROM fact_orders WHERE order_id = 12345;

-- 查询：每个订单的金额（退化维度作为GROUP BY维度）
SELECT 
    order_id,
    sum(amount) as order_amount
FROM fact_orders
GROUP BY order_id;

-- 注意：退化维度没有对应的维度表
-- 不需要：CREATE TABLE dim_orders (...);
```

**优势**：
```yaml
简化设计：
  - 不需要为每个标识创建维度表
  - 减少表数量
  
保留标识：
  - 保留业务标识
  - 便于追踪和分析
```

##### 3.2 外部维度（Outrigger Dimension）

**定义**：维度表的维度，描述维度的某个属性

**场景**：
```yaml
问题：
  - 用户维度包含地址信息
  - 地址本身有层级（省、市、区）
  - 需要按地址层级分析
  
解决：
  - 创建地理维度表
  - 用户维度关联地理维度
```

**示例**：
```sql
-- 外部维度：地理维度
CREATE TABLE dim_location (
    location_id INT PRIMARY KEY,
    country VARCHAR(100),
    province VARCHAR(100),
    city VARCHAR(100),
    district VARCHAR(100)
);

-- 用户维度：关联外部维度
CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    name VARCHAR(100),
    location_id INT,          -- 关联外部维度
    segment VARCHAR(50)
);

-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT
);

-- 查询：按城市分析
SELECT
    l.city,
    count(*) as order_count
FROM fact_orders f
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_location l ON u.location_id = l.location_id
GROUP BY l.city;

-- 查询：按省份分析
SELECT
    l.province,
    count(*) as order_count
FROM fact_orders f
JOIN dim_users u ON f.user_id = u.user_id
JOIN dim_location l ON u.location_id = l.location_id
GROUP BY l.province;
```

**优势**：
```yaml
层级分析：
  - 支持按层级分析
  - 省份、城市、区域
  
减少冗余：
  - 地理信息统一管理
  - 减少冗余
```

#### 四、模式选择原则

##### 4.1 原则1：根据场景选择

**垃圾维度**：
```yaml
场景：
  - 多个低基数属性
  - 标志字段多
  
示例：
  - is_new, is_vip, is_active
  - payment_type, order_source
```

**角色扮演维度**：
```yaml
场景：
  - 同一维度表多次使用
  - 需要区分角色
  
示例：
  - 订单日期、发货日期
  - 买方用户、卖方用户
```

**桥接表**：
```yaml
场景：
  - 多对多关系
  - 事实表粒度不一致
  
示例：
  - 订单-商品多对多
  - 学生-课程多对多
```

**无事实事实表**：
```yaml
场景：
  - 记录事件
  - 没有数值度量
  
示例：
  - 学生出勤
  - 用户登录
  - 商品浏览
```

##### 4.2 原则2：性能 vs 复杂度

**简单场景**：
```yaml
设计：
  - 简单的星型模型
  - 不使用高级模式
  
优势：
  - 设计简单
  - 易于理解
  
劣势：
  - 可能性能不佳
  - 表较大
```

**复杂场景**：
```yaml
设计：
  - 使用高级模式
  - 垃圾维度、桥接表等
  
优势：
  - 性能更好
  - 表更精简
  
劣势：
  - 设计复杂
  - 难以理解
```

**建议**：
```yaml
小项目：
  - 简单设计优先
  - 避免过度设计
  
大项目：
  - 性能优先
  - 使用高级模式
```

#### 五、常见误区

**误区一：模式越多越好**

- **说明**：模式要根据需求，不是越多越好
- **后果**：过度设计，维护成本高
- **正确理解**：
  - 根据场景选择
  - 避免过度设计
  - 简单优先

**误区二：垃圾维度是"垃圾"**

- **说明**：垃圾维度不是垃圾，是合理的维度设计
- **后果**：理解错误
- **正确理解**：
  - 垃圾维度是专业术语
  - 用于低基数属性
  - 提升性能

**误区三：桥接表就是关联表**

- **说明**：桥接表是处理多对多关系的特殊表
- **后果**：理解错误
- **正确理解**：
  - 桥接表处理多对多
  - 不是简单的关联表
  - 有特殊作用

**误区四：无事实事实表没用**

- **说明**：无事实事实表记录事件，有价值
- **后果**：不使用
- **正确理解**：
  - 记录事件发生
  - 支持事件分析
  - 有实际价值

**误区五：退化维度不规范**

- **说明**：退化维度是合理的简化设计
- **后果**：不使用
- **正确理解**：
  - 退化维度是标识
  - 没有额外属性
  - 可以直接使用

#### 六、实战任务

**任务1：设计垃圾维度**

设计订单事实表的垃圾维度：

```sql
-- 需求分析
标志字段：
  - is_new_user（是否新用户）
  - is_vip_user（是否VIP用户）
  - is_first_order（是否首单）
  - has_discount（有折扣）
  - payment_type（支付方式）
  - order_source（订单来源）

-- 设计
CREATE TABLE dim_order_flags (
    flag_id INT PRIMARY KEY,
    is_new_user BOOLEAN,
    is_vip_user BOOLEAN,
    is_first_order BOOLEAN,
    has_discount BOOLEAN,
    payment_type VARCHAR(50),
    order_source VARCHAR(50)
);

CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    date_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    flag_id INT NOT NULL,
    amount NUMERIC(10,2) NOT NULL
);

-- 查询
SELECT
    f.amount,
    j.is_vip_user,
    j.payment_type
FROM fact_orders f
JOIN dim_order_flags j ON f.flag_id = j.flag_id;
```

**任务2：设计桥接表**

设计订单-商品桥接表：

```sql
-- 需求分析
需求：
  - 一个订单包含多个商品
  - 事实表粒度是订单
  - 需要记录订单商品明细

-- 设计
CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    date_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    quantity INT NOT NULL
);

CREATE TABLE bridge_order_products (
    order_id BIGINT,
    product_id BIGINT,
    product_quantity INT,
    product_amount NUMERIC(10,2),
    PRIMARY KEY (order_id, product_id)
);

-- 查询
SELECT
    o.order_id,
    p.product_name,
    b.product_quantity,
    b.product_amount
FROM fact_orders o
JOIN bridge_order_products b ON o.order_id = b.order_id
JOIN dim_products p ON b.product_id = p.product_id
WHERE o.order_id = 12345;
```

**任务3：设计角色扮演维度**

设计订单事实表的角色扮演维度：

```sql
-- 需求分析
需求：
  - 订单有订单日期、发货日期、送达日期
  - 都是时间维度
  - 需要区分不同角色

-- 设计
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT,
    month INT,
    day INT,
    week INT,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN
);

CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    order_date_id INT NOT NULL,
    ship_date_id INT,
    deliver_date_id INT,
    user_id BIGINT NOT NULL,
    amount NUMERIC(10,2) NOT NULL
);

-- 查询：订单到发货的天数
SELECT
    o.order_id,
    order_date.date_value as order_date,
    ship_date.date_value as ship_date,
    (ship_date.date_value - order_date.date_value) as days_to_ship
FROM fact_orders o
JOIN dim_date order_date ON o.order_date_id = order_date.date_id
JOIN dim_date ship_date ON o.ship_date_id = ship_date.date_id;
```

#### 七、小结

常见建模模式提供了处理特殊场景的方法，根据场景选择合适的模式。

核心要点：
- 垃圾维度：低基数属性组合，减少事实表大小
- 角色扮演维度：同一维度表多次使用，区分不同角色
- 缩减维度：维度表子集，用于特定事实表
- 一致性维度：跨事实表共享，支持跨业务分析
- 桥接表：处理多对多关系，保持事实表简单
- 无事实事实表：记录事件，没有度量
- 聚合事实表：预先聚合，提升查询性能
- 退化维度：没有维度表的维度，简化设计
- 外部维度：维度的维度，支持层级分析
- 选择原则：根据场景选择，平衡性能和复杂度

下一节将进入指标体系设计，了解如何设计指标体系、指标管理方法等。
