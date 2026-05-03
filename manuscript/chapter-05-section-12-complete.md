### 5.12 指标管理实战

上一节学习了指标体系设计，了解了指标的分层架构、元数据管理、质量管理等。

现在学习如何在实际项目中实施指标管理。

**场景**：
```yaml
数据仓库建设进入实战阶段：
  
技术经理："指标体系设计好了，现在开始实施吧"
  
你："好的，我先建立指标元数据表，然后开发指标计算..."
  
产品经理："我们需要一个指标管理平台，让业务方可以查询指标定义"
  
数据分析师："我需要在一个地方看到所有指标，避免重复开发"
  
新同事："有没有最佳实践可以参考？"
```

**问题**：
- 如何从零开始建立指标管理体系？
- 如何实施指标计算和存储？
- 如何建立指标管理平台？
- 如何推广和运营指标体系？

**答案**：**按照规划→设计→实施→运营的流程，建立可持续的指标管理体系**

#### 一、实施前的准备

##### 1.1 需求调研

**调研对象**：
```yaml
业务方：
  - 需要哪些指标？
  - 指标如何使用？
  - 指标更新频率？
  
数据分析师：
  - 常用哪些指标？
  - 哪些指标重复计算？
  - 指标口径有什么问题？
  
数据工程师：
  - 指标如何实现？
  - 数据来源在哪里？
  - 计算逻辑是什么？
```

**调研问题**：
```yaml
指标使用：
  1. 你们日常关注哪些指标？
  2. 这些指标如何定义？
  3. 数据从哪里来？
  4. 多久更新一次？
  
痛点：
  1. 指标定义是否一致？
  2. 是否重复计算？
  3. 是否有指标不清楚？
  4. 是否有指标无法追溯？
  
期望：
  1. 希望有什么功能？
  2. 如何查询指标？
  3. 如何申请新指标？
  4. 如何管理指标？
```

**调研方法**：
```yaml
访谈：
  - 一对一访谈
  - 访谈业务方、数据分析师、数据工程师
  
问卷：
  - 设计问卷
  - 收集广泛意见
  
文档：
  - 查看现有报表
  - 查看现有SQL
  - 查看数据字典
```

##### 1.2 现状分析

**分析维度1：指标现状**
```sql
-- 分析现有指标（查看现有报表）
SELECT 
    report_name,
    indicator_name,
    indicator_definition
FROM existing_reports;

-- 分析现有SQL（查找常用指标）
-- 搜索包含"GMV"的SQL
SELECT * FROM sql_scripts WHERE script_content LIKE '%GMV%';

-- 搜索包含"DAU"的SQL
SELECT * FROM sql_scripts WHERE script_content LIKE '%DAU%';
```

**分析维度2：问题识别**
```yaml
问题1：指标定义不一致
  示例：
    - 报表A的GMV包含退款订单
    - 报表B的GMV不包含退款订单
  
问题2：指标重复计算
  示例：
    - 数据分析师A计算GMV的SQL
    - 数据分析师B计算GMV的SQL
    - 两个SQL略有不同
  
问题3：指标口径不透明
  示例：
    - 报表显示GMV增长20%
    - 但不知道如何计算
    - 无法确认是否正确
  
问题4：指标无法追溯
  示例：
    - 看到一个指标
    - 不知道谁定义的
    - 不知道数据来源
    - 不知道计算逻辑
```

**分析维度3：优先级排序**
```yaml
P0（立即处理）：
  - 核心指标（GMV、DAU、转化率）
  - 定义不一致的指标
  - 使用频率高的指标
  
P1（尽快处理）：
  - 重要指标（留存率、复购率）
  - 重复计算的指标
  - 口径不透明的指标
  
P2（逐步处理）：
  - 一般指标（浏览量、点击量）
  - 使用频率低的指标
```

#### 二、实施步骤

##### 2.1 第1步：建立指标元数据

**创建元数据表**：
```sql
-- 指标定义表
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_code VARCHAR(50) UNIQUE NOT NULL,           -- 指标编码
    metric_name VARCHAR(100) NOT NULL,                 -- 指标名称
    metric_definition TEXT,                             -- 指标定义
    metric_type VARCHAR(50) NOT NULL,                   -- 指标类型（atomic/derived/composite）
    business_domain VARCHAR(100) NOT NULL,              -- 业务域（order/user/product）
    data_source_table VARCHAR(255),                     -- 数据来源表
    metric_sql TEXT,                                    -- 计算SQL
    update_frequency VARCHAR(50),                       -- 更新频率
    owner VARCHAR(100),                                 -- 负责人
    status VARCHAR(50) DEFAULT 'active',                -- 状态（active/inactive/deprecated）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 指标关系表
CREATE TABLE dim_metric_relations (
    relation_id INT PRIMARY KEY,
    parent_metric_id INT NOT NULL,                      -- 父指标ID
    child_metric_id INT NOT NULL,                       -- 子指标ID
    relation_type VARCHAR(50) NOT NULL,                 -- 关系类型（composed_by/calculated_from）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_metric_id) REFERENCES dim_metrics(metric_id),
    FOREIGN KEY (child_metric_id) REFERENCES dim_metrics(metric_id)
);

-- 指标维度表（支持多维指标）
CREATE TABLE dim_metric_dimensions (
    dimension_id INT PRIMARY KEY,
    metric_id INT NOT NULL,
    dimension_name VARCHAR(100) NOT NULL,               -- 维度名称
    dimension_type VARCHAR(50) NOT NULL,                -- 维度类型（date/channel/product/category）
    allowed_values TEXT,                                 -- 允许的值（JSON格式）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (metric_id) REFERENCES dim_metrics(metric_id)
);

-- 指标变更历史表
CREATE TABLE fact_metric_changes (
    change_id INT PRIMARY KEY,
    metric_id INT NOT NULL,
    change_type VARCHAR(50) NOT NULL,                   -- 变更类型（create/update/delete/deprecate）
    old_value TEXT,                                      -- 旧值（JSON格式）
    new_value TEXT,                                      -- 新值（JSON格式）
    change_reason TEXT,                                  -- 变更原因
    changed_by VARCHAR(100) NOT NULL,                    -- 变更人
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (metric_id) REFERENCES dim_metrics(metric_id)
);
```

**导入基础指标**：
```sql
-- 原子指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain, data_source_table, metric_sql, update_frequency, owner) VALUES
('GMV', 'GMV', '已完成订单金额（order_status=''completed''，不含退款订单）', 'atomic', 'order', 'dwd_fact_orders', 
 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed'' AND is_refunded = false',
 'T+1 4:00', '张三'),

('ORDER_COUNT', '订单数', '已完成订单数量', 'atomic', 'order', 'dwd_fact_orders',
 'SELECT count(*) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三'),

('USER_COUNT', '用户数', '去重用户数（有订单的用户）', 'atomic', 'user', 'dwd_fact_orders',
 'SELECT count(DISTINCT user_id) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三'),

('VISITOR_COUNT', '访客数', '去重访客数（有页面浏览的用户）', 'atomic', 'user', 'dwd_fact_events',
 'SELECT count(DISTINCT user_id) FROM dwd_fact_events WHERE event_type = ''page_view''',
 'T+1 4:00', '李四'),

('CONVERSION_USER_COUNT', '转化用户数', '有完成订单的访客数', 'atomic', 'user', 'dwd_fact_orders',
 'SELECT count(DISTINCT user_id) FROM dwd_fact_orders WHERE order_status = ''completed''',
 'T+1 4:00', '张三');

-- 派生指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain, data_source_table, metric_sql, update_frequency, owner) VALUES
('AVG_ORDER_AMOUNT', '客单价', 'GMV / 订单数', 'derived', 'order', 'dws_daily_metrics',
 'SELECT gmv / order_count FROM dws_daily_metrics',
 'T+1 4:30', '张三'),

('GMV_PER_USER', '人均GMV', 'GMV / 用户数', 'derived', 'order', 'dws_daily_metrics',
 'SELECT gmv / user_count FROM dws_daily_metrics',
 'T+1 4:30', '张三'),

('CONVERSION_RATE', '转化率', '转化用户数 / 访客数 × 100%', 'derived', 'user', 'dws_daily_metrics',
 'SELECT conversion_user_count * 1.0 / visitor_count * 100 FROM dws_daily_metrics',
 'T+1 4:30', '李四');

-- 指标关系
INSERT INTO dim_metric_relations (parent_metric_id, child_metric_id, relation_type) VALUES
-- 客单价 = GMV / 订单数
(7, 1, 'calculated_from'),
(7, 2, 'calculated_from'),
-- 人均GMV = GMV / 用户数
(8, 1, 'calculated_from'),
(8, 3, 'calculated_from'),
-- 转化率 = 转化用户数 / 访客数
(9, 5, 'calculated_from'),
(9, 4, 'calculated_from');
```

##### 2.2 第2步：实现指标计算

**创建DWS层（原子指标）**：
```sql
-- 原子指标表（每日汇总）
CREATE TABLE dws_daily_atomic_metrics (
    metric_date DATE PRIMARY KEY,
    -- 订单相关指标
    order_count BIGINT,
    gmv NUMERIC(20,2),
    user_count BIGINT,
    -- 用户行为相关指标
    visitor_count BIGINT,
    visit_count BIGINT,
    -- 转化相关指标
    conversion_user_count BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_atomic_metrics_date ON dws_daily_atomic_metrics(metric_date);

-- 计算原子指标（存储过程）
CREATE OR REPLACE FUNCTION calc_atomic_metrics(p_date DATE)
RETURNS void AS $$
BEGIN
    -- 删除当天数据（幂等性）
    DELETE FROM dws_daily_atomic_metrics WHERE metric_date = p_date;
    
    -- 插入新数据
    INSERT INTO dws_daily_atomic_metrics (
        metric_date,
        order_count,
        gmv,
        user_count,
        visitor_count,
        visit_count,
        conversion_user_count
    )
    SELECT
        p_date as metric_date,
        -- 订单相关指标
        (SELECT count(*) 
         FROM dwd_fact_orders 
         WHERE order_status = 'completed' 
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as order_count,
        
        (SELECT sum(order_amount)
         FROM dwd_fact_orders 
         WHERE order_status = 'completed' 
         AND is_refunded = false
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as gmv,
        
        (SELECT count(DISTINCT user_id)
         FROM dwd_fact_orders 
         WHERE order_status = 'completed' 
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as user_count,
        
        -- 用户行为相关指标
        (SELECT count(DISTINCT user_id)
         FROM dwd_fact_events 
         WHERE event_type = 'page_view'
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as visitor_count,
        
        (SELECT count(*)
         FROM dwd_fact_events 
         WHERE event_type = 'page_view'
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as visit_count,
        
        -- 转化相关指标
        (SELECT count(DISTINCT user_id)
         FROM dwd_fact_orders 
         WHERE order_status = 'completed' 
         AND date_id = EXTRACT(YEAR FROM p_date) * 10000 + 
                     EXTRACT(MONTH FROM p_date) * 100 + 
                     EXTRACT(DAY FROM p_date)) as conversion_user_count;
    
    -- 记录日志
    INSERT INTO etl_logs (table_name, operation, status, start_time, end_time)
    VALUES ('dws_daily_atomic_metrics', 'calc_atomic_metrics', 'success', NOW(), NOW());
    
EXCEPTION WHEN OTHERS THEN
    -- 记录错误
    INSERT INTO etl_logs (table_name, operation, status, error_message, start_time, end_time)
    VALUES ('dws_daily_atomic_metrics', 'calc_atomic_metrics', 'error', SQLERRM, NOW(), NOW());
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 调用存储过程（计算昨天的数据）
SELECT calc_atomic_metrics(CURRENT_DATE - INTERVAL '1 day');
```

**创建DWS层（派生指标）**：
```sql
-- 派生指标表（每日汇总）
CREATE TABLE dws_daily_derived_metrics (
    metric_date DATE PRIMARY KEY,
    -- 派生指标
    avg_order_amount NUMERIC(10,2),
    gmv_per_user NUMERIC(10,2),
    conversion_rate NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 计算派生指标（基于原子指标）
CREATE OR REPLACE FUNCTION calc_derived_metrics(p_date DATE)
RETURNS void AS $$
BEGIN
    -- 删除当天数据
    DELETE FROM dws_daily_derived_metrics WHERE metric_date = p_date;
    
    -- 插入新数据
    INSERT INTO dws_daily_derived_metrics (
        metric_date,
        avg_order_amount,
        gmv_per_user,
        conversion_rate
    )
    SELECT
        p_date as metric_date,
        -- 客单价 = GMV / 订单数
        (gmv / NULLIF(order_count, 0)) as avg_order_amount,
        -- 人均GMV = GMV / 用户数
        (gmv / NULLIF(user_count, 0)) as gmv_per_user,
        -- 转化率 = 转化用户数 / 访客数
        (conversion_user_count * 100.0 / NULLIF(visitor_count, 0)) as conversion_rate
    FROM dws_daily_atomic_metrics
    WHERE metric_date = p_date;
    
    -- 记录日志
    INSERT INTO etl_logs (table_name, operation, status, start_time, end_time)
    VALUES ('dws_daily_derived_metrics', 'calc_derived_metrics', 'success', NOW(), NOW());
    
EXCEPTION WHEN OTHERS THEN
    -- 记录错误
    INSERT INTO etl_logs (table_name, operation, status, error_message, start_time, end_time)
    VALUES ('dws_daily_derived_metrics', 'calc_derived_metrics', 'error', SQLERRM, NOW(), NOW());
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- 调用存储过程
SELECT calc_derived_metrics(CURRENT_DATE - INTERVAL '1 day');
```

##### 2.3 第3步：创建指标API

**RESTful API设计**：
```python
# Flask API示例
from flask import Flask, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor

app = Flask(__name__)

# 数据库连接
def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        database="data_warehouse",
        user="postgres",
        password="password"
    )
    return conn

# API 1: 查询所有指标
@app.route('/api/metrics', methods=['GET'])
def get_metrics():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 查询参数
    business_domain = request.args.get('business_domain')
    metric_type = request.args.get('metric_type')
    
    # 构建SQL
    sql = "SELECT * FROM dim_metrics WHERE status = 'active'"
    params = []
    
    if business_domain:
        sql += " AND business_domain = %s"
        params.append(business_domain)
    
    if metric_type:
        sql += " AND metric_type = %s"
        params.append(metric_type)
    
    cur.execute(sql, params)
    metrics = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(metrics)

# API 2: 查询单个指标详情
@app.route('/api/metrics/<metric_code>', methods=['GET'])
def get_metric_detail(metric_code):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 查询指标详情
    cur.execute("""
        SELECT 
            m.*,
            json_agg(
                json_build_object(
                    'child_metric_id', r.child_metric_id,
                    'child_metric_code', c.metric_code,
                    'child_metric_name', c.metric_name
                )
            ) as derived_from
        FROM dim_metrics m
        LEFT JOIN dim_metric_relations r ON m.metric_id = r.parent_metric_id
        LEFT JOIN dim_metrics c ON r.child_metric_id = c.metric_id
        WHERE m.metric_code = %s
        GROUP BY m.metric_id
    """, (metric_code,))
    
    metric = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if metric:
        return jsonify(metric)
    else:
        return jsonify({'error': 'Metric not found'}), 404

# API 3: 查询指标数据
@app.route('/api/metrics/<metric_code>/data', methods=['GET'])
def get_metric_data(metric_code):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 查询参数
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    # 查询指标定义
    cur.execute("SELECT metric_sql FROM dim_metrics WHERE metric_code = %s", (metric_code,))
    metric = cur.fetchone()
    
    if not metric:
        return jsonify({'error': 'Metric not found'}), 404
    
    # 执行指标SQL
    if start_date and end_date:
        sql = f"""
            SELECT 
                metric_date,
                {metric_code.lower()} as metric_value
            FROM dws_daily_derived_metrics
            WHERE metric_date BETWEEN %s AND %s
            ORDER BY metric_date
        """
        cur.execute(sql, (start_date, end_date))
    else:
        sql = f"""
            SELECT 
                metric_date,
                {metric_code.lower()} as metric_value
            FROM dws_daily_derived_metrics
            ORDER BY metric_date DESC
            LIMIT 30
        """
        cur.execute(sql)
    
    data = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return jsonify(data)

# API 4: 创建新指标
@app.route('/api/metrics', methods=['POST'])
def create_metric():
    data = request.get_json()
    
    conn = get_db_connection()
    cur = conn.cursor()
    
    try:
        # 插入指标
        cur.execute("""
            INSERT INTO dim_metrics (
                metric_code, metric_name, metric_definition, metric_type,
                business_domain, data_source_table, metric_sql, update_frequency, owner
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING metric_id
        """, (
            data['metric_code'],
            data['metric_name'],
            data['metric_definition'],
            data['metric_type'],
            data['business_domain'],
            data.get('data_source_table'),
            data.get('metric_sql'),
            data.get('update_frequency', 'T+1'),
            data.get('owner', 'system')
        ))
        
        metric_id = cur.fetchone()[0]
        conn.commit()
        
        return jsonify({'metric_id': metric_id, 'message': 'Metric created successfully'}), 201
    
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 400
    
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)
```

##### 2.4 第4步：创建定时任务

**创建定时任务（每日计算指标）**：
```bash
#!/bin/bash
# script: calc_daily_metrics.sh

# 设置环境变量
export PGHOST="localhost"
export PGDATABASE="data_warehouse"
export PGUSER="postgres"
export PGPASSWORD="password"

# 计算昨天的日期
yesterday=$(date -d "yesterday" +%Y-%m-%d)

# 计算原子指标
echo "Calculating atomic metrics for $yesterday..."
psql -c "SELECT calc_atomic_metrics('$yesterday');"

# 计算派生指标
echo "Calculating derived metrics for $yesterday..."
psql -c "SELECT calc_derived_metrics('$yesterday');"

# 数据质量检查
echo "Running data quality checks..."
psql -f /path/to/dq_checks.sql

echo "Daily metrics calculation completed at $(date)"
```

**配置Cron定时任务**：
```bash
# 编辑crontab
crontab -e

# 添加定时任务（每天凌晨4点执行）
0 4 * * * /path/to/calc_daily_metrics.sh >> /var/log/metrics_calc.log 2>&1

# 查看定时任务
crontab -l
```

#### 三、指标管理平台

##### 3.1 功能设计

**功能模块**：
```yaml
1. 指标查询
   - 搜索指标
   - 查看指标详情
   - 查看指标定义
   - 查看指标关系

2. 指标管理
   - 创建指标
   - 编辑指标
   - 下线指标
   - 审批流程

3. 指标数据
   - 查看指标数据
   - 导出指标数据
   - 可视化展示

4. 指标监控
   - 数据质量监控
   - 计算任务监控
   - 告警通知
```

##### 3.2 前端界面

**指标查询页面**：
```html
<!DOCTYPE html>
<html>
<head>
    <title>指标管理平台</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .search-box { margin-bottom: 20px; }
        .metric-card { border: 1px solid #ddd; padding: 15px; margin-bottom: 10px; border-radius: 5px; }
        .metric-name { font-size: 18px; font-weight: bold; }
        .metric-code { color: #666; }
        .metric-definition { margin-top: 10px; }
        .metric-type { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
        .type-atomic { background-color: #e3f2fd; color: #1976d2; }
        .type-derived { background-color: #fff3e0; color: #f57c00; }
        .type-composite { background-color: #f3e5f5; color: #7b1fa2; }
    </style>
</head>
<body>
    <h1>指标管理平台</h1>
    
    <div class="search-box">
        <input type="text" id="searchInput" placeholder="搜索指标名称或编码" onkeyup="searchMetrics()">
        <select id="domainFilter" onchange="searchMetrics()">
            <option value="">所有业务域</option>
            <option value="order">订单</option>
            <option value="user">用户</option>
            <option value="product">商品</option>
        </select>
        <select id="typeFilter" onchange="searchMetrics()">
            <option value="">所有类型</option>
            <option value="atomic">原子指标</option>
            <option value="derived">派生指标</option>
            <option value="composite">复合指标</option>
        </select>
    </div>
    
    <div id="metricsList"></div>
    
    <script>
        // 加载指标列表
        function loadMetrics() {
            fetch('/api/metrics')
                .then(response => response.json())
                .then(data => {
                    displayMetrics(data);
                });
        }
        
        // 搜索指标
        function searchMetrics() {
            const search = document.getElementById('searchInput').value;
            const domain = document.getElementById('domainFilter').value;
            const type = document.getElementById('typeFilter').value;
            
            let url = '/api/metrics?';
            if (search) url += `search=${search}&`;
            if (domain) url += `business_domain=${domain}&`;
            if (type) url += `metric_type=${type}`;
            
            fetch(url)
                .then(response => response.json())
                .then(data => {
                    displayMetrics(data);
                });
        }
        
        // 展示指标列表
        function displayMetrics(metrics) {
            const list = document.getElementById('metricsList');
            list.innerHTML = '';
            
            metrics.forEach(metric => {
                const card = document.createElement('div');
                card.className = 'metric-card';
                card.innerHTML = `
                    <div class="metric-name">${metric.metric_name}</div>
                    <div class="metric-code">${metric.metric_code}</div>
                    <span class="metric-type type-${metric.metric_type}">${metric.metric_type}</span>
                    <span class="metric-domain">${metric.business_domain}</span>
                    <div class="metric-definition">${metric.metric_definition}</div>
                    <button onclick="viewMetricDetail('${metric.metric_code}')">查看详情</button>
                `;
                list.appendChild(card);
            });
        }
        
        // 查看指标详情
        function viewMetricDetail(metricCode) {
            window.location.href = `/metrics/${metricCode}`;
        }
        
        // 页面加载时执行
        loadMetrics();
    </script>
</body>
</html>
```

#### 四、运营和推广

##### 4.1 培训和文档

**培训材料**：
```yaml
1. 指标体系介绍
   - 什么是指标体系
   - 为什么需要指标体系
   - 指标体系的架构
   
2. 指标查询指南
   - 如何查询指标
   - 如何理解指标定义
   - 如何使用指标数据
   
3. 指标管理流程
   - 如何申请新指标
   - 如何修改指标
   - 如何下线指标
```

**文档模板**：
```markdown
# 指标管理指南

## 1. 指标查询

### 1.1 通过平台查询
1. 访问指标管理平台：http://metrics.company.com
2. 在搜索框输入指标名称或编码
3. 点击"查看详情"查看完整定义

### 1.2 通过API查询
```bash
# 查询所有指标
curl http://metrics.company.com/api/metrics

# 查询单个指标
curl http://metrics.company.com/api/metrics/GMV

# 查询指标数据
curl http://metrics.company.com/api/metrics/GMV/data?start_date=2026-01-01&end_date=2026-01-31
```

## 2. 指标申请

### 2.1 申请新指标
1. 确认指标不存在（通过平台查询）
2. 填写指标申请表（见附件）
3. 提交到数据团队审批
4. 审批通过后，由数据团队开发

### 2.2 申请修改指标
1. 说明修改原因
2. 提交修改方案
3. 评审通过后执行

## 3. 指标使用

### 3.1 数据分析师
- 使用平台查询指标定义
- 使用API获取指标数据
- 不重复计算已有指标

### 3.2 业务方
- 查看指标定义
- 理解指标口径
- 正确使用指标
```

##### 4.2 持续运营

**定期评审**：
```yaml
月度评审：
  - 评审指标使用情况
  - 识别低频指标
  - 下线无效指标
  
季度评审：
  - 评审指标体系架构
  - 优化指标定义
  - 新增业务指标
  
年度评审：
  - 总结指标体系
  - 规划下一年度
  - 淘汰过时指标
```

**用户反馈**：
```yaml
收集渠道：
  - 用户访谈
  - 问卷调查
  - 平台留言
  
处理流程：
  1. 收集反馈
  2. 分类整理
  3. 评估优先级
  4. 制定改进计划
  5. 执行改进
```

#### 五、常见误区

**误区一：一次建设，一劳永逸**

- **说明**：指标体系需要持续优化
- **后果**：指标过时，无法支撑业务
- **正确理解**：
  - 定期评估指标
  - 持续优化改进
  - 淘汰无效指标

**误区二：平台建设就是全部**

- **说明**：平台只是工具，运营更重要
- **后果**：平台闲置，无人使用
- **正确理解**：
  - 平台是工具
  - 运营是关键
  - 推广要重视

**误区三：指标越多越好**

- **说明**：指标要根据业务需求
- **后果**：指标泛滥，管理困难
- **正确理解**：
  - 专注核心指标
  - 避免指标泛滥
  - 定期清理

**误区四：技术团队独自负责**

- **说明**：指标管理需要业务参与
- **后果**：指标与业务脱节
- **正确理解**：
  - 业务方参与定义
  - 技术团队负责实现
  - 共同管理指标

**误区五：忽视数据质量**

- **说明**：数据质量是指标的生命
- **后果**：指标不可信，使用率低
- **正确理解**：
  - 重视数据质量
  - 建立质量监控
  - 及时修复问题

#### 六、实战任务

**任务1：建立指标元数据**

```sql
-- 1. 创建元数据表
CREATE TABLE dim_metrics (
    metric_id INT PRIMARY KEY,
    metric_code VARCHAR(50) UNIQUE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_definition TEXT,
    metric_type VARCHAR(50) NOT NULL,
    business_domain VARCHAR(100) NOT NULL,
    data_source_table VARCHAR(255),
    metric_sql TEXT,
    update_frequency VARCHAR(50),
    owner VARCHAR(100),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. 导入核心指标
INSERT INTO dim_metrics (metric_code, metric_name, metric_definition, metric_type, business_domain, data_source_table, metric_sql, update_frequency, owner) VALUES
('GMV', 'GMV', '已完成订单金额', 'atomic', 'order', 'dwd_fact_orders', 'SELECT sum(order_amount) FROM dwd_fact_orders WHERE order_status = ''completed''', 'T+1 4:00', '张三'),
('ORDER_COUNT', '订单数', '已完成订单数量', 'atomic', 'order', 'dwd_fact_orders', 'SELECT count(*) FROM dwd_fact_orders WHERE order_status = ''completed''', 'T+1 4:00', '张三'),
('USER_COUNT', '用户数', '去重用户数', 'atomic', 'user', 'dwd_fact_orders', 'SELECT count(DISTINCT user_id) FROM dwd_fact_orders WHERE order_status = ''completed''', 'T+1 4:00', '张三');
```

**任务2：实现指标计算**

```sql
-- 创建存储过程
CREATE OR REPLACE FUNCTION calc_daily_metrics(p_date DATE)
RETURNS void AS $$
BEGIN
    -- 计算原子指标
    INSERT INTO dws_daily_atomic_metrics (metric_date, order_count, gmv, user_count)
    SELECT
        p_date,
        count(*) FILTER (WHERE order_status = 'completed'),
        sum(order_amount) FILTER (WHERE order_status = 'completed' AND is_refunded = false),
        count(DISTINCT user_id) FILTER (WHERE order_status = 'completed')
    FROM dwd_fact_orders
    WHERE date = p_date
    ON CONFLICT (metric_date) DO UPDATE SET
        order_count = EXCLUDED.order_count,
        gmv = EXCLUDED.gmv,
        user_count = EXCLUDED.user_count;
    
    -- 计算派生指标
    INSERT INTO dws_daily_derived_metrics (metric_date, avg_order_amount, gmv_per_user)
    SELECT
        p_date,
        gmv / NULLIF(order_count, 0),
        gmv / NULLIF(user_count, 0)
    FROM dws_daily_atomic_metrics
    WHERE metric_date = p_date
    ON CONFLICT (metric_date) DO UPDATE SET
        avg_order_amount = EXCLUDED.avg_order_amount,
        gmv_per_user = EXCLUDED.gmv_per_user;
END;
$$ LANGUAGE plpgsql;

-- 执行计算
SELECT calc_daily_metrics(CURRENT_DATE - INTERVAL '1 day');
```

**任务3：创建定时任务**

```bash
#!/bin/bash
# script: daily_metrics.sh

# 设置环境变量
export PGHOST="localhost"
export PGDATABASE="data_warehouse"
export PGUSER="postgres"
export PGPASSWORD="password"

# 计算昨天的日期
yesterday=$(date -d "yesterday" +%Y-%m-%d)

# 执行计算
echo "Calculating metrics for $yesterday..."
psql -c "SELECT calc_daily_metrics('$yesterday');"

echo "Calculation completed at $(date)"
```

```bash
# 配置定时任务
crontab -e

# 添加：每天凌晨4点执行
0 4 * * * /path/to/daily_metrics.sh >> /var/log/metrics.log 2>&1
```

#### 七、小结

指标管理实战通过规划→设计→实施→运营的流程，建立可持续的指标管理体系。

核心要点：
- 实施前准备：需求调研、现状分析、优先级排序
- 实施步骤：建立元数据→实现计算→创建API→定时任务
- 管理平台：功能设计、前端界面、API服务
- 运营推广：培训文档、持续运营、用户反馈
- 常见误区：需要持续优化、重视运营、关注质量

**至此，第5章"数据仓库建模"全部完成！**

第5章涵盖内容：
- 5.1 为什么业务库不能直接做分析
- 5.2 数据仓库的核心概念
- 5.3 数仓的基本术语
- 5.4 数仓分层的必要性
- 5.5 常见分层模型详解
- 5.6 分层的实施策略
- 5.7 维度建模基础
- 5.8 事实表设计
- 5.9 维度表设计
- 5.10 常见建模模式
- 5.11 指标体系设计
- 5.12 指标管理实战

下一章将进入第6章：ETL/ELT，学习数据抽取、转换、加载的方法和工具。
