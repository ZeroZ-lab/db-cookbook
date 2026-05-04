### 5.11 指标体系设计

数仓把数据准备好了，下一步是定义指标。指标是业务方看到的最终产物——GMV、DAU、转化率、留存率。指标体系的目标很简单：让公司里所有人对同一个指标有完全一致的理解。

#### 指标体系解决什么问题

三个真实问题，几乎每个数仓团队都会遇到。

**定义不一致**。数据分析师 A 的 GMV 包含退款，数据分析师 B 的 GMV 不含退款。两个人在同一场经营分析会上各自报了一个 GMV 数字，CEO 不知道该信谁。

**重复建设**。公司有 5 个数据分析师，每个人各自写了计算 GMV 的 SQL。5 个 SQL 实现略有不同（排序、过滤范围），维护成本高，而且口型越来越发散。

**口径不透明**。运营总监看到 GMV 增长 20%，问"这个数字包含哪些订单？包不包含退款？包不包含未支付？"数据分析师要翻 SQL 才能回答。指标成了黑箱——用的人不了解，做的人解释不清楚。

指标体系通过"先定义再计算再管理"的流程，把这三个问题全部解决。

#### 原子指标、派生指标、复合指标

指标分三层。

**原子指标（Atomic Metric）**：不可再拆分的度量，直接从事实表聚合得出。GMV（SUM order_amount）、订单数（COUNT *）、用户数（COUNT DISTINCT user_id）。原子指标的定义要精确到字段级别：

```
GMV = SUM(fact_orders.order_amount)
      过滤条件：order_status = 'completed' AND is_refunded = false
```

**派生指标（Derived Metric）**：基于原子指标计算。客单价 = GMV / 订单数。转化率 = 转化用户数 / 访问用户数 × 100%。派生指标的值不能直接从事实表 SUM 出来，需要原子指标做中间计算。

**复合指标（Composite Metric）**：多个派生指标或原子指标的组合，通常带时间维度。GMV 环比 = (本月 GMV - 上月 GMV) / 上月 GMV。GMV 同比 = (本月 GMV - 去年同月 GMV) / 去年同月 GMV。

```sql
-- 原子指标
SELECT sum(order_amount) as gmv
FROM dwd_fact_orders WHERE order_status = 'completed';

-- 派生指标
SELECT gmv / order_count as avg_order_amount
FROM dws_daily_atomic_metrics;

-- 复合指标
SELECT (gmv - LAG(gmv) OVER (ORDER BY date_id)) / LAG(gmv) OVER (ORDER BY date_id) as gmv_mom
FROM dws_daily_derived_metrics;
```

#### 指标体系的设计原则

**可理解**。指标名称要让业务方一眼看懂。"已完成订单总金额（GMV）"比"metric_order_amt_completed"好。定义中明确写出包含什么、不包含什么。

**可计算**。每个指标必须有明确的 SQL。如果两个数据分析师写出的 SQL 不一样，说明定义不够精确。

**可追踪**。每个指标知道数据来源（哪张表、哪个字段）、计算逻辑（SQL）、更新频率（T+1 还是小时级）、负责人（谁定义、谁维护）。

**可管理**。指标放在统一的元数据表里，有唯一编码，有版本历史。新增指标要评审，过时指标要下线。这是从"人人写自己的 SQL"到"体系化管理"的关键跃迁。

#### 指标元数据管理

指标元数据表是指标体系落地的核心基础设施：

```sql
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_code VARCHAR(50) UNIQUE NOT NULL,   -- 唯一编码
    metric_name VARCHAR(100) NOT NULL,         -- 指标名称
    metric_definition TEXT,                     -- 完整定义
    metric_type VARCHAR(50) NOT NULL,           -- atomic/derived/composite
    business_domain VARCHAR(100) NOT NULL,      -- 业务域
    data_source_table VARCHAR(255),             -- 数据来源表
    metric_sql TEXT,                            -- 计算 SQL
    update_frequency VARCHAR(50),               -- 更新频率
    owner VARCHAR(100),                         -- 负责人
    status VARCHAR(50) DEFAULT 'active',        -- 状态
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 指标关系表（记录派生关系和依赖）
CREATE TABLE dim_metric_relations (
    relation_id INT PRIMARY KEY,
    parent_metric_id INT,
    child_metric_id INT,
    relation_type VARCHAR(50)  -- calculated_from / composed_by
);
```

核心指标录入：

```sql
INSERT INTO dim_metrics VALUES
(1, 'GMV', 'GMV', '已完成订单金额（不含退款）', 'atomic',
 'order', 'dwd_fact_orders',
 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed'' AND is_refunded = false',
 'T+1 4:00', '张三', 'active', NOW(), NOW()),

(2, 'ORDER_COUNT', '订单数', '已完成订单数量', 'atomic',
 'order', 'dwd_fact_orders',
 'SELECT count(*) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三', 'active', NOW(), NOW()),

(3, 'AVG_ORDER_AMOUNT', '客单价', 'GMV / 订单数', 'derived',
 'order', 'dws_daily_metrics',
 'SELECT gmv / order_count FROM dws_daily_metrics',
 'T+1 4:30', '张三', 'active', NOW(), NOW());

-- 记录依赖关系：客单价 由 GMV 和 订单数 计算得出
INSERT INTO dim_metric_relations VALUES
(1, 3, 1, 'calculated_from'),
(2, 3, 2, 'calculated_from');
```

#### 指标计算的数据流

指标计算按分层架构走：

1. 原子指标在 DWS 层计算，从 DWD 事实表聚合得出
2. 派生指标在 DWS 层计算，基于原子指标
3. 复合指标在 ADS 层计算，基于派生指标

```sql
-- DWS 层：原子指标
CREATE TABLE dws_daily_atomic_metrics AS
SELECT date_id,
       count(*) as order_count,
       sum(order_amount) as gmv,
       count(DISTINCT user_id) as user_count
FROM dwd_fact_orders
WHERE order_status = 'completed'
GROUP BY date_id;

-- DWS 层：派生指标
CREATE TABLE dws_daily_derived_metrics AS
SELECT date_id,
       gmv / order_count as avg_order_amount,
       gmv / user_count as gmv_per_user
FROM dws_daily_atomic_metrics;

-- ADS 层：复合指标
CREATE TABLE ads_monthly_report AS
SELECT year, month,
       sum(gmv) as monthly_gmv,
       sum(gmv) / LAG(sum(gmv)) OVER (ORDER BY year, month) - 1 as gmv_mom
FROM dws_daily_derived_metrics
GROUP BY year, month;
```

#### 常见误区

**"指标越多越好"**。指标泛滥是数仓常见的失败模式。一个团队追着 200 个指标看，等于一个也没看。聚焦 15-30 个核心指标（北极星指标 + 各业务线的关键指标），其余的按需查询。

**"指标定义一次就固定"**。业务在变，指标定义需要跟着演进。但变更必须有流程：评审 → 通知所有使用者 → 更新元数据 → 记录变更历史。不能悄无声息地改。

**"指标不需要管理"**。没有元数据管理的指标体系就是一团乱麻。你至少要有一张 dim_metrics 表和一份指标字典文档。否则当数据分析师离职，他写的那些 SQL 后面的人不敢改。

**"指标体系是技术团队的事"**。指标的口径定义必须由业务方参与并确认。技术团队定义 GMV 为"已完成且未退款订单金额"，但如果财务部门认为 GMV 应该含退款（因为退款也是交易的一部分），这个分歧必须由业务方拍板。技术人员负责实现，业务方负责定义。

#### 小结

指标体系的三层结构：原子指标（不可拆分的度量） → 派生指标（基于原子计算） → 复合指标（跨时间对比）。设计原则：可理解、可计算、可追踪、可管理。元数据管理（dim_metrics + dim_metric_relations）是指标落地的底座。下一节是本章最后一节——指标管理实战，讲如何从零建立指标管理体系和平台。
