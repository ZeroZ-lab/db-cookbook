### 5.11 指标体系设计

上一节学习了常见建模模式，了解了垃圾维度、桥接表、角色扮演维度等设计模式。

现在学习如何设计指标体系。

**场景**：
```yaml
数据仓库建设完成后：
  
业务方："我需要GMV、DAU、留存率、转化率..."
  
数据分析师："好的，我来计算这些指标"
  
新员工："什么是GMV？什么是DAU？如何定义？"
  
数据架构师："我们需要建立统一的指标体系"
```

**问题**：
- 什么是指标体系？
- 为什么需要指标体系？
- 如何设计指标体系？
- 如何管理指标？

**答案**：**建立分层、分类、可管理的指标体系，确保指标定义一致、计算准确**

#### 一、为什么需要指标体系

**第一，指标定义混乱**

**问题**：
```yaml
场景1：GMV定义不一致
  数据分析师A："GMV = 所有订单金额（含未支付）"
  数据分析师B："GMV = 已支付订单金额"
  数据分析师C："GMV = 已完成订单金额（不含退款）"
  
结果：
  - 同一个GMV，不同人计算结果不同
  - 数据对比困难
  - 决策依据不准确
```

**场景2：DAU定义不一致**
```yaml
数据产品A："DAU = 当天登录用户数"
数据产品B："DAU = 当天活跃用户数（有行为）"
数据产品C："DAU = 当天去重用户数（UV）"

结果：
  - DAU数据波动大
  - 无法判断真实增长
```

**第二，指标重复建设**

```yaml
问题：
  - 每个数据分析师各自计算指标
  - 重复开发相同指标
  - 浪费资源
  
示例：
  - 计算GMV的SQL有10个版本
  - 每个版本略有不同
  - 维护成本高
```

**第三，指标口径不透明**

```yaml
问题：
  - 业务方不知道指标如何计算
  - 不理解指标含义
  - 不信任数据
  
示例：
  - 报表显示GMV增长20%
  - 业务方："怎么算的？包含哪些订单？"
  - 数据分析师："这个...让我看看SQL..."
```

#### 二、指标体系的核心概念

##### 2.1 指标的定义

**定义**：衡量业务目标的量化标准

**示例**：
```yaml
电商指标：
  - GMV（成交金额）
  - 订单量
  - DAU（日活跃用户数）
  - 转化率
  - 留存率
  
用户指标：
  - 新增用户数
  - 活跃用户数
  - 流失用户数
  - 用户生命周期价值（LTV）
  
商品指标：
  - 销量
  - 销售额
  - 库存周转天数
  - 毛利率
```

##### 2.2 指标的构成

**构成要素**：
```yaml
指标名称：
  - GMV
  - DAU
  - 转化率
  
指标定义：
  - GMV = 已完成订单金额（不含退款）
  - DAU = 当天有行为的去重用户数
  - 转化率 = 转化用户数 / 访问用户数 × 100%
  
计算口径：
  - 时间范围：最近30天
  - 用户范围：所有用户
  - 订单范围：已完成订单
  - 排除范围：退款订单
  
数据来源：
  - 数据表：fact_orders
  - 字段：order_amount, order_status
  - 过滤条件：order_status = 'completed'
  
更新频率：
  - T+1更新
  - 每天4:00更新
```

##### 2.3 原子指标 vs 派生指标

**原子指标（Atomic Metric）**：
```yaml
定义：
  - 最基础的指标
  - 不可再分
  
示例：
  - 订单数（count(order_id)）
  - 订单金额（sum(order_amount)）
  - 用户数（count(DISTINCT user_id)）
```

**派生指标（Derived Metric）**：
```yaml
定义：
  - 基于原子指标计算
  - 可以是多个原子指标的组合
  
示例：
  - 客单价 = GMV / 订单数
  - 人均GMV = GMV / 用户数
  - 转化率 = 转化用户数 / 访问用户数 × 100%
  - 复购率 = 复购用户数 / 购买用户数 × 100%
```

**示例**：
```sql
-- 原子指标1：GMV
SELECT sum(order_amount) as gmv
FROM fact_orders
WHERE order_status = 'completed';

-- 原子指标2：订单数
SELECT count(*) as order_count
FROM fact_orders
WHERE order_status = 'completed';

-- 原子指标3：用户数
SELECT count(DISTINCT user_id) as user_count
FROM fact_orders
WHERE order_status = 'completed';

-- 派生指标1：客单价（客单价 = GMV / 订单数）
SELECT 
    sum(order_amount) / count(*) as avg_order_amount
FROM fact_orders
WHERE order_status = 'completed';

-- 派生指标2：人均GMV（人均GMV = GMV / 用户数）
SELECT 
    sum(order_amount) / count(DISTINCT user_id) as gmv_per_user
FROM fact_orders
WHERE order_status = 'completed';

-- 派生指标3：转化率（转化率 = 转化用户数 / 访问用户数）
SELECT 
    count(DISTINCT CASE WHEN order_status = 'completed' THEN user_id END) * 1.0 / 
    count(DISTINCT user_id) as conversion_rate
FROM fact_orders;
```

#### 三、指标体系的设计原则

##### 3.1 原则1：指标可理解

**定义**：指标名称和定义要清晰易懂

**示例**：
```sql
-- 不好的指标名称
SELECT sum(amount) as metric_1;
-- 问题：metric_1是什么？

-- 好的指标名称
SELECT sum(order_amount) as gmv_completed;
-- 清晰：已完成订单的GMV

-- 不好的定义
GMV = 订单金额
-- 问题：哪些订单？包含退款吗？

-- 好的定义
GMV = 已完成订单金额（order_status='completed'，不含退款订单）
-- 清晰：明确说明口径
```

##### 3.2 原则2：指标可计算

**定义**：指标要有明确的计算方法

**示例**：
```sql
-- 清晰的计算方法
-- 指标：转化率
-- 定义：转化用户数 / 访问用户数 × 100%
-- SQL：
WITH visiting_users AS (
    SELECT DISTINCT user_id
    FROM fact_events
    WHERE event_type = 'page_view'
    AND date_id = 20260101
),
converting_users AS (
    SELECT DISTINCT user_id
    FROM fact_orders
    WHERE date_id = 20260101
    AND order_status = 'completed'
)
SELECT 
    count(*) FILTER (FROM converting_users) * 1.0 / count(*) as conversion_rate
FROM visiting_users;
```

##### 3.3 原则3：指标可追踪

**定义**：指标要有数据来源和更新时间

**示例**：
```yaml
指标：GMV
数据来源：
  - 表名：dwd_fact_orders
  - 字段：order_amount
  - 过滤条件：order_status = 'completed'
  
计算逻辑：
  - SQL：SELECT sum(order_amount) FROM dwd_fact_orders WHERE ...
  
更新频率：
  - T+1更新
  - 每天凌晨4点
  
负责人：
  - 数据分析师：张三
  - 数据工程师：李四
```

##### 3.4 原则4：指标可管理

**定义**：指标要有统一的元数据管理

**示例**：
```sql
-- 指标元数据表
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_name VARCHAR(100),          -- 指标名称
    metric_definition TEXT,            -- 指标定义
    metric_type VARCHAR(50),           -- 指标类型（原子/派生）
    metric_sql TEXT,                   -- 计算SQL
    data_source_table VARCHAR(100),    -- 数据来源表
    data_source_field VARCHAR(100),    -- 数据来源字段
    update_frequency VARCHAR(50),      -- 更新频率
    owner VARCHAR(100),                -- 负责人
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 示例数据
INSERT INTO dim_metrics VALUES
(1, 'GMV', '已完成订单金额（不含退款）', '原子', 
 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'dwd_fact_orders', 'order_amount', 'T+1 4:00', '张三', NOW(), NOW()),
 
(2, '转化率', '转化用户数 / 访问用户数 × 100%', '派生',
 'SELECT ...',
 'fact_events, fact_orders', 'user_id', 'T+1 4:00', '张三', NOW(), NOW());
```

#### 四、指标体系的架构设计

##### 4.1 分层架构

**三层架构**：
```yaml
第1层：原子指标层（Atomic Metrics）
  - 最基础的指标
  - 不可再分
  - 例如：订单数、GMV、用户数
  
第2层：派生指标层（Derived Metrics）
  - 基于原子指标计算
  - 例如：客单价、转化率、复购率
  
第3层：复合指标层（Composite Metrics）
  - 基于派生指标计算
  - 例如：GMV增长率、DAU环比、用户价值分层
```

**示例**：
```sql
-- 第1层：原子指标
CREATE TABLE atomic_metrics (
    metric_date DATE,
    order_count BIGINT,
    gmv NUMERIC(20,2),
    user_count BIGINT
);

-- 第2层：派生指标
CREATE TABLE derived_metrics (
    metric_date DATE,
    avg_order_amount NUMERIC(10,2),      -- GMV / 订单数
    gmv_per_user NUMERIC(10,2),          -- GMV / 用户数
    conversion_rate NUMERIC(5,2)         -- 转化用户数 / 用户数
);

-- 第3层：复合指标
CREATE TABLE composite_metrics (
    metric_date DATE,
    gmv_growth_rate NUMERIC(5,2),        -- GMV环比增长率
    gmv_mom NUMERIC(5,2),                -- GMV环比
    gmv_yoy NUMERIC(5,2),                -- GMV同比
    user_ltv NUMERIC(10,2),              -- 用户生命周期价值
    user_segment VARCHAR(50)             -- 用户价值分层
);
```

##### 4.2 指标数据流

**数据流**：
```yaml
第1步：数据源（DWD层）
  - fact_orders（订单事实表）
  - fact_events（用户行为事实表）
  
第2步：原子指标计算（DWS层）
  - 计算原子指标
  - 按天汇总
  
第3步：派生指标计算（DWS层）
  - 基于原子指标计算
  - 按天汇总
  
第4步：复合指标计算（ADS层）
  - 基于派生指标计算
  - 支撑报表和仪表板
```

**示例**：
```sql
-- 第2步：原子指标（DWS层）
CREATE TABLE dws_daily_atomic_metrics AS
SELECT
    date_id,
    count(*) as order_count,
    sum(order_amount) as gmv,
    count(DISTINCT user_id) as user_count
FROM dwd_fact_orders
WHERE order_status = 'completed'
GROUP BY date_id;

-- 第3步：派生指标（DWS层）
CREATE TABLE dws_daily_derived_metrics AS
SELECT
    date_id,
    gmv / order_count as avg_order_amount,
    gmv / user_count as gmv_per_user,
    conversion_rate
FROM dws_daily_atomic_metrics;

-- 第4步：复合指标（ADS层）
CREATE TABLE ads_monthly_report AS
SELECT
    year,
    month,
    sum(gmv) as monthly_gmv,
    sum(gmv) / LAG(sum(gmv)) OVER (ORDER BY year, month) - 1 as gmv_mom,
    sum(gmv) / LAG(sum(gmv), 12) OVER (ORDER BY year, month) - 1 as gmv_yoy
FROM dws_daily_derived_metrics
GROUP BY year, month;
```

#### 五、指标体系的管理

##### 5.1 指标元数据管理

**元数据表设计**：
```sql
-- 指标定义表
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_code VARCHAR(50),            -- 指标编码
    metric_name VARCHAR(100),           -- 指标名称
    metric_definition TEXT,             -- 指标定义
    metric_type VARCHAR(50),            -- 指标类型（atomic/derived/composite）
    business_domain VARCHAR(100),       -- 业务域（order/user/product）
    data_source_table VARCHAR(100),     -- 数据来源表
    metric_sql TEXT,                    -- 计算SQL
    update_frequency VARCHAR(50),       -- 更新频率
    owner VARCHAR(100),                 -- 负责人
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 指标关系表
CREATE TABLE dim_metric_relations (
    relation_id INT PRIMARY KEY,
    parent_metric_id INT,               -- 父指标ID
    child_metric_id INT,                -- 子指标ID
    relation_type VARCHAR(50)           -- 关系类型（composed_by/calculated_from）
);

-- 指标维度表
CREATE TABLE dim_metric_dimensions (
    dimension_id INT PRIMARY KEY,
    metric_id INT,
    dimension_name VARCHAR(100),        -- 维度名称
    dimension_value VARCHAR(100)        -- 维度值
);
```

**示例数据**：
```sql
-- 原子指标：GMV
INSERT INTO dim_metrics VALUES
(1, 'GMV', 'GMV', '已完成订单金额（不含退款）', 'atomic',
 'order', 'dwd_fact_orders',
 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三', NOW(), NOW());

-- 原子指标：订单数
INSERT INTO dim_metrics VALUES
(2, 'ORDER_COUNT', '订单数', '已完成订单数量', 'atomic',
 'order', 'dwd_fact_orders',
 'SELECT count(*) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三', NOW(), NOW());

-- 派生指标：客单价
INSERT INTO dim_metrics VALUES
(3, 'AVG_ORDER_AMOUNT', '客单价', 'GMV / 订单数', 'derived',
 'order', 'dws_daily_metrics',
 'SELECT gmv / order_count FROM dws_daily_metrics',
 'T+1 4:30', '张三', NOW(), NOW());

-- 指标关系
INSERT INTO dim_metric_relations VALUES
(1, 3, 1, 'calculated_from'),  -- 客单价由GMV计算
(2, 3, 2, 'calculated_from');  -- 客单价由订单数计算
```

##### 5.2 指标数据管理

**指标数据表**：
```sql
-- 指标数据表（存储指标值）
CREATE TABLE fact_metrics (
    metric_id INT,
    metric_date DATE,
    metric_value NUMERIC(20,2),
    dimension_values JSONB,            -- 维度值（JSON格式）
    created_at TIMESTAMP,
    PRIMARY KEY (metric_id, metric_date, dimension_values)
);

-- 示例数据
INSERT INTO fact_metrics VALUES
(1, '2026-01-01', 1000000.00, '{"channel": "app"}', NOW()),
(1, '2026-01-01', 500000.00, '{"channel": "web"}', NOW()),
(2, '2026-01-01', 10000.00, '{"channel": "app"}', NOW()),
(2, '2026-01-01', 5000.00, '{"channel": "web"}', NOW());

-- 查询：某个指标的数据
SELECT 
    m.metric_name,
    f.metric_date,
    f.metric_value,
    f.dimension_values->>'channel' as channel
FROM fact_metrics f
JOIN dim_metrics m ON f.metric_id = m.metric_id
WHERE m.metric_code = 'GMV'
AND f.metric_date = '2026-01-01';
```

##### 5.3 指标质量管理

**质量检查**：
```sql
-- 指标质量检查表
CREATE TABLE dq_metric_checks (
    check_id INT PRIMARY KEY,
    metric_id INT,
    check_date DATE,
    check_type VARCHAR(50),            -- 检查类型（completeness/accuracy/timeliness）
    check_result VARCHAR(50),          -- 检查结果（pass/fail）
    check_detail TEXT,                 -- 检查详情
    created_at TIMESTAMP
);

-- 检查1：完整性检查（是否有空值）
INSERT INTO dq_metric_checks
SELECT 
    1 as check_id,
    m.metric_id,
    CURRENT_DATE as check_date,
    'completeness' as check_type,
    CASE 
        WHEN f.metric_value IS NULL THEN 'fail'
        ELSE 'pass'
    END as check_result,
    '检查指标值是否为空' as check_detail,
    NOW()
FROM dim_metrics m
LEFT JOIN fact_metrics f ON m.metric_id = f.metric_id AND f.metric_date = CURRENT_DATE;

-- 检查2：准确性检查（是否在合理范围内）
INSERT INTO dq_metric_checks
SELECT 
    2 as check_id,
    m.metric_id,
    CURRENT_DATE as check_date,
    'accuracy' as check_type,
    CASE 
        WHEN f.metric_value < 0 THEN 'fail'
        WHEN f.metric_value > 10000000000 THEN 'fail'
        ELSE 'pass'
    END as check_result,
    '检查指标值是否在合理范围内' as check_detail,
    NOW()
FROM dim_metrics m
JOIN fact_metrics f ON m.metric_id = f.metric_id AND f.metric_date = CURRENT_DATE;

-- 检查3：及时性检查（是否按时更新）
INSERT INTO dq_metric_checks
SELECT 
    3 as check_id,
    m.metric_id,
    CURRENT_DATE as check_date,
    'timeliness' as check_type,
    CASE 
        WHEN f.created_at < CURRENT_TIMESTAMP - INTERVAL '2 hours' THEN 'fail'
        ELSE 'pass'
    END as check_result,
    '检查指标是否按时更新' as check_detail,
    NOW()
FROM dim_metrics m
JOIN fact_metrics f ON m.metric_id = f.metric_id AND f.metric_date = CURRENT_DATE;
```

#### 六、常见误区

**误区一：指标越多越好**

- **说明**：指标要根据业务需求，不是越多越好
- **后果**：指标过多，管理困难
- **正确理解**：
  - 根据业务目标设计指标
  - 专注核心指标
  - 避免指标泛滥

**误区二：指标就是数字**

- **说明**：指标要有定义、口径、来源
- **后果**：指标混乱
- **正确理解**：
  - 指标要有明确定义
  - 指标要有计算口径
  - 指标要有数据来源

**误区三：指标一成不变**

- **说明**：指标要根据业务发展调整
- **后果**：指标失效
- **正确理解**：
  - 定期评估指标
  - 及时更新指标
  - 淘汰无效指标

**误区四：指标不需要管理**

- **说明**：指标需要统一管理
- **后果**：指标混乱
- **正确理解**：
  - 建立指标元数据
  - 统一管理指标
  - 指标可追溯

**误区五：指标可以随意定义**

- **说明**：指标定义要经过评审
- **后果**：口径不一致
- **正确理解**：
  - 指标定义要评审
  - 达成共识
  - 统一口径

#### 七、实战任务

**任务1：设计指标体系**

设计电商的指标体系：

```sql
-- 原子指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain) VALUES
('GMV', 'GMV', '已完成订单金额', 'atomic', 'order'),
('ORDER_COUNT', '订单数', '已完成订单数量', 'atomic', 'order'),
('USER_COUNT', '用户数', '去重用户数', 'atomic', 'user'),
('VISIT_COUNT', '访问次数', 'PV', 'atomic', 'user'),
('VISITOR_COUNT', '访客数', 'UV', 'atomic', 'user');

-- 派生指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain) VALUES
('AVG_ORDER_AMOUNT', '客单价', 'GMV / 订单数', 'derived', 'order'),
('GMV_PER_USER', '人均GMV', 'GMV / 用户数', 'derived', 'order'),
('CONVERSION_RATE', '转化率', '转化用户数 / 访问用户数 × 100%', 'derived', 'user'),
('REPURCHASE_RATE', '复购率', '复购用户数 / 购买用户数 × 100%', 'derived', 'user');

-- 复合指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain) VALUES
('GMV_MOM', 'GMV环比', '本月GMV / 上月GMV - 1', 'composite', 'order'),
('GMV_YOY', 'GMV同比', '今年GMV / 去年GMV - 1', 'composite', 'order'),
('USER_LTV', '用户生命周期价值', '用户总GMV', 'composite', 'user');

-- 指标关系
INSERT INTO dim_metric_relations (parent_metric_id, child_metric_id, relation_type) VALUES
-- 客单价 = GMV / 订单数
(3, 1, 'calculated_from'),
(3, 2, 'calculated_from'),
-- 人均GMV = GMV / 用户数
(4, 1, 'calculated_from'),
(4, 3, 'calculated_from'),
-- 转化率 = 转化用户数 / 访问用户数
(5, 3, 'calculated_from'),
(5, 5, 'calculated_from');
```

**任务2：实现指标计算**

实现指标计算SQL：

```sql
-- 原子指标计算
CREATE TABLE dws_daily_atomic_metrics AS
SELECT
    date_id,
    -- 订单相关
    count(*) FILTER (WHERE order_status = 'completed') as order_count,
    sum(order_amount) FILTER (WHERE order_status = 'completed') as gmv,
    count(DISTINCT user_id) FILTER (WHERE order_status = 'completed') as user_count,
    -- 用户行为相关
    count(*) FILTER (WHERE event_type = 'page_view') as visit_count,
    count(DISTINCT user_id) FILTER (WHERE event_type = 'page_view') as visitor_count
FROM (
    -- 订单事实表
    SELECT order_id, date_id, user_id, order_amount, order_status, NULL as event_type
    FROM dwd_fact_orders
    
    UNION ALL
    
    -- 用户行为事实表
    SELECT event_id, date_id, user_id, NULL as order_amount, NULL as order_status, event_type
    FROM dwd_fact_events
) combined_data
GROUP BY date_id;

-- 派生指标计算
CREATE TABLE dws_daily_derived_metrics AS
SELECT
    date_id,
    -- 客单价 = GMV / 订单数
    gmv / NULLIF(order_count, 0) as avg_order_amount,
    -- 人均GMV = GMV / 用户数
    gmv / NULLIF(user_count, 0) as gmv_per_user,
    -- 转化率 = 购买用户数 / 访客数
    user_count * 1.0 / NULLIF(visitor_count, 0) as conversion_rate
FROM dws_daily_atomic_metrics;

-- 复合指标计算
CREATE TABLE ads_monthly_metrics AS
SELECT
    date_id,
    gmv,
    LAG(gmv) OVER (ORDER BY date_id) as prev_gmv,
    LAG(gmv, 30) OVER (ORDER BY date_id) as prev_month_gmv,
    -- GMV环比 = (今日GMV - 昨日GMV) / 昨日GMV
    (gmv - LAG(gmv) OVER (ORDER BY date_id)) / LAG(gmv) OVER (ORDER BY date_id) as gmv_mom,
    -- GMV环比30天 = (今日GMV - 30天前GMV) / 30天前GMV
    (gmv - LAG(gmv, 30) OVER (ORDER BY date_id)) / LAG(gmv, 30) OVER (ORDER BY date_id) as gmv_mom_30d
FROM dws_daily_derived_metrics;
```

**任务3：设计指标质量检查**

设计指标质量检查：

```sql
-- 质量检查1：数据完整性
CREATE TABLE dq_metric_completeness AS
SELECT
    date_id,
    'order_count' as metric_name,
    CASE 
        WHEN order_count IS NULL THEN 'fail'
        ELSE 'pass'
    END as check_result
FROM dws_daily_atomic_metrics

UNION ALL

SELECT
    date_id,
    'gmv' as metric_name,
    CASE 
        WHEN gmv IS NULL THEN 'fail'
        ELSE 'pass'
    END as check_result
FROM dws_daily_atomic_metrics;

-- 质量检查2：数据准确性
CREATE TABLE dq_metric_accuracy AS
SELECT
    date_id,
    'gmv' as metric_name,
    CASE 
        WHEN gmv < 0 THEN 'fail'
        WHEN gmv > 10000000000 THEN 'fail'
        ELSE 'pass'
    END as check_result
FROM dws_daily_atomic_metrics;

-- 质量检查3：数据合理性
CREATE TABLE dq_metric_sanity AS
SELECT
    date_id,
    'avg_order_amount' as metric_name,
    CASE 
        WHEN avg_order_amount < 0 THEN 'fail'
        WHEN avg_order_amount > 100000 THEN 'fail'
        ELSE 'pass'
    END as check_result
FROM dws_daily_derived_metrics;

-- 查询：质量检查汇总
SELECT
    date_id,
    count(*) FILTER (WHERE check_result = 'pass') as pass_count,
    count(*) FILTER (WHERE check_result = 'fail') as fail_count
FROM (
    SELECT * FROM dq_metric_completeness
    UNION ALL
    SELECT * FROM dq_metric_accuracy
    UNION ALL
    SELECT * FROM dq_metric_sanity
) combined_checks
GROUP BY date_id;
```

#### 八、小结

指标体系设计通过分层、分类、可管理的设计，确保指标定义一致、计算准确。

核心要点：
- 为什么需要指标体系：指标定义混乱、重复建设、口径不透明
- 核心概念：指标定义、指标构成、原子指标 vs 派生指标
- 设计原则：可理解、可计算、可追踪、可管理
- 架构设计：三层架构（原子、派生、复合）、指标数据流
- 指标管理：元数据管理、数据管理、质量管理
- 常见误区：不是越多越好、需要管理、要随业务调整

下一节将进入指标管理实战，了解如何在实际项目中实施指标管理。
