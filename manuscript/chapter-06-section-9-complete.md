### 6.9 性能优化

前面学习了错误处理和重试，了解了如何保证ETL任务的稳定性。

ETL任务不仅要稳定，还要快。如何优化ETL性能？如何减少执行时间？

**场景**：
```yaml
数据仓库日常运行：
  
数据工程师："今天的ETL任务运行了3小时"
  
技术经理："太慢了，报表要等到中午才能出"
  
数据工程师："数据量太大了，有什么优化方法吗？"
  
新同事："如何优化ETL性能？从哪些方面入手？"
```

**问题**：
- ETL性能优化的方向有哪些？
- 如何优化数据抽取？
- 如何优化数据转换？
- 如何优化数据加载？
- 如何优化SQL性能？

**答案**：**从数据抽取、转换、加载、SQL、系统资源等多个维度优化ETL性能，减少执行时间，提升数据新鲜度**

#### 一、为什么需要性能优化

**第一，数据新鲜度要求**

```yaml
业务需求：
  - 报表需要在早上8点前完成
  - ETL在凌晨4点开始
  - 当前需要4小时
  
问题：
  - 报表延迟，影响业务决策
  
目标：
  - ETL在2小时内完成
  - 报表按时完成
```

**第二，成本优化**

```yaml
资源成本：
  - 长时间运行占用资源
  - 云服务器按小时计费
  - 成本高
  
优化：
  - 减少运行时间
  - 降低资源使用
  - 节省成本
```

**第三，可扩展性**

```yaml
当前：
  - 数据量1TB，运行4小时
  
未来：
  - 数据量增长到10TB
  - 如果不优化，需要40小时
  
优化：
  - 提升性能
  - 应对数据增长
```

#### 二、数据抽取优化

##### 2.1 增量抽取

**问题**：全量抽取数据量大，耗时长

**优化**：增量抽取

```sql
-- 优化前：全量抽取（1000万行，30分钟）
SELECT * FROM orders;

-- 优化后：增量抽取（10万行，3分钟）
SELECT * FROM orders 
WHERE updated_at >= CURRENT_DATE - INTERVAL '1 day';
```

**效果**：
```yaml
数据量：1000万 → 10万（减少99%）
时间：30分钟 → 3分钟（减少90%）
```

##### 2.2 只抽取需要的字段

**问题**：抽取所有字段，包括不需要的字段

**优化**：只抽取需要的字段

```sql
-- 优化前：抽取所有字段
SELECT * FROM orders;

-- 优化后：只抽取需要的字段
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    created_at
FROM orders;
```

**效果**：
```yaml
网络传输：减少50%
内存占用：减少50%
```

##### 2.3 分批抽取

**问题**：一次抽取大量数据，内存不足

**优化**：分批抽取

```python
# 优化前：一次抽取（内存不足）
df = pd.read_sql('SELECT * FROM orders', conn)

# 优化后：分批抽取（每次10万行）
batch_size = 100000
offset = 0

all_data = []
while True:
    df = pd.read_sql(f"""
        SELECT * FROM orders 
        ORDER BY order_id 
        LIMIT {batch_size} OFFSET {offset}
    """, conn)
    
    if len(df) == 0:
        break
    
    all_data.append(df)
    offset += batch_size

df = pd.concat(all_data)
```

**效果**：
```yaml
内存占用：峰值减少
稳定性：提升
```

#### 三、数据转换优化

##### 3.1 使用数据库计算

**问题**：在Python中转换数据，慢

**优化**：在数据库中转换

```python
# 优化前：Python中转换
def transform_data(df):
    df = df[df['order_amount'] > 0]
    df['date_id'] = df['created_at'].apply(lambda x: int(x.strftime('%Y%m%d')))
    return df

df = extract_data()
df = transform_data(df)

# 优化后：数据库中转换
sql = """
SELECT 
    order_id,
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
    user_id,
    product_id,
    order_amount
FROM orders
WHERE order_amount > 0
"""

df = pd.read_sql(sql, conn)
```

**效果**：
```yaml
转换时间：10分钟 → 1分钟（减少90%）
原因：数据库优化更好
```

##### 3.2 减少数据移动

**问题**：数据在多个系统间移动，慢

**优化**：减少数据移动

```yaml
优化前：
  MySQL → Python文件 → PostgreSQL
  （数据经过Python）

优化后：
  MySQL → PostgreSQL
  （直接数据库到数据库）
  
使用：
  - PostgreSQL的FDW（Foreign Data Wrapper）
  - 或使用数据库链接
```

**效果**：
```yaml
数据移动：减少一次
时间：减少30%
```

##### 3.3 并行转换

**问题**：多个表串行转换，慢

**优化**：并行转换

```python
# 优化前：串行转换
def transform_all():
    transform_orders()
    transform_users()
    transform_products()
    # 总时间：10 + 8 + 5 = 23分钟

# 优化后：并行转换
import concurrent.futures

def transform_all_parallel():
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [
            executor.submit(transform_orders),
            executor.submit(transform_users),
            executor.submit(transform_products)
        ]
        
        for future in concurrent.futures.as_completed(futures):
            future.result()
    # 总时间：max(10, 8, 5) = 10分钟
```

**效果**：
```yaml
总时间：23分钟 → 10分钟（减少56%）
```

#### 四、数据加载优化

##### 4.1 批量插入

**问题**：逐行插入，慢

**优化**：批量插入

```python
# 优化前：逐行插入（10万行，30分钟）
for _, row in df.iterrows():
    cursor.execute("""
        INSERT INTO dwd_fact_orders 
        (order_id, date_id, user_id, product_id, order_amount)
        VALUES (%s, %s, %s, %s, %s)
    """, (row['order_id'], row['date_id'], row['user_id'], 
          row['product_id'], row['order_amount']))

# 优化后：批量插入（10万行，3分钟)
data = [
    (row['order_id'], row['date_id'], row['user_id'], 
     row['product_id'], row['order_amount'])
    for _, row in df.iterrows()
]

cursor.executemany("""
    INSERT INTO dwd_fact_orders 
    (order_id, date_id, user_id, product_id, order_amount)
    VALUES (%s, %s, %s, %s, %s)
""", data)
```

**效果**：
```yaml
时间：30分钟 → 3分钟（减少90%）
原因：减少网络往返
```

##### 4.2 使用COPY命令

**问题**：INSERT命令慢

**优化**：使用COPY命令

```python
# 优化前：使用INSERT（10万行，3分钟）
cursor.executemany("INSERT INTO dwd_fact_orders ...", data)

# 优化后：使用COPY（10万行，30秒）
from io import StringIO

# 准备数据
data = StringIO()
for _, row in df.iterrows():
    data.write(f"{row['order_id']}\t{row['date_id']}\t{row['user_id']}\t{row['product_id']}\t{row['order_amount']}\n")
data.seek(0)

# 使用COPY
cursor.copy_from(data, 'dwd_fact_orders', columns=('order_id', 'date_id', 'user_id', 'product_id', 'order_amount'))
```

**效果**：
```yaml
时间：3分钟 → 30秒（减少83%）
原因：COPY是PostgreSQL的最快加载方式
```

##### 4.3 禁用索引和约束

**问题**：加载时索引更新，慢

**优化**：加载前禁用，加载后重建

```sql
-- 优化前：直接加载（有索引，10分钟）
INSERT INTO dwd_fact_orders SELECT * FROM temp_orders;

-- 优化后：禁用索引后加载
-- 加载前：删除索引
DROP INDEX IF EXISTS idx_fact_orders_date;
DROP INDEX IF EXISTS idx_fact_orders_user;
DROP INDEX IF EXISTS idx_fact_orders_product;

-- 加载数据（无索引，2分钟）
INSERT INTO dwd_fact_orders SELECT * FROM temp_orders;

-- 加载后：重建索引
CREATE INDEX idx_fact_orders_date ON dwd_fact_orders(date_id);
CREATE INDEX idx_fact_orders_user ON dwd_fact_orders(user_id);
CREATE INDEX idx_fact_orders_product ON dwd_fact_orders(product_id);
```

**效果**：
```yaml
时间：10分钟 → 2分钟（减少80%）
原因：避免加载时更新索引
```

#### 五、SQL优化

##### 5.1 使用EXPLAIN分析

**方法**：使用EXPLAIN分析SQL执行计划

```sql
-- 分析SQL
EXPLAIN ANALYZE
SELECT 
    o.order_id,
    o.user_id,
    u.city,
    o.order_amount
FROM dwd_fact_orders o
JOIN dim_users u ON o.user_id = u.user_id
WHERE o.date_id = 20260101;

-- 结果示例
Hash Join  (cost=1000.00..5000.00 rows=10000 width=20) (actual time=50.000..150.000 rows=10000 loops=1)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on dwd_fact_orders o  (cost=0.00..4000.00 rows=10000 width=16) (actual time=10.000..40.000 rows=10000 loops=1)
        Filter: (date_id = 20260101)
  ->  Hash  (cost=500.00..500.00 rows=10000 width=12) (actual time=20.000..30.000 rows=10000 loops=1)
        ->  Seq Scan on dim_users u  (cost=0.00..500.00 rows=10000 width=12) (actual time=5.000..15.000 rows=10000 loops=1)
```

**分析**：
```yaml
问题1：Seq Scan（全表扫描）
  解决：创建索引
  
问题2：Hash Join开销大
  解决：优化JOIN条件
  
问题3：Filter过滤晚
  解决：提前过滤
```

##### 5.2 创建合适的索引

```sql
-- 创建索引
CREATE INDEX idx_fact_orders_date ON dwd_fact_orders(date_id);
CREATE INDEX idx_fact_orders_user ON dwd_fact_orders(user_id);
CREATE INDEX idx_fact_orders_date_user ON dwd_fact_orders(date_id, user_id);

-- 复合索引（date_id, user_id）
-- 对于WHERE date_id = ? AND user_id = ?的查询，复合索引更优
```

**效果**：
```yaml
查询时间：150ms → 10ms（减少93%）
原因：使用索引而非全表扫描
```

##### 5.3 优化JOIN

```sql
-- 优化前：多次JOIN
SELECT 
    o.order_id,
    u.city,
    p.category,
    c.channel_name
FROM dwd_fact_orders o
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_channels c ON o.channel_id = c.channel_id
WHERE o.date_id = 20260101;

-- 优化后：使用物化视图或预关联
-- 如果经常JOIN，可以创建物化视图
CREATE MATERIALIZED VIEW mv_order_details AS
SELECT 
    o.order_id,
    o.date_id,
    u.city,
    p.category,
    c.channel_name,
    o.order_amount
FROM dwd_fact_orders o
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_channels c ON o.channel_id = c.channel_id;

-- 查询物化视图
SELECT * FROM mv_order_details WHERE date_id = 20260101;
```

**效果**：
```yaml
查询时间：150ms → 20ms（减少87%）
原因：避免多次JOIN
```

#### 六、系统资源优化

##### 6.1 并行度配置

```sql
-- PostgreSQL配置并行查询
-- 设置并行度
SET max_parallel_workers_per_gather = 4;  -- 每个查询最多使用4个并行worker

-- 查看并行度
SHOW max_parallel_workers_per_gather;

-- 查看实际的并行度
EXPLAIN ANALYZE SELECT ...;
```

**效果**：
```yaml
查询时间：100秒 → 30秒（减少70%）
原因：利用多核CPU
```

##### 6.2 内存配置

```sql
-- PostgreSQL内存配置
-- 工作内存（每个排序/哈希操作的内存）
SET work_mem = '1GB';

-- 维护工作内存（VACUUM、CREATE INDEX等操作的内存）
SET maintenance_work_mem = '2GB';

-- 共享缓冲区（数据库缓存的内存）
SET shared_buffers = '4GB';
```

**效果**：
```yaml
性能：提升30-50%
原因：减少磁盘I/O
```

##### 6.3 分区表

```sql
-- 创建分区表
CREATE TABLE dwd_fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    order_amount NUMERIC(10,2)
) PARTITION BY RANGE (date_id);

-- 创建分区
CREATE TABLE dwd_fact_orders_202601 PARTITION OF dwd_fact_orders
    FOR VALUES FROM (20260101) TO (20260201);

CREATE TABLE dwd_fact_orders_202602 PARTITION OF dwd_fact_orders
    FOR VALUES FROM (20260201) TO (20260301);

-- 查询只扫描相关分区
EXPLAIN ANALYZE
SELECT COUNT(*) FROM dwd_fact_orders WHERE date_id = 20260101;
-- 结果：只扫描dwd_fact_orders_202601分区
```

**效果**：
```yaml
查询时间：10秒 → 1秒（减少90%）
原因：分区剪裁
```

#### 七、性能监控

##### 7.1 慢查询日志

```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询
ALTER SYSTEM SET log_statement = 'all';  -- 记录所有SQL
SELECT pg_reload_conf();  -- 重新加载配置

-- 查看慢查询日志
-- 日志文件位置：/var/log/postgresql/postgresql-slow.log
```

##### 7.2 性能指标

```sql
-- 创建性能监控表
CREATE TABLE etl_performance (
    run_id SERIAL PRIMARY KEY,
    dag_id VARCHAR(100),
    task_id VARCHAR(100),
    execution_date DATE,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INT,
    row_count BIGINT,
    rows_per_second NUMERIC(10,2)
);

-- 记录性能
INSERT INTO etl_performance (dag_id, task_id, execution_date, start_time, end_time, duration_seconds, row_count, rows_per_second)
VALUES (
    'daily_etl_orders',
    'extract_orders',
    '2026-01-01',
    '2026-01-01 04:00:00',
    '2026-01-01 04:03:00',
    180,  -- 3分钟
    1000000,
    5555.56  -- 每秒5555行
);

-- 查看性能趋势
SELECT 
    execution_date,
    AVG(duration_seconds) as avg_duration,
    AVG(rows_per_second) as avg_rows_per_sec
FROM etl_performance
WHERE execution_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY execution_date
ORDER BY execution_date;
```

#### 八、常见误区

**误区一：性能优化就是加硬件**

- **说明**：硬件只是部分因素，代码优化更重要
- **后果**：硬件加了很多，性能提升有限
- **正确理解**：
  - 代码优化优先
  - SQL优化优先
  - 硬件优化辅助

**误区二：索引越多越好**

- **说明**：索引会降低写入性能
- **后果**：加载变慢
- **正确理解**：
  - 只创建必要的索引
  - 加载时禁用索引
  - 加载后重建索引

**误区三：忽略批量操作**

- **说明**：批量操作比单行操作快很多
- **后果**：性能差
- **正确理解**：
  - 使用批量插入
  - 使用COPY命令
  - 减少网络往返

**误区四：不监控性能**

- **说明**：性能监控是优化的基础
- **后果**：不知道瓶颈在哪里
- **正确理解**：
  - 监控ETL性能
  - 记录慢查询
  - 定期分析瓶颈

**误区五：一次性优化**

- **说明**：性能优化是持续的过程
- **后果**：性能退化
- **正确理解**：
  - 定期review性能
  - 持续优化
  - 应对数据增长

#### 九、实战任务

**任务1：优化ETL性能**

场景：当前ETL需要4小时，优化到2小时

```yaml
优化措施：
1. 全量抽取 → 增量抽取（节省1小时）
2. 逐行插入 → COPY命令（节省30分钟）
3. 加载时禁用索引（节省20分钟）
4. 并行转换多个表（节省20分钟）

效果：4小时 → 1小时50分钟
```

**任务2：优化SQL查询**

```sql
-- 优化前：慢查询（10秒）
SELECT 
    o.order_id,
    u.city,
    p.category,
    o.order_amount
FROM dwd_fact_orders o
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id
WHERE o.date_id = 20260101;

-- 优化后：添加索引（1秒）
CREATE INDEX idx_fact_orders_date_user ON dwd_fact_orders(date_id, user_id);
CREATE INDEX idx_fact_orders_date_product ON dwd_fact_orders(date_id, product_id);

-- 再次查询，速度快了
```

**任务3：监控性能**

```sql
-- 创建性能监控
CREATE TABLE etl_performance (
    run_id SERIAL PRIMARY KEY,
    task_name VARCHAR(100),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INT,
    rows_processed BIGINT
);

-- 记录性能
INSERT INTO etl_performance (task_name, start_time, end_time, duration_seconds, rows_processed)
VALUES (
    'extract_orders',
    '2026-01-01 04:00:00',
    '2026-01-01 04:03:00',
    180,
    1000000
);

-- 分析性能
SELECT 
    task_name,
    AVG(duration_seconds) as avg_duration,
    AVG(rows_processed) as avg_rows
FROM etl_performance
GROUP BY task_name;
```

#### 十、小结

ETL性能优化从数据抽取、转换、加载、SQL、系统资源等多个维度入手，通过增量抽取、批量操作、索引优化、并行处理等方式，大幅减少执行时间。

核心要点：
- 抽取优化：增量抽取、只抽取需要的字段、分批抽取
- 转换优化：使用数据库计算、减少数据移动、并行转换
- 加载优化：批量插入、COPY命令、禁用索引
- SQL优化：使用EXPLAIN分析、创建索引、优化JOIN、使用物化视图
- 系统优化：并行度配置、内存配置、分区表
- 性能监控：慢查询日志、性能指标记录、趋势分析
- 效果：性能可提升50-90%
- 常见误区：不是只加硬件、索引不是越多越好、持续优化

下一节将学习ETL最佳实践，了解ETL开发的规范和经验。
