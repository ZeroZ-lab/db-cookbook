### 6.4 数据加载

上一节学习了数据转换，了解了数据清洗、格式化、关联、聚合等操作。

数据转换完成后，需要将数据加载到目标系统。这是ETL/ELT的最后一步。

**场景**：
```yaml
数据仓库项目：
  
数据工程师："数据转换完成了，现在加载到数仓"
  
技术经理："加载策略是什么？全量加载还是增量加载？"
  
新同事："什么是全量加载？什么是增量加载？如何选择？"
```

**问题**：
- 什么是数据加载？
- 全量加载 vs 增量加载有什么区别？
- 如何设计加载策略？
- 如何保证加载性能和数据质量？

**答案**：**根据数据量、性能要求、业务需求，选择全量加载、增量加载或Upsert**

#### 一、为什么数据加载很重要

**第一，加载策略影响数据新鲜度**

```yaml
全量加载：
  - 每次加载全部数据
  - 耗时长
  - 数据延迟大
  
增量加载：
  - 只加载变化数据
  - 耗时短
  - 数据延迟小
```

**第二，加载策略影响存储成本**

```yaml
全量加载：
  - 可能产生重复数据
  - 存储成本高
  
增量加载：
  - 只追加新数据
  - 存储成本低
```

**第三，加载策略影响查询性能**

```yaml
全量加载：
  - 数据量大
  - 查询慢
  
增量加载：
  - 数据量相对小
  - 查询快
```

#### 二、数据加载的类型

##### 2.1 全量加载

**定义**：每次删除目标表数据，重新加载全部数据

**示例**：
```sql
-- 全量加载
-- 第1步：删除目标表数据
TRUNCATE TABLE dwd_fact_orders;

-- 第2步：重新加载全部数据
INSERT INTO dwd_fact_orders
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders;

-- 第3步：提交
COMMIT;
```

**特点**：
```yaml
数据量：
  - 每次加载全部数据
  - 数据量大
  
时间：
  - 耗时长
  - 占用资源多
  
简单性：
  - 实现简单
  - 逻辑清晰
  
一致性：
  - 数据一致性好
  - 但有加载空窗期
```

**适用场景**：
```yaml
场景1：小表
  示例：维度表、配置表
  原因：数据量小，全量加载快
  
场景2：数据完全重构
  示例：DWD层每天重构
  原因：确保数据一致性
  
场景3：初始化
  示例：首次加载
  原因：初始化必须全量加载
```

##### 2.2 增量加载

**定义**：只追加新数据，不删除旧数据

**示例**：
```sql
-- 增量加载
-- 第1步：只加载新数据
INSERT INTO dwd_fact_orders
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE date_id = 20260101;  -- 只加载新的一天

-- 第2步：提交
COMMIT;
```

**特点**：
```yaml
数据量：
  - 只加载新数据
  - 数据量小
  
时间：
  - 耗时短
  - 占用资源少
  
简单性：
  - 实现简单
  - 逻辑清晰
  
一致性：
  - 数据持续增长
  - 需要定期清理
```

**适用场景**：
```yaml
场景1：大表
  示例：事实表
  原因：数据量大，增量加载必要
  
场景2：只追加数据
  示例：日志表、事件表
  原因：数据只追加，不修改
  
场景3：需要历史数据
  示例：需要保留完整历史
  原因：增量加载保留历史
```

##### 2.3 Upsert（Update + Insert）

**定义**：有则更新，无则插入

**示例**：
```sql
-- Upsert（PostgreSQL）
INSERT INTO dwd_fact_orders
    (order_id, date_id, user_id, product_id, order_amount)
VALUES 
    (12345, 20260101, 1001, 2001, 100.00)
ON CONFLICT (order_id) DO UPDATE SET
    date_id = EXCLUDED.date_id,
    user_id = EXCLUDED.user_id,
    product_id = EXCLUDED.product_id,
    order_amount = EXCLUDED.order_amount;
```

**特点**：
```yaml
数据量：
  - 只处理变化数据
  - 数据量小
  
时间：
  - 耗时中等
  - 需要判断是否存在
  
简单性：
  - 实现复杂
  - 需要支持冲突处理
  
一致性：
  - 数据保持最新
  - 没有重复数据
```

**适用场景**：
```yaml
场景1：数据会更新
  示例：用户维度表
  原因：用户信息会变化
  
场景2：需要最新数据
  示例：维度表
  原因：确保维度数据最新
  
场景3：CDC数据
  示例：CDC增量加载
  原因：CDC包含INSERT和UPDATE
```

#### 三、全量加载 vs 增量加载对比

| 维度 | 全量加载 | 增量加载 | Upsert |
|------|---------|---------|--------|
| **数据量** | 全部数据 | 新数据 | 变化数据 |
| **时间** | 长 | 短 | 中 |
| **实现** | 简单 | 简单 | 复杂 |
| **存储** | 可能重复 | 持续增长 | 紧凑 |
| **查询** | 可能慢 | 快 | 快 |
| **一致性** | 好 | 好 | 好 |
| **历史** | 丢失 | 保留 | 保留（需要特殊设计） |
| **更新** | 支持 | 不支持 | 支持 |
| **适用** | 小表、初始化 | 大事实表 | 维度表、CDC |

#### 四、加载策略设计

##### 4.1 维度表的加载

**策略1：快速变化维度（SCD Type 1）**

**定义**：直接覆盖旧数据

```sql
-- SCD Type 1：直接更新
CREATE TABLE dim_users AS
SELECT * FROM ods_users;  -- 初始化

-- 每天加载：覆盖更新
DELETE FROM dim_users WHERE user_id IN (SELECT user_id FROM ods_users);
INSERT INTO dim_users SELECT * FROM ods_users;

-- 或者使用TRUNCATE
TRUNCATE TABLE dim_users;
INSERT INTO dim_users SELECT * FROM ods_users;
```

**策略2：历史归档维度（SCD Type 2）**

**定义**：保留历史版本

```sql
-- SCD Type 2：保留历史版本
CREATE TABLE dim_users (
    user_id BIGINT,
    user_name VARCHAR(100),
    city VARCHAR(100),
    version INT,
    effective_date DATE,
    expiry_date DATE,
    is_current BOOLEAN
);

-- 初始化
INSERT INTO dim_users
SELECT 
    user_id,
    user_name,
    city,
    1 as version,
    created_at as effective_date,
    '9999-12-31' as expiry_date,
    TRUE as is_current
FROM ods_users;

-- 每天加载：检测变化，新增版本
INSERT INTO dim_users
SELECT 
    new.user_id,
    new.user_name,
    new.city,
    old.version + 1 as version,
    CURRENT_DATE as effective_date,
    '9999-12-31' as expiry_date,
    TRUE as is_current
FROM ods_users new
JOIN dim_users old ON new.user_id = old.user_id AND old.is_current = TRUE
WHERE new.city != old.city  -- 检测变化
  OR new.user_name != old.user_name;

-- 更新旧版本：设置过期日期和is_current
UPDATE dim_users
SET expiry_date = CURRENT_DATE - INTERVAL '1 day',
    is_current = FALSE
WHERE user_id IN (
    SELECT new.user_id
    FROM ods_users new
    JOIN dim_users old ON new.user_id = old.user_id AND old.is_current = TRUE
    WHERE new.city != old.city
      OR new.user_name != old.user_name
);
```

**策略3：混合策略**

```yaml
大维度表（用户表）：
  → 使用SCD Type 2
  → 保留历史版本
  
小维度表（字典表）：
  → 使用SCD Type 1
  → 直接覆盖
```

##### 4.2 事实表的加载

**策略1：全量加载（每日重构）**

```sql
-- 每天全量重构DWD层
TRUNCATE TABLE dwd_fact_orders;
INSERT INTO dwd_fact_orders
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE order_status = 'completed';
```

**策略2：增量加载（追加）**

```sql
-- 每天增量加载DWD层
INSERT INTO dwd_fact_orders
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE date_id = 20260101  -- 只加载新的一天
  AND order_status = 'completed';
```

**策略3：分区加载**

```sql
-- 按天分区
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

-- 加载单天数据到对应分区
DELETE FROM dwd_fact_orders_202601 WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders_202601
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE date_id = 20260101;
```

##### 4.3 汇总表的加载

**策略1：全量刷新**

```sql
-- 每天全量刷新汇总表
TRUNCATE TABLE dws_daily_gmv;
INSERT INTO dws_daily_gmv
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM dwd_fact_orders
GROUP BY date_id;
```

**策略2：增量刷新**

```sql
-- 每天增量刷新汇总表
DELETE FROM dws_daily_gmv WHERE date_id = 20260101;
INSERT INTO dws_daily_gmv
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM dwd_fact_orders
WHERE date_id = 20260101
GROUP BY date_id;
```

**策略3：使用物化视图**

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM dwd_fact_orders
GROUP BY date_id;

-- 刷新物化视图
REFRESH MATERIALIZED VIEW mv_daily_gmv;

-- 增量刷新（PostgreSQL 9.4+）
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_gmv;
```

#### 五、加载性能优化

##### 5.1 批量插入

**方法**：使用批量插入而非单行插入

```python
# 不好的做法：单行插入
for order in orders:
    cursor.execute("""
        INSERT INTO dwd_fact_orders 
        (order_id, date_id, user_id, product_id, order_amount)
        VALUES (%s, %s, %s, %s, %s)
    """, (order['order_id'], order['date_id'], order['user_id'], 
          order['product_id'], order['order_amount']))

# 好的做法：批量插入
data = [
    (order['order_id'], order['date_id'], order['user_id'], 
     order['product_id'], order['order_amount'])
    for order in orders
]

cursor.executemany("""
    INSERT INTO dwd_fact_orders 
    (order_id, date_id, user_id, product_id, order_amount)
    VALUES (%s, %s, %s, %s, %s)
""", data)
```

##### 5.2 禁用索引和约束

**方法**：加载前禁用，加载后启用

```sql
-- 加载前：禁用索引
ALTER INDEX idx_fact_orders_date DISABLE;
ALTER INDEX idx_fact_orders_user DISABLE;

-- 加载数据
INSERT INTO dwd_fact_orders SELECT ...;

-- 加载后：重建索引
REINDEX INDEX idx_fact_orders_date;
REINDEX INDEX idx_fact_orders_user;

-- 或者：DROP后CREATE
DROP INDEX IF EXISTS idx_fact_orders_date;
DROP INDEX IF EXISTS idx_fact_orders_user;

INSERT INTO dwd_fact_orders SELECT ...;

CREATE INDEX idx_fact_orders_date ON dwd_fact_orders(date_id);
CREATE INDEX idx_fact_orders_user ON dwd_fact_orders(user_id);
```

##### 5.3 使用COPY命令

**方法**：使用PostgreSQL的COPY命令

```python
# 使用COPY命令（最快）
import psycopg2
from io import StringIO

# 准备数据
data = StringIO()
for order in orders:
    data.write(f"{order['order_id']}\t{order['date_id']}\t{order['user_id']}\t{order['product_id']}\t{order['order_amount']}\n")
data.seek(0)

# 使用COPY
conn = psycopg2.connect(...)
cursor = conn.cursor()
cursor.copy_from(data, 'dwd_fact_orders', columns=('order_id', 'date_id', 'user_id', 'product_id', 'order_amount'))
conn.commit()
```

##### 5.4 并行加载

**方法**：并行加载不同分区

```bash
# 并行加载不同天
#!/bin/bash

# 加载2026-01-01
load_day.sh 20260101 &
PID1=$!

# 加载2026-01-02
load_day.sh 20260102 &
PID2=$!

# 加载2026-01-03
load_day.sh 20260103 &
PID3=$!

# 等待所有完成
wait $PID1
wait $PID2
wait $PID3
```

#### 六、数据质量保证

##### 6.1 加载前检查

```sql
-- 检查1：数据量是否合理
SELECT 
    'source' as table_name,
    count(*) as row_count
FROM ods_orders
WHERE date_id = 20260101

UNION ALL

SELECT 
    'target' as table_name,
    count(*) as row_count
FROM dwd_fact_orders
WHERE date_id = 20260101;

-- 检查2：数据完整性
SELECT 
    count(*) FILTER (WHERE user_id IS NULL) as null_user_id,
    count(*) FILTER (WHERE order_amount IS NULL) as null_order_amount
FROM ods_orders
WHERE date_id = 20260101;

-- 检查3：数据准确性
SELECT 
    count(*) FILTER (WHERE order_amount < 0) as negative_amount,
    count(*) FILTER (WHERE order_amount = 0) as zero_amount
FROM ods_orders
WHERE date_id = 20260101;
```

##### 6.2 加载后验证

```sql
-- 验证1：行数是否一致
WITH source_count AS (
    SELECT count(*) as cnt FROM ods_orders WHERE date_id = 20260101
),
target_count AS (
    SELECT count(*) as cnt FROM dwd_fact_orders WHERE date_id = 20260101
)
SELECT 
    source_count.cnt as source_rows,
    target_count.cnt as target_rows,
    source_count.cnt - target_count.cnt as diff
FROM source_count, target_count;

-- 验证2：金额是否一致
WITH source_sum AS (
    SELECT SUM(order_amount) as total FROM ods_orders WHERE date_id = 20260101
),
target_sum AS (
    SELECT SUM(order_amount) as total FROM dwd_fact_orders WHERE date_id = 20260101
)
SELECT 
    source_sum.total as source_amount,
    target_sum.total as target_amount,
    source_sum.total - target_sum.total as diff
FROM source_sum, target_sum;
```

#### 七、常见误区

**误区一：全量加载最简单**

- **说明**：全量加载看似简单，但数据量大时会有问题
- **后果**：加载时间长，影响数据新鲜度
- **正确理解**：
  - 小表可以全量加载
  - 大表必须增量加载
  - 根据场景选择

**误区二：增量加载不需要删除**

- **说明**：增量加载可能需要处理删除操作
- **后果**：数据不准确
- **正确理解**：
  - 需要处理源系统的删除
  - 使用软删除或CDC
  - 确保数据准确

**误区三：Upsert性能好**

- **说明**：Upsert需要判断是否存在，性能不一定好
- **后果**：性能差
- **正确理解**：
  - Upsert有性能开销
  - 全量加载可能更快
  - 根据场景选择

**误区四：加载不需要事务**

- **说明**：加载需要事务保证一致性
- **后果**：数据不一致
- **正确理解**：
  - 使用事务
  - 失败时回滚
  - 确保一致性

**误区五：加载不需要监控**

- **说明**：加载需要监控和日志
- **后果**：问题难以排查
- **正确理解**：
  - 记录加载日志
  - 监控加载时间
  - 监控数据量

#### 八、实战任务

**任务1：设计维度表加载**

```sql
-- 需求：加载用户维度表（SCD Type 2）

-- 第1步：检测变化
CREATE TABLE temp_user_changes AS
SELECT 
    new.user_id,
    new.user_name,
    new.city
FROM ods_users new
JOIN dim_users old ON new.user_id = old.user_id AND old.is_current = TRUE
WHERE new.city != old.city
  OR new.user_name != old.user_name;

-- 第2步：更新旧版本
UPDATE dim_users
SET expiry_date = CURRENT_DATE - INTERVAL '1 day',
    is_current = FALSE
WHERE user_id IN (SELECT user_id FROM temp_user_changes)
  AND is_current = TRUE;

-- 第3步：插入新版本
INSERT INTO dim_users
SELECT 
    user_id,
    user_name,
    city,
    (SELECT version FROM dim_users WHERE user_id = temp_user_changes.user_id AND is_current = FALSE) + 1 as version,
    CURRENT_DATE as effective_date,
    '9999-12-31' as expiry_date,
    TRUE as is_current
FROM temp_user_changes;
```

**任务2：设计事实表加载**

```sql
-- 需求：加载订单事实表（分区加载）

-- 第1步：删除分区数据
DELETE FROM dwd_fact_orders_202601 WHERE date_id = 20260101;

-- 第2步：加载新数据
INSERT INTO dwd_fact_orders_202601
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE date_id = 20260101
  AND order_status = 'completed';

-- 第3步：验证
SELECT 
    count(*) as loaded_rows
FROM dwd_fact_orders_202601
WHERE date_id = 20260101;
```

**任务3：设计汇总表加载**

```sql
-- 需求：加载每日GMV汇总表（增量刷新）

-- 第1步：删除当天数据
DELETE FROM dws_daily_gmv WHERE date_id = 20260101;

-- 第2步：插入新汇总
INSERT INTO dws_daily_gmv
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    AVG(order_amount) as avg_order_amount
FROM dwd_fact_orders
WHERE date_id = 20260101
GROUP BY date_id;

-- 第3步：验证
SELECT 
    date_id,
    order_count,
    gmv
FROM dws_daily_gmv
WHERE date_id = 20260101;
```

#### 九、小结

数据加载是将转换后的数据写入目标系统的过程，根据数据量、性能要求选择全量加载、增量加载或Upsert。

核心要点：
- 全量加载：删除后重新加载，适合小表
- 增量加载：只追加新数据，适合大事实表
- Upsert：有则更新无则插入，适合维度表和CDC
- 维度表加载：SCD Type 1（覆盖）、SCD Type 2（历史）
- 事实表加载：全量重构、增量追加、分区加载
- 汇总表加载：全量刷新、增量刷新、物化视图
- 性能优化：批量插入、禁用索引、COPY命令、并行加载
- 质量保证：加载前检查、加载后验证

下一节将学习常见ETL工具，了解Airflow、dbt、Fivetran等工具的使用。
