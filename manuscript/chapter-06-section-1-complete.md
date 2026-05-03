### 6.1 ETL vs ELT

前面学习了数据仓库建模，了解了维度建模、分层架构、指标体系等。

现在开始学习数据工程的核心环节：数据移动和转换。

**场景**：
```yaml
数据仓库项目启动：
  
技术经理："数据仓库设计好了，现在开始把数据从业务库同步过来"
  
数据工程师A："我用ETL，先转换再加载"
  
数据工程师B："我用ELT，先加载再转换"
  
新同事："什么是ETL？什么是ELT？有什么区别？"
```

**问题**：
- 什么是ETL？什么是ELT？
- ETL和ELT有什么区别？
- 应该选择ETL还是ELT？
- 各自的适用场景是什么？

**答案**：**ETL和ELT是两种不同的数据集成策略，根据数据量、性能要求、技术栈选择合适的方法**

#### 一、什么是ETL和ELT

##### 1.1 ETL（Extract-Transform-Load）

**定义**：先抽取数据，然后转换数据，最后加载数据

**流程**：
```text
源系统 → 抽取(Extract) → 转换(Transform) → 加载(Load) → 目标系统
         ↓               ↓               ↓
      原始数据        清洗/格式化      转换后数据
```

**示例**：
```python
# ETL流程示例（使用Python）

# 第1步：Extract（抽取）
def extract():
    # 从MySQL抽取数据
    conn_mysql = pymysql.connect(host='mysql-server', user='root', database='business_db')
    df = pd.read_sql('SELECT * FROM orders WHERE created_at >= "2026-01-01"', conn_mysql)
    conn_mysql.close()
    return df

# 第2步：Transform（转换）
def transform(df):
    # 数据清洗
    df = df[df['order_amount'] > 0]  # 过滤负数订单
    df = df.dropna(subset=['user_id'])  # 删除用户ID为空的记录
    
    # 数据转换
    df['order_date'] = pd.to_datetime(df['created_at']).dt.date
    df['date_id'] = df['order_date'].apply(lambda x: int(x.strftime('%Y%m%d')))
    
    # 数据关联
    df_users = pd.read_sql('SELECT user_id, city FROM users', conn_mysql)
    df = df.merge(df_users, on='user_id', how='left')
    
    return df

# 第3步：Load（加载）
def load(df):
    # 加载到PostgreSQL
    conn_pg = psycopg2.connect(host='postgres-server', user='postgres', database='data_warehouse')
    cursor = conn_pg.cursor()
    
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dwd_fact_orders 
            (order_id, date_id, user_id, order_amount, city)
            VALUES (%s, %s, %s, %s, %s)
        """, (row['order_id'], row['date_id'], row['user_id'], row['order_amount'], row['city']))
    
    conn_pg.commit()
    conn_pg.close()

# 执行ETL
df_raw = extract()
df_transformed = transform(df_raw)
load(df_transformed)
```

**特点**：
```yaml
转换位置：
  - 在独立的ETL服务器上
  - 在加载前完成转换
  
数据流：
  - 源系统 → ETL服务器 → 目标系统
  - 转换后的数据才进入目标系统
  
性能影响：
  - 对源系统影响小
  - 转换过程不影响目标系统
```

##### 1.2 ELT（Extract-Load-Transform）

**定义**：先抽取数据，然后加载数据，最后在目标系统中转换数据

**流程**：
```text
源系统 → 抽取(Extract) → 加载(Load) → 转换(Transform) → 目标系统
         ↓               ↓               ↓
      原始数据        原始数据        转换后数据
                                        (在目标系统内完成)
```

**示例**：
```sql
-- ELT流程示例（使用SQL）

-- 第1步：Extract（抽取）
-- 从MySQL抽取数据（通过CDC工具）
-- 工具：Debezium + Kafka
-- 数据自动同步到Kafka topic

-- 第2步：Load（加载）
-- 从Kafka加载到PostgreSQL的ODS层（原始数据）
-- 自动完成，无需人工干预

-- 第3步：Transform（转换）
-- 在PostgreSQL内完成转换

-- 转换1：ODS → DWD（清洗）
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    date_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE order_amount > 0              -- 清洗：过滤负数订单
  AND user_id IS NOT NULL           -- 清洗：过滤空用户ID
  AND order_status = 'completed';   -- 清洗：只保留已完成订单

-- 转换2：DWD → DWS（关联）
CREATE TABLE dws_daily_gmv AS
SELECT 
    date_id,
    count(*) as order_count,
    sum(order_amount) as gmv
FROM dwd_fact_orders f
JOIN dim_users u ON f.user_id = u.user_id  -- 关联维度表
GROUP BY date_id;
```

**特点**：
```yaml
转换位置：
  - 在目标系统内完成
  - 利用目标系统的计算能力
  
数据流：
  - 源系统 → 目标系统（ODS层）
  - 在目标系统内完成转换
  
性能影响：
  - 原始数据全部进入目标系统
  - 转换过程占用目标系统资源
```

#### 二、ETL vs ELT对比

##### 2.1 架构对比

**ETL架构**：
```text
┌──────────┐    抽取     ┌────────────┐    转换     ┌────────────┐    加载     ┌──────────┐
│ MySQL    │ ────────→ │ ETL服务器  │ ────────→ │ ETL服务器  │ ────────→ │ 数仓PG   │
│ 业务库    │           │ (原始数据)  │           │ (转换数据)  │           │          │
└──────────┘           └────────────┘           └────────────┘           └──────────┘
                              ↑                                              ↑
                         Python/Java                                   SQL
                         Spark/Pandas
```

**ELT架构**：
```text
┌──────────┐    抽取+加载  ┌──────────┐    转换     ┌──────────┐
│ MySQL    │ ───────────→ │ 数仓PG   │ ────────→ │ 数仓PG   │
│ 业务库    │    (CDC)     │ (ODS层)  │    (SQL)   │ (DWD层)  │
└──────────┘              └──────────┘           └──────────┘
                                                        ↓
                                                   SQL在数仓内
                                                   完成转换
```

##### 2.2 详细对比

| 维度 | ETL | ELT |
|------|-----|-----|
| **转换位置** | 独立的ETL服务器 | 目标系统内 |
| **数据流** | 源系统 → ETL → 目标系统 | 源系统 → 目标系统 |
| **工具** | Informatica, Talend, Python, Spark | Fivetran, Airbyte, dbt |
| **编程语言** | Python, Java, Scala | SQL |
| **性能** | 转换不影响源系统和目标系统 | 转换占用目标系统资源 |
| **数据量** | 适合中低数据量 | 适合大数据量 |
| **实时性** | 通常批量，延迟高 | 可以近实时 |
| **成本** | 需要独立的ETL服务器 | 利用目标系统，成本低 |
| **复杂度** | 需要管理ETL服务器 | 管理简单 |
| **灵活性** | 高（可以使用任何编程语言） | 中（受限于SQL） |
| **数据质量** | 转换后数据质量高 | 需要在数仓内保证质量 |
| **调试** | 容易调试 | SQL调试相对简单 |

##### 2.3 适用场景

**ETL适用场景**：
```yaml
场景1：数据质量要求高
  示例：金融数据
  原因：需要在加载前严格清洗数据
  
场景2：数据源系统性能敏感
  示例：核心交易系统
  原因：不能影响源系统性能
  
场景3：转换逻辑复杂
  示例：需要复杂的业务规则
  原因：Python/Java比SQL更灵活
  
场景4：多个异构数据源
  示例：MySQL, MongoDB, API等
  原因：需要在ETL服务器统一处理
  
场景5：数据量中等
  示例：每天GB级别
  原因：ETL服务器可以处理
```

**ELT适用场景**：
```yaml
场景1：大数据量
  示例：每天TB级别
  原因：现代数仓（Snowflake, BigQuery）计算能力强
  
场景2：云原生数仓
  示例：Snowflake, BigQuery, Redshift
  原因：这些数仓专为ELT设计
  
场景3：快速实施
  示例：初创公司
  原因：工具简单，上手快
  
场景4：数据源简单
  示例：主要是关系型数据库
  原因：CDC工具成熟
  
场景5：团队SQL能力强
  示例：数据分析师为主
  原因：SQL比Python/Java更容易
```

#### 三、核心判断：选择ETL还是ELT

> 核心判断：**根据数据量、技术栈、团队能力选择ETL或ELT，没有绝对的优劣**

**判断标准1：数据量**
```yaml
小数据量（< 10GB/天）：
  → ETL和ELT都可以
  → 选择团队熟悉的方式
  
中等数据量（10GB-1TB/天）：
  → ETL：如果转换逻辑复杂
  → ELT：如果转换逻辑简单
  
大数据量（> 1TB/天）：
  → ELT：现代云数仓（Snowflake, BigQuery）
  → ETL：如果使用Hadoop/Spark
```

**判断标准2：技术栈**
```yaml
传统数仓（Oracle, SQL Server）：
  → ETL：使用Informatica, Talend
  
云数仓（Snowflake, BigQuery）：
  → ELT：使用Fivetran + dbt
  
开源数仓（PostgreSQL, MySQL）：
  → ETL：使用Python + Airflow
  → ELT：使用Airbyte + dbt
```

**判断标准3：团队能力**
```yaml
强工程能力（Python/Java/Scala）：
  → ETL：更灵活
  
强SQL能力：
  → ELT：更简单
  
混合团队：
  → ELT：降低门槛
```

**判断标准4：实时性要求**
```yaml
准实时（分钟级）：
  → ELT：使用CDC
  
批量（小时级、天级）：
  → ETL和ELT都可以
  
实时（秒级）：
  → 流处理（Kafka + Flink）
  → 超出ETL/ELT范畴
```

#### 四、实施示例

##### 4.1 ETL实施（Python + PostgreSQL）

**架构**：
```text
MySQL → Python脚本 → PostgreSQL
        (ETL)
```

**代码**：
```python
import pandas as pd
import pymysql
import psycopg2
from datetime import datetime

# ETL配置
MYSQL_CONFIG = {
    'host': 'mysql-server',
    'user': 'root',
    'password': 'password',
    'database': 'business_db'
}

PG_CONFIG = {
    'host': 'postgres-server',
    'user': 'postgres',
    'password': 'password',
    'database': 'data_warehouse'
}

# Extract
def extract_orders(start_date, end_date):
    conn = pymysql.connect(**MYSQL_CONFIG)
    
    query = f"""
        SELECT 
            order_id,
            user_id,
            product_id,
            order_amount,
            order_status,
            created_at
        FROM orders
        WHERE DATE(created_at) BETWEEN '{start_date}' AND '{end_date}'
    """
    
    df = pd.read_sql(query, conn)
    conn.close()
    
    print(f"Extracted {len(df)} orders from MySQL")
    return df

# Transform
def transform_orders(df):
    # 清洗：过滤无效数据
    df = df[df['order_amount'] > 0]
    df = df[df['user_id'].notna()]
    df = df[df['order_status'] == 'completed']
    
    # 转换：生成date_id
    df['order_date'] = pd.to_datetime(df['created_at']).dt.date
    df['date_id'] = df['order_date'].apply(
        lambda x: int(x.strftime('%Y%m%d'))
    )
    
    # 关联：获取用户城市
    conn = pymysql.connect(**MYSQL_CONFIG)
    df_users = pd.read_sql('SELECT user_id, city FROM users', conn)
    conn.close()
    
    df = df.merge(df_users, on='user_id', how='left')
    
    print(f"Transformed to {len(df)} valid orders")
    return df

# Load
def load_orders(df):
    conn = psycopg2.connect(**PG_CONFIG)
    cursor = conn.cursor()
    
    # 清空目标表（可选）
    # cursor.execute("TRUNCATE TABLE dwd_fact_orders")
    
    # 插入数据
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dwd_fact_orders 
            (order_id, date_id, user_id, product_id, order_amount, city, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (order_id) DO NOTHING
        """, (
            row['order_id'],
            row['date_id'],
            row['user_id'],
            row['product_id'],
            row['order_amount'],
            row['city'],
            row['created_at']
        ))
    
    conn.commit()
    cursor.close()
    conn.close()
    
    print(f"Loaded {len(df)} orders to PostgreSQL")

# 完整ETL流程
def etl_orders(start_date, end_date):
    print(f"Starting ETL for {start_date} to {end_date}")
    
    # Extract
    df = extract_orders(start_date, end_date)
    
    # Transform
    df = transform_orders(df)
    
    # Load
    load_orders(df)
    
    print("ETL completed successfully")

# 执行
if __name__ == '__main__':
    # 处理昨天的数据
    yesterday = (datetime.now() - pd.Timedelta(days=1)).strftime('%Y-%m-%d')
    etl_orders(yesterday, yesterday)
```

##### 4.2 ELT实施（Airbyte + dbt + PostgreSQL）

**架构**：
```text
MySQL → Airbyte(CDC) → PostgreSQL(ODS) → dbt(Transform) → PostgreSQL(DWD)
```

**第1步：配置Airbyte（抽取+加载）**
```yaml
# Airbyte配置文件
source:
  type: postgres
  host: mysql-server
  port: 3306
  database: business_db
  username: root
  password: password

destination:
  type: postgres
  host: postgres-server
  port: 5432
  database: data_warehouse
  username: postgres
  password: password

streams:
  - name: orders
    namespace: public
    destination_namespace: ods
    sync_mode: full_refresh_overwrite  # 或 cdc_incremental
```

**第2步：配置dbt（转换）**

```sql
-- models/dwd_fact_orders.sql

-- DWD层：清洗后的订单事实表
{{ config(
    materialized='table',
    schema='dwd'
) }}

SELECT 
    order_id,
    CAST(TO_DATE(created_at) AS INTEGER) as date_id,
    user_id,
    product_id,
    order_amount,
    order_status
FROM {{ source('ods', 'orders') }}
WHERE order_amount > 0              -- 清洗：过滤负数订单
  AND user_id IS NOT NULL           -- 清洗：过滤空用户ID
  AND order_status = 'completed';   -- 清洗：只保留已完成订单
```

```sql
-- models/dws_daily_gmv.sql

-- DWS层：每日GMV汇总
{{ config(
    materialized='table',
    schema='dws'
) }}

SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM {{ ref('dwd_fact_orders') }}
GROUP BY date_id;
```

**第3步：执行ELT**
```bash
# Airbyte自动同步（CDC）
# 无需手动执行

# dbt执行转换
dbt run

# 生成文档
dbt docs generate
dbt docs serve
```

#### 五、常见误区

**误区一：ELT比ETL更先进**

- **说明**：ELT和ETL各有优劣，没有绝对优劣
- **后果**：盲目选择ELT，可能不适合场景
- **正确理解**：
  - ETL适合复杂转换、敏感源系统
  - ELT适合大数据量、云原生数仓
  - 根据场景选择

**误区二：ELT不需要转换**

- **说明**：ELT也需要转换，只是转换位置不同
- **后果**：误解ELT的含义
- **正确理解**：
  - ELT的T在Load之后
  - 转换在目标系统内完成
  - 不是没有转换

**误区三：ETL是传统方法**

- **说明**：ETL仍然是主流方法之一
- **后果**：忽视ETL的价值
- **正确理解**：
  - ETL适合很多场景
  - 云时代也有应用
  - 不是过时技术

**误区四：必须二选一**

- **说明**：可以混合使用ETL和ELT
- **后果**：限制设计选择
- **正确理解**：
  - 可以ETL处理某些数据源
  - 可以ELT处理其他数据源
  - 混合架构

**误区五：ELT更简单**

- **说明**：ELT看似简单，但需要管理数仓内的转换
- **后果**：低估复杂度
- **正确理解**：
  - ELT工具简单
  - 但转换逻辑需要管理
  - 数据质量需要保证

#### 六、实战任务

**任务1：判断使用ETL还是ELT**

场景1：金融公司，数据量10GB/天，核心交易系统
```yaml
决策：
  → 使用ETL
  
原因：
  - 数据质量要求高
  - 源系统性能敏感
  - 转换逻辑复杂（金融规则）
```

场景2：初创公司，数据量1TB/天，使用Snowflake
```yaml
决策：
  → 使用ELT
  
原因：
  - 数据量大
  - 云原生数仓
  - 团队小，需要快速实施
```

**任务2：设计ETL流程**

设计一个ETL流程：
```python
# 需求：从MySQL同步用户数据到PostgreSQL

# 1. Extract
def extract_users():
    conn = pymysql.connect(**MYSQL_CONFIG)
    df = pd.read_sql('SELECT * FROM users WHERE updated_at >= LAST_SYNC', conn)
    conn.close()
    return df

# 2. Transform
def transform_users(df):
    # 数据清洗
    df = df[df['email'].notna()]
    df = df[df['email'].str.contains('@')]
    
    # 数据转换
    df['register_date'] = pd.to_datetime(df['created_at']).dt.date
    df['date_id'] = df['register_date'].apply(lambda x: int(x.strftime('%Y%m%d')))
    
    return df

# 3. Load
def load_users(df):
    conn = psycopg2.connect(**PG_CONFIG)
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dim_users 
            (user_id, name, email, city, date_id)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (user_id) DO UPDATE SET
                name = EXCLUDED.name,
                email = EXCLUDED.email,
                city = EXCLUDED.city
        """, (row['user_id'], row['name'], row['email'], row['city'], row['date_id']))
    
    conn.commit()
    conn.close()

# 执行
df = extract_users()
df = transform_users(df)
load_users(df)
```

**任务3：对比ETL和ELT的优缺点**

对比：
```yaml
ETL优点：
  - 转换不影响源系统和目标系统
  - 可以使用任意编程语言
  - 转换逻辑灵活
  - 容易调试
  
ETL缺点：
  - 需要独立的ETL服务器
  - 需要管理ETL代码
  - 学习曲线陡峭
  - 维护成本高

ELT优点：
  - 架构简单
  - 利用目标系统计算能力
  - 工具简单，上手快
  - 维护成本低
  
ELT缺点：
  - 原始数据全部进入目标系统
  - 转换占用目标系统资源
  - SQL灵活性有限
  - 数据质量需要在目标系统保证
```

#### 七、小结

ETL和ELT是两种不同的数据集成策略，ETL先转换后加载，ELT先加载后转换。

核心要点：
- ETL：Extract-Transform-Load，转换在独立的ETL服务器
- ELT：Extract-Load-Transform，转换在目标系统内
- 对比：转换位置、工具、性能、成本各有特点
- 选择：根据数据量、技术栈、团队能力选择
- ETL场景：数据质量要求高、转换逻辑复杂、源系统敏感
- ELT场景：大数据量、云原生数仓、快速实施
- 混合架构：可以混合使用ETL和ELT

下一节将学习数据抽取，了解如何从源系统抽取数据。
