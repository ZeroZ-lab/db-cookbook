### 5.12 指标管理实战

指标体系设计好了，这一节讲怎么落地。从建立元数据表，到实现指标计算，到搭建管理平台——按照规划、实施、运营的节奏推进。

#### 第一步：建立指标元数据

核心基础设施是三张表：

```sql
-- 指标定义表
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_code VARCHAR(50) UNIQUE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_definition TEXT,
    metric_type VARCHAR(50) NOT NULL,     -- atomic/derived/composite
    business_domain VARCHAR(100) NOT NULL,
    data_source_table VARCHAR(255),
    metric_sql TEXT,
    update_frequency VARCHAR(50),
    owner VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 指标关系表
CREATE TABLE dim_metric_relations (
    relation_id INT PRIMARY KEY,
    parent_metric_id INT NOT NULL,
    child_metric_id INT NOT NULL,
    relation_type VARCHAR(50) NOT NULL,   -- calculated_from / composed_by
    FOREIGN KEY (parent_metric_id) REFERENCES dim_metrics(metric_id),
    FOREIGN KEY (child_metric_id) REFERENCES dim_metrics(metric_id)
);

-- 指标变更历史表
CREATE TABLE fact_metric_changes (
    change_id INT PRIMARY KEY,
    metric_id INT NOT NULL,
    change_type VARCHAR(50) NOT NULL,     -- create/update/deprecate
    old_value TEXT,                        -- JSON 格式
    new_value TEXT,
    change_reason TEXT,
    changed_by VARCHAR(100) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

录入第一批核心指标——原子指标先行，派生指标随后：

```sql
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain, data_source_table, metric_sql, update_frequency, owner) VALUES
('GMV', 'GMV', '已完成订单金额（order_status=''completed''，不含退款）', 'atomic', 'order', 'dwd_fact_orders',
 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed'' AND is_refunded = false',
 'T+1 4:00', '张三'),

('ORDER_COUNT', '订单数', '已完成订单数量', 'atomic', 'order', 'dwd_fact_orders',
 'SELECT count(*) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三'),

('AVG_ORDER_AMOUNT', '客单价', 'GMV / 订单数', 'derived', 'order', 'dws_daily_metrics',
 'SELECT gmv / order_count FROM dws_daily_metrics',
 'T+1 4:30', '张三'),

('CONVERSION_RATE', '转化率', '转化用户数 / 访客数 × 100%', 'derived', 'user', 'dws_daily_metrics',
 'SELECT conversion_user_count * 1.0 / visitor_count * 100 FROM dws_daily_metrics',
 'T+1 4:30', '李四');
```

#### 第二步：实现指标计算

用存储过程封装计算逻辑，保证幂等性（同一天数据跑两次结果不变）：

```sql
CREATE OR REPLACE FUNCTION calc_daily_metrics(p_date DATE)
RETURNS void AS $$
BEGIN
    -- 原子指标（幂等：先删旧数据再插新数据）
    DELETE FROM dws_daily_atomic_metrics WHERE metric_date = p_date;

    INSERT INTO dws_daily_atomic_metrics (metric_date, order_count, gmv, user_count)
    SELECT p_date,
           count(*) FILTER (WHERE order_status = 'completed'),
           sum(order_amount) FILTER (WHERE order_status = 'completed' AND is_refunded = false),
           count(DISTINCT user_id) FILTER (WHERE order_status = 'completed')
    FROM dwd_fact_orders
    WHERE date_id = EXTRACT(YEAR FROM p_date) * 10000 +
                    EXTRACT(MONTH FROM p_date) * 100 +
                    EXTRACT(DAY FROM p_date)
    ON CONFLICT (metric_date) DO UPDATE SET
        order_count = EXCLUDED.order_count,
        gmv = EXCLUDED.gmv,
        user_count = EXCLUDED.user_count;

    -- 派生指标
    DELETE FROM dws_daily_derived_metrics WHERE metric_date = p_date;

    INSERT INTO dws_daily_derived_metrics (metric_date, avg_order_amount, gmv_per_user)
    SELECT p_date,
           gmv / NULLIF(order_count, 0),
           gmv / NULLIF(user_count, 0)
    FROM dws_daily_atomic_metrics
    WHERE metric_date = p_date;

    -- 记录 ETL 日志
    INSERT INTO etl_logs (table_name, operation, status, rows_affected, created_at)
    VALUES ('dws_daily_metrics', 'calc_daily_metrics', 'success',
            (SELECT count(*) FROM dws_daily_atomic_metrics WHERE metric_date = p_date),
            NOW());

EXCEPTION WHEN OTHERS THEN
    INSERT INTO etl_logs (table_name, operation, status, error_message, created_at)
    VALUES ('dws_daily_metrics', 'calc_daily_metrics', 'error', SQLERRM, NOW());
    RAISE;
END;
$$ LANGUAGE plpgsql;
```

#### 第三步：创建定时任务

生产环境中用调度系统（Airflow、DolphinScheduler 或简单的 cron）定时触发：

```bash
#!/bin/bash
# /opt/dw/scripts/calc_daily_metrics.sh
export PGHOST="localhost"
export PGDATABASE="data_warehouse"
export PGUSER="postgres"

yesterday=$(date -d "yesterday" +%Y-%m-%d)
echo "[$(date)] Calculating metrics for $yesterday"
psql -c "SELECT calc_daily_metrics('$yesterday');"

if [ $? -eq 0 ]; then
    echo "[$(date)] Calculation completed"
else
    echo "[$(date)] ERROR: Calculation failed" >&2
    exit 1
fi
```

cron 配置：`0 4 * * * /opt/dw/scripts/calc_daily_metrics.sh >> /var/log/metrics.log 2>&1`

#### 第四步：指标管理平台

指标管理平台解决的核心问题是：让业务方自己查指标定义，不用每次都问数据分析师。平台的核心功能：

1. **指标查询**：搜索指标名称/编码，查看完整定义（口径、SQL、负责人、更新频率）
2. **指标申请**：新指标申请 → 评审 → 开发 → 上线，全流程可追踪
3. **指标数据**：查看历史趋势、导出数据、对接 BI 工具
4. **指标监控**：数据质量检查结果、计算任务状态、异常告警

技术选型上，简单的方案是一套 Flask/FastAPI 后端 + React/Vue 前端。后端提供 RESTful API：

```
GET  /api/metrics                -- 查询所有指标
GET  /api/metrics/{code}         -- 查询单个指标详情
GET  /api/metrics/{code}/data    -- 查询指标历史数据
POST /api/metrics                -- 创建新指标
```

指标的定义和计算 SQL 存储在 dim_metrics 表里，平台只是读取和展示。指标值的查询则路由到 dws 或 ads 层的表。

#### 持续运营

指标体系不是一建成型的东西。你需要：

**定期评审**。月度评审：哪些指标使用率为零？考虑下线。季度评审：指标体系是否仍然覆盖业务重点？需要新增哪些？年度评审：整个指标体系的架构是否需要调整？

**变更管理**。指标定义变更（比如 GMV 口径从"不含退款"变成"含退款"）必须有审批流程。所有变更记录在 fact_metric_changes 表里。变更通知所有使用该指标的报表负责人。

**推广培训**。指标管理平台建好了没人用是常态。你需要：给业务方做培训（怎么查指标、怎么理解定义）、把平台链接放到 BI 工具的首页、在每次经营分析会上用平台的数据（而不是分析师自己导出的 Excel）。

#### 常见误区

**"一次建设，一劳永逸"**。指标体系需要持续维护。业务变化 → 指标要跟，数据增长 → 计算逻辑要优化，人员变动 → 知识要交接。一个 3 年不维护的指标表里至少 30% 的指标是废的。

**"平台建好就有人用"**。平台只是工具，运营是关键。数据分析师习惯了写自己的 SQL，不会主动去平台查定义。需要强制规则：报表引用的指标必须有 metric_code，新人必须先查平台再写 SQL。

**"指标越多越好"**。指标在精不在多。一个电商团队通常 20-40 个核心指标就够用。超过 100 个指标意味着：要么很多没人看，要么很多是重复的（只是维度不同）。

**"技术团队独自负责"**。指标口径是业务决策，不是技术决策。"订单金额是否包含退款"这个问题，必须由业务方（通常是财务或运营负责人）拍板。技术上可以实现任何一种，但口径的权威性来自业务方。

---

第 5 章覆盖了数据仓库建模的完整链路：为什么业务库不适合做分析 → 数仓核心概念和四层架构 → 维度建模（事实表、维度表、星型模型）→ 分层实施策略 → 指标体系设计和管理。这一章的内容是后面 ETL（第 6 章）、批处理（第 7 章）和 OLAP 数据库（第 9 章）的基础——ETL 负责把数据从业务库搬进这四层架构里，批处理负责驱动各层之间的数据流转，OLAP 数据库正是实现这套建模的物理存储引擎。
