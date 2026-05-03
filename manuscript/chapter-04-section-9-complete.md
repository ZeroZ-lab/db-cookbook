### 4.9 OLTP与OLAP的系统分工

前面学习了OLTP的本质、优化策略和OLAP的本质、数据模型、优化策略。

现在学习如何在实际系统中分工协作。

**场景**：
```yaml
完整的电商系统：
  - 用户下单（OLTP）
  - 支付处理（OLTP）
  - 订单查询（OLTP）
  - GMV报表（OLAP）
  - 用户留存分析（OLAP）
  - 商品销量分析（OLAP）
```

**问题**：
- 如何划分OLTP和OLAP？
- 如何设计系统架构？
- 如何同步数据？
- 如何保证数据一致性？

**答案**：**系统分工，各司其职**

#### 一、为什么OLTP和OLAP要分工

**第一，优化目标不同**

**OLTP优化目标**：
```yaml
写入性能：
  - 每秒1000个订单
  - 响应时间<100ms
  
查询性能：
  - 单行查询
  - 简单JOIN
  - 响应时间<100ms
  
一致性：
  - 强一致性
  - ACID事务
```

**OLAP优化目标**：
```yaml
查询性能：
  - 复杂分析查询
  - 扫描数亿行
  - 响应时间秒级到分钟级
  
灵活性：
  - 多维度分析
  - 灵活组合
  
数据量：
  - TB级数据
  - 全部历史数据
```

**如果强行合并**：
```yaml
OLTP影响OLAP：
  - OLAP查询占用资源
  - OLTP响应时间增加
  - 用户体验差
  
OLAP影响OLTP：
  - OLTP写入频繁
  - OLAP查询数据不稳定
  - 分析结果不准确
```

**第二，技术栈不同**

**OLTP技术栈**：
```yaml
数据库：
  - PostgreSQL
  - MySQL
  - Oracle
  
优化：
  - 索引（B-tree）
  - 事务（ACID）
  - 连接池
  
架构：
  - 主从复制
  - 读写分离
```

**OLAP技术栈**：
```yaml
数据库：
  - ClickHouse
  - Doris
  - BigQuery
  - Redshift
  
优化：
  - 列式存储
  - 分区表
  - 物化视图
  
架构：
  - 分布式存储
  - 并行计算
```

**结论**：
> OLTP和OLAP优化目标不同、技术栈不同，应该分工协作，OLTP处理业务事务，OLAP处理分析查询，通过ETL同步数据。

#### 二、核心判断：OLTP和OLAP分工的本质是"各司其职"

> OLTP和OLAP分工的核心判断是：OLTP处理业务事务（高并发写入、强一致性、快速响应），OLAP处理分析查询（大数据量、复杂查询、灵活分析），通过ETL同步数据，各自优化，互不干扰。

这个判断说明：
- **OLTP职责**：业务事务、实时查询
- **OLAP职责**：分析查询、历史数据
- **数据同步**：通过ETL定期同步
- **各自优化**：互不干扰，各司其职

#### 三、系统架构设计

##### 3.1 典型架构

**架构图**：
```text
用户 → OLTP系统
        ↓
      写入和实时查询
        ↓
      ETL同步
        ↓
      OLAP系统
        ↓
      分析查询
```

**组件说明**：
```yaml
OLTP系统：
  - PostgreSQL主从
  - 处理订单写入
  - 处理实时查询
  - 保留最近3个月数据

ETL系统：
  - 数据抽取（Extract）
  - 数据转换（Transform）
  - 数据加载（Load）
  - 每小时或每天同步

OLAP系统：
  - ClickHouse集群
  - 存储全部历史数据
  - 处理分析查询
  - 生成报表
```

##### 3.2 数据同步

**同步方式**：
```yaml
全量同步：
  - 首次同步全部历史数据
  - 耗时较长
  - 适用于初始化
  
增量同步：
  - 每小时同步增量数据
  - 基于updated_at字段
  - 适用于日常运行
  
实时同步：
  - 使用CDC（Change Data Capture）
  - 通过Kafka消息队列
  - 延迟：秒级到分钟级
```

**同步频率**：
```yaml
实时：
  - 延迟：秒级到分钟级
  - 复杂度高
  - 成本高
  
准实时：
  - 延迟：5-15分钟
  - 复杂度中等
  - 成本中等
  
T+1：
  - 延迟：第二天凌晨
  - 复杂度低
  - 成本低
```

##### 3.3 数据一致性

**一致性级别**：
```yaml
OLTP：
  - 强一致性
  - 实时（毫秒级）
  
OLAP：
  - 最终一致性
  - 准实时（几分钟到几小时延迟）
```

**保证**：
```yaml
OLTP保证：
  - ACID事务
  - 数据一致
  
OLAP保证：
  - 最终一致性
  - 数据可能有延迟
```

#### 四、OLTP系统设计

##### 4.1 OLTP职责

**职责**：
```yaml
业务事务：
  - 创建订单
  - 支付处理
  - 库存扣减
  - 物流更新
  
实时查询：
  - 查询订单
  - 查询库存
  - 查询用户信息
  
数据保留：
  - 保留热数据（最近3个月）
  - 旧数据归档到OLAP
```

##### 4.2 OLTP架构

**架构**：
```sql
-- PostgreSQL主从架构

-- 主库（Master）
-- 处理写入和实时查询
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    product_id BIGINT,
    order_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 从库（Slave）
-- 处理读查询
-- 通过流复制同步主库数据
```

**优化**：
```yaml
写入优化：
  - 只保留必要索引
  - 规范化设计
  - 批量写入
  
查询优化：
  - 主键查询
  - 索引查询
  - 简单JOIN
  
数据保留：
  - 只保留最近3个月数据
  - 定期归档旧数据
```

##### 4.3 OLTP查询示例

**查询1：创建订单**
```sql
BEGIN;
INSERT INTO orders (order_id, user_id, product_id, order_amount, order_status)
VALUES (1001, 123, 456, 100.00, 'pending');
UPDATE inventory SET stock = stock - 1 WHERE product_id = 456;
COMMIT;
-- 响应时间：50ms
```

**查询2：查询订单**
```sql
SELECT * FROM orders WHERE order_id = 1001;
-- 响应时间：10ms
```

**查询3：查询用户订单**
```sql
SELECT * FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;
-- 响应时间：20ms
```

#### 五、OLAP系统设计

##### 5.1 OLAP职责

**职责**：
```yaml
分析查询：
  - GMV报表
  - 用户留存分析
  - 转化漏斗分析
  - 商品销量分析
  
数据存储：
  - 全部历史数据
  - 用户行为数据
  - 日志数据
  
报表生成：
  - 定时报表
  - 即席查询
  - 数据可视化
```

##### 5.2 OLAP架构

**架构**：
```sql
-- ClickHouse集群

-- 订单表（列式存储）
CREATE TABLE orders (
    order_id BigInt,
    order_date Date,
    user_id BigInt,
    product_id BigInt,
    order_amount Decimal(10, 2),
    order_status String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(order_date)
ORDER BY (order_date, user_id);

-- 用户行为表
CREATE TABLE events (
    event_id BigInt,
    event_time DateTime,
    user_id BigInt,
    event_type String,
    page_url String
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(event_time)
ORDER BY (event_time, user_id);
```

**优化**：
```yaml
存储优化：
  - 列式存储
  - 分区表（按月）
  - 压缩存储
  
查询优化：
  - 物化视图
  - 预计算指标
  - 并行查询
  
数据保留：
  - 全部历史数据
  - 不删除
```

##### 5.3 OLAP查询示例

**查询1：GMV趋势**
```sql
SELECT
    toDate(order_date) as date,
    sum(order_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_date >= today() - INTERVAL 30 DAY
GROUP BY date
ORDER BY date;
-- 响应时间：5秒
```

**查询2：用户留存**
```sql
WITH cohort_users AS (
    SELECT
        user_id,
        toDate(min(event_time)) as cohort_date
    FROM events
    WHERE event_type = 'register'
    GROUP BY user_id
),
retention AS (
    SELECT
        c.user_id,
        c.cohort_date,
        count(DISTINCT toDate(e.event_time)) as active_days
    FROM cohort_users c
    LEFT JOIN events e ON c.user_id = e.user_id
        AND e.event_time >= c.cohort_date
        AND e.event_time < c.cohort_date + INTERVAL 30 DAY
    GROUP BY c.user_id, c.cohort_date
)
SELECT
    cohort_date,
    count(*) as cohort_size,
    count(*) FILTER (WHERE active_days >= 1) as day1_retention,
    count(*) FILTER (WHERE active_days >= 7) as day7_retention
FROM retention
GROUP BY cohort_date
ORDER BY cohort_date;
-- 响应时间：10秒
```

#### 六、ETL设计

##### 6.1 ETL流程

**流程**：
```text
Extract（抽取）
    ↓
Transform（转换）
    ↓
Load（加载）
```

**Extract（抽取）**：
```sql
-- 从OLTP抽取数据
SELECT * FROM orders
WHERE updated_at >= '2026-01-01 00:00:00'
  AND updated_at < '2026-01-01 01:00:00';
```

**Transform（转换）**：
```sql
-- 数据转换
-- 1. 类型转换
-- 2. 数据清洗
-- 3. 数据聚合
-- 4. 维度关联
```

**Load（加载）**：
```sql
-- 加载到OLAP
INSERT INTO orders
SELECT
    order_id,
    toDate(order_date) as order_date,
    user_id,
    product_id,
    order_amount,
    order_status
FROM source_data;
```

##### 6.2 ETL实现

**Python示例**：
```python
import psycopg2
import clickhouse_connect

# 连接OLTP（PostgreSQL）
oltp_conn = psycopg2.connect(
    host='localhost',
    database='postgres',
    user='postgres',
    password='password'
)

# 连接OLAP（ClickHouse）
olap_client = clickhouse_connect.get_client(
    host='localhost',
    port=8123
)

# 抽取数据
def extract():
    cursor = oltp_conn.cursor()
    cursor.execute("""
        SELECT * FROM orders
        WHERE updated_at >= %s AND updated_at < %s
    """, ('2026-01-01 00:00:00', '2026-01-01 01:00:00'))
    return cursor.fetchall()

# 转换数据
def transform(data):
    transformed = []
    for row in data:
        transformed.append({
            'order_id': row[0],
            'order_date': row[1].date(),
            'user_id': row[2],
            'product_id': row[3],
            'order_amount': row[4],
            'order_status': row[5]
        })
    return transformed

# 加载数据
def load(data):
    olap_client.insert('orders', data)

# ETL流程
def etl():
    data = extract()
    transformed_data = transform(data)
    load(transformed_data)

# 每小时执行
import schedule
schedule.every().hour.do(etl)
```

##### 6.3 ETL优化

**优化1：增量抽取**
```sql
-- 只抽取变化的数据
SELECT * FROM orders
WHERE updated_at >= last_sync_time
```

**优化2：批量加载**
```python
# 批量加载
def load_batch(data, batch_size=10000):
    for i in range(0, len(data), batch_size):
        batch = data[i:i+batch_size]
        olap_client.insert('orders', batch)
```

**优化3：并行处理**
```python
from concurrent.futures import ThreadPoolExecutor

# 并行处理多个表
with ThreadPoolExecutor(max_workers=4) as executor:
    executor.submit(etl_orders)
    executor.submit(etl_users)
    executor.submit(etl_products)
    executor.submit(etl_events)
```

#### 七、典型场景

##### 7.1 场景1：GMV报表

**OLTP系统**：
```sql
-- 实时GMV查询（最近1小时）
SELECT sum(order_amount) FROM orders
WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '1 hour'
  AND order_status = 'paid';
-- 响应时间：50ms
-- 用于：实时监控
```

**OLAP系统**：
```sql
-- 历史GMV分析（最近30天）
SELECT
    toDate(created_at) as order_date,
    sum(order_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= today() - INTERVAL 30 DAY
  AND order_status = 'paid'
GROUP BY order_date
ORDER BY order_date;
-- 响应时间：5秒
-- 用于：趋势分析
```

##### 7.2 场景2：用户查询

**OLTP系统**：
```sql
-- 查询用户订单（最近10个）
SELECT * FROM orders
WHERE user_id = 123
ORDER BY created_at DESC
LIMIT 10;
-- 响应时间：20ms
-- 用于：用户查看订单
```

**OLAP系统**：
```sql
-- 分析用户行为（全部历史）
SELECT
    user_id,
    count(*) as order_count,
    sum(order_amount) as total_spent,
    avg(order_amount) as avg_order_value
FROM orders
WHERE user_id = 123
GROUP BY user_id;
-- 响应时间：1秒
-- 用于：用户画像分析
```

##### 7.3 场景3：库存查询

**OLTP系统**：
```sql
-- 查询实时库存
SELECT product_id, stock
FROM inventory
WHERE product_id = 456;
-- 响应时间：10ms
-- 用于：下单时检查库存
```

**OLAP系统**：
```sql
-- 分析库存周转（按月）
SELECT
    toYYYYMM(created_at) as month,
    product_id,
    sum(quantity) as sales_quantity,
    avg(stock) as avg_stock
FROM inventory_history
WHERE created_at >= today() - INTERVAL 12 MONTH
GROUP BY month, product_id;
-- 响应时间：10秒
-- 用于：库存管理分析
```

#### 八、常见误区

**误区一：OLTP和OLAP可以合并**

- **说明**：OLTP和OLAP优化目标不同，强行合并会导致两者都做不好
- **后果**：性能差、用户体验差
- **正确理解**：
  - OLTP和OLAP应该分工
  - 各自优化
  - 通过ETL同步

**误区二：OLAP数据必须实时**

- **说明**：OLAP数据可以有延迟，大部分场景分钟级延迟可接受
- **后果**：过度复杂、成本高
- **正确理解**：
  - OLTP实时（毫秒级）
  - OLAP准实时（几分钟延迟）
  - T+1也可以（第二天凌晨）

**误区三：ETL必须实时同步**

- **说明**：ETL频率根据业务需求，不是所有场景都需要实时
- **后果**：成本高、复杂度高
- **正确理解**：
  - 实时：秒级到分钟级
  - 准实时：5-15分钟
  - T+1：第二天凌晨
  - 根据业务需求选择

**误区四：OLAP不需要查询优化**

- **说明**：OLAP也需要优化，但优化策略与OLTP不同
- **后果**：性能差
- **正确理解**：
  - 分区优化
  - 物化视图
  - 并行计算
  - 列式存储

**误区五：OLTP数据必须全部同步到OLAP**

- **说明**：OLTP数据应该有选择地同步，不是所有数据都需要
- **后果**：数据冗余、存储浪费
- **正确理解**：
  - 只同步需要分析的数据
  - 过滤不需要的列
  - 聚合后再同步

#### 九、实战任务

**任务1：设计电商OLTP-OLAP架构**

设计一个电商系统的OLTP-OLAP架构：

```yaml
OLTP系统（PostgreSQL）：
  功能：
    - 用户下单
    - 支付处理
    - 订单查询
    - 库存管理
  数据保留：
    - 最近3个月数据
  性能要求：
    - 响应时间<100ms

OLAP系统（ClickHouse）：
  功能：
    - GMV报表
    - 用户留存分析
    - 转化漏斗分析
    - 商品销量分析
  数据保留：
    - 全部历史数据
  性能要求：
    - 查询时间<10秒

ETL系统：
  抽取：
    - 每小时从PostgreSQL抽取增量数据
  转换：
    - 数据类型转换
    - 数据清洗
    - 维度关联
  加载：
    - 批量加载到ClickHouse
  延迟：
    - 最多1小时
```

**任务2：实现ETL流程**

实现ETL流程：

```python
import psycopg2
import clickhouse_connect
from datetime import datetime, timedelta

# 连接配置
OLTP_CONN = {
    'host': 'localhost',
    'database': 'postgres',
    'user': 'postgres',
    'password': 'password'
}

OLAP_CONN = {
    'host': 'localhost',
    'port': 8123
}

def extract_orders(last_sync_time):
    """抽取订单数据"""
    conn = psycopg2.connect(**OLTP_CONN)
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT
            order_id,
            created_at,
            user_id,
            product_id,
            order_amount,
            order_status
        FROM orders
        WHERE updated_at >= %s
    """, (last_sync_time,))
    
    data = cursor.fetchall()
    conn.close()
    return data

def transform_orders(data):
    """转换订单数据"""
    transformed = []
    for row in data:
        transformed.append({
            'order_id': row[0],
            'order_date': row[1].date(),
            'user_id': row[2],
            'product_id': row[3],
            'order_amount': row[4],
            'order_status': row[5]
        })
    return transformed

def load_orders(data):
    """加载订单数据到OLAP"""
    client = clickhouse_connect.get_client(**OLAP_CONN)
    client.insert('orders', data)

def etl_orders():
    """ETL流程"""
    # 计算上次同步时间
    last_sync_time = datetime.now() - timedelta(hours=1)
    
    # 抽取、转换、加载
    data = extract_orders(last_sync_time)
    transformed_data = transform_orders(data)
    load_orders(transformed_data)
    
    print(f"同步了{len(transformed_data)}条订单数据")

if __name__ == '__main__':
    etl_orders()
```

**任务3：验证数据一致性**

验证OLTP和OLAP数据一致性：

```sql
-- OLTP查询：今日GMV
SELECT sum(order_amount) FROM orders
WHERE date(created_at) = CURRENT_DATE
  AND order_status = 'paid';
-- 结果：1000000.00

-- OLAP查询：今日GMV
SELECT sum(order_amount) FROM orders
WHERE order_date = today()
  AND order_status = 'paid';
-- 结果：1000000.00

-- 对比验证：
-- 1. 行数一致
-- 2. GMV一致
-- 3. 订单状态一致

-- 如果不一致：
-- 1. 检查ETL日志
-- 2. 检查数据转换逻辑
-- 3. 重新同步数据
```

#### 十、小结

OLTP和OLAP通过分工协作，各司其职，OLTP处理业务事务，OLAP处理分析查询，通过ETL同步数据。

核心要点：
- OLTP职责：业务事务、实时查询、强一致性
- OLAP职责：分析查询、历史数据、最终一致性
- ETL同步：抽取、转换、加载，定期同步
- 系统架构：OLTP主从、ETL、OLAP集群
- 数据一致性：OLTP强一致，OLAP最终一致
- 典型场景：GMV报表、用户查询、库存查询

下一节将进入如何判断应该用OLTP还是OLAP，了解在实际场景中如何选择合适的系统。
