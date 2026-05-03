### 5.4 数仓分层的必要性

前三节学习了为什么业务库不能直接做分析、数据仓库的核心概念、基本术语。

现在学习数据仓库的分层设计。

**场景**：
```yaml
数据仓库项目启动：
  
技术经理："我们要建设数据仓库"
  
你："好，我们需要设计分层架构"
  
产品经理："为什么要分层？直接把数据放进去不就行了？"
  
你："分层有很多好处..."
```

**问题**：
- 为什么数据仓库要分层？
- 分层有哪些好处？
- 如何设计分层架构？

**答案**：**分层设计可以降低复杂度、提高复用性、便于维护**

#### 一、为什么数据仓库要分层

**第一，降低复杂度**

**问题**：所有逻辑放在一起

```sql
-- 复杂的查询（所有逻辑在一起）
SELECT
    date_part('year', o.created_at) as year,
    date_part('month', o.created_at) as month,
    u.city,
    p.category,
    sum(o.amount) as gmv,
    count(*) as order_count
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND o.created_at >= '2026-01-01'
  AND u.is_deleted = false
  AND p.is_active = true
GROUP BY date_part('year', o.created_at), date_part('month', o.created_at), u.city, p.category;
```

**问题分析**：
```yaml
数据清洗：
  - 过滤删除数据（u.is_deleted = false）
  - 过滤下架商品（p.is_active = true）
  
数据转换：
  - 时间转换（date_part）
  
数据聚合：
  - GROUP BY
  - SUM、COUNT
  
所有逻辑混在一起：
  - 难以理解
  - 难以维护
  - 难以复用
```

**分层后**：
```sql
-- DWD层：数据清洗
CREATE TABLE dwd_orders AS
SELECT
    o.order_id,
    o.created_at,
    u.user_id,
    p.product_id,
    o.amount
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND u.is_deleted = false
  AND p.is_active = true;

-- DWS层：数据聚合
CREATE TABLE dws_daily_gmv AS
SELECT
    date_trunc('day', created_at) as order_date,
    sum(amount) as gmv,
    count(*) as order_count
FROM dwd_orders
GROUP BY date_trunc('day', created_at);

-- ADS层：应用数据
CREATE TABLE ads_monthly_gmv_by_city AS
SELECT
    date_part('year', order_date) as year,
    date_part('month', order_date) as month,
    u.city,
    sum(gmv) as gmv
FROM dws_daily_gmv d
JOIN users u ON d.user_id = u.user_id
GROUP BY date_part('year', order_date), date_part('month', order_date), u.city;
```

**优势**：
```yaml
分层清晰：
  - DWD：清洗
  - DWS：聚合
  - ADS：应用
  
易于理解：
  - 每层职责明确
  - 逻辑清晰
  
易于维护：
  - 修改某一层，不影响其他层
```

**第二，提高复用性**

**问题**：相同逻辑重复

```sql
-- 报表1：每日GMV
SELECT
    date_trunc('day', created_at) as order_date,
    sum(amount) as gmv
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND u.is_deleted = false
  AND p.is_active = true
GROUP BY date_trunc('day', created_at);

-- 报表2：用户GMV排名
SELECT
    u.user_id,
    sum(o.amount) as total_gmv
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND u.is_deleted = false
  AND p.is_active = true
GROUP BY u.user_id;

-- 报表3：商品GMV排名
SELECT
    p.product_id,
    sum(o.amount) as total_gmv
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND u.is_deleted = false
  AND p.is_active = true
GROUP BY p.product_id;
```

**问题分析**：
```yaml
重复逻辑：
  - 相同的JOIN
  - 相同的WHERE条件
  - 重复3次
  
问题：
  - 代码重复
  - 维护成本高
  - 容易出错
```

**分层后**：
```sql
-- DWD层：清洗数据（一次）
CREATE TABLE dwd_orders AS
SELECT
    o.order_id,
    o.created_at,
    u.user_id,
    p.product_id,
    o.amount
FROM orders o
JOIN users u ON o.user_id = u.user_id
JOIN products p ON o.product_id = p.product_id
WHERE o.status = 'completed'
  AND u.is_deleted = false
  AND p.is_active = true;

-- 报表1：每日GMV（复用DWD层）
SELECT
    date_trunc('day', created_at) as order_date,
    sum(amount) as gmv
FROM dwd_orders
GROUP BY date_trunc('day', created_at);

-- 报表2：用户GMV排名（复用DWD层）
SELECT
    user_id,
    sum(amount) as total_gmv
FROM dwd_orders
GROUP BY user_id;

-- 报表3：商品GMV排名（复用DWD层）
SELECT
    product_id,
    sum(amount) as total_gmv
FROM dwd_orders
GROUP BY product_id;
```

**优势**：
```yaml
复用性：
  - DWD层清洗一次
  - 多个报表复用
  
维护性：
  - 清洗逻辑修改一次
  - 所有报表自动更新
  
一致性：
  - 所有报表使用相同逻辑
  - 保证数据一致性
```

**第三，便于维护**

**问题**：需求变更影响所有报表

```sql
-- 原需求：只统计已完成订单
WHERE o.status = 'completed'

-- 需求变更：统计已完成和已支付订单
WHERE o.status IN ('completed', 'paid')
```

**不分层**：
```yaml
影响：
  - 需要修改所有报表
  - 可能有10个报表
  - 修改10次
  
风险：
  - 可能遗漏某些报表
  - 数据不一致
```

**分层后**：
```yaml
影响：
  - 只需修改DWD层
  - 修改一次
  - 所有报表自动更新
  
优势：
  - 降低维护成本
  - 保证数据一致性
```

#### 二、核心判断：分层的本质是"关注点分离"

> 数据仓库分层的核心判断是：通过分层设计，将不同职责的逻辑分离到不同层次，降低复杂度、提高复用性、便于维护，每层只关注自己的职责。

这个判断说明：
- **降低复杂度**：复杂逻辑分解到多层
- **提高复用性**：公共逻辑只做一次
- **便于维护**：修改只影响相关层
- **职责明确**：每层有明确的职责

#### 三、常见分层架构

##### 3.1 四层架构

**ODS层（操作数据存储）**：
```yaml
职责：
  - 原始数据副本
  - 不做清洗和转换
  
特点：
  - 数据结构与源系统一致
  - 保留原始数据
  
用途：
  - 数据备份
  - 数据回溯
```

**DWD层（明细数据层）**：
```yaml
职责：
  - 数据清洗
  - 数据统一
  - 数据关联
  
特点：
  - 清洗后的明细数据
  - 最细粒度
  
用途：
  - 明细查询
  - 基础数据层
```

**DWS层（汇总数据层）**：
```yaml
职责：
  - 数据聚合
  - 数据汇总
  
特点：
  - 按维度汇总
  - 预计算
  
用途：
  - 加速查询
  - 公共汇总数据
```

**ADS层（应用数据层）**：
```yaml
职责：
  - 面向应用
  - 准备好的数据
  
特点：
  - 直接用于报表
  - 结果数据
  
用途：
  - 报表数据
  - 仪表板数据
```

##### 3.2 数据流转

**流程图**：
```text
数据源 → ODS → DWD → DWS → ADS → 应用
          ↑      ↑     ↑     ↑     ↑
        原始   清洗   汇总   应用   展示
```

**示例**：
```sql
-- ODS层：原始数据
CREATE TABLE ods_orders AS
SELECT * FROM source_orders;

-- DWD层：清洗数据
CREATE TABLE dwd_orders AS
SELECT
    order_id,
    user_id,
    product_id,
    amount
FROM ods_orders
WHERE status = 'completed'
  AND is_deleted = false;

-- DWS层：汇总数据
CREATE TABLE dws_daily_gmv AS
SELECT
    date_trunc('day', order_time) as order_date,
    sum(amount) as gmv
FROM dwd_orders
GROUP BY date_trunc('day', order_time);

-- ADS层：应用数据
CREATE TABLE ads_monthly_gmv AS
SELECT
    date_part('year', order_date) as year,
    date_part('month', order_date) as month,
    sum(gmv) as gmv
FROM dws_daily_gmv
GROUP BY date_part('year', order_date), date_part('month', order_date);
```

#### 四、各层详细设计

##### 4.1 ODS层设计

**职责**：
```yaml
数据同步：
  - 从源系统同步数据
  - 保持数据结构一致
  
数据备份：
  - 保留原始数据
  - 不做任何修改
  
数据回溯：
  - 出问题时可以重新加载
```

**设计要点**：
```sql
-- ODS层表设计
CREATE TABLE ods_orders (
    -- 与源系统保持一致
    order_id BIGINT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2),
    status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    -- 同步时间
    etl_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 不做清洗和转换
-- 数据结构与源系统一致
```

##### 4.2 DWD层设计

**职责**：
```yaml
数据清洗：
  - 过滤无效数据
  - 补全缺失数据
  - 修正错误数据
  
数据统一：
  - 统一编码（性别、日期格式）
  - 统一命名（user_id）
  - 统一单位（金额：元）
  
数据关联：
  - JOIN维度表
  - 丰富维度信息
```

**设计要点**：
```sql
-- DWD层表设计
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
-- 数据统一
-- 数据关联
```

##### 4.3 DWS层设计

**职责**：
```yaml
数据聚合：
  - 按日期汇总
  - 按用户汇总
  - 按商品汇总
  
预计算：
  - 提前计算常用指标
  - 加速查询
  
公共汇总：
  - 多个报表复用
```

**设计要点**：
```sql
-- DWS层表设计：每日汇总
CREATE TABLE dws_daily_gmv (
    date_id INT,
    gmv NUMERIC(20,2),
    order_count BIGINT,
    user_count BIGINT,
    avg_order_value NUMERIC(10,2)
);

-- DWS层表设计：用户汇总
CREATE TABLE dws_user_gmv (
    user_id BIGINT,
    total_gmv NUMERIC(20,2),
    order_count BIGINT,
    avg_order_value NUMERIC(10,2),
    first_order_date DATE,
    last_order_date DATE
);

-- DWS层表设计：商品汇总
CREATE TABLE dws_product_gmv (
    product_id BIGINT,
    total_gmv NUMERIC(20,2),
    order_count BIGINT,
    avg_order_value NUMERIC(10,2)
);
```

##### 4.4 ADS层设计

**职责**：
```yaml
面向应用：
  - 面向具体报表
  - 面向具体仪表板
  
结果数据：
  - 数据已经准备好
  - 直接用于展示
  
业务逻辑：
  - 包含业务逻辑
  - 符合业务需求
```

**设计要点**：
```sql
-- ADS层表设计：月度GMV报表
CREATE TABLE ads_monthly_gmv_report (
    year INT,
    month INT,
    gmv NUMERIC(20,2),
    order_count BIGINT,
    gmv_growth_rate NUMERIC(5,2)  -- 同比增长率
);

-- ADS层表设计：用户留存报表
CREATE TABLE ads_user_retention_report (
    cohort_date DATE,
    cohort_size BIGINT,
    day1_retention NUMERIC(5,2),
    day7_retention NUMERIC(5,2),
    day30_retention NUMERIC(5,2)
);

-- ADS层表设计：商品销量排名
CREATE TABLE ads_product_sales_ranking (
    product_id BIGINT,
    product_name VARCHAR(100),
    total_sales BIGINT,
    rank_id INT
);
```

#### 五、分层的好处

##### 5.1 降低复杂度

**示例**：复杂查询分解

**不分层**：
```sql
-- 一个SQL包含所有逻辑（100行）
SELECT ...
FROM orders o
JOIN users u ON ...
JOIN products p ON ...
JOIN categories c ON ...
WHERE ...
GROUP BY ...
HAVING ...
ORDER BY ...;
-- 难以理解、难以维护
```

**分层后**：
```sql
-- DWD层：数据清洗（20行）
CREATE TABLE dwd_orders AS ...;

-- DWS层：数据聚合（20行）
CREATE TABLE dws_daily_gmv AS ...;

-- ADS层：应用数据（20行）
CREATE TABLE ads_monthly_gmv AS ...;

-- 应用层：简单查询（10行）
SELECT * FROM ads_monthly_gmv;
-- 总共70行，逻辑清晰，易于维护
```

##### 5.2 提高复用性

**示例**：公共汇总数据

**DWS层**：
```sql
-- 公共汇总：每日GMV
CREATE TABLE dws_daily_gmv AS
SELECT
    date_trunc('day', order_time) as order_date,
    sum(amount) as gmv
FROM dwd_orders
GROUP BY date_trunc('day', order_time);
```

**多个应用复用**：
```sql
-- 应用1：日报表
SELECT * FROM dws_daily_gmv WHERE order_date = CURRENT_DATE;

-- 应用2：周报表
SELECT
    date_trunc('week', order_date) as week,
    sum(gmv) as weekly_gmv
FROM dws_daily_gmv
GROUP BY date_trunc('week', order_date);

-- 应用3：月报表
SELECT
    date_trunc('month', order_date) as month,
    sum(gmv) as monthly_gmv
FROM dws_daily_gmv
GROUP BY date_trunc('month', order_date);
```

##### 5.3 便于维护

**示例**：需求变更

**原需求**：GMV = 订单金额

**变更需求**：GMV = 订单金额 - 退款金额

**不分层**：
```yaml
影响：
  - 需要修改所有报表
  - 可能有10+个报表
  - 修改10+次
```

**分层后**：
```sql
-- 只需修改DWD层
UPDATE dwd_fact_orders
SET order_amount = order_amount - refund_amount;

-- 所有报表自动更新
-- 只需修改一次
```

##### 5.4 提升性能

**示例**：预计算加速查询

**不预计算**：
```sql
-- 每次查询都聚合
SELECT
    date_trunc('month', order_time) as month,
    sum(amount) as gmv
FROM dwd_orders
WHERE order_time >= '2026-01-01'
GROUP BY date_trunc('month', order_time);
-- 每次扫描1亿行，耗时30秒
```

**预计算后**：
```sql
-- DWS层预计算
CREATE TABLE dws_daily_gmv AS
SELECT
    order_date,
    sum(amount) as gmv
FROM dwd_orders
GROUP BY order_date;

-- 查询预计算结果
SELECT
    date_trunc('month', order_date) as month,
    sum(gmv) as gmv
FROM dws_daily_gmv
WHERE order_date >= '2026-01-01'
GROUP BY date_trunc('month', order_date);
-- 只扫描365行，耗时100ms
```

#### 六、常见误区

**误区一：分层越多越好**

- **说明**：分层要根据需求，不是越多越好
- **后果**：过度设计，维护成本高
- **正确理解**：
  - 根据项目规模选择
  - 小项目：3层（ODS-DWD-ADS）
  - 大项目：4-5层（ODS-DWD-DWS-ADS）

**误区二：所有项目都需要分层**

- **说明**：简单项目可以不分层
- **后果**：过度设计
- **正确理解**：
  - 简单项目：不分层也可以
  - 复杂项目：分层设计
  - 根据需求判断

**误区三：ODS层可以省略**

- **说明**：ODS层有重要价值，不建议省略
- **后果**：无法回溯数据
- **正确理解**：
  - ODS层：数据备份
  - 出问题时可以重新加载
  - 建议保留

**误区四：DWS层和ADS层可以合并**

- **说明**：DWS层是公共汇总，ADS层是特定应用，建议分开
- **后果**：复用性差
- **正确理解**：
  - DWS层：公共汇总，多个应用复用
  - ADS层：特定应用，单一应用使用
  - 建议分开

**误区五：分层后性能一定更好**

- **说明**：分层不直接提升性能，通过预计算才能提升性能
- **后果**：期望过高
- **正确理解**：
  - 分层主要是降低复杂度、提高复用性
  - 预计算才能提升性能
  - 合理设计DWS层

#### 七、实战任务

**任务1：设计分层架构**

设计一个电商数据仓库的分层架构：

```yaml
ODS层：
  - ods_orders：订单原始数据
  - ods_users：用户原始数据
  - ods_products：商品原始数据

DWD层：
  - dwd_fact_orders：订单事实表（清洗后）
  - dim_date：日期维度表
  - dim_users：用户维度表
  - dim_products：商品维度表

DWS层：
  - dws_daily_gmv：每日GMV汇总
  - dws_user_gmv：用户GMV汇总
  - dws_product_gmv：商品GMV汇总

ADS层：
  - ads_monthly_gmv_report：月度GMV报表
  - ads_user_retention_report：用户留存报表
  - ads_product_ranking：商品销量排名
```

**任务2：实现数据流转**

实现从ODS到ADS的数据流转：

```sql
-- 1. ODS层：原始数据
CREATE TABLE ods_orders AS
SELECT * FROM source_orders;

-- 2. DWD层：清洗数据
CREATE TABLE dwd_fact_orders AS
SELECT
    order_id,
    to_date(created_at) as order_date,
    user_id,
    product_id,
    amount
FROM ods_orders
WHERE status = 'completed'
  AND is_deleted = false;

-- 3. DWS层：汇总数据
CREATE TABLE dws_daily_gmv AS
SELECT
    order_date,
    sum(amount) as gmv,
    count(*) as order_count
FROM dwd_fact_orders
GROUP BY order_date;

-- 4. ADS层：应用数据
CREATE TABLE ads_monthly_gmv_report AS
SELECT
    date_part('year', order_date) as year,
    date_part('month', order_date) as month,
    sum(gmv) as gmv
FROM dws_daily_gmv
GROUP BY date_part('year', order_date), date_part('month', order_date);
```

**任务3：评估分层收益**

评估分层设计的收益：

```yaml
复杂度：
  不分层：
    - 每个报表SQL 100行
    - 10个报表：1000行
  
  分层后：
    - DWD层SQL 20行
    - DWS层SQL 20行
    - ADS层SQL 20行
    - 应用层SQL 10行
    - 总共：70行 + 10*10行 = 170行
  
  收益：代码减少83%

复用性：
  不分层：
    - 清洗逻辑重复10次
    - 汇总逻辑重复10次
  
  分层后：
    - DWD层清洗1次，复用10次
    - DWS层汇总1次，复用10次
  
  收益：代码复用90%

维护性：
  不分层：
    - 需求变更，修改10个报表
    - 工作量：10次修改
  
  分层后：
    - 需求变更，修改DWD层1次
    - 工作量：1次修改
  
  收益：维护成本降低90%
```

#### 八、小结

数据仓库分层设计通过关注点分离，降低复杂度、提高复用性、便于维护。

核心要点：
- 为什么分层：降低复杂度、提高复用性、便于维护
- 核心判断：关注点分离
- 常见架构：ODS-DWD-DWS-ADS四层
- 数据流转：源→ODS→DWD→DWS→ADS→应用
- 各层职责：ODS原始、DWD清洗、DWS汇总、ADS应用
- 分层好处：降低复杂度、提高复用性、便于维护、提升性能

下一节将进入常见分层模型详解，了解ODS、DWD、DWS、ADS各层的详细设计。
