---
title: "6. ETL / ELT：数据如何进入大数据系统"
description: "说明 PostgreSQL 数据如何通过批量同步、CDC、转换和调度进入数据平台。"
prev: { text: "5. 数据仓库建模：从表设计到分析建模", link: "/chapters/05-data-warehouse-modeling" }
next: { text: "7. 批处理系统：Hive / Spark / Trino", link: "/chapters/07-batch-processing" }
---
# 6. ETL / ELT：数据如何进入大数据系统

::: tip 本章导读
说明 PostgreSQL 数据如何通过批量同步、CDC、转换和调度进入数据平台。
:::


## 本章阅读框架

| 阅读问题 | 本章回答方式 |
| --- | --- |
| 这个问题为什么出现？ | 从业务增长、数据规模、系统目标或 AI 应用压力切入。 |
| 它解决什么问题？ | 提炼为一个核心判断，避免把概念写成孤立定义。 |
| 它不解决什么问题？ | 在机制解释和常见误区中说明边界，防止工具崇拜。 |
| 它在真实平台哪里出现？ | 放回 PostgreSQL、数仓、批流、OLAP、湖仓、向量、图和治理的演化链路。 |
| 读完要会做什么？ | 通过场景案例和实战任务转成可练习的判断。 |

```mermaid
flowchart LR
  P["PostgreSQL"] --> B["Batch Extract"]
  P --> C["CDC / WAL"]
  B --> W["Data Warehouse"]
  C --> K["Kafka"]
  K --> F["Flink"]
  F --> O["OLAP / Lakehouse"]
  W --> BI["BI / 指标"]
```

数据不是天然在数仓里。

## 问题切入

业务数据最初通常在 PostgreSQL、MySQL、业务日志、第三方系统或外部文件中。要让这些数据进入分析平台，必须经过抽取、同步、清洗、转换、装载和调度。

第 5 章已经设计了数仓模型：ODS、DWD、DWS、ADS，事实表、维度表和指标口径都已经明确。但模型只是目标形态，真实系统还要回答更工程化的问题：

```text
PostgreSQL 里的订单数据什么时候进入 ODS？
全量同步和增量同步如何切换？
源表新增字段后，下游任务会不会失败？
同步任务失败一天后，如何补回缺失数据？
CDC 消费变慢时，WAL 会不会堆积？
同一条订单变更被消费两次，指标会不会重复？
数据到达以后，怎样证明它完整、准确、及时？
```

如果这些问题没有设计清楚，数仓模型再漂亮也无法稳定运行。数据链路一旦不可信，下游报表、特征、RAG 知识库和治理系统都会失去基础。

## 核心判断

> 大数据平台的核心不是某一个计算引擎，而是持续、可信、可追踪的数据链路。

本章要建立的判断是：ETL / ELT 解决的不是“把数据搬走”，而是让源系统数据以可恢复、可验证、可追踪的方式进入分析系统。

它的边界也要明确。ETL / ELT 不能替代数仓建模，不能自动统一指标口径，不能让错误源数据变正确，也不能单独保证端到端 Exactly Once。它提供的是数据进入平台的工程链路，后续仍需要建模、质量、血缘、权限和调度治理。

## 机制解释

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

### 6.2 数据抽取

上一节学习了ETL vs ELT，了解了两种不同的数据集成策略。

无论选择ETL还是ELT，第一步都是数据抽取（Extract）。

**场景**：
```yaml
数据仓库项目启动：
  
技术经理："先从业务数据库抽取数据吧"
  
数据工程师A："我每天全量抽取所有数据"
  
数据工程师B："我使用CDC增量抽取变更数据"
  
新同事："什么是全量抽取？什么是增量抽取？什么是CDC？"
```

**问题**：
- 什么是数据抽取？
- 全量抽取 vs 增量抽取有什么区别？
- 如何实现CDC（Change Data Capture）？
- 应该选择哪种抽取方式？

**答案**：**根据数据量、性能要求、实时性要求，选择全量抽取、增量抽取或CDC**

#### 一、为什么数据抽取很重要

**第一，数据抽取是ETL/ELT的第一步**

```yaml
ETL流程：
  Extract（抽取）→ Transform（转换）→ Load（加载）
      ↑
    第一步

ELT流程：
  Extract（抽取）→ Load（加载）→ Transform（转换）
      ↑
    第一步
```

**第二，抽取方式影响整个数据链路**

```yaml
全量抽取：
  优点：简单、可靠
  缺点：数据量大、耗时长、影响源系统
  
增量抽取：
  优点：数据量小、快速
  缺点：复杂、需要追踪变化
  
CDC：
  优点：实时、数据量小
  缺点：复杂、需要CDC工具
```

**第三，抽取方式影响数据质量**

```yaml
全量抽取：
  - 数据一致性好
  - 但可能有重复数据
  
增量抽取：
  - 需要准确识别变化
  - 可能遗漏数据
  
CDC：
  - 捕获所有变更
  - 需要处理删除操作
```

#### 二、数据抽取的类型

##### 2.1 全量抽取

**定义**：每次抽取全部数据

**示例**：
```sql
-- 全量抽取SQL
-- 每天执行一次，抽取所有订单

DELETE FROM ods_orders;  -- 清空目标表

INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders;  -- 抽取全部数据

COMMIT;
```

**特点**：
```yaml
数据量：
  - 每次抽取全部数据
  - 数据量大
  
时间：
  - 耗时长
  - 占用源系统资源
  
简单性：
  - 实现简单
  - 不需要追踪变化
  
一致性：
  - 数据一致性好
  - 但可能有重复
```

**适用场景**：
```yaml
场景1：小表
  示例：字典表、配置表
  原因：数据量小，全量抽取快
  
场景2：频繁变化的表
  示例：状态表
  原因：增量追踪困难
  
场景3：数据量不大的表
  示例：< 100万行
  原因：全量抽取可接受
```

##### 2.2 增量抽取

**定义**：只抽取变化的数据（新增、修改）

**示例**：
```sql
-- 增量抽取SQL（基于时间戳）
-- 每天执行一次，只抽取昨天变更的数据

INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders
WHERE updated_at >= CURRENT_DATE - INTERVAL '1 day'  -- 只抽取昨天更新的数据
  AND updated_at < CURRENT_DATE;

COMMIT;
```

**特点**：
```yaml
数据量：
  - 只抽取变化数据
  - 数据量小
  
时间：
  - 耗时短
  - 占用源系统资源少
  
复杂度：
  - 需要追踪变化
  - 需要updated_at字段
  
一致性：
  - 可能遗漏数据
  - 需要处理删除
```

**适用场景**：
```yaml
场景1：大表
  示例：订单表、用户表
  原因：数据量大，增量抽取必要
  
场景2：有updated_at字段
  示例：业务表有更新时间
  原因：可以追踪变化
  
场景3：只追加，不删除
  示例：日志表、事件表
  原因：增量追踪简单
```

##### 2.3 CDC（Change Data Capture）

**定义**：捕获数据变更日志，包括INSERT、UPDATE、DELETE

**示例**：
```python
# CDC示例（使用Debezium + Kafka）

# Debezium配置
{
    "database.hostname": "mysql-server",
    "database.port": "3306",
    "database.user": "debezium",
    "database.password": "dbz",
    "database.server.id": "184054",
    "database.server.name": "customer",
    "database.include.list": "business_db",
    "table.include.list": "business_db.orders",
    "database.history.kafka.bootstrap.servers": "kafka:9092",
    "database.history.kafka.topic": "schema-changes.business_db"
}

# CDC事件示例（Kafka消息）
{
    "before": {  # 变更前的数据
        "order_id": 12345,
        "order_amount": 100.00,
        "order_status": "pending"
    },
    "after": {  # 变更后的数据
        "order_id": 12345,
        "order_amount": 100.00,
        "order_status": "completed"
    },
    "op": "u",  # 操作类型：c=create, u=update, d=delete
    "ts_ms": 1641234567890  # 时间戳
}

# 消费CDC事件
from kafka import KafkaConsumer
import json

consumer = KafkaConsumer(
    'customer.business_db.orders',
    bootstrap_servers=['kafka:9092'],
    auto_offset_reset='earliest',
    enable_auto_commit=True,
    group_id='etl-group',
    value_deserializer=lambda x: json.loads(x.decode('utf-8'))
)

for message in consumer:
    event = message.value
    
    if event['op'] == 'c':  # INSERT
        handle_insert(event['after'])
    elif event['op'] == 'u':  # UPDATE
        handle_update(event['before'], event['after'])
    elif event['op'] == 'd':  # DELETE
        handle_delete(event['before'])
```

**特点**：
```yaml
数据量：
  - 只捕获变更
  - 数据量最小
  
实时性：
  - 近实时
  - 秒级延迟
  
完整性：
  - 捕获所有变更
  - 包括DELETE
  
复杂度：
  - 需要CDC工具
  - 需要消息队列
  - 实现复杂
```

**适用场景**：
```yaml
场景1：需要实时数据
  示例：实时报表
  原因：CDC是实时的
  
场景2：大数据量
  示例：每天TB级别
  原因：CDC数据量小
  
场景3：需要捕获DELETE
  示例：数据同步
  原因：CDC捕获所有变更
```

#### 三、增量抽取的实现方式

##### 3.1 基于时间戳

**方法**：使用updated_at字段

```sql
-- 第1次全量抽取
CREATE TABLE ods_orders AS
SELECT * FROM business_db.orders;

-- 记录抽取时间
INSERT INTO etl_logs (table_name, last_sync_time)
VALUES ('ods_orders', NOW());

-- 第2次增量抽取
INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders
WHERE updated_at >= (
    SELECT last_sync_time 
    FROM etl_logs 
    WHERE table_name = 'ods_orders'
    ORDER BY sync_id DESC 
    LIMIT 1
);

-- 更新抽取时间
UPDATE etl_logs 
SET last_sync_time = NOW() 
WHERE table_name = 'ods_orders';
```

**优点**：
```yaml
简单：
  - 实现简单
  - 只需要updated_at字段
```

**缺点**：
```yaml
遗漏删除：
  - 无法捕获DELETE操作
  
时间精度：
  - 依赖时间戳精度
  - 可能遗漏同一秒的变更
  
性能问题：
  - 需要在updated_at上建索引
```

##### 3.2 基于自增ID

**方法**：使用自增主键

```sql
-- 第1次全量抽取
CREATE TABLE ods_orders AS
SELECT * FROM business_db.orders;

-- 记录最大ID
INSERT INTO etl_logs (table_name, last_max_id)
VALUES ('ods_orders', (SELECT MAX(order_id) FROM business_db.orders));

-- 第2次增量抽取
INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders
WHERE order_id > (
    SELECT last_max_id 
    FROM etl_logs 
    WHERE table_name = 'ods_orders'
    ORDER BY sync_id DESC 
    LIMIT 1
);

-- 更新最大ID
UPDATE etl_logs 
SET last_max_id = (SELECT MAX(order_id) FROM business_db.orders)
WHERE table_name = 'ods_orders';
```

**优点**：
```yaml
性能好：
  - 主键查询快
  
简单：
  - 实现简单
```

**缺点**：
```yaml
只捕获新增：
  - 无法捕获UPDATE
  - 无法捕获DELETE
  
问题：
  - 如果ID重置，会出问题
```

##### 3.3 基于触发器

**方法**：使用数据库触发器

```sql
-- 创建变更表
CREATE TABLE orders_changes (
    change_id SERIAL PRIMARY KEY,
    order_id BIGINT,
    change_type VARCHAR(10),  -- INSERT, UPDATE, DELETE
    change_data JSONB,
    change_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 创建触发器函数
CREATE OR REPLACE FUNCTION log_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO orders_changes (order_id, change_type, change_data)
        VALUES (NEW.order_id, 'INSERT', row_to_json(NEW)::jsonb);
        
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO orders_changes (order_id, change_type, change_data)
        VALUES (NEW.order_id, 'UPDATE', row_to_json(NEW)::jsonb);
        
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO orders_changes (order_id, change_type, change_data)
        VALUES (OLD.order_id, 'DELETE', row_to_json(OLD)::jsonb);
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER trigger_order_changes
AFTER INSERT OR UPDATE OR DELETE ON business_db.orders
FOR EACH ROW
EXECUTE FUNCTION log_order_changes();

-- 增量抽取：从变更表抽取
INSERT INTO ods_orders
SELECT 
    change_data->>'order_id' as order_id,
    change_data->>'user_id' as user_id,
    change_data->>'product_id' as product_id,
    change_data->>'order_amount' as order_amount,
    change_data->>'order_status' as order_status,
    change_data->>'created_at' as created_at,
    change_data->>'updated_at' as updated_at
FROM orders_changes
WHERE change_time >= (
    SELECT last_sync_time 
    FROM etl_logs 
    WHERE table_name = 'ods_orders'
    ORDER BY sync_id DESC 
    LIMIT 1
);

-- 处理DELETE
DELETE FROM ods_orders
WHERE order_id IN (
    SELECT change_data->>'order_id'
    FROM orders_changes
    WHERE change_type = 'DELETE'
    AND change_time >= (
        SELECT last_sync_time 
        FROM etl_logs 
        WHERE table_name = 'ods_orders'
        ORDER BY sync_id DESC 
        LIMIT 1
    )
);
```

**优点**：
```yaml
完整性：
  - 捕获所有变更
  - 包括DELETE
  
实时性：
  - 实时捕获
```

**缺点**：
```yaml
性能影响：
  - 触发器影响源系统性能
  
复杂度：
  - 需要维护触发器
  - 需要维护变更表
```

#### 四、CDC的实现方式

##### 4.1 基于Binlog（MySQL）

**工具**：Debezium, Canal, Maxwell

**原理**：解析MySQL Binlog

```bash
# Debezium配置
{
    "name": "orders-connector",
    "config": {
        "connector.class": "io.debezium.connector.mysql.MySqlConnector",
        "database.hostname": "mysql-server",
        "database.port": "3306",
        "database.user": "debezium",
        "database.password": "dbz",
        "database.server.id": "184054",
        "database.server.name": "customer",
        "database.include.list": "business_db",
        "table.include.list": "business_db.orders",
        "database.history.kafka.bootstrap.servers": "kafka:9092",
        "database.history.kafka.topic": "schema-changes.business_db",
        "include.schema.changes": "false",
        "snapshot.mode": "schema_only"
    }
}
```

**优点**：
```yaml
实时：
  - 秒级延迟
  
完整性：
  - 捕获所有变更
  - 包括DELETE
  
无侵入：
  - 不影响源系统
```

**缺点**：
```yaml
复杂：
  - 需要Kafka
  - 需要CDC工具
```

##### 4.2 基于WAL（PostgreSQL）

**工具**：Debezium, pg_logical

**原理**：解析PostgreSQL WAL

```sql
-- 创建逻辑复制槽
SELECT * FROM pg_create_logical_replication_slot('orders_slot', 'pgoutput');

-- 读取WAL
SELECT * FROM pg_logical_slot_peek_changes('orders_slot', NULL, NULL);

-- 消费WAL
SELECT * FROM pg_logical_slot_get_changes('orders_slot', NULL, NULL);
```

**优点**：
```yaml
实时：
  - 秒级延迟
  
完整性：
  - 捕获所有变更
  - 包括DELETE
  
原生支持：
  - PostgreSQL原生支持
```

**缺点**：
```yaml
复杂：
  - 需要理解WAL
  - 需要解析WAL
```

#### 五、抽取策略选择

##### 5.1 决策树

```yaml
第1步：数据量多大？
  小数据量（< 100万行）
    → 全量抽取
  
  大数据量（> 100万行）
    → 第2步

第2步：是否需要实时？
  不需要（批量即可）
    → 增量抽取
  
  需要（秒级）
    → CDC
  
第3步：是否有updated_at字段？
  有
    → 基于时间戳的增量抽取
  
  没有
    → 基于ID的增量抽取
    或 CDC
```

##### 5.2 混合策略

```yaml
策略：不同表使用不同抽取方式
  
小表（字典表、配置表）：
  → 全量抽取
  → 每天1次
  
大表（订单表、用户表）：
  → 增量抽取
  → 每天1次
  
核心表（需要实时）：
  → CDC
  → 实时
```

#### 六、常见误区

**误区一：全量抽取最简单**

- **说明**：全量抽取看似简单，但数据量大时会有问题
- **后果**：影响源系统性能
- **正确理解**：
  - 小表可以全量抽取
  - 大表必须增量抽取
  - 根据场景选择

**误区二：增量抽取会遗漏数据**

- **说明**：正确实现的增量抽取不会遗漏数据
- **后果**：不敢使用增量抽取
- **正确理解**：
  - 使用updated_at字段
  - 记录每次抽取时间
  - 不会遗漏数据

**误区三：CDC很复杂**

- **说明**：CDC工具已经成熟，使用不复杂
- **后果**：不敢使用CDC
- **正确理解**：
  - 工具成熟（Debezium）
  - 配置简单
  - 容易上手

**误区四：CDC一定需要Kafka**

- **说明**：CDC不一定需要Kafka
- **后果**：过度设计
- **正确理解**：
  - 可以不用Kafka
  - 可以直接写入目标库
  - 根据需求选择

**误区五：触发器是实时CDC**

- **说明**：触发器可以捕获变更，但会影响性能
- **后果**：影响源系统性能
- **正确理解**：
  - 触发器影响性能
  - 不推荐用于大表
  - 优先使用Binlog/WAL

#### 七、实战任务

**任务1：设计增量抽取**

设计订单表的增量抽取：

```sql
-- 第1步：创建ETL日志表
CREATE TABLE etl_logs (
    sync_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    last_sync_time TIMESTAMP NOT NULL,
    row_count BIGINT NOT NULL,
    sync_status VARCHAR(50) NOT NULL,
    sync_start_time TIMESTAMP,
    sync_end_time TIMESTAMP,
    error_message TEXT
);

-- 第2步：全量初始化
INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders;

-- 记录同步
INSERT INTO etl_logs (table_name, last_sync_time, row_count, sync_status, sync_start_time, sync_end_time)
VALUES (
    'ods_orders',
    NOW(),
    (SELECT count(*) FROM business_db.orders),
    'success',
    NOW(),
    NOW()
);

-- 第3步：增量抽取（每天执行）
INSERT INTO ods_orders
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM business_db.orders
WHERE updated_at >= (
    SELECT last_sync_time 
    FROM etl_logs 
    WHERE table_name = 'ods_orders'
    ORDER BY sync_id DESC 
    LIMIT 1
)
ON CONFLICT (order_id) DO UPDATE SET
    user_id = EXCLUDED.user_id,
    product_id = EXCLUDED.product_id,
    order_amount = EXCLUDED.order_amount,
    order_status = EXCLUDED.order_status,
    updated_at = EXCLUDED.updated_at;

-- 记录同步
INSERT INTO etl_logs (table_name, last_sync_time, row_count, sync_status, sync_start_time, sync_end_time)
VALUES (
    'ods_orders',
    NOW(),
    (SELECT count(*) FROM business_db.orders WHERE updated_at >= ...),
    'success',
    NOW(),
    NOW()
);
```

**任务2：对比抽取方式**

对比：
```yaml
全量抽取：
  SQL: SELECT * FROM orders
  数据量：1000万行
  耗时：30分钟
  影响：影响源系统30分钟
  
增量抽取：
  SQL: SELECT * FROM orders WHERE updated_at >= ...
  数据量：10万行
  耗时：3分钟
  影响：影响源系统3分钟
  
CDC：
  工具：Debezium
  数据量：1万行
  延迟：秒级
  影响：几乎不影响
```

**任务3：选择抽取策略**

场景：
```yaml
表1：用户表（1000万行，有updated_at字段）
  → 增量抽取（基于时间戳）
  
表2：订单表（5000万行，需要实时）
  → CDC
  
表3：字典表（1000行，不常变化）
  → 全量抽取
  
表4：日志表（每天1亿行，只追加）
  → 增量抽取（基于ID）
```

#### 八、小结

数据抽取是ETL/ELT的第一步，根据数据量、性能要求、实时性要求选择合适的抽取方式。

核心要点：
- 全量抽取：简单可靠，适合小表
- 增量抽取：数据量小，适合大表
- CDC：实时完整，适合核心表
- 增量实现：基于时间戳、基于ID、基于触发器
- CDC实现：基于Binlog（MySQL）、基于WAL（PostgreSQL）
- 选择策略：根据数据量、实时性要求、技术栈选择
- 混合策略：不同表使用不同抽取方式

下一节将学习数据转换，了解如何清洗、转换、关联数据。

### 6.3 数据转换

上一节学习了数据抽取，了解了全量抽取、增量抽取、CDC等方法。

数据抽取到ODS层后，需要进行数据转换（Transform），生成DWD层和DWS层的数据。

**场景**：
```yaml
数据仓库项目：
  
数据分析师："ODS层的数据太脏了，有很多无效数据"
  
数据工程师："我来清洗和转换数据"
  
新同事："什么是数据转换？需要做哪些转换？"
```

**问题**：
- 什么是数据转换？
- 数据转换包含哪些操作？
- 如何设计数据转换流程？
- 如何保证数据质量？

**答案**：**数据转换是对抽取的数据进行清洗、格式化、关联、聚合等操作，生成高质量的数据**

#### 一、为什么需要数据转换

**第一，源数据质量不高**

```yaml
问题1：数据不完整
  示例：user_id为空、order_amount为NULL
  影响：无法分析
  
问题2：数据不准确
  示例：order_amount为负数、日期格式错误
  影响：分析结果错误
  
问题3：数据不一致
  示例：status字段有'completed'和'complete'两种值
  影响：聚合错误
```

**第二，源数据不适合直接分析**

```yaml
问题1：数据分散
  示例：订单表只有user_id，没有用户城市
  解决：关联用户维度表
  
问题2：粒度不符合
  示例：源表是明细数据，需要每日汇总
  解决：聚合计算
  
问题3：格式不统一
  示例：日期格式有'2026-01-01'和'01/01/2026'
  解决：统一格式
```

**第三，业务规则需要应用**

```yaml
规则1：数据过滤
  示例：只分析已完成订单
  转换：过滤order_status='completed'
  
规则2：数据计算
  示例：GMV = 订单金额 - 退款金额
  转换：计算GMV
  
规则3：数据分类
  示例：用户分群（VIP、普通）
  转换：根据订单金额分类
```

#### 二、数据转换的类型

##### 2.1 数据清洗（Data Cleaning）

**定义**：过滤或修正无效数据

**示例1：过滤空值**
```sql
-- 过滤user_id为空的订单
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE user_id IS NOT NULL;  -- 清洗：过滤user_id为空的记录
```

**示例2：过滤异常值**
```sql
-- 过滤order_amount为负数的订单
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders
WHERE order_amount > 0;  -- 清洗：过滤订单金额为负数的记录
```

**示例3：修正格式**
```sql
-- 修正日期格式
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    TO_DATE(created_at_text, 'YYYY-MM-DD') as created_at  -- 清洗：修正日期格式
FROM ods_orders;
```

**示例4：去重**
```sql
-- 去除重复订单
CREATE TABLE dwd_fact_orders AS
SELECT DISTINCT
    order_id,
    user_id,
    product_id,
    order_amount
FROM ods_orders;
```

##### 2.2 数据格式化（Data Formatting）

**定义**：统一数据格式

**示例1：日期格式化**
```sql
-- 统一日期格式为date_id（整数）
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    created_at,
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,  -- 格式化：2026-01-01 → 20260101
    EXTRACT(YEAR FROM created_at) as order_year,
    EXTRACT(MONTH FROM created_at) as order_month,
    EXTRACT(DAY FROM created_at) as order_day
FROM ods_orders;
```

**示例2：金额格式化**
```sql
-- 统一金额精度（保留2位小数）
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    product_id,
    ROUND(order_amount, 2) as order_amount,  -- 格式化：保留2位小数
    ROUND(discount_amount, 2) as discount_amount
FROM ods_orders;
```

**示例3：文本格式化**
```sql
-- 统一文本格式（大写、小写、去空格）
CREATE TABLE dim_users AS
SELECT 
    user_id,
    TRIM(name) as name,                              -- 格式化：去空格
    LOWER(email) as email,                           -- 格式化：转小写
    UPPER(city) as city                              -- 格式化：转大写
FROM ods_users;
```

**示例4：布尔值格式化**
```sql
-- 统一布尔值格式
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    user_id,
    order_amount,
    CASE 
        WHEN is_vip = 'true' THEN TRUE
        WHEN is_vip = '1' THEN TRUE
        WHEN is_vip = 'yes' THEN TRUE
        ELSE FALSE
    END as is_vip  -- 格式化：统一布尔值
FROM ods_orders;
```

##### 2.3 数据关联（Data Joining）

**定义**：关联多个表，丰富数据维度

**示例1：关联维度表**
```sql
-- 关联用户维度表
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.date_id,
    o.user_id,
    o.order_amount,
    u.city,              -- 关联：获取用户城市
    u.province,          -- 关联：获取用户省份
    u.segment            -- 关联：获取用户分群
FROM ods_orders o
JOIN dim_users u ON o.user_id = u.user_id;  -- 关联用户维度表
```

**示例2：关联多个维度表**
```sql
-- 关联多个维度表
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.date_id,
    o.user_id,
    o.product_id,
    o.order_amount,
    u.city,              -- 用户维度
    p.category,          -- 商品维度
    c.channel_name       -- 渠道维度
FROM ods_orders o
JOIN dim_users u ON o.user_id = u.user_id
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_channels c ON o.channel_id = c.channel_id;
```

**示例3：关联层级维度**
```sql
-- 关联商品分类层级
CREATE TABLE dwd_fact_orders AS
SELECT 
    o.order_id,
    o.product_id,
    p.product_name,
    c1.category_name as category_l1,  -- 一级分类
    c2.category_name as category_l2,  -- 二级分类
    c3.category_name as category_l3   -- 三级分类
FROM ods_orders o
JOIN dim_products p ON o.product_id = p.product_id
JOIN dim_categories c3 ON p.category_id = c3.category_id
JOIN dim_categories c2 ON c3.parent_id = c2.category_id
JOIN dim_categories c1 ON c2.parent_id = c1.category_id;
```

##### 2.4 数据聚合（Data Aggregation）

**定义**：对明细数据进行汇总

**示例1：按日期聚合**
```sql
-- 每日GMV汇总（DWS层）
CREATE TABLE dws_daily_gmv AS
SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    AVG(order_amount) as avg_order_amount
FROM dwd_fact_orders
GROUP BY date_id;
```

**示例2：按多维度聚合**
```sql
-- 每日GMV汇总（按城市）
CREATE TABLE dws_daily_gmv_by_city AS
SELECT 
    date_id,
    city,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv
FROM dwd_fact_orders
GROUP BY date_id, city;
```

**示例3：滚动聚合**
```sql
-- 7日滚动GMV
CREATE TABLE dws_7day_gmv AS
SELECT 
    date_id,
    SUM(order_amount) OVER (
        ORDER BY date_id
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) as gmv_7day
FROM dwd_daily_gmv;
```

**示例4：累计聚合**
```sql
-- 累计GMV
CREATE TABLE dws_cumulative_gmv AS
SELECT 
    date_id,
    gmv,
    SUM(gmv) OVER (
        ORDER BY date_id
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) as cumulative_gmv
FROM dws_daily_gmv;
```

##### 2.5 数据计算（Data Calculation）

**定义**：基于现有字段计算新字段

**示例1：计算派生字段**
```sql
-- 计算客单价
CREATE TABLE dws_daily_metrics AS
SELECT 
    date_id,
    gmv,
    order_count,
    gmv / order_count as avg_order_amount  -- 计算：客单价 = GMV / 订单数
FROM dws_daily_gmv;
```

**示例2：计算比率**
```sql
-- 计算转化率
CREATE TABLE dws_daily_conversion AS
SELECT 
    date_id,
    visitor_count,
    conversion_user_count,
    conversion_user_count * 100.0 / visitor_count as conversion_rate  -- 计算：转化率
FROM dws_daily_traffic;
```

**示例3：计算时间间隔**
```sql
-- 计算订单到发货的天数
CREATE TABLE dwd_fact_orders AS
SELECT 
    order_id,
    created_at,
    shipped_at,
    DATE_PART('day', shipped_at - created_at) as days_to_ship  -- 计算：发货天数
FROM ods_orders;
```

**示例4：计算条件字段**
```sql
-- 计算用户分群
CREATE TABLE dim_users AS
SELECT 
    user_id,
    total_order_amount,
    CASE 
        WHEN total_order_amount >= 10000 THEN 'VIP'
        WHEN total_order_amount >= 1000 THEN '高价值'
        WHEN total_order_amount >= 100 THEN '普通'
        ELSE '低价值'
    END as user_segment  -- 计算：用户分群
FROM ods_users;
```

#### 三、数据转换的分层设计

##### 3.1 ODS层 → DWD层

**转换内容**：
```yaml
数据清洗：
  - 过滤无效数据
  - 修正数据格式
  - 去除重复数据
  
数据关联：
  - 关联维度表
  - 获取维度属性
  
数据格式化：
  - 统一日期格式
  - 统一金额精度
  - 统一文本格式
```

**示例**：
```sql
-- ODS层 → DWD层
CREATE TABLE dwd_fact_orders AS
SELECT 
    -- 主键
    o.order_id,
    
    -- 维度外键
    TO_CHAR(o.created_at, 'YYYYMMDD')::INT as date_id,
    o.user_id,
    o.product_id,
    o.channel_id,
    
    -- 关联维度表
    u.city,
    u.province,
    u.segment as user_segment,
    p.category,
    p.brand,
    c.channel_name,
    
    -- 度量
    o.order_amount,
    o.order_quantity,
    o.order_profit,
    o.discount_amount,
    
    -- 技术字段
    o.created_at,
    o.updated_at
FROM ods_orders o
-- 关联维度表
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
LEFT JOIN dim_channels c ON o.channel_id = c.channel_id
-- 数据清洗
WHERE o.order_amount > 0
  AND o.user_id IS NOT NULL
  AND o.order_status = 'completed';
```

##### 3.2 DWD层 → DWS层

**转换内容**：
```yaml
数据聚合：
  - 按日期聚合
  - 按维度聚合
  - 滚动聚合
  - 累计聚合
  
数据计算：
  - 计算派生指标
  - 计算比率
  - 计算排名
```

**示例**：
```sql
-- DWD层 → DWS层（每日汇总）
CREATE TABLE dws_daily_gmv AS
SELECT 
    -- 维度
    date_id,
    city,
    category,
    
    -- 度量
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    SUM(order_quantity) as total_quantity,
    AVG(order_amount) as avg_order_amount,
    MAX(order_amount) as max_order_amount,
    MIN(order_amount) as min_order_amount
FROM dwd_fact_orders
GROUP BY date_id, city, category;
```

##### 3.3 DWS层 → ADS层

**转换内容**：
```yaml
数据聚合：
  - 按月聚合
  - 按季度聚合
  - 按年聚合
  
复杂计算：
  - 同比计算
  - 环比计算
  - 排名计算
```

**示例**：
```sql
-- DWS层 → ADS层（月度报表）
CREATE TABLE ads_monthly_report AS
SELECT 
    -- 维度
    TO_CHAR(TO_DATE(date_id::TEXT, 'YYYYMMDD'), 'YYYY-MM') as month,
    city,
    category,
    
    -- 度量
    SUM(gmv) as monthly_gmv,
    SUM(order_count) as monthly_order_count,
    
    -- 环比
    SUM(gmv) / LAG(SUM(gmv)) OVER (PARTITION BY city, category ORDER BY date_id) - 1 as gvw_mom,
    
    -- 同比
    SUM(gmv) / LAG(SUM(gmv), 12) OVER (PARTITION BY city, category ORDER BY date_id) - 1 as gvw_yoy,
    
    -- 排名
    RANK() OVER (PARTITION BY city ORDER BY SUM(gmv) DESC) as category_rank_in_city
FROM dws_daily_gmv
GROUP BY city, category, date_id;
```

#### 四、数据转换的最佳实践

##### 4.1 幂等性

**定义**：多次执行结果相同

```sql
-- 不好的设计（非幂等）
CREATE TABLE dwd_fact_orders AS
SELECT ... FROM ods_orders;

-- 好的设计（幂等）
CREATE TABLE IF NOT EXISTS dwd_fact_orders AS
SELECT ... FROM ods_orders;

-- 或者使用事务
BEGIN;
DELETE FROM dwd_fact_orders WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders
SELECT ... FROM ods_orders WHERE date_id = 20260101;
COMMIT;
```

##### 4.2 可追溯性

**定义**：记录转换过程

```sql
-- 创建ETL日志表
CREATE TABLE etl_logs (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(100),
    operation VARCHAR(50),
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    row_count BIGINT,
    status VARCHAR(50),
    error_message TEXT
);

-- 记录转换日志
INSERT INTO etl_logs (table_name, operation, start_time, status)
VALUES ('dwd_fact_orders', 'transform', NOW(), 'running');

-- 执行转换
...

-- 更新日志
UPDATE etl_logs 
SET end_time = NOW(), 
    row_count = (SELECT count(*) FROM dwd_fact_orders),
    status = 'success'
WHERE table_name = 'dwd_fact_orders' 
  AND operation = 'transform' 
  AND status = 'running';
```

##### 4.3 分区处理

**定义**：按分区处理，提高性能

```sql
-- 按天处理
CREATE TABLE dwd_fact_orders (
    order_id BIGINT,
    date_id INT,
    ...
) PARTITION BY RANGE (date_id);

-- 创建分区
CREATE TABLE dwd_fact_orders_202601 PARTITION OF dwd_fact_orders
    FOR VALUES FROM (20260101) TO (20260201);

-- 处理单天数据
DELETE FROM dwd_fact_orders_202601 WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders_202601
SELECT ... FROM ods_orders WHERE date_id = 20260101;
```

#### 五、常见误区

**误区一：转换逻辑越复杂越好**

- **说明**：转换逻辑要简洁，避免过度复杂
- **后果**：难以维护，性能差
- **正确理解**：
  - 保持转换逻辑简洁
  - 避免过度嵌套
  - 分步实现

**误区二：转换不影响性能**

- **说明**：转换可能很耗时
- **后果**：性能差，影响数据新鲜度
- **正确理解**：
  - 转换可能很耗时
  - 需要优化SQL
  - 使用索引、分区

**误区三：转换不需要测试**

- **说明**：转换逻辑需要测试
- **后果**：数据错误
- **正确理解**：
  - 需要单元测试
  - 需要数据质量检查
  - 需要验证结果

**误区四：转换可以随意修改**

- **说明**：转换逻辑修改会影响下游
- **后果**：下游数据不一致
- **正确理解**：
  - 修改需要评估
  - 需要通知下游
  - 需要版本控制

**误区五：转换一次就完成**

- **说明**：转换需要持续优化
- **后果**：性能退化
- **正确理解**：
  - 定期优化SQL
  - 监控转换性能
  - 持续改进

#### 六、实战任务

**任务1：设计ODS → DWD转换**

```sql
-- 需求：将ODS层的订单表转换为DWD层的事实表

CREATE TABLE dwd_fact_orders AS
SELECT 
    -- 主键
    order_id,
    
    -- 维度外键
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
    EXTRACT(HOUR FROM created_at) as hour_id,
    user_id,
    product_id,
    channel_id,
    
    -- 关联维度表
    u.city,
    u.province,
    u.segment as user_segment,
    p.category,
    p.brand,
    c.channel_name,
    
    -- 度量
    order_amount,
    order_quantity,
    profit,
    discount,
    
    -- 技术字段
    created_at,
    updated_at
FROM ods_orders o
LEFT JOIN dim_users u ON o.user_id = u.user_id
LEFT JOIN dim_products p ON o.product_id = p.product_id
LEFT JOIN dim_channels c ON o.channel_id = c.channel_id
-- 数据清洗
WHERE order_amount > 0
  AND user_id IS NOT NULL
  AND order_status = 'completed'
  AND is_refunded = false;
```

**任务2：设计DWD → DWS转换**

```sql
-- 需求：将DWD层的事实表转换为DWS层的每日汇总

CREATE TABLE dws_daily_gmv AS
SELECT 
    -- 维度
    date_id,
    city,
    category,
    
    -- 度量
    COUNT(DISTINCT order_id) as order_count,
    SUM(order_amount) as gmv,
    SUM(order_quantity) as total_quantity,
    AVG(order_amount) as avg_order_amount,
    COUNT(DISTINCT user_id) as user_count
FROM dwd_fact_orders
GROUP BY date_id, city, category;

-- 创建索引
CREATE INDEX idx_dws_daily_gmv_date ON dws_daily_gmv(date_id);
CREATE INDEX idx_dws_daily_gmv_city ON dws_daily_gmv(city);
```

**任务3：设计转换流程**

```sql
-- 第1步：ODS → DWD
BEGIN;
DELETE FROM dwd_fact_orders WHERE date_id = 20260101;
INSERT INTO dwd_fact_orders
SELECT ... FROM ods_orders WHERE date_id = 20260101;
COMMIT;

-- 第2步：DWD → DWS
BEGIN;
DELETE FROM dws_daily_gmv WHERE date_id = 20260101;
INSERT INTO dws_daily_gmv
SELECT ... FROM dwd_fact_orders WHERE date_id = 20260101;
COMMIT;

-- 第3步：记录日志
INSERT INTO etl_logs (table_name, operation, status, row_count)
VALUES 
('dwd_fact_orders', 'transform', 'success', (SELECT count(*) FROM dwd_fact_orders WHERE date_id = 20260101)),
('dws_daily_gmv', 'transform', 'success', (SELECT count(*) FROM dws_daily_gmv WHERE date_id = 20260101));
```

#### 七、小结

数据转换是对抽取的数据进行清洗、格式化、关联、聚合等操作，生成高质量的数据。

核心要点：
- 数据清洗：过滤无效数据、修正格式、去重
- 数据格式化：统一日期、金额、文本格式
- 数据关联：关联维度表，丰富数据维度
- 数据聚合：按维度汇总，生成汇总表
- 数据计算：计算派生字段、比率、排名
- 分层设计：ODS → DWD → DWS → ADS
- 最佳实践：幂等性、可追溯性、分区处理

下一节将学习数据加载，了解如何将转换后的数据加载到目标系统。

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

### 6.5 常见ETL工具

前面学习了ETL的概念和数据抽取、转换、加载的方法。

现在学习常见的ETL工具，了解如何使用工具简化ETL开发。

**场景**：
```yaml
数据仓库项目启动：
  
技术经理："我们需要选择ETL工具"
  
数据工程师A："我用Airflow，灵活强大"
  
数据工程师B："我用Fivetran，简单快速"
  
数据工程师C："我用Informatica，企业级"
  
新同事："这么多工具，应该怎么选？"
```

**问题**：
- 常见的ETL工具有哪些？
- 不同工具有什么特点？
- 如何选择合适的ETL工具？
- 开源工具 vs 商业工具如何选择？

**答案**：**根据团队规模、技术能力、预算、需求选择合适的ETL工具**

#### 一、ETL工具分类

##### 1.1 按部署方式分类

**自托管（On-Premise）**：
```yaml
定义：
  - 部署在自己的服务器
  - 自己维护
  
工具：
  - Airflow（开源）
  - dbt（开源）
  - Informatica PowerCenter（商业）
  
优势：
  - 数据安全
  - 可定制化
  - 无供应商锁定
  
劣势：
  - 需要运维
  - 需要硬件成本
  - 升级复杂
```

**云托管（Cloud-Hosted）**：
```yaml
定义：
  - 部署在云平台
  - 供应商维护
  
工具：
  - Fivetran（商业）
  - Airbyte（开源+商业）
  - Matillion（商业）
  
优势：
  - 无需运维
  - 快速上手
  - 自动扩展
  
劣势：
  - 数据在云端
  - 供应商锁定
  - 长期成本高
```

##### 1.2 按功能分类

**数据集成工具（Data Integration）**：
```yaml
功能：
  - 数据同步
  - CDC
  - 数据复制
  
工具：
  - Fivetran
  - Airbyte
  - Qlik Replicate
```

**工作流调度工具（Workflow Orchestration）**：
```yaml
功能：
  - 任务调度
  - 工作流管理
  - 依赖管理
  
工具：
  - Airflow
  - Prefect
  - Dagster
```

**数据转换工具（Data Transformation）**：
```yaml
功能：
  - 数据转换
  - SQL管理
  - 版本控制
  
工具：
  - dbt
  - SQLMesh
```

**企业级ETL平台**：
```yaml
功能：
  - 全功能ETL平台
  - 图形化界面
  - 企业级支持
  
工具：
  - Informatica PowerCenter
  - IBM InfoSphere DataStage
  - Talend
```

#### 二、开源ETL工具

##### 2.1 Apache Airflow

**定义**：工作流调度平台，用Python编写DAG（有向无环图）

**特点**：
```yaml
优势：
  - 开源免费
  - 社区活跃
  - 可扩展性强
  - 支持多种任务类型
  
劣势：
  - 学习曲线陡峭
  - 需要运维
  - 配置复杂
```

**示例**：
```python
# Airflow DAG示例
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import psycopg2

# 默认参数
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email': ['data-team@company.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# 创建DAG
dag = DAG(
    'daily_etl',
    default_args=default_args,
    description='每日ETL任务',
    schedule_interval='0 4 * * *',  # 每天凌晨4点
    catchup=False,
    tags=['etl', 'daily'],
)

# 任务1：抽取数据
def extract_data():
    conn = psycopg2.connect(host='mysql-server', database='business_db')
    df = pd.read_sql('SELECT * FROM orders WHERE date >= CURRENT_DATE - 1', conn)
    df.to_csv('/data/orders.csv', index=False)
    conn.close()

# 任务2：转换数据
def transform_data():
    df = pd.read_csv('/data/orders.csv')
    df = df[df['order_amount'] > 0]
    df.to_csv('/data/orders_transformed.csv', index=False)

# 任务3：加载数据
def load_data():
    conn = psycopg2.connect(host='postgres-server', database='data_warehouse')
    cursor = conn.cursor()
    
    df = pd.read_csv('/data/orders_transformed.csv')
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dwd_fact_orders 
            (order_id, date_id, user_id, product_id, order_amount)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (order_id) DO UPDATE SET
                date_id = EXCLUDED.date_id,
                user_id = EXCLUDED.user_id,
                product_id = EXCLUDED.product_id,
                order_amount = EXCLUDED.order_amount
        """, (row['order_id'], row['date_id'], row['user_id'], 
              row['product_id'], row['order_amount']))
    
    conn.commit()
    conn.close()

# 定义任务
extract_task = PythonOperator(
    task_id='extract_data',
    python_callable=extract_data,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_data',
    python_callable=load_data,
    dag=dag,
)

# 设置依赖关系
extract_task >> transform_task >> load_task
```

**适用场景**：
```yaml
场景1：复杂工作流
  示例：多步骤ETL、复杂依赖关系
  原因：Airflow擅长管理复杂依赖
  
场景2：自定义任务
  示例：需要Python代码
  原因：支持Python Operator
  
场景3：有技术团队
  示例：有数据工程团队
  原因：需要运维Airflow
```

##### 2.2 dbt（data build tool）

**定义**：数据转换工具，用SQL编写转换逻辑

**特点**：
```yaml
优势：
  - SQL-based，学习成本低
  - 版本控制友好
  - 自动生成文档
  - 模块化设计
  
劣势：
  - 只做转换，不做抽取
  - SQL灵活性有限
  - 需要配合其他工具
```

**示例**：
```sql
-- models/staging/orders.sql
-- ODS层 → DWD层

{{ config(
    materialized='table',
    schema='dwd'
) }}

SELECT 
    order_id,
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
    user_id,
    product_id,
    order_amount
FROM {{ source('ods', 'orders') }}
WHERE order_amount > 0
  AND user_id IS NOT NULL
  AND order_status = 'completed';
```

```sql
-- models/marts/daily_gmv.sql
-- DWD层 → DWS层

{{ config(
    materialized='table',
    schema='dws'
) }}

SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    AVG(order_amount) as avg_order_amount
FROM {{ ref('staging_orders') }}
GROUP BY date_id;
```

```yaml
# dbt_project.yml
name: 'my_data_warehouse'
version: '1.0.0'
config-version: 2

profile: 'my_data_warehouse'

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]

target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"
```

```sql
-- profiles.yml
my_data_warehouse:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      user: postgres
      password: password
      port: 5432
      dbname: data_warehouse
      schema: dws
      threads: 4
```

**执行dbt**：
```bash
# 运行所有模型
dbt run

# 运行特定模型
dbt run --models staging_orders

# 测试
dbt test

# 生成文档
dbt docs generate
dbt docs serve
```

**适用场景**：
```yaml
场景1：SQL转换
  示例：DWD → DWS转换
  原因：dbt擅长SQL转换
  
场景2：版本控制
  示例：需要Git管理
  原因：dbt代码是SQL文件
  
场景3：数据团队
  示例：数据分析师为主
  原因：SQL比Python简单
```

##### 2.3 Airbyte

**定义**：数据集成平台，支持多种数据源和目标

**特点**：
```yaml
优势：
  - 开源
  - 支持300+数据源
  - UI界面友好
  - 支持CDC
  
劣势：
  - 功能相对简单
  - 自定义能力有限
```

**示例**：
```yaml
# Airbyte配置
source:
  type: postgres
  connection:
    host: mysql-server
    port: 3306
    database: business_db
    username: root
    password: password

destination:
  type: postgres
  connection:
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

**适用场景**：
```yaml
场景1：数据同步
  示例：MySQL → PostgreSQL
  原因：Airbyte擅长数据同步
  
场景2：CDC
  示例：实时数据同步
  原因：Airbyte支持CDC
  
场景3：简单集成
  示例：不需要复杂转换
  原因：Airbyte配置简单
```

#### 三、商业ETL工具

##### 3.1 Fivetran

**定义**：云托管的数据集成平台

**特点**：
```yaml
优势：
  - 零运维
  - 支持150+数据源
  - 自动处理Schema变更
  - 自动重试
  
劣势：
  - 价格昂贵
  - 自定义能力有限
  - 供应商锁定
  
定价：
  - 按数据行数计费
  - 例如：$0.10/1000行
```

**适用场景**：
```yaml
场景1：预算充足
  示例：大公司
  原因：Fivetran价格高
  
场景2：无运维团队
  示例：小团队
  原因：Fivetran零运维
  
场景3：快速实施
  示例：MVP阶段
  原因：Fivetran快速上手
```

##### 3.2 Informatica PowerCenter

**定义**：企业级ETL平台

**特点**：
```yaml
优势：
  - 功能强大
  - 图形化界面
  - 企业级支持
  - 性能优秀
  
劣势：
  - 价格昂贵
  - 学习曲线陡峭
  - 部署复杂
  
定价：
  - 许可费 + 维护费
  - 例如：$100,000+/年
```

**适用场景**：
```yaml
场景1：大型企业
  示例：500强企业
  原因：需要企业级支持
  
场景2：复杂ETL
  示例：复杂数据转换
  原因：Informatica功能强大
  
场景3：传统行业
  示例：银行、保险
  原因：需要成熟稳定方案
```

#### 四、工具选择指南

##### 4.1 决策树

```yaml
第1步：预算多少？
  低预算（<$10,000/年）
    → 开源工具（Airflow + dbt + Airbyte）
  
  中等预算（$10,000-$100,000/年）
    → 混合方案（Fivetran + dbt）
  
  高预算（>$100,000/年）
    → 商业工具（Informatica）

第2步：团队能力如何？
  强工程能力（Python/Java）
    → Airflow
  
  强SQL能力
    → dbt
  
  弱技术能力
    → Fivetran

第3步：需要自定义吗？
  需要高度自定义
    → Airflow
  
  中等自定义
    → dbt
  
  不需要自定义
    → Fivetran

第4步：有运维团队吗？
  有
    → 自托管工具
  
  没有
    → 云托管工具
```

##### 4.2 常见组合

**组合1：Airflow + dbt + Airbyte**
```yaml
适用：
  - 开源方案
  - 中等技术团队
  - 预算有限
  
分工：
  - Airbyte：数据同步（CDC）
  - dbt：数据转换（SQL）
  - Airflow：工作流调度
  
成本：
  - $0（开源）
  - 但需要运维成本
```

**组合2：Fivetran + dbt**
```yaml
适用：
  - 云原生方案
  - 小团队
  - 预算充足
  
分工：
  - Fivetran：数据同步（CDC）
  - dbt：数据转换（SQL）
  
成本：
  - $50,000+/年
  - 零运维
```

**组合3：Airflow**
```yaml
适用：
  - 全栈方案
  - 强技术团队
  - 预算有限
  
分工：
  - Airflow：抽取+转换+加载+调度
  
成本：
  - $0（开源）
  - 高开发成本
```

**组合4：Informatica**
```yaml
适用：
  - 企业级方案
  - 大型团队
  - 预算充足
  
分工：
  - Informatica：全功能ETL平台
  
成本：
  - $100,000+/年
  - 包含支持
```

#### 五、实战示例

##### 5.1 使用Airflow + dbt + Airbyte

**架构**：
```text
MySQL → Airbyte(CDC) → PostgreSQL(ODS) → dbt(Transform) → PostgreSQL(DWD/DWS)
                              ↓
                         Airflow(调度)
```

**Airflow DAG**：
```python
from airflow import DAG
from airflow.operators.airbyte import AirbyteTriggerSyncOperator
from airflow.providers.dbt.operators.dbt import DbtRunOperator
from datetime import datetime

dag = DAG(
    'daily_etl',
    start_date=datetime(2026, 1, 1),
    schedule_interval='0 4 * * *',
    catchup=False,
)

# 任务1：Airbyte同步数据
sync_orders = AirbyteTriggerSyncOperator(
    task_id='sync_orders',
    airbyte_conn_id='airbyte',
    connection_id='订单同步连接ID',
    dag=dag,
)

# 任务2：dbt运行转换
run_dbt = DbtRunOperator(
    task_id='run_dbt',
    profiles_dir='/usr/local/airflow/dags/dbt',
    dir='/usr/local/airflow/dags/dbt',
    dag=dag,
)

# 设置依赖
sync_orders >> run_dbt
```

**dbt模型**：
```sql
-- models/dwd_fact_orders.sql
{{ config(materialized='table', schema='dwd') }}

SELECT 
    order_id,
    TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
    user_id,
    product_id,
    order_amount
FROM {{ source('ods', 'orders') }}
WHERE order_amount > 0;
```

#### 六、常见误区

**误区一：商业工具一定比开源工具好**

- **说明**：商业工具和开源工具各有优劣
- **后果**：盲目选择商业工具，浪费预算
- **正确理解**：
  - 商业工具：功能全、支持好、价格高
  - 开源工具：灵活、免费、需要运维
  - 根据需求选择

**误区二：工具越复杂越好**

- **说明**：工具要根据团队规模和能力选择
- **后果**：工具太复杂，团队无法驾驭
- **正确理解**：
  - 小团队：简单工具（Fivetran）
  - 大团队：复杂工具（Airflow）
  - 根据团队能力选择

**误区三：一个工具解决所有问题**

- **说明**：通常需要多个工具组合
- **后果**：强用一个工具，效果差
- **正确理解**：
  - 工具组合：Airbyte + dbt + Airflow
  - 各司其职
  - 发挥各自优势

**误区四：开源工具免费**

- **说明**：开源工具虽然免费，但需要人力成本
- **后果**：低估总成本
- **正确理解**：
  - 开源工具：零许可费，高人力成本
  - 商业工具：高许可费，低人力成本
  - 综合评估总成本

**误区五：工具选择一成不变**

- **说明**：工具选择会随业务发展而变化
- **后果**：工具不适配业务
- **正确理解**：
  - 初创期：Fivetran
  - 成长期：Airflow + dbt
  - 成熟期：自研平台
  - 持续评估

#### 七、实战任务

**任务1：选择ETL工具**

场景1：初创公司，5人数据团队，预算有限
```yaml
决策：
  → Airflow + dbt + Airbyte
  
原因：
  - 预算有限，选择开源
  - 团队小，需要简单方案
  - 有一定技术能力
```

场景2：大公司，50人数据团队，预算充足
```yaml
决策：
  → Fivetran + dbt + 自研平台
  
原因：
  - 预算充足
  - 需要零运维的数据同步
  - 有能力自研平台
```

**任务2：设计ETL架构**

使用Airflow + dbt + Airbyte：

```yaml
架构：
  数据同步：Airbyte（CDC）
  数据转换：dbt（SQL）
  工作流调度：Airflow

数据流：
  MySQL → Airbyte → PostgreSQL(ODS) → dbt → PostgreSQL(DWD/DWS)
                              ↓
                         Airflow调度
```

**任务3：评估工具成本**

开源方案（Airflow + dbt + Airbyte）：
```yaml
许可费：$0
硬件成本：$5,000/年（服务器）
人力成本：$200,000/年（1个数据工程师）
总成本：$205,000/年
```

商业方案（Fivetran）：
```yaml
许可费：$100,000/年
硬件成本：$0（云托管）
人力成本：$50,000/年（0.5个数据分析师）
总成本：$150,000/年
```

结论：对于大公司，商业方案总成本更低。

#### 八、小结

常见的ETL工具有开源和商业两类，根据团队规模、技术能力、预算选择合适的工具。

核心要点：
- 工具分类：自托管 vs 云托管、数据集成 vs 工作流调度 vs 数据转换
- 开源工具：Airflow（调度）、dbt（转换）、Airbyte（集成）
- 商业工具：Fivetran（集成）、Informatica（全功能ETL）
- 工具选择：根据预算、团队能力、自定义需求、运维能力选择
- 常见组合：Airflow+dbt+Airbyte（开源）、Fivetran+dbt（混合）
- 成本评估：开源工具低许可费高人力成本，商业工具高许可费低人力成本

下一节将学习工作流调度，了解如何管理ETL任务的依赖和调度。

### 6.6 工作流调度

上一节学习了常见ETL工具，了解了Airflow、dbt、Airbyte等工具的使用。

ETL任务通常不是单一的，而是有依赖关系的工作流。需要工作流调度工具来管理这些任务。

**场景**：
```yaml
数据仓库项目：
  
数据工程师："我每天要运行10个ETL任务"
  
技术经理："这些任务有依赖关系吗？"
  
数据工程师："有的，DWD层完成后才能运行DWS层"
  
技术经理："如果任务失败了怎么办？"
  
新同事："如何管理这些复杂的任务依赖？"
```

**问题**：
- 什么是工作流调度？
- 如何设计任务依赖？
- 如何处理任务失败？
- 如何保证SLA？

**答案**：**使用工作流调度工具（如Airflow）管理ETL任务的依赖、调度、监控、重试**

#### 一、为什么需要工作流调度

**第一，ETL任务有依赖关系**

```yaml
场景1：分层依赖
  ODS层 → DWD层 → DWS层 → ADS层
  
问题：
  - DWD层完成后，才能运行DWS层
  - 如何管理这种依赖？
  
解决：
  - 工作流调度工具自动管理依赖
```

**第二，ETL任务需要定时执行**

```yaml
场景2：定时任务
  - 每天凌晨4点运行ETL
  - 每小时运行增量加载
  
问题：
  - 如何定时执行？
  - 如何处理时区？
  
解决：
  - 工作流调度工具支持Cron表达式
```

**第三，ETL任务可能失败**

```yaml
场景3：任务失败
  - 数据源不可用
  - 数据格式错误
  - 资源不足
  
问题：
  - 如何重试？
  - 如何告警？
  - 如何避免阻塞下游任务？
  
解决：
  - 工作流调度工具支持重试、告警、跳过
```

#### 二、工作流调度的核心概念

##### 2.1 DAG（Directed Acyclic Graph）

**定义**：有向无环图，表示任务的依赖关系

**示例**：
```text
     [任务A]
       /   \
   [任务B] [任务C]
      \     /
      [任务D]
```

**特点**：
```yaml
有向：
  - 任务有方向
  - A → B表示A完成后运行B
  
无环：
  - 不能有循环依赖
  - A → B → C → A（不允许）
  
原因：
  - 避免死锁
  - 确保任务能完成
```

##### 2.2 任务（Task）

**定义**：DAG中的节点，表示一个具体的操作

**示例**：
```python
# Airflow任务示例
from airflow.operators.python import PythonOperator

# 任务1：抽取数据
extract_task = PythonOperator(
    task_id='extract_data',
    python_callable=extract_data_function,
    dag=dag,
)

# 任务2：转换数据
transform_task = PythonOperator(
    task_id='transform_data',
    python_callable=transform_data_function,
    dag=dag,
)

# 任务3：加载数据
load_task = PythonOperator(
    task_id='load_data',
    python_callable=load_data_function,
    dag=dag,
)
```

**任务类型**：
```yaml
Python任务：
  - 运行Python函数
  - 示例：extract_task = PythonOperator(...)

SQL任务：
  - 运行SQL查询
  - 示例：sql_task = SQLOperator(...)

Bash任务：
  - 运行Shell脚本
  - 示例：bash_task = BashOperator(...)

传感器任务：
  - 等待某个条件满足
  - 示例：sensor_task = FileSensor(...)
```

##### 2.3 依赖关系（Dependencies）

**定义**：任务之间的执行顺序

**设置方式**：
```python
# 方式1：使用>>运算符
extract_task >> transform_task >> load_task

# 方式2：使用set_downstream
extract_task.set_downstream([transform_task])
transform_task.set_downstream([load_task])

# 方式3：使用set_upstream
load_task.set_upstream([transform_task])
transform_task.set_upstream([extract_task])
```

**复杂依赖**：
```python
# 场景：多个任务并行
extract_task1 >> [transform_task1, transform_task2]
# 或
extract_task1 >> transform_task1
extract_task1 >> transform_task2

# 场景：多个任务汇聚
[transform_task1, transform_task2] >> load_task

# 场景：复杂依赖
extract_task1 >> transform_task1 >> load_task
extract_task2 >> transform_task2 >> load_task
```

#### 三、Airflow实战

##### 3.1 创建DAG

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import psycopg2
import pandas as pd

# DAG配置
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email': ['data-team@company.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# 创建DAG
dag = DAG(
    'daily_etl_orders',
    default_args=default_args,
    description='每日订单ETL',
    schedule_interval='0 4 * * *',  # 每天凌晨4点
    catchup=False,
    tags=['etl', 'orders', 'daily'],
    max_active_runs=1,  # 同时最多运行1个实例
)
```

##### 3.2 定义任务函数

```python
# 函数1：抽取数据
def extract_orders(**context):
    # 获取执行日期
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    # 从MySQL抽取
    conn_mysql = pymysql.connect(
        host='mysql-server',
        user='root',
        password='password',
        database='business_db'
    )
    
    df = pd.read_sql(f"""
        SELECT 
            order_id,
            user_id,
            product_id,
            order_amount,
            order_status,
            created_at
        FROM orders
        WHERE DATE(created_at) = '{execution_date.date()}'
    """, conn_mysql)
    
    conn_mysql.close()
    
    # 保存到文件
    df.to_csv(f'/data/orders_{date_id}.csv', index=False)
    
    print(f"Extracted {len(df)} orders for {date_id}")

# 函数2：转换数据
def transform_orders(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    # 读取文件
    df = pd.read_csv(f'/data/orders_{date_id}.csv')
    
    # 数据清洗
    df = df[df['order_amount'] > 0]
    df = df[df['user_id'].notna()]
    df = df[df['order_status'] == 'completed']
    
    # 数据转换
    df['date_id'] = date_id
    
    # 保存转换后的数据
    df.to_csv(f'/data/orders_transformed_{date_id}.csv', index=False)
    
    print(f"Transformed to {len(df)} valid orders")

# 函数3：加载数据
def load_orders(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    # 读取转换后的数据
    df = pd.read_csv(f'/data/orders_transformed_{date_id}.csv')
    
    # 加载到PostgreSQL
    conn_pg = psycopg2.connect(
        host='postgres-server',
        user='postgres',
        password='password',
        database='data_warehouse'
    )
    cursor = conn_pg.cursor()
    
    # 删除当天数据
    cursor.execute(f"DELETE FROM dwd_fact_orders WHERE date_id = {date_id}")
    
    # 插入新数据
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dwd_fact_orders 
            (order_id, date_id, user_id, product_id, order_amount)
            VALUES (%s, %s, %s, %s, %s)
        """, (row['order_id'], row['date_id'], row['user_id'], 
              row['product_id'], row['order_amount']))
    
    conn_pg.commit()
    cursor.close()
    conn_pg.close()
    
    print(f"Loaded {len(df)} orders to data warehouse")

# 函数4：数据质量检查
def quality_check(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    conn_pg = psycopg2.connect(
        host='postgres-server',
        user='postgres',
        password='password',
        database='data_warehouse'
    )
    cursor = conn_pg.cursor()
    
    # 检查1：行数检查
    cursor.execute(f"SELECT COUNT(*) FROM dwd_fact_orders WHERE date_id = {date_id}")
    row_count = cursor.fetchone()[0]
    
    if row_count == 0:
        raise Exception(f"No data loaded for {date_id}")
    
    # 检查2：金额检查
    cursor.execute(f"""
        SELECT COUNT(*) FROM dwd_fact_orders 
        WHERE date_id = {date_id} AND order_amount <= 0
    """)
    invalid_amount = cursor.fetchone()[0]
    
    if invalid_amount > 0:
        raise Exception(f"Found {invalid_amount} orders with invalid amount")
    
    cursor.close()
    conn_pg.close()
    
    print(f"Quality check passed for {date_id}: {row_count} rows")
```

##### 3.3 创建任务并设置依赖

```python
# 创建任务
extract_task = PythonOperator(
    task_id='extract_orders',
    python_callable=extract_orders,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_orders',
    python_callable=transform_orders,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_orders',
    python_callable=load_orders,
    dag=dag,
)

quality_check_task = PythonOperator(
    task_id='quality_check',
    python_callable=quality_check,
    dag=dag,
)

# 设置依赖关系
extract_task >> transform_task >> load_task >> quality_check_task
```

##### 3.4 完整DAG示例

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta
import pymysql
import psycopg2
import pandas as pd

# DAG配置
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email': ['data-team@company.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

# 创建DAG
dag = DAG(
    'daily_etl_orders',
    default_args=default_args,
    description='每日订单ETL',
    schedule_interval='0 4 * * *',
    catchup=False,
    tags=['etl', 'orders'],
)

# 定义任务函数
def extract_orders(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    conn = pymysql.connect(
        host='mysql-server',
        user='root',
        password='password',
        database='business_db'
    )
    
    df = pd.read_sql(f"""
        SELECT order_id, user_id, product_id, order_amount, order_status, created_at
        FROM orders
        WHERE DATE(created_at) = '{execution_date.date()}'
    """, conn)
    
    conn.close()
    df.to_csv(f'/data/orders_{date_id}.csv', index=False)
    print(f"Extracted {len(df)} orders")

def transform_orders(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    df = pd.read_csv(f'/data/orders_{date_id}.csv')
    df = df[df['order_amount'] > 0]
    df = df[df['user_id'].notna()]
    df['date_id'] = date_id
    df.to_csv(f'/data/orders_transformed_{date_id}.csv', index=False)
    print(f"Transformed to {len(df)} valid orders")

def load_orders(**context):
    execution_date = context['execution_date']
    date_id = int(execution_date.strftime('%Y%m%d'))
    
    df = pd.read_csv(f'/data/orders_transformed_{date_id}.csv')
    
    conn = psycopg2.connect(
        host='postgres-server',
        user='postgres',
        password='password',
        database='data_warehouse'
    )
    cursor = conn.cursor()
    
    cursor.execute(f"DELETE FROM dwd_fact_orders WHERE date_id = {date_id}")
    
    for _, row in df.iterrows():
        cursor.execute("""
            INSERT INTO dwd_fact_orders 
            (order_id, date_id, user_id, product_id, order_amount)
            VALUES (%s, %s, %s, %s, %s)
        """, (row['order_id'], row['date_id'], row['user_id'], 
              row['product_id'], row['order_amount']))
    
    conn.commit()
    cursor.close()
    conn.close()
    print(f"Loaded {len(df)} orders")

# 创建任务
extract_task = PythonOperator(
    task_id='extract_orders',
    python_callable=extract_orders,
    dag=dag,
)

transform_task = PythonOperator(
    task_id='transform_orders',
    python_callable=transform_orders,
    dag=dag,
)

load_task = PythonOperator(
    task_id='load_orders',
    python_callable=load_orders,
    dag=dag,
)

# 设置依赖
extract_task >> transform_task >> load_task
```

#### 四、任务调度策略

##### 4.1 调度时间

```python
# 每天凌晨4点
schedule_interval='0 4 * * *'

# 每小时
schedule_interval='0 * * * *'

# 每周一凌晨3点
schedule_interval='0 3 * * 1'

# 每6小时
schedule_interval='0 */6 * * *'

# 使用cron预设
schedule_interval='@daily'     # 每天
schedule_interval='@hourly'    # 每小时
schedule_interval='@weekly'    # 每周
schedule_interval='@monthly'   # 每月
```

##### 4.2 时区处理

```python
from airflow.utils.timezone import make_aware

# 设置时区
dag = DAG(
    'daily_etl_orders',
    schedule_interval='0 4 * * *',  # UTC时间
    timezone='Asia/Shanghai',  # DAG时区
    ...
)

# 任务中使用时区
def get_execution_date(**context):
    execution_date = context['execution_date']
    # 转换为本地时区
    local_date = make_aware(execution_date, timezone='Asia/Shanghai')
    print(f"Execution date (local): {local_date}")
```

#### 五、错误处理和重试

##### 5.1 重试策略

```python
# 任务级别重试
task = PythonOperator(
    task_id='extract_orders',
    python_callable=extract_orders,
    retries=3,  # 最多重试3次
    retry_delay=timedelta(minutes=5),  # 重试间隔5分钟
    retry_exponential_backoff=True,  # 指数退避
    max_retry_delay=timedelta(minutes=30),  # 最大重试间隔
)

# DAG级别重试
default_args = {
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}
```

##### 5.2 错误处理

```python
# 使用try-except
def extract_orders(**context):
    try:
        conn = pymysql.connect(...)
        df = pd.read_sql(...)
        conn.close()
        return df
    except Exception as e:
        print(f"Error: {e}")
        # 记录到日志系统
        send_alert(f"Extract failed: {e}")
        raise  # 重新抛出异常，触发重试
```

#### 六、SLA管理

##### 6.1 定义SLA

```python
from airflow.utils.dates import days_ago

# DAG级别SLA
dag = DAG(
    'daily_etl_orders',
    schedule_interval='0 4 * * *',
    sla=timedelta(hours=2),  # 必须在调度后2小时内完成
    ...
)

# 任务级别SLA
task = PythonOperator(
    task_id='extract_orders',
    python_callable=extract_orders,
    sla=timedelta(hours=1),  # 必须在1小时内完成
    ...
)
```

##### 6.2 SLA监控

```python
# SLA错过告警
def sla_miss_callback(dag, task_list, blocking_task_list, slas, blocking_tis):
    send_email(
        subject=f"SLA Missed: {dag.dag_id}",
        body=f"Tasks {task_list} missed SLA"
    )

dag = DAG(
    'daily_etl_orders',
    schedule_interval='0 4 * * *',
    sla_miss_callback=sla_miss_callback,
    ...
)
```

#### 七、常见误区

**误区一：所有任务都串行**

- **说明**：可以并行执行没有依赖的任务
- **后果**：总耗时长
- **正确理解**：
  - 识别可并行的任务
  - 合理设置依赖关系
  - 提升效率

**误区二：catchup=True**

- **说明**：catchup=True会补跑历史任务
- **后果**：启动时运行大量历史任务
- **正确理解**：
  - 生产环境设置catchup=False
  - 避免启动时运行历史任务

**误区三：忽略时区**

- **说明**：Airflow默认使用UTC时区
- **后果**：调度时间错误
- **正确理解**：
  - 明确指定时区
  - 或使用UTC时间

**误区四：不设置SLA**

- **说明**：SLA可以帮助监控任务完成时间
- **后果**：任务延迟无法及时发现
- **正确理解**：
  - 设置合理的SLA
  - 配置SLA告警

**误区五：忽略重试配置**

- **说明**：合理的重试可以提高任务成功率
- **后果**：临时故障导致任务失败
- **正确理解**：
  - 设置重试次数和间隔
  - 使用指数退避

#### 八、实战任务

**任务1：设计多层级ETL工作流**

```python
# ODS层ETL
ods_task = PythonOperator(
    task_id='ods_etl',
    python_callable=ods_etl_function,
    dag=dag,
)

# DWD层ETL（多个表并行）
dwd_orders_task = PythonOperator(
    task_id='dwd_orders_etl',
    python_callable=dwd_orders_etl_function,
    dag=dag,
)

dwd_users_task = PythonOperator(
    task_id='dwd_users_etl',
    python_callable=dwd_users_etl_function,
    dag=dag,
)

dwd_products_task = PythonOperator(
    task_id='dwd_products_etl',
    python_callable=dwd_products_etl_function,
    dag=dag,
)

# DWS层ETL
dws_gmv_task = PythonOperator(
    task_id='dws_gmv_etl',
    python_callable=dws_gmv_etl_function,
    dag=dag,
)

# 依赖关系
ods_task >> [dwd_orders_task, dwd_users_task, dwd_products_task] >> dws_gmv_task
```

**任务2：配置错误处理**

```python
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'email': ['data-team@company.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,
    'max_retry_delay': timedelta(minutes=30),
}
```

**任务3：设置SLA和告警**

```python
dag = DAG(
    'daily_etl',
    default_args=default_args,
    schedule_interval='0 4 * * *',
    sla=timedelta(hours=3),
    sla_miss_callback=sla_miss_callback,
    catchup=False,
    max_active_runs=1,
)
```

#### 九、小结

工作流调度是管理ETL任务依赖、调度、监控的关键，使用Airflow等工具可以自动化管理复杂的ETL工作流。

核心要点：
- 核心概念：DAG（有向无环图）、任务（Task）、依赖关系（Dependencies）
- Airflow实战：创建DAG、定义任务函数、设置依赖关系
- 调度策略：Cron表达式、时区处理
- 错误处理：重试策略、错误捕获
- SLA管理：定义SLA、SLA监控、SLA告警
- 最佳实践：并行执行、catchup=False、明确时区、设置SLA、配置重试

下一节将学习数据质量监控，了解如何监控和保证ETL数据质量。

### 6.7 数据质量监控

前面学习了ETL工具和工作流调度，了解了如何管理和调度ETL任务。

ETL任务运行后，如何确保数据质量？如何发现和解决数据质量问题？

**场景**：
```yaml
数据仓库日常运行：
  
数据分析师："为什么今天的GMV数据不对？"
  
数据工程师："让我检查一下..."
  
数据工程师："发现昨天的ETL任务部分失败了"
  
数据分析师："有没有办法提前发现问题？"
  
技术经理："我们需要数据质量监控"
```

**问题**：
- 什么是数据质量？
- 如何监控数据质量？
- 如何定义数据质量规则？
- 如何处理数据质量问题？

**答案**：**建立数据质量监控体系，定义质量规则，自动检查和告警，及时发现和解决数据质量问题**

#### 一、数据质量的维度

##### 1.1 完整性（Completeness）

**定义**：数据是否完整，有没有缺失

**示例**：
```yaml
问题1：数据缺失
  示例：用户表的city字段有很多NULL
  影响：无法按城市分析
  
问题2：数据量异常
  示例：今天只有1000条订单，平时有10000条
  影响：数据不完整
  
问题3：时间缺失
  示例：某个小时的数据缺失
  影响：时间序列不完整
```

**检查规则**：
```sql
-- 检查1：NULL值检查
SELECT 
    COUNT(*) FILTER (WHERE user_id IS NULL) as null_user_id,
    COUNT(*) FILTER (WHERE order_amount IS NULL) as null_order_amount,
    COUNT(*) FILTER (WHERE city IS NULL) as null_city
FROM dwd_fact_orders
WHERE date_id = 20260101;

-- 检查2：数据量检查
SELECT 
    date_id,
    COUNT(*) as row_count
FROM dwd_fact_orders
WHERE date_id >= 20260101 AND date_id < 20260201
GROUP BY date_id
ORDER BY date_id;

-- 检查3：时间连续性检查
WITH date_series AS (
    SELECT generate_series(
        20260101, 
        20260131, 
        1
    ) as date_id
)
SELECT 
    ds.date_id,
    COUNT(f.order_id) as order_count
FROM date_series ds
LEFT JOIN dwd_fact_orders f ON ds.date_id = f.date_id
GROUP BY ds.date_id
HAVING COUNT(f.order_id) = 0;  -- 找出没有订单的日期
```

##### 1.2 准确性（Accuracy）

**定义**：数据是否准确，有没有错误

**示例**：
```yaml
问题1：数值异常
  示例：订单金额为负数或0
  影响：GMV计算错误
  
问题2：格式错误
  示例：日期格式不正确
  影响：数据无法使用
  
问题3：逻辑错误
  示例：下单时间晚于支付时间
  影响：数据不合理
```

**检查规则**：
```sql
-- 检查1：数值范围检查
SELECT 
    COUNT(*) FILTER (WHERE order_amount < 0) as negative_amount,
    COUNT(*) FILTER (WHERE order_amount = 0) as zero_amount,
    COUNT(*) FILTER (WHERE order_amount > 1000000) as excessive_amount
FROM dwd_fact_orders
WHERE date_id = 20260101;

-- 检查2：日期格式检查
SELECT 
    COUNT(*) FILTER (WHERE date_id < 20200101 OR date_id > 20991231) as invalid_date
FROM dwd_fact_orders;

-- 检查3：逻辑检查
SELECT 
    COUNT(*) as invalid_orders
FROM dwd_fact_orders
WHERE payment_time < order_time;  -- 支付时间早于下单时间
```

##### 1.3 一致性（Consistency）

**定义**：数据是否一致，有没有矛盾

**示例**：
```yaml
问题1：跨表不一致
  示例：事实表的用户ID在维度表中不存在
  影响：关联查询失败
  
问题2：字段不一致
  示例：同一字段在不同表中有不同含义
  影响：混淆
  
问题3：汇总不一致
  示例：明细表的总和与汇总表不一致
  影响：数据可信度低
```

**检查规则**：
```sql
-- 检查1：外键一致性检查
SELECT 
    COUNT(DISTINCT f.user_id) as fact_user_count,
    COUNT(DISTINCT d.user_id) as dim_user_count,
    COUNT(DISTINCT f.user_id) - COUNT(DISTINCT d.user_id) as diff
FROM dwd_fact_orders f
FULL JOIN dim_users d ON f.user_id = d.user_id
WHERE f.date_id = 20260101;

-- 检查2：汇总一致性检查
WITH detail_sum AS (
    SELECT SUM(order_amount) as total_amount
    FROM dwd_fact_orders
    WHERE date_id = 20260101
),
summary_sum AS (
    SELECT gmv as total_amount
    FROM dws_daily_gmv
    WHERE date_id = 20260101
)
SELECT 
    detail_sum.total_amount as detail_total,
    summary_sum.total_amount as summary_total,
    ABS(detail_sum.total_amount - summary_sum.total_amount) as diff
FROM detail_sum, summary_sum;

-- 检查3：唯一性检查
SELECT 
    user_id,
    COUNT(*) as duplicate_count
FROM dim_users
GROUP BY user_id
HAVING COUNT(*) > 1;  -- 找出重复的用户ID
```

##### 1.4 及时性（Timeliness）

**定义**：数据是否及时，有没有延迟

**示例**：
```yaml
问题1：数据延迟
  示例：今天是1月2日，但12月31日的数据还没到
  影响：报表不是最新的
  
问题2：更新延迟
  示例：ETL任务应该在凌晨4点完成，实际8点才完成
  影响：数据时效性差
```

**检查规则**：
```sql
-- 检查1：数据新鲜度检查
SELECT 
    MAX(date_id) as max_date_id,
    CURRENT_DATE - TO_DATE(MAX(date_id)::TEXT, 'YYYYMMDD') as days_lag
FROM dwd_fact_orders;

-- 检查2：更新时间检查
SELECT 
    table_name,
    MAX(updated_at) as last_update_time,
    CURRENT_TIMESTAMP - MAX(updated_at) as update_lag
FROM etl_logs
GROUP BY table_name;
```

#### 二、数据质量监控框架

##### 2.1 质量规则定义

**创建质量规则表**：
```sql
-- 数据质量规则表
CREATE TABLE dq_rules (
    rule_id INT PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL,  -- completeness/accuracy/consistency/timeliness
    table_name VARCHAR(100) NOT NULL,
    rule_sql TEXT NOT NULL,
    severity VARCHAR(50) NOT NULL,  -- critical/warning/info
    owner VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 示例规则
INSERT INTO dq_rules (rule_name, rule_type, table_name, rule_sql, severity, owner) VALUES
('订单金额不能为负', 'accuracy', 'dwd_fact_orders', 
 'SELECT COUNT(*) FROM dwd_fact_orders WHERE order_amount < 0 AND date_id = {{date_id}}', 
 'critical', '张三'),

('用户ID不能为空', 'completeness', 'dwd_fact_orders',
 'SELECT COUNT(*) FILTER (WHERE user_id IS NULL) FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'critical', '张三'),

('外键一致性检查', 'consistency', 'dwd_fact_orders',
 'SELECT COUNT(DISTINCT f.user_id) - COUNT(DISTINCT d.user_id) FROM dwd_fact_orders f LEFT JOIN dim_users d ON f.user_id = d.user_id WHERE f.date_id = {{date_id}}',
 'warning', '李四'),

('数据量检查', 'completeness', 'dwd_fact_orders',
 'SELECT CASE WHEN COUNT(*) < 1000 THEN 1 ELSE 0 END FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'warning', '张三');
```

##### 2.2 质量检查执行

**创建质量检查函数**：
```sql
-- 数据质量检查函数
CREATE OR REPLACE FUNCTION run_quality_checks(p_date_id INT)
RETURNS TABLE(
    rule_id INT,
    rule_name VARCHAR(100),
    rule_type VARCHAR(50),
    check_result BIGINT,
    status VARCHAR(50),
    error_message TEXT
) AS $$
DECLARE
    v_rule RECORD;
    v_result BIGINT;
    v_status VARCHAR(50);
    v_rule_sql TEXT;
BEGIN
    -- 遍历所有规则
    FOR v_rule IN SELECT * FROM dq_rules LOOP
        -- 替换SQL中的变量
        v_rule_sql := REPLACE(v_rule.rule_sql, '{{date_id}}', p_date_id::TEXT);
        
        -- 执行检查
        BEGIN
            EXECUTE v_rule_sql INTO v_result;
            
            -- 判断状态
            IF v_result > 0 THEN
                -- 有问题
                IF v_rule.severity = 'critical' THEN
                    v_status := 'fail';
                ELSE
                    v_status := 'warning';
                END IF;
            ELSE
                -- 没问题
                v_status := 'pass';
            END IF;
            
            -- 返回结果
            RETURN QUERY
            SELECT v_rule.rule_id, v_rule.rule_name, v_rule.rule_type, v_result, v_status, NULL::TEXT;
            
        EXCEPTION WHEN OTHERS THEN
            -- SQL执行失败
            RETURN QUERY
            SELECT v_rule.rule_id, v_rule.rule_name, v_rule.rule_type, 0::BIGINT, 'error', SQLERRM::TEXT;
        END;
    END LOOP;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 执行质量检查
SELECT * FROM run_quality_checks(20260101);
```

##### 2.3 质量报告生成

**创建质量报告表**：
```sql
-- 数据质量报告表
CREATE TABLE dq_reports (
    report_id INT PRIMARY KEY,
    date_id INT NOT NULL,
    total_rules INT NOT NULL,
    passed_rules INT NOT NULL,
    failed_rules INT NOT NULL,
    warning_rules INT NOT NULL,
    error_rules INT NOT NULL,
    overall_status VARCHAR(50) NOT NULL,  -- pass/warning/fail
    report_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 生成质量报告
CREATE OR REPLACE FUNCTION generate_quality_report(p_date_id INT)
RETURNS INT AS $$
DECLARE
    v_report_id INT;
    v_total_rules INT;
    v_passed_rules INT;
    v_failed_rules INT;
    v_warning_rules INT;
    v_error_rules INT;
    v_overall_status VARCHAR(50);
BEGIN
    -- 统计规则执行结果
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE status = 'pass'),
        COUNT(*) FILTER (WHERE status = 'fail'),
        COUNT(*) FILTER (WHERE status = 'warning'),
        COUNT(*) FILTER (WHERE status = 'error')
    INTO v_total_rules, v_passed_rules, v_failed_rules, v_warning_rules, v_error_rules
    FROM run_quality_checks(p_date_id);
    
    -- 判断整体状态
    IF v_failed_rules > 0 OR v_error_rules > 0 THEN
        v_overall_status := 'fail';
    ELSIF v_warning_rules > 0 THEN
        v_overall_status := 'warning';
    ELSE
        v_overall_status := 'pass';
    END IF;
    
    -- 插入报告
    INSERT INTO dq_reports (
        date_id, total_rules, passed_rules, failed_rules, 
        warning_rules, error_rules, overall_status
    ) VALUES (
        p_date_id, v_total_rules, v_passed_rules, v_failed_rules,
        v_warning_rules, v_error_rules, v_overall_status
    ) RETURNING report_id INTO v_report_id;
    
    -- 记录详情
    INSERT INTO dq_report_details (report_id, rule_id, rule_name, rule_type, check_result, status)
    SELECT 
        v_report_id, 
        rule_id, rule_name, rule_type, check_result, status
    FROM run_quality_checks(p_date_id);
    
    RETURN v_report_id;
END;
$$ LANGUAGE plpgsql;

-- 执行报告生成
SELECT generate_quality_report(20260101);
```

#### 三、质量监控Dashboard

##### 3.1 质量趋势查询

```sql
-- 质量趋势（最近30天）
SELECT 
    date_id,
    total_rules,
    passed_rules,
    failed_rules,
    warning_rules,
    error_rules,
    overall_status
FROM dq_reports
WHERE date_id >= 20260101 AND date_id < 20260201
ORDER BY date_id;
```

##### 3.2 问题规则Top10

```sql
-- 最近30天失败次数最多的规则
SELECT 
    dr.rule_id,
    dr.rule_name,
    dr.rule_type,
    COUNT(*) as fail_count
FROM dq_report_details rd
JOIN dq_rules dr ON rd.rule_id = dr.rule_id
WHERE rd.status IN ('fail', 'warning')
  AND rd.report_id IN (
      SELECT report_id FROM dq_reports 
      WHERE date_id >= 20260101 AND date_id < 20260201
  )
GROUP BY dr.rule_id, dr.rule_name, dr.rule_type
ORDER BY fail_count DESC
LIMIT 10;
```

#### 四、告警机制

##### 4.1 告警规则

```sql
-- 告警规则表
CREATE TABLE dq_alert_rules (
    alert_rule_id INT PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    alert_condition TEXT NOT NULL,  -- 告警条件SQL
    alert_type VARCHAR(50) NOT NULL,  -- email/sms/webhook
    alert_target VARCHAR(255) NOT NULL,  -- 告警目标（邮箱/手机号/Webhook URL）
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 示例告警规则
INSERT INTO dq_alert_rules (rule_name, alert_condition, alert_type, alert_target) VALUES
('质量检查失败告警',
 'SELECT COUNT(*) FROM dq_reports WHERE overall_status = ''fail'' AND date_id = {{date_id}}',
 'email',
 'data-team@company.com'),

('数据量异常告警',
 'SELECT CASE WHEN COUNT(*) < 1000 THEN 1 ELSE 0 END FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'email',
 'data-team@company.com');
```

##### 4.2 告警发送

```sql
-- 告警发送函数
CREATE OR REPLACE FUNCTION send_alerts(p_date_id INT)
RETURNS void AS $$
DECLARE
    v_alert_rule RECORD;
    v_should_alert BOOLEAN;
    v_alert_condition TEXT;
BEGIN
    -- 遍历所有告警规则
    FOR v_alert_rule IN SELECT * FROM dq_alert_rules WHERE is_active = TRUE LOOP
        -- 替换条件中的变量
        v_alert_condition := REPLACE(v_alert_rule.alert_condition, '{{date_id}}', p_date_id::TEXT);
        
        -- 检查是否需要告警
        EXECUTE v_alert_condition INTO v_should_alert;
        
        IF v_should_alert THEN
            -- 发送告警
            IF v_alert_rule.alert_type = 'email' THEN
                -- 发送邮件
                PERFORM send_email(
                    v_alert_rule.alert_target,
                    '数据质量告警',
                    format('数据质量检查失败，date_id=%s', p_date_id)
                );
                
            ELSIF v_alert_rule.alert_type = 'webhook' THEN
                -- 发送Webhook
                PERFORM send_webhook(
                    v_alert_rule.alert_target,
                    jsonb_build_object(
                        'date_id', p_date_id,
                        'message', '数据质量检查失败'
                    )
                );
            END IF;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
```

#### 五、数据质量改进

##### 5.1 根因分析

```sql
-- 创建质量问题跟踪表
CREATE TABLE dq_issues (
    issue_id INT PRIMARY KEY,
    issue_title VARCHAR(200) NOT NULL,
    issue_description TEXT,
    root_cause TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open',  -- open/investigating/fixed/closed
    assigned_to VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 示例问题
INSERT INTO dq_issues (issue_title, issue_description, root_cause, severity, assigned_to) VALUES
('订单金额为负数', '2026-01-01发现100条订单金额为负数', '业务系统Bug，退款订单金额未处理', 'critical', '张三'),
('用户ID缺失', '部分订单的用户ID为NULL', '数据抽取时用户表关联失败', 'warning', '李四');
```

##### 5.2 持续改进

```yaml
改进措施1：修复源头
  - 修复业务系统Bug
  - 优化数据抽取逻辑
  
改进措施2：增加验证
  - 源系统增加数据验证
  - ETL过程增加数据清洗
  
改进措施3：优化监控
  - 增加质量检查规则
  - 调整告警阈值
```

#### 六、常见误区

**误区一：数据质量不重要**

- **说明**：数据质量是数据仓库的生命线
- **后果**：数据不可信，业务方不使用
- **正确理解**：
  - 数据质量至关重要
  - 需要持续监控
  - 及时修复问题

**误区二：质量规则越多越好**

- **说明**：质量规则要聚焦核心问题
- **后果**：规则太多，告警疲劳
- **正确理解**：
  - 定义核心质量规则
  - 关注critical级别
  - 定期review规则

**误区三：质量检查不影响性能**

- **说明**：质量检查可能影响ETL性能
- **后果**：ETL耗时增加
- **正确理解**：
  - 合理设计检查规则
  - 避免复杂SQL
  - 考虑异步检查

**误区四：质量检查是一次性的**

- **说明**：数据质量需要持续监控
- **后果**：问题复发
- **正确理解**：
  - 建立监控体系
  - 定期生成报告
  - 持续改进

**误区五：质量检查只是技术问题**

- **说明**：数据质量需要业务参与
- **后果**：规则不合理
- **正确理解**：
  - 业务方定义质量标准
  - 技术方实现监控
  - 共同保证质量

#### 七、实战任务

**任务1：定义质量规则**

```sql
-- 订单表质量规则
INSERT INTO dq_rules (rule_name, rule_type, table_name, rule_sql, severity, owner) VALUES
-- 完整性规则
('用户ID不能为空', 'completeness', 'dwd_fact_orders',
 'SELECT COUNT(*) FILTER (WHERE user_id IS NULL) FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'critical', '张三'),

('订单金额不能为空', 'completeness', 'dwd_fact_orders',
 'SELECT COUNT(*) FILTER (WHERE order_amount IS NULL) FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'critical', '张三'),

-- 准确性规则
('订单金额不能为负', 'accuracy', 'dwd_fact_orders',
 'SELECT COUNT(*) FILTER (WHERE order_amount < 0) FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'critical', '张三'),

-- 一致性规则
('外键一致性检查', 'consistency', 'dwd_fact_orders',
 'SELECT COUNT(DISTINCT f.user_id) - COUNT(DISTINCT d.user_id) FROM dwd_fact_orders f LEFT JOIN dim_users d ON f.user_id = d.user_id WHERE f.date_id = {{date_id}}',
 'warning', '李四'),

-- 及时性规则
('数据新鲜度检查', 'timeliness', 'dwd_fact_orders',
 'SELECT CASE WHEN MAX(date_id) < EXTRACT(YEAR FROM CURRENT_DATE)*10000 + EXTRACT(MONTH FROM CURRENT_DATE)*100 + EXTRACT(DAY FROM CURRENT_DATE) - 1 THEN 1 ELSE 0 END FROM dwd_fact_orders',
 'warning', '张三');
```

**任务2：执行质量检查**

```sql
-- 执行质量检查
SELECT * FROM run_quality_checks(20260101);

-- 生成质量报告
SELECT generate_quality_report(20260101);

-- 查看报告
SELECT 
    date_id,
    total_rules,
    passed_rules,
    failed_rules,
    warning_rules,
    overall_status
FROM dq_reports
WHERE date_id = 20260101;

-- 查看详情
SELECT 
    rule_name,
    rule_type,
    check_result,
    status
FROM dq_report_details
WHERE report_id = (SELECT report_id FROM dq_reports WHERE date_id = 20260101);
```

**任务3：配置告警**

```sql
-- 配置告警规则
INSERT INTO dq_alert_rules (rule_name, alert_condition, alert_type, alert_target) VALUES
('Critical质量检查失败',
 'SELECT COUNT(*) FROM dq_reports WHERE overall_status = ''fail'' AND date_id = {{date_id}}',
 'email',
 'data-team@company.com'),

('数据量异常',
 'SELECT CASE WHEN COUNT(*) < 1000 THEN 1 ELSE 0 END FROM dwd_fact_orders WHERE date_id = {{date_id}}',
 'email',
 'data-team@company.com');

-- 发送告警
SELECT send_alerts(20260101);
```

#### 八、小结

数据质量监控通过定义质量规则、自动检查、生成报告、发送告警，确保数据仓库的数据质量。

核心要点：
- 质量维度：完整性、准确性、一致性、及时性
- 质量规则：定义规则表、执行检查函数
- 质量报告：生成报告、记录详情、趋势分析
- 告警机制：定义告警规则、发送告警
- 持续改进：根因分析、修复问题、优化规则
- 最佳实践：聚焦核心规则、定期review、业务参与

下一节将学习错误处理和重试，了解如何处理ETL任务失败和异常情况。

### 6.8 错误处理和重试

前面学习了数据质量监控，了解了如何监控数据质量和发送告警。

当ETL任务出现错误时，如何处理？如何自动重试？如何避免错误影响下游任务？

**场景**：
```yaml
数据仓库日常运行：
  
运维工程师："今天凌晨4点的ETL任务失败了"
  
数据工程师："是什么错误？"
  
运维工程师："数据库连接失败"
  
数据工程师："重试了吗？"
  
运维工程师："配置了重试3次，但都失败了"
  
新同事："如何处理各种错误？如何配置重试策略？"
```

**问题**：
- ETL任务有哪些常见错误？
- 如何分类和处理不同类型的错误？
- 如何设计重试策略？
- 如何避免错误级联影响？

**答案**：**建立完善的错误处理和重试机制，根据错误类型采取不同策略，确保ETL任务的稳定性**

#### 一、常见错误类型

##### 1.1 临时性错误（Transient Errors）

**定义**：暂时性故障，重试后可能成功

**示例**：
```yaml
错误1：网络超时
  示例：连接MySQL超时
  原因：网络抖动
  处理：重试
  
错误2：数据库连接失败
  示例：PostgreSQL连接池满
  原因：连接数不足
  处理：等待后重试
  
错误3：资源不足
  示例：内存不足
  原因：系统资源紧张
  处理：等待后重试
  
错误4：锁等待
  示例：表被锁定
  原因：其他任务正在写入
  处理：等待后重试
```

**特点**：
```yaml
临时性：
  - 不是持续性的错误
  - 重试后可能成功
  
处理：
  - 自动重试
  - 增加重试间隔
  - 限制重试次数
```

##### 1.2 持续性错误（Permanent Errors）

**定义**：持续性故障，重试无法解决

**示例**：
```yaml
错误1：SQL语法错误
  示例：SELECT语句语法错误
  原因：代码Bug
  处理：修复代码
  
错误2：表不存在
  示例：查询的表不存在
  原因：表未创建或名称错误
  处理：创建表或修正名称
  
错误3：权限不足
  示例：没有INSERT权限
  原因：权限配置错误
  处理：授予权限
  
错误4：数据格式错误
  示例：日期格式不正确
  原因：源数据格式错误
  处理：数据清洗
```

**特点**：
```yaml
持续性：
  - 重试无法解决
  - 需要人工干预
  
处理：
  - 不重试
  - 立即失败
  - 发送告警
```

##### 1.3 逻辑错误（Logical Errors）

**定义**：代码逻辑问题，数据不符合预期

**示例**：
```yaml
错误1：数据量为0
  示例：查询返回0行数据
  原因：数据源没有新数据
  处理：跳过或告警
  
错误2：数据异常
  示例：GMV异常增长100倍
  原因：数据错误或业务变化
  处理：人工确认
  
错误3：依赖缺失
  示例：上游任务未完成
  原因：上游任务失败
  处理：等待上游任务
```

#### 二、错误分类和处理策略

##### 2.1 错误分类

```python
# 错误分类函数
def classify_error(error):
    """
    根据错误类型分类
    返回: 'transient' | 'permanent' | 'logical'
    """
    error_message = str(error).lower()
    error_type = type(error).__name__
    
    # 临时性错误
    transient_keywords = [
        'timeout', 'connection', 'network', 'temporarily',
        'deadlock', 'lock', 'resource'
    ]
    
    if any(keyword in error_message for keyword in transient_keywords):
        return 'transient'
    
    # 持续性错误
    permanent_keywords = [
        'syntax', 'permission', 'does not exist',
        'invalid', 'malformed'
    ]
    
    if any(keyword in error_message for keyword in permanent_keywords):
        return 'permanent'
    
    # 默认为逻辑错误
    return 'logical'
```

##### 2.2 处理策略

```python
# 错误处理策略
def handle_error(error, retry_count=0):
    """
    根据错误类型采取不同策略
    """
    error_type = classify_error(error)
    
    if error_type == 'transient':
        # 临时性错误：重试
        if retry_count < 3:
            wait_time = 2 ** retry_count * 5  # 指数退避：5秒、10秒、20秒
            print(f"Temporary error, retrying in {wait_time} seconds...")
            time.sleep(wait_time)
            return 'retry'
        else:
            print(f"Max retries reached, giving up")
            return 'fail'
    
    elif error_type == 'permanent':
        # 持续性错误：立即失败
        print(f"Permanent error, giving up: {error}")
        send_alert(f"Permanent error: {error}")
        return 'fail'
    
    else:  # logical
        # 逻辑错误：根据具体情况处理
        if 'no data' in str(error).lower():
            print(f"No data found, skipping")
            return 'skip'
        else:
            print(f"Logical error, manual review needed: {error}")
            send_alert(f"Logical error: {error}")
            return 'fail'
```

#### 三、重试策略设计

##### 3.1 指数退避（Exponential Backoff）

**定义**：每次重试间隔成倍增长

**示例**：
```python
import time

def retry_with_backoff(func, max_retries=3):
    """
    指数退避重试
    """
    for retry_count in range(max_retries):
        try:
            return func()
        except Exception as e:
            error_type = classify_error(e)
            
            if error_type == 'transient' and retry_count < max_retries - 1:
                # 指数退避：5秒、10秒、20秒
                wait_time = 2 ** retry_count * 5
                print(f"Retry {retry_count + 1}/{max_retries} in {wait_time}s")
                time.sleep(wait_time)
            else:
                raise e
    
# 使用示例
def extract_data():
    conn = pymysql.connect(...)
    df = pd.read_sql(...)
    conn.close()
    return df

# 自动重试
df = retry_with_backoff(extract_data, max_retries=3)
```

##### 3.2 固定间隔重试

```python
def retry_with_fixed_delay(func, max_retries=3, delay=10):
    """
    固定间隔重试
    """
    for retry_count in range(max_retries):
        try:
            return func()
        except Exception as e:
            if retry_count < max_retries - 1:
                print(f"Retry {retry_count + 1}/{max_retries} in {delay}s")
                time.sleep(delay)
            else:
                raise e
```

##### 3.3 重试限制

```yaml
限制1：最大重试次数
  示例：最多重试3次
  原因：避免无限重试
  
限制2：最大重试时间
  示例：最多重试1小时
  原因：避免长时间阻塞
  
限制3：最大总次数
  示例：1天内最多重试100次
  原因：避免频繁重试
```

#### 四、Airflow中的错误处理

##### 4.1 任务级别配置

```python
from airflow import DAG
from airflow.operators.python import PythonOperator
from datetime import datetime, timedelta

# 默认参数
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'retries': 3,  # 最多重试3次
    'retry_delay': timedelta(minutes=5),  # 每次重试间隔5分钟
    'retry_exponential_backoff': True,  # 启用指数退避
    'max_retry_delay': timedelta(minutes=30),  # 最大重试间隔30分钟
    'email_on_retry': False,  # 重试时不发送邮件
    'email_on_failure': True,  # 失败时发送邮件
}

# 创建DAG
dag = DAG(
    'daily_etl_with_retry',
    default_args=default_args,
    schedule_interval='0 4 * * *',
    catchup=False,
)
```

##### 4.2 自定义重试逻辑

```python
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

def smart_extract_data(**context):
    """
    带智能错误处理的数据抽取
    """
    max_retries = 3
    retry_count = 0
    
    while retry_count < max_retries:
        try:
            # 尝试抽取数据
            conn = pymysql.connect(...)
            df = pd.read_sql(...)
            conn.close()
            
            # 检查数据量
            if len(df) == 0:
                raise ValueError("No data extracted")
            
            return df
            
        except Exception as e:
            retry_count += 1
            error_type = classify_error(e)
            
            if error_type == 'transient' and retry_count < max_retries:
                # 临时性错误：重试
                wait_time = 2 ** (retry_count - 1) * 5
                print(f"Retry {retry_count}/{max_retries} in {wait_time}s")
                time.sleep(wait_time)
            elif error_type == 'logical' and 'no data' in str(e).lower():
                # 逻辑错误：没有数据
                print("No data available, skipping")
                return None
            else:
                # 其他错误：抛出异常
                raise e

# 创建任务
extract_task = PythonOperator(
    task_id='smart_extract_data',
    python_callable=smart_extract_data,
    dag=dag,
)
```

##### 4.3 失败后的处理

```python
from airflow.operators.python import PythonOperator
from airflow.utils.dates import days_ago

def on_failure_callback(context):
    """
    任务失败时的回调函数
    """
    dag_id = context['dag'].dag_id
    task_id = context['task'].task_id
    exception = context['exception']
    
    # 记录错误日志
    error_log = f"""
    DAG: {dag_id}
    Task: {task_id}
    Exception: {exception}
    Execution Date: {context['execution_date']}
    """
    
    print(error_log)
    
    # 发送告警
    send_email(
        to='data-team@company.com',
        subject=f'ETL Task Failed: {dag_id}.{task_id}',
        body=error_log
    )

# 创建任务
task = PythonOperator(
    task_id='extract_data',
    python_callable=extract_data,
    on_failure_callback=on_failure_callback,
    dag=dag,
)
```

#### 五、错误隔离和容错

##### 5.1 任务隔离

**定义**：避免一个任务的错误影响其他任务

```python
# 场景：3个独立的表转换任务
dwd_orders_task = PythonOperator(
    task_id='dwd_orders_etl',
    python_callable=dwd_orders_etl,
    dag=dag,
)

dwd_users_task = PythonOperator(
    task_id='dwd_users_etl',
    python_callable=dwd_users_etl,
    dag=dag,
)

dwd_products_task = PythonOperator(
    task_id='dwd_products_etl',
    python_callable=dwd_products_etl,
    dag=dag,
)

# 策略1：即使某个任务失败，其他任务继续执行
# 在Airflow中，默认就是这样的行为

# 策略2：使用Trigger Rule
# 即使上游任务失败，也执行下游任务
final_task = PythonOperator(
    task_id='final_task',
    python_callable=final_task,
    trigger_rule='all_done',  # 所有上游任务完成后执行（不管成功或失败）
    dag=dag,
)
```

##### 5.2 跳过策略

```python
from airflow.operators.python import PythonOperator
from airflow.utils.trigger_rule import TriggerRule

def load_data_if_available(**context):
    """
    如果有数据就加载，没有就跳过
    """
    data_file = '/data/orders_transformed.csv'
    
    if os.path.exists(data_file):
        # 有数据，执行加载
        df = pd.read_csv(data_file)
        # 加载到数据库...
        return f"Loaded {len(df)} rows"
    else:
        # 没有数据，跳过
        print("No data available, skipping")
        return "Skipped"

# 创建任务（即使上游失败也执行）
load_task = PythonOperator(
    task_id='load_data_if_available',
    python_callable=load_data_if_available,
    trigger_rule=TriggerRule.ALL_DONE,  # 上游任务完成后执行
    dag=dag,
)
```

#### 六、错误监控和分析

##### 6.1 错误日志记录

```sql
-- 创建错误日志表
CREATE TABLE etl_error_logs (
    log_id SERIAL PRIMARY KEY,
    dag_id VARCHAR(100),
    task_id VARCHAR(100),
    execution_date DATE,
    error_type VARCHAR(50),  -- transient/permanent/logical
    error_message TEXT,
    retry_count INT,
    status VARCHAR(50),  -- retried/failed/skipped
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 记录错误
INSERT INTO etl_error_logs (dag_id, task_id, execution_date, error_type, error_message, retry_count, status)
VALUES (
    'daily_etl_orders',
    'extract_orders',
    '2026-01-01',
    'transient',
    'Connection timeout',
    3,
    'retried'
);
```

##### 6.2 错误分析

```sql
-- 错误统计（最近30天）
SELECT 
    dag_id,
    task_id,
    error_type,
    COUNT(*) as error_count,
    AVG(retry_count) as avg_retry_count
FROM etl_error_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY dag_id, task_id, error_type
ORDER BY error_count DESC;

-- Top 10错误
SELECT 
    error_message,
    COUNT(*) as error_count
FROM etl_error_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY error_message
ORDER BY error_count DESC
LIMIT 10;
```

#### 七、常见误区

**误区一：所有错误都重试**

- **说明**：只有临时性错误才适合重试
- **后果**：持续性错误也会重试，浪费资源
- **正确理解**：
  - 临时性错误：重试
  - 持续性错误：立即失败
  - 逻辑错误：根据情况处理

**误区二：重试次数越多越好**

- **说明**：重试次数要合理设置
- **后果**：重试太多，延迟时间长
- **正确理解**：
  - 通常重试3-5次
  - 设置最大重试时间
  - 避免无限重试

**误区三：所有任务都要成功**

- **说明**：某些任务失败可以接受
- **后果**：过度强调整体成功
- **正确理解**：
  - 核心任务必须成功
  - 非核心任务可以失败
  - 使用Trigger Rule灵活处理

**误区四：忽略错误日志**

- **说明**：错误日志是优化的重要依据
- **后果**：同样错误重复发生
- **正确理解**：
  - 记录详细错误日志
  - 定期分析错误模式
  - 持续优化ETL

**误区五：错误处理只在代码中**

- **说明**：错误处理需要多层次
- **后果**：单一层面处理不够
- **正确理解**：
  - 代码层：try-except
  - 任务层：重试配置
  - DAG层：失败策略
  - 监控层：告警和恢复

#### 八、实战任务

**任务1：实现智能错误处理**

```python
def smart_etl_task():
    """
    带智能错误处理的ETL任务
    """
    max_retries = 3
    
    for retry_count in range(max_retries):
        try:
            # 抽取
            df = extract_data()
            
            # 转换
            df = transform_data(df)
            
            # 加载
            load_data(df)
            
            # 成功
            return "Success"
            
        except pymysql.OperationalError as e:
            # 数据库连接错误（临时性）
            if retry_count < max_retries - 1:
                wait_time = 2 ** retry_count * 5
                print(f"Connection error, retrying in {wait_time}s")
                time.sleep(wait_time)
            else:
                raise e
                
        except pd.errors.EmptyDataError as e:
            # 没有数据（逻辑错误）
            print("No data available, skipping")
            return "Skipped"
            
        except Exception as e:
            # 其他错误（持续性）
            print(f"Permanent error: {e}")
            send_alert(f"ETL failed: {e}")
            raise e
```

**任务2：配置Airflow重试**

```python
default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'retry_exponential_backoff': True,
    'max_retry_delay': timedelta(minutes=30),
    'email_on_retry': False,
    'email_on_failure': True,
    'email': ['data-team@company.com'],
}

dag = DAG(
    'daily_etl',
    default_args=default_args,
    schedule_interval='0 4 * * *',
    catchup=False,
)
```

**任务3：分析错误日志**

```sql
-- 错误趋势分析
SELECT 
    DATE(created_at) as error_date,
    error_type,
    COUNT(*) as error_count
FROM etl_error_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at), error_type
ORDER BY error_date, error_type;

-- 找出最频繁的错误
SELECT 
    error_message,
    error_type,
    COUNT(*) as error_count
FROM etl_error_logs
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY error_message, error_type
ORDER BY error_count DESC
LIMIT 10;
```

#### 九、小结

错误处理和重试是保证ETL任务稳定运行的关键，通过错误分类、智能重试、失败处理、错误隔离，提高ETL的可靠性。

核心要点：
- 错误类型：临时性错误、持续性错误、逻辑错误
- 错误分类：根据错误特征自动分类
- 处理策略：临时性错误重试、持续性错误立即失败、逻辑错误根据情况处理
- 重试策略：指数退避、固定间隔、重试限制
- Airflow配置：retries、retry_delay、retry_exponential_backoff
- 错误隔离：任务独立、失败不影响其他任务
- 跳过策略：使用Trigger Rule灵活处理
- 错误监控：记录错误日志、分析错误模式
- 最佳实践：智能错误处理、合理重试、核心任务必须成功

下一节将学习性能优化，了解如何优化ETL任务的性能。

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

### 6.10 ETL最佳实践

前面学习了性能优化，了解了如何优化ETL的各个方面。

现在总结ETL开发的最佳实践，这些实践来自于真实项目的经验总结。

**场景**：
```yaml
新数据工程师入职：
  
新工程师："我刚接手ETL项目，有什么注意事项吗？"
  
资深工程师："有很多最佳实践需要注意"
  
新工程师："能具体说说吗？"
```

**问题**：
- ETL开发有哪些最佳实践？
- 如何避免常见陷阱？
- 如何写出可维护的ETL代码？
- 如何建立ETL规范？

**答案**：**遵循ETL最佳实践，建立代码规范、文档习惯、测试流程，提升ETL质量和可维护性**

#### 一、代码规范

##### 1.1 命名规范

**DAG命名**：
```python
# 好的命名
daily_etl_orders          # 清晰：每日订单ETL
hourly_sync_users         # 清晰：每小时用户同步
monthly_report_gmv         # 清晰：月度GMV报表

# 不好的命名
etl1                       # 不清晰
test_dag                   # 不清晰
do_something              # 不清晰
```

**任务命名**：
```python
# 好的命名
extract_orders_from_mysql    # 清楚：从MySQL抽取订单
transform_user_dimension      # 清楚：转换用户维度
load_data_to_warehouse        # 清楚：加载数据到数仓

# 不好的命名
task1                         # 不清晰
extract                       # 不够具体
do_it                         # 不清晰
```

**变量命名**：
```python
# 好的命名
max_retry_count = 3
connection_timeout = 30
orders_dataframe = pd.DataFrame()

# 不好的命名
n = 3                          # 不清晰
t = 30                         # 不清晰
df = pd.DataFrame()             # 可以更具体
```

##### 1.2 代码结构

**函数设计**：
```python
# 好的设计：单一职责
def extract_orders(date_id):
    """从MySQL抽取订单数据"""
    conn = get_mysql_connection()
    df = pd.read_sql(f"SELECT * FROM orders WHERE date_id = {date_id}", conn)
    conn.close()
    return df

def transform_orders(df):
    """转换订单数据"""
    df = df[df['order_amount'] > 0]
    df['date_id'] = df['created_at'].apply(lambda x: int(x.strftime('%Y%m%d')))
    return df

def load_orders(df):
    """加载订单数据到数仓"""
    conn = get_pg_connection()
    cursor.executemany("INSERT INTO dwd_fact_orders ...", df.to_records())
    conn.commit()
    conn.close()

# 不好的设计：一个函数做所有事情
def etl_orders(date_id):
    """抽取、转换、加载都在一起"""
    # 抽取
    conn = get_mysql_connection()
    df = pd.read_sql(...)
    
    # 转换
    df = df[df['order_amount'] > 0]
    
    # 加载
    conn2 = get_pg_connection()
    cursor.executemany(...)
    
    # 问题：
    # 1. 函数太长
    # 2. 职责不单一
    # 3. 难以测试
    # 4. 难以复用
```

**配置管理**：
```python
# 好的设计：配置集中管理
# config.py
MYSQL_CONFIG = {
    'host': 'mysql-server',
    'user': 'root',
    'password': 'password',
    'database': 'business_db'
}

POSTGRES_CONFIG = {
    'host': 'postgres-server',
    'user': 'postgres',
    'password': 'password',
    'database': 'data_warehouse'
}

ETL_CONFIG = {
    'batch_size': 100000,
    'max_retries': 3,
    'retry_delay': 5
}

# 使用配置
from config import MYSQL_CONFIG, POSTGRES_CONFIG, ETL_CONFIG

def extract_orders():
    conn = pymysql.connect(**MYSQL_CONFIG)
    ...

# 不好的设计：配置硬编码
def extract_orders():
    conn = pymysql.connect(
        host='mysql-server',  # 硬编码
        user='root',
        password='password',
        database='business_db'
    )
    ...
```

#### 二、文档规范

##### 2.1 DAG文档

```python
# 好的文档：详细的DAG描述
dag = DAG(
    dag_id='daily_etl_orders',
    default_args=default_args,
    schedule_interval='0 4 * * *',
    catchup=False,
    tags=['etl', 'orders', 'daily'],
    # 添加详细描述
    description='''
    每日订单ETL任务
    
    功能：
    1. 从MySQL抽取前一天的交易订单
    2. 清洗和转换数据
    3. 加载到PostgreSQL数仓的DWD层
    4. 生成DWS层的每日汇总
    
    依赖：
    - MySQL: business_db.orders表
    - PostgreSQL: dim_users, dim_products表
    
    输出：
    - dwd_fact_orders表
    - dws_daily_gmv表
    
    SLA：
    - 必须在每天早上6点前完成
    - 数据延迟不能超过2天
    
    联系人：张三（zhangsan@company.com）
    ''',
)
```

##### 2.2 任务文档

```python
# 好的文档：任务级文档
def extract_orders(**context):
    """
    从MySQL抽取订单数据
    
    详细说明：
    1. 抽取前一天的订单数据（created_at >= 昨天）
    2. 只抽取order_status='completed'的订单
    3. 抽取字段：order_id, user_id, product_id, order_amount, created_at
    4. 数据保存到CSV文件：/data/orders_{date_id}.csv
    
    参数:
        date_id: 日期ID（YYYYMMDD格式）
    
    返回:
        抽取的行数
    
    异常:
        - 连接失败：重试3次
        - 查询超时：重试3次
        - 数据量为0：记录警告但继续
    
    作者：张三
    创建日期：2026-01-01
    最后修改：2026-01-15
    """
    ...
```

##### 2.3 README文档

```markdown
# ETL项目文档

## 项目概述
本项目负责从业务系统抽取数据到数据仓库的ETL开发。

## 项目结构
```
etl_project/
├── dags/                   # Airflow DAG文件
│   ├── daily_etl_orders.py
│   └── hourly_sync_users.py
├── scripts/                # ETL脚本
│   ├── extract/
│   ├── transform/
│   └── load/
├── config/                 # 配置文件
│   ├── databases.py
│   └── etl_config.py
├── tests/                  # 测试文件
└── docs/                   # 文档
    └── README.md
```

## 环境配置
详见：docs/SETUP.md

## 常见问题
详见：docs/FAQ.md

## 变更日志
详见：docs/CHANGELOG.md
```

#### 三、测试规范

##### 3.1 单元测试

```python
# tests/test_extract_orders.py
import unittest
from scripts.extract.extract_orders import extract_orders
from unittest.mock import patch, MagicMock

class TestExtractOrders(unittest.TestCase):
    
    @patch('scripts.extract.extract_orders.pymysql.connect')
    def test_extract_orders_success(self, mock_connect):
        """测试：成功抽取订单"""
        # 模拟数据库连接和查询结果
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        mock_df = pd.DataFrame({
            'order_id': [1, 2, 3],
            'user_id': [101, 102, 103],
            'order_amount': [100, 200, 300]
        })
        
        # 测试
        result = extract_orders(20260101)
        
        # 断言
        self.assertEqual(len(result), 3)
        self.assertEqual(result['order_amount'].sum(), 600)
    
    @patch('scripts.extract.extract_orders.pymysql.connect')
    def test_extract_orders_no_data(self, mock_connect):
        """测试：没有数据的情况"""
        mock_conn = MagicMock()
        mock_connect.return_value = mock_conn
        
        # 模拟空结果
        mock_df = pd.DataFrame()
        
        # 测试
        result = extract_orders(20260101)
        
        # 断言
        self.assertEqual(len(result), 0)

if __name__ == '__main__':
    unittest.main()
```

##### 3.2 集成测试

```python
# tests/test_etl_integration.py
import unittest
from scripts.etl_orders import etl_orders

class TestETLIntegration(unittest.TestCase):
    
    def test_full_etl_pipeline(self):
        """测试：完整ETL流程"""
        # 1. 准备测试数据
        prepare_test_data()
        
        # 2. 执行ETL
        result = etl_orders(20260101)
        
        # 3. 验证结果
        conn = get_pg_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM dwd_fact_orders WHERE date_id = 20260101")
        count = cursor.fetchone()[0]
        
        self.assertGreater(count, 0)
        self.assertEqual(count, result['rows_loaded'])
        
        conn.close()
```

##### 3.3 数据质量测试

```python
# tests/test_data_quality.py
import unittest

class TestDataQuality(unittest.TestCase):
    
    def test_no_null_user_id(self):
        """测试：没有NULL的user_id"""
        conn = get_pg_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dwd_fact_orders 
            WHERE date_id = 20260101 
              AND user_id IS NULL
        """)
        
        null_count = cursor.fetchone()[0]
        
        self.assertEqual(null_count, 0, "存在NULL的user_id")
        
        conn.close()
    
    def test_no_negative_amount(self):
        """测试：没有负数订单金额"""
        conn = get_pg_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT COUNT(*) 
            FROM dwd_fact_orders 
            WHERE date_id = 20260101 
              AND order_amount < 0
        """)
        
        negative_count = cursor.fetchone()[0]
        
        self.assertEqual(negative_count, 0, "存在负数订单金额")
        
        conn.close()
```

#### 四、版本控制

##### 4.1 Git规范

```bash
# 分支规范
main             # 主分支，生产环境
develop          # 开发分支
feature/xxx      # 功能分支
bugfix/xxx       # Bug修复分支
hotfix/xxx       # 紧急修复分支

# Commit规范
git commit -m "feat: 添加用户维度表ETL"
git commit -m "fix: 修复订单金额为负数的Bug"
git commit -m "docs: 更新README文档"
git commit -m "refactor: 重构抽取函数"
git commit -m "test: 添加单元测试"
git commit -m "chore: 更新依赖包版本"
```

##### 4.2 代码审查

```yaml
审查清单：
1. 代码规范
   - 命名是否清晰
   - 结构是否合理
   - 注释是否充分
   
2. 功能正确性
   - 逻辑是否正确
   - 边界条件是否处理
   - 错误是否处理
   
3. 性能
   - 是否有性能问题
   - SQL是否优化
   - 是否有资源泄漏
   
4. 测试
   - 是否有单元测试
   - 测试覆盖率如何
   - 是否有集成测试
   
5. 文档
   - 是否更新了文档
   - README是否更新
   - 变更日志是否记录
```

#### 五、监控和告警

##### 5.1 关键指标监控

```python
# 关键指标
KEY_METRICS = {
    'duration_seconds': 3600,  # 执行时间不超过1小时
    'rows_processed': 1,        # 至少处理1行
    'error_rate': 0.01,         # 错误率不超过1%
    'data freshness': 2,         # 数据延迟不超过2天
}

def check_metrics(dag_id, task_id, execution_date):
    """检查关键指标"""
    # 1. 查询ETL性能
    perf = get_etl_performance(dag_id, task_id, execution_date)
    
    # 2. 检查执行时间
    if perf['duration_seconds'] > KEY_METRICS['duration_seconds']:
        send_alert(f"ETL超时: {dag_id}.{task_id}")
    
    # 3. 检查处理行数
    if perf['rows_processed'] < KEY_METRICS['rows_processed']:
        send_alert(f"数据量异常: {dag_id}.{task_id}")
    
    # 4. 检查错误率
    error_rate = perf['error_rows'] / perf['rows_processed']
    if error_rate > KEY_METRICS['error_rate']:
        send_alert(f"错误率过高: {dag_id}.{task_id}")
    
    # 5. 检查数据新鲜度
    freshness = calculate_freshness(dag_id)
    if freshness > KEY_METRICS['data freshness']:
        send_alert(f"数据延迟: {dag_id}.{task_id}")
```

##### 5.2 告警配置

```python
# 告警规则
ALERT_RULES = {
    'critical': {
        'channels': ['email', 'sms', 'pagerduty'],
        'recipients': ['oncall@company.com']
    },
    'warning': {
        'channels': ['email'],
        'recipients': ['data-team@company.com']
    },
    'info': {
        'channels': ['slack'],
        'recipients': ['#data-team']
    }
}

def send_alert(level, message):
    """发送告警"""
    config = ALERT_RULES[level]
    
    for channel in config['channels']:
        if channel == 'email':
            send_email(config['recipients'], message)
        elif channel == 'sms':
            send_sms(config['recipients'], message)
        elif channel == 'pagerduty':
            trigger_pagerduty(config['recipients'], message)
```

#### 六、安全规范

##### 6.1 凭证管理

```python
# 好的做法：使用环境变量
import os
from dotenv import load_dotenv

load_dotenv()

MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST'),
    'user': os.getenv('MYSQL_USER'),
    'password': os.getenv('MYSQL_PASSWORD'),  # 从环境变量读取
    'database': os.getenv('MYSQL_DATABASE')
}

# .env文件（不提交到Git）
MYSQL_HOST=mysql-server
MYSQL_USER=root
MYSQL_PASSWORD=secure_password_here
MYSQL_DATABASE=business_db

# .gitignore
.env
*.pyc
__pycache__/
```

```python
# 不好的做法：硬编码密码
MYSQL_CONFIG = {
    'host': 'mysql-server',
    'user': 'root',
    'password': 'plain_text_password',  # 危险！
    'database': 'business_db'
}
```

##### 6.2 SQL注入防护

```python
# 好的做法：使用参数化查询
def get_orders(date_id):
    conn = get_connection()
    cursor = conn.cursor()
    
    # 参数化查询，防止SQL注入
    cursor.execute(
        "SELECT * FROM orders WHERE date_id = %s",
        (date_id,)  # 参数
    )
    
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result

# 不好的做法：字符串拼接（SQL注入风险）
def get_orders(date_id):
    conn = get_connection()
    cursor = conn.cursor()
    
    # 危险！SQL注入风险
    query = f"SELECT * FROM orders WHERE date_id = {date_id}"
    cursor.execute(query)
    
    result = cursor.fetchall()
    cursor.close()
    conn.close()
    return result
```

#### 七、最佳实践总结

##### 7.1 开发流程

```yaml
1. 需求分析
   - 理解业务需求
   - 明确数据源和目标
   - 确定SLA
   
2. 设计
   - 设计DAG结构
   - 设计任务依赖
   - 设计错误处理
   
3. 开发
   - 编写代码
   - 编写单元测试
   - 编写文档
   
4. 测试
   - 单元测试
   - 集成测试
   - 数据质量测试
   
5. 代码审查
   - 提交PR
   - 代码审查
   - 修改完善
   
6. 部署
   - 部署到测试环境
   - 验证功能
   - 部署到生产环境
```

##### 7.2 黄金法则

```yaml
法则1：幂等性
  - ETL任务可以重复执行
  - 结果一致
  
法则2：原子性
  - 任务要么全成功，要么全失败
  - 使用事务
  
法则3：可追溯
  - 记录ETL日志
  - 记录数据来源
  
法则4：可监控
  - 监控关键指标
  - 及时告警
  
法则5：可恢复
  - 任务失败后可以恢复
  - 不丢失数据
  
法则6：可测试
  - 有完善的测试
  - 测试覆盖率足够
  
法则7：可维护
  - 代码清晰
  - 文档完善
  
法则8：安全第一
  - 不硬编码密码
  - 防止SQL注入
```

#### 八、常见陷阱

##### 8.1 硬编码陷阱

```python
# 硬编码的陷阱
def extract_orders():
    conn = pymysql.connect(
        host='192.168.1.100',  # 硬编码IP
        port=3306,
        user='root',
        password='password',   # 硬编码密码
        database='business_db'  # 硬编码数据库名
    )
    ...

# 问题：
# 1. 环境切换需要修改代码
# 2. 密码暴露在代码中
# 3. 无法部署到多个环境
```

##### 8.2 单体函数陷阱

```python
# 单体函数的陷阱
def etl_process():
    """一个函数做所有事情"""
    # 抽取
    conn1 = connect_to_mysql()
    df1 = pd.read_sql("SELECT * FROM orders", conn1)
    
    # 转换
    df1 = df1[df1['amount'] > 0]
    df2 = df1.groupby('user_id').sum()
    
    # 加载
    conn2 = connect_to_postgres()
    cursor = conn2.cursor()
    for _, row in df2.iterrows():
        cursor.execute("INSERT INTO ...", row)
    
    # 问题：
    # 1. 函数太长（难以阅读）
    # 2. 职责不单一（难以测试）
    # 3. 无法复用（难以维护）
    # 4. 错误难以定位（难以调试）
```

##### 8.3 魔法数字陷阱

```python
# 魔法数字的陷阱
def process_data(df):
    df = df[df['amount'] > 100]  # 魔法数字：100
    df = df[df['count'] < 1000]  # 魔法数字：1000
    return df

# 问题：
# 1. 数字含义不清楚
# 2. 修改需要查找所有地方
# 3. 代码难以理解

# 好的做法：使用常量
MIN_AMOUNT = 100
MAX_COUNT = 1000

def process_data(df):
    df = df[df['amount'] > MIN_AMOUNT]
    df = df[df['count'] < MAX_COUNT]
    return df
```

#### 九、实战清单

##### 9.1 ETL开发清单

```yaml
开发前：
  □ 需求是否明确
  □ 数据源是否确认
  □ 目标表是否设计
  □ SLA是否定义
  
开发中：
  □ 代码是否符合规范
  □ 命名是否清晰
  □ 错误是否处理
  □ 日志是否记录
  
测试：
  □ 单元测试是否通过
  □ 集成测试是否通过
  □ 数据质量是否验证
  
文档：
  □ DAG文档是否完整
  □ 函数文档是否完整
  □ README是否更新
  
部署：
  □ 环境变量是否配置
  □ 依赖是否安装
  □ 调度是否配置
  
监控：
  □ 指标是否监控
  □ 告警是否配置
  □ 日志是否收集
```

#### 十、小结

ETL最佳实践是多年项目经验的总结，涵盖代码规范、文档规范、测试规范、版本控制、监控告警、安全规范等多个方面。

核心要点：
- 代码规范：命名清晰、结构合理、配置管理
- 文档规范：DAG文档、任务文档、README文档
- 测试规范：单元测试、集成测试、数据质量测试
- 版本控制：Git规范、分支管理、代码审查
- 监控告警：关键指标监控、多级告警、及时响应
- 安全规范：凭证管理、SQL注入防护、数据脱敏
- 开发流程：需求分析→设计→开发→测试→审查→部署
- 黄金法则：幂等性、原子性、可追溯、可监控、可恢复、可测试、可维护、安全第一
- 常见陷阱：硬编码、单体函数、魔法数字
- 实战清单：开发前、开发中、测试、文档、部署、监控的检查清单

下一节将学习ELT最佳实践，了解ELT（Extract-Load-Transform）的特有实践。

### 6.11 ELT最佳实践

上一节学习了ETL最佳实践，了解了ETL开发的规范和经验。

ELT（Extract-Load-Transform）是另一种数据集成策略，它有自己的特点和最佳实践。

**场景**：
```yaml
数据仓库项目：
  
技术经理："我们决定采用ELT架构"
  
数据工程师："ELT和ETL的实践有什么不同？"
  
架构师："ELT有自己的最佳实践"
  
新工程师："能具体说说吗？"
```

**问题**：
- ELT和ETL的实践有什么区别？
- ELT有哪些特有的最佳实践？
- 如何使用dbt等工具？
- 如何管理ELT项目？

**答案**：**ELT的最佳实践包括dbt项目结构、SQL模块化、测试策略、文档管理、版本控制等，充分利用现代数据栈的优势**

#### 一、ELT vs ETL实践差异

##### 1.1 转换位置

**ETL**：
```yaml
转换位置：
  - 在ETL服务器中
  - 使用Python/Java/Scala
  
代码管理：
  - 代码在Git仓库
  - 使用Python/Java
  
示例：
  - Python脚本
  - Spark作业
```

**ELT**：
```yaml
转换位置：
  - 在目标数据库中
  - 使用SQL
  
代码管理：
  - 代码在Git仓库
  - 使用dbt/SQL
  
示例：
  - dbt模型（.sql文件）
  - 存储过程
```

##### 1.2 工具栈

**ETL工具栈**：
```yaml
数据同步：
  - 自定义Python脚本
  - Sqoop
  - GoldenGate
  
数据转换：
  - Python/Java/Scala
  - Spark
  - Flink
  
工作流调度：
  - Airflow
  - Oozie
  - Azkaban
```

**ELT工具栈**：
```yaml
数据同步：
  - Fivetran
  - Airbyte
  - CDC工具
  
数据转换：
  - dbt
  - SQLMesh
  - 存储过程
  
工作流调度：
  - dbt Cloud
  - Airflow（dbt插件）
```

#### 二、dbt项目结构

##### 2.1 标准项目结构

```
my_data_warehouse/
├── dbt_project.yml          # dbt项目配置
├── profiles.yml              # 数据库连接配置
├── dbt_packages/             # dbt包
├── macros/                   # 自定义宏
│   ├── date_utils.sql
│   └── utils.sql
├── models/                   # 数据模型（核心）
│   ├── staging/             # 中间层（ODS → DWD）
│   │   ├── stg_orders.sql
│   │   ├── stg_users.sql
│   │   └── stg_products.sql
│   ├── intermediate/        # 中间层
│   │   ├── int_order_metrics.sql
│   │   └── int_user_metrics.sql
│   └── marts/               # 输出层（DWS/ADS）
│       ├── finance/
│       │   ├── gmv.sql
│       │   └── revenue.sql
│       └── marketing/
│           ├── user_segments.sql
│           └── campaign_performance.sql
├── seeds/                    # 静态数据
│   ├── country_codes.csv
│   └── currency_codes.csv
├── tests/                    # 测试
│   ├── schema_tests/
│   │   └── stg_orders_schema.yml
│   └── data_tests/
│       └── gmv_data.yml
├── snapshots/                # 快照
│   └── orders_snapshot.yml
├── analyses/                 # 临时分析
│   └── ad_hoc_analysis.sql
└── docs/                     # 文档
    └── model_documentation.md
```

##### 2.2 项目配置

**dbt_project.yml**：
```yaml
name: 'my_data_warehouse'
version: '1.0.0'
config-version: 2

# 模型搜索路径
model-paths: ["models"]

# 种子数据路径
seed-paths: ["seeds"]

# 测试路径
test-paths: ["tests"]

# 快照路径
snapshot-paths: ["snapshots"]

# 分析路径
analysis-paths: ["analyses"]

# 宏路径
macro-paths: ["macros"]

# 目标路径
target-path: "target"

# 清理目标
clean-targets:
  - "target"
  - "dbt_packages"

# 模型配置
models:
  my_data_warehouse:
    # 中间层配置
    staging:
      +materialized: view
      +schema: stg
    
    # 输出层配置
    marts:
      +materialized: table
      +schema: dws
```

**profiles.yml**：
```yaml
my_data_warehouse:
  target: dev  # 环境：dev/prod
  outputs:
    dev:
      type: postgres
      host: localhost
      user: postgres
      password: password
      port: 5432
      dbname: data_warehouse
      schema: dws
      threads: 4
      timeout_seconds: 300
    
    prod:
      type: postgres
      host: prod-postgres-server
      user: postgres_ro
      password: "{{ env_var('POSTGRES_PASSWORD') }}"
      port: 5432
      dbname: data_warehouse
      schema: dws
      threads: 8
      timeout_seconds: 600
```

#### 三、dbt模型设计

##### 3.1 分层模型

**Staging层（ODS → DWD）**：
```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    unique_key='order_id',
    schema='stg'
) }}

WITH source_data AS (
    SELECT * FROM {{ source('raw', 'orders') }}
)

SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM source_data
WHERE order_status = 'completed'  -- 只保留已完成订单
  AND order_amount > 0;           -- 过滤负数订单
```

**Intermediate层（中间计算）**：
```sql
-- models/intermediate/int_order_metrics.sql
{{ config(
    materialized='table',
    schema='int'
) }}

WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
),

user_metrics AS (
    SELECT 
        user_id,
        COUNT(*) as order_count,
        SUM(order_amount) as total_amount,
        AVG(order_amount) as avg_amount
    FROM orders
    GROUP BY user_id
)

SELECT 
    o.*,
    u.order_count as user_order_count,
    u.total_amount as user_total_amount,
    u.avg_amount as user_avg_amount
FROM orders o
LEFT JOIN user_metrics u ON o.user_id = u.user_id;
```

**Marts层（DWS/ADS）**：
```sql
-- models/marts/finance/gmv.sql
{{ config(
    materialized='table',
    schema='dws'
) }}

WITH daily_orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
)

SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    SUM(order_amount) / COUNT(*) as avg_order_amount,
    COUNT(DISTINCT user_id) as user_count
FROM daily_orders
GROUP BY date_id;
```

##### 3.2 模型命名规范

```yaml
Staging层：
  - 前缀：stg_
  - 命名：stg_orders
  - 作用：原始数据的初步清洗
  
Intermediate层：
  - 前缀：int_
  - 命名：int_order_metrics
  - 作用：中间计算
  
Marts层：
  - 按业务域组织
  - 命名：finance_gmv, marketing_users
  - 作用：最终输出
```

#### 四、SQL模块化

##### 4.1 使用宏（Macros）

**定义宏**：
```sql
-- macros/date_utils.sql
{% macro date_spine(start_date, end_date) %}
  SELECT 
    date_day,
    TO_CHAR(date_day, 'YYYYMMDD')::INT as date_id,
    EXTRACT(YEAR FROM date_day) as year,
    EXTRACT(MONTH FROM date_day) as month,
    EXTRACT(DAY FROM date_day) as day,
    TO_CHAR(date_day, 'Day') as weekday
  FROM (
    SELECT generate_series(
      DATE '{{ start_date }}',
      DATE '{{ end_date }}',
      INTERVAL '1 day'
    ) as date_day
  ) sub
{% endmacro %}
```

**使用宏**：
```sql
-- models/marts/finance/gmv.sql
{{ config(
    materialized='table',
    schema='dws'
) }}

WITH date_spine AS (
    {{ date_spine('2026-01-01', '2026-12-31') }}
),

orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
)

SELECT 
    d.date_id,
    d.year,
    d.month,
    COALESCE(SUM(o.order_amount), 0) as gmv
FROM date_spine d
LEFT JOIN orders o ON d.date_id = o.date_id
GROUP BY d.date_id, d.year, d.month;
```

##### 4.2 使用Source

**定义Source**：
```yaml
# dbt_project.yml
name: 'my_data_warehouse'

sources:
  - name: raw
    schema: ods
    tables:
      - name: orders
        description: "原始订单表"
        columns:
          - name: order_id
            description: "订单ID"
            tests:
              - unique
              - not_null
          - name: user_id
            description: "用户ID"
          - name: order_amount
            description: "订单金额"
            tests:
              - not_null
```

**使用Source**：
```sql
-- models/staging/stg_orders.sql
SELECT 
    order_id,
    user_id,
    order_amount
FROM {{ source('raw', 'orders') }}
WHERE order_status = 'completed';
```

#### 五、测试策略

##### 5.1 Schema测试

```yaml
# tests/schema_tests/stg_orders_schema.yml
version: 2

models:
  - name: stg_orders
    columns:
      - name: order_id
        tests:
          - unique
          - not_null
      
      - name: user_id
        tests:
          - not_null
          - relationships:
              to: ref('stg_users')
              field: user_id
      
      - name: order_amount
        tests:
          - not_null
          - positive_value  # 自定义测试
```

##### 5.2 数据测试

```yaml
# tests/data_tests/gmv_data.yml
version: 2

models:
  - name: dws_daily_gmv
    tests:
      - dbt_utils.expression_is_true:
          expression: "gmv >= 0"
          name: "gmv_is_non_negative"
      
      - dbt_utils.recency:
          datepart: day
          field: date_id
          interval: 1
          name: "data_is_fresh"
```

##### 5.3 自定义测试

```sql
-- tests/generic/tests/not_null_columns.sql
{% test not_null_columns(model, columns) %}
SELECT *
FROM (
    SELECT 
        {% for column in columns %}
        SUM(CASE WHEN {{ column }} IS NULL THEN 1 ELSE 0 END) as null_count_{{ column }},
        {% endfor %}
        COUNT(*) as total_count
    FROM {{ model }}
) checks
WHERE 
    {% for column in columns %}
    null_count_{{ column }} > 0
        {% if not loop.last %}OR{% endif %}
    {% endfor %}
{% endtest %}
```

**使用自定义测试**：
```yaml
# models/staging/stg_orders.yml
models:
  - name: stg_orders
    tests:
      - not_null_columns:
          columns: [order_id, user_id, order_amount]
```

#### 六、文档管理

##### 6.1 模型文档

```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='view',
    schema='stg'
) }}

{{
    doc("""
    ### 订单Staging表
    
    **描述**: 从ODS层的orders表清洗数据
    
    **转换规则**:
    - 只保留order_status='completed'的订单
    - 过滤order_amount <= 0的订单
    
    **来源**: {{ source('raw', 'orders') }}
    
    **输出**: 
    - dwd_fact_orders（事实表）
    - dws_daily_gmv（汇总表）
    
    **更新频率**: 每天
    
    **负责人**: 张三
    """)
}}

SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM {{ source('raw', 'orders') }}
WHERE order_status = 'completed'
  AND order_amount > 0;
```

##### 6.2 自动生成文档

```bash
# 生成文档
dbt docs generate

# 启动文档服务器
dbt docs serve

# 访问文档
# http://localhost:8080
```

**文档内容**：
```yaml
自动生成：
  - 模型列表
  - 模型依赖关系图
  - 字段文档
  - 测试结果
  
手动维护：
  - 模型描述
  - 转换逻辑说明
  - 业务定义
```

#### 七、版本控制

##### 7.1 Git工作流

```bash
# 功能分支工作流
# 1. 创建功能分支
git checkout -b feature/add-user-segmentation

# 2. 开发
# 创建/修改模型
dbt run --models marts/marketing/user_segments

# 3. 测试
dbt test --models marts/marketing/user_segments

# 4. 提交
git add models/marts/marketing/user_segments.sql
git commit -m "feat: 添加用户分群模型"

# 5. 推送
git push origin feature/add-user-segmentation

# 6. 创建PR
# 在GitHub/GitLab上创建Pull Request

# 7. 代码审查

# 8. 合并到主分支
git checkout main
git merge feature/add-user-segmentation
```

##### 7.2 dbt包管理

```yaml
# packages.yml
packages:
  - package: dbt-labs/dbt_utils
    version: 1.0.0
  
  - package: calogica/dbt_expectations
    version: 0.9.0

# 安装包
dbt deps install

# 更新包
dbt deps update
```

#### 八、性能优化

##### 8.1 增量模型

```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    unique_key='order_id',
    schema='stg'
) }}

SELECT 
    order_id,
    user_id,
    product_id,
    order_amount
FROM {{ source('raw', 'orders') }}
WHERE updated_at >= (
    SELECT MAX(updated_at) FROM {{ this }}
) OR TRUE;  -- 首次运行
```

##### 8.2 物化视图

```sql
-- models/marts/finance/gmv.sql
{{ config(
    materialized='table',
    schema='dws'
) }}

-- 复杂查询使用table而非view
WITH date_spine AS (
    {{ date_spine('2026-01-01', '2026-12-31') }}
),
orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
)
SELECT 
    d.date_id,
    COALESCE(SUM(o.order_amount), 0) as gmv
FROM date_spine d
LEFT JOIN orders o ON d.date_id = o.date_id
GROUP BY d.date_id;
```

#### 九、ELT最佳实践总结

##### 9.1 项目组织

```yaml
1. 分层设计
   - Staging层：初步清洗
   - Intermediate层：中间计算
   - Marts层：最终输出
   
2. 按业务域组织
   - finance
   - marketing
   - product
   - operations
   
3. 模型命名
   - 清晰的命名
   - 一致的前缀
```

##### 9.2 代码质量

```yaml
1. SQL规范
   - 使用标准SQL
   - 避免特定数据库方言
   - 添加注释
   
2. 测试覆盖
   - Schema测试
   - 数据测试
   - 自定义测试
   
3. 文档完善
   - 模型描述
   - 字段描述
   - 转换逻辑
```

##### 9.3 性能优化

```yaml
1. 增量模型
   - 只处理变化数据
   - 减少计算量
   
2. 物化策略
   - table vs view
   - 根据查询频率选择
   
3. 分区表
   - 按日期分区
   - 提升查询性能
```

##### 9.4 团队协作

```yaml
1. 代码审查
   - 所有模型需要审查
   - 自动化测试
   
2. 文档共享
   - 自动生成文档
   - 团队知识沉淀
   
3. 版本管理
   - Git工作流
   - 分支策略
```

#### 十、常见陷阱

##### 10.1 过度使用 Jinja

```sql
--不好的做法：复杂的Jinja逻辑
{% set result = [] %}
{% for order in orders %}
  {% if order.amount > 100 %}
    {% set result = result + [order] %}
  {% endif %}
{% endfor %}
SELECT * FROM {{ result }}

--好的做法：使用SQL
SELECT * FROM orders WHERE amount > 100
```

##### 10.2 忽略测试

```yaml
问题：
  - 只关注模型开发
  - 忽略测试
  
后果：
  - 数据质量无法保证
  - Bug无法及时发现
  
解决：
  - 每个模型都有测试
  - CI/CD中运行测试
```

##### 10.3 缺乏文档

```yaml
问题：
  - 模型没有文档
  - 新成员难以理解
  
后果：
  - 团队知识流失
  - 维护困难
  
解决：
  - 每个模型都有文档
  - 使用dbt docs generate
```

#### 十一、实战清单

##### 11.1 ELT项目检查清单

```yaml
项目结构：
  □ 分层是否清晰
  □ 命名是否规范
  □ 组织是否合理
  
代码质量：
  □ SQL是否标准
  □ 是否有注释
  □ 是否有文档
  
测试：
  □ Schema测试是否完整
  □ 数据测试是否完整
  □ 测试覆盖率是否足够
  
文档：
  □ 模型文档是否完整
  □ README是否更新
  □ 是否生成dbt文档
  
版本控制：
  □ 是否使用Git
  □ 是否有代码审查
  □ 是否有版本标签
  
监控：
  □ 是否有运行监控
  □ 是否有数据质量监控
  □ 是否有告警机制
```

#### 十二、小结

ELT的最佳实践与ETL有很大不同，重点关注dbt项目结构、SQL模块化、测试策略、文档管理等方面。

核心要点：
- ELT vs ETL：转换位置不同、工具栈不同
- dbt项目结构：models分层、macros复用、tests完整
- 模型设计：Staging、Intermediate、Marts三层
- SQL模块化：使用宏、使用Source、代码复用
- 测试策略：Schema测试、数据测试、自定义测试
- 文档管理：模型文档、自动生成、知识沉淀
- 版本控制：Git工作流、分支策略、代码审查
- 性能优化：增量模型、物化策略、分区表
- 团队协作：代码审查、文档共享、版本管理
- 最佳实践：分层设计、代码质量、性能优化、团队协作
- 常见陷阱：过度使用Jinja、忽略测试、缺乏文档
- 实战清单：项目结构、代码质量、测试、文档、版本控制、监控

下一节将学习ETL/ELT实战案例，通过一个完整的案例展示ETL/ELT的实施过程。

### 6.12 ETL/ELT实战案例

前面学习了ETL最佳实践和ELT最佳实践，了解了两种架构的规范和方法。

现在通过一个完整的实战案例，展示从需求分析到实施部署的全过程。

**场景**：
```yaml
公司背景：
  - 电商公司，业务快速增长
  - 数据量达到TB级别
  - 需要建立数据仓库
  
需求：
  - 每日GMV报表
  - 用户留存分析
  - 商品销售排名
  
技术栈：
  - 源系统：MySQL（业务库）
  - 目标系统：PostgreSQL（数据仓库）
  - 工具：Airflow + dbt + Airbyte
  
目标：
  - 从零开始建立ETL/ELT系统
  - 实现自动化数据处理
  - 保证数据质量和性能
```

**问题**：
- 如何从零开始设计ETL/ELT系统？
- 如何选择合适的架构和工具？
- 如何实施和优化？
- 如何保证质量和性能？

**答案**：**通过一个完整的实战案例，展示ETL/ELT系统的设计、实施、优化全过程**

#### 一、需求分析

##### 1.1 业务需求

```yaml
报表需求：
  1. 每日GMV报表
     - 按日期、城市、品类展示
     - 每天8点前完成
     
  2. 用户留存报表
     - 按用户注册日期分组
     - 计算次日、7日、30日留存
     - 每周一早上9点完成
     
  3. 商品销售排名
     - 按GMV、销量排名
     - Top 100商品
     - 每天9点前完成

数据需求：
  - 订单数据（2020年至今）
  - 用户数据（2020年至今）
  - 商品数据（2020年至今）
  - 用户行为数据（2022年至今）
```

##### 1.2 技术需求

```yaml
性能需求：
  - ETL任务在4小时内完成
  - 报表查询在5秒内完成
  - 系统可用性99.9%
  
质量需求：
  - 数据准确率99.9%
  - 数据延迟不超过1天
  - 数据完整性100%
  
扩展需求：
  - 支持数据量增长10倍
  - 支持新增数据源
  - 支持新增报表
```

#### 二、架构设计

##### 2.1 整体架构

```text
┌─────────────┐
│  MySQL      │  源系统
│  (业务库)    │
└──────┬──────┘
       │
       │ Airbyte (CDC)
       ↓
┌─────────────┐
│ PostgreSQL  │  数据仓库
│  (ODS层)    │  原始数据
└──────┬──────┘
       │
       │ dbt Transform
       ↓
┌─────────────┐
│ PostgreSQL  │  数据仓库
│  (DWD层)    │  明细层
└──────┬──────┘
       │
       │ dbt Transform
       ↓
┌─────────────┐
│ PostgreSQL  │  数据仓库
│  (DWS层)    │  汇总层
└──────┬──────┘
       │
       │ dbt Transform
       ↓
┌─────────────┐
│ PostgreSQL  │  数据仓库
│  (ADS层)    │  应用层
└─────────────┘
       ↓
┌─────────────┐
│ BI 工具      │  报表展示
└─────────────┘
```

##### 2.2 工具选择

```yaml
数据同步：Airbyte
  原因：
  - 开源免费
  - 支持CDC
  - 配置简单
  
数据转换：dbt
  原因：
  - SQL-based，学习成本低
  - 版本控制友好
  - 模块化设计
  
工作流调度：Airflow
  原因：
  - 功能强大
  - 社区活跃
  - 可扩展性强
```

#### 三、实施步骤

##### 3.1 第1步：数据库初始化

```sql
-- 1. 创建数据库
CREATE DATABASE data_warehouse;

-- 2. 创建Schema
CREATE SCHEMA ods;     -- 原始数据层
CREATE SCHEMA dwd;     -- 明细层
CREATE SCHEMA dws;     -- 汇总层
CREATE SCHEMA ads;     -- 应用层
CREATE SCHEMA stg;     -- 中间层
CREATE SCHEMA dim;     -- 维度层

-- 3. 创建用户
CREATE USER etl_user WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE data_warehouse TO etl_user;
GRANT USAGE ON SCHEMA ods, dwd, dws, ads, stg, dim TO etl_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ods, dwd, dws, ads, stg, dim TO etl_user;

-- 4. 创建Airbyte源表（ODS层）
CREATE TABLE ods.orders (
    order_id BIGINT PRIMARY KEY,
    user_id BIGINT,
    product_id BIGINT,
    order_amount NUMERIC(10,2),
    order_status VARCHAR(50),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

-- 5. 创建维度表（DIM层）
CREATE TABLE dim.users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),
    city VARCHAR(100),
    province VARCHAR(100),
    register_date DATE
);

CREATE TABLE dim.products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(200),
    category VARCHAR(100),
    brand VARCHAR(100),
    price NUMERIC(10,2)
);
```

##### 3.2 第2步：配置Airbyte数据同步

```yaml
# Airbyte配置文件：airbyte_config.yaml
sourceDefinition:
  name: mysql
  connectionConfiguration:
    host: mysql-server
    port: 3306
    database: business_db
    username: root
    password: password

destinationDefinition:
  name: postgres
  connectionConfiguration:
    host: postgres-server
    port: 5432
    database: data_warehouse
    schema: ods
    username: etl_user
    password: secure_password

streams:
  - name: orders
    namespace: public
    destinationNamespace: ods
    syncMode: cdc  # 使用CDC

# 启动Airbyte
docker-compose up -d

# 创建同步连接
# 通过Airbyte UI配置：
# 1. Source: MySQL
#    - host: mysql-server
#    - database: business_db
#    - tables: orders, users, products
# 2. Destination: PostgreSQL
#    - host: postgres-server
#    - database: data_warehouse
#    - schema: ods
# 3. 启动同步
```

##### 3.3 第3步：dbt项目初始化

```bash
# 1. 创建dbt项目
dbt init my_data_warehouse

# 2. 项目结构
cd my_data_warehouse

# 3. 配置dbt_project.yml
cat > dbt_project.yml <<EOF
name: 'my_data_warehouse'
version: '1.0.0'
config-version: 2

profile: 'my_data_warehouse'

model-paths: ["models"]
seed-paths: ["seeds"]
test-paths: ["tests"]
snapshot-paths: ["snapshots"]
macro-paths: ["macros"]
target-path: "target"
clean-targets:
  - "target"
  - "dbt_packages"

models:
  my_data_warehouse:
    staging:
      +schema: stg
      +materialized: view
    intermediate:
      +schema: int
      +materialized: table
    marts:
      +schema: dws
      +materialized: table
EOF

# 4. 配置profiles.yml
mkdir -p ~/.dbt
cat > ~/.dbt/profiles.yml <<EOF
my_data_warehouse:
  target: dev
  outputs:
    dev:
      type: postgres
      host: localhost
      user: etl_user
      password: secure_password
      port: 5432
      dbname: data_warehouse
      schema: dws
      threads: 4
EOF

# 5. 测试连接
dbt debug
```

##### 3.4 第4步：创建dbt模型

**Staging层（ODS → DWD）**：
```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='view',
    schema='stg'
) }}

SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM {{ source('ods', 'orders') }}
WHERE order_status = 'completed'
  AND order_amount > 0;
```

**Intermediate层（中间计算）**：
```sql
-- models/intermediate/int_order_user_metrics.sql
{{ config(
    materialized='table',
    schema='int'
) }}

WITH orders AS (
    SELECT * FROM {{ ref('stg_orders') }}
)

SELECT 
    user_id,
    COUNT(*) as order_count,
    SUM(order_amount) as total_amount,
    AVG(order_amount) as avg_amount,
    MIN(created_at) as first_order_date,
    MAX(created_at) as last_order_date
FROM orders
GROUP BY user_id;
```

**Marts层（DWS/ADS）**：
```sql
-- models/marts/finance/daily_gmv.sql
{{ config(
    materialized='table',
    schema='dws'
) }}

WITH orders AS (
    SELECT 
        order_id,
        TO_CHAR(created_at, 'YYYYMMDD')::INT as date_id,
        user_id,
        product_id,
        order_amount
    FROM {{ ref('stg_orders') }}
)

SELECT 
    date_id,
    COUNT(*) as order_count,
    SUM(order_amount) as gmv,
    AVG(order_amount) as avg_order_amount,
    COUNT(DISTINCT user_id) as user_count
FROM orders
GROUP BY date_id;
```

##### 3.5 第5步：创建Airflow DAG

```python
# dags/daily_etl_dag.py
from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.dbt.operators.dbt import DbtRunOperator
from datetime import datetime, timedelta
import psycopg2

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

dag = DAG(
    'daily_etl_pipeline',
    default_args=default_args,
    description='每日ETL任务：数据同步+dbt转换',
    schedule_interval='0 4 * * *',
    catchup=False,
    tags=['etl', 'daily'],
)

# 任务1：等待Airbyte同步完成（简化处理）
# 实际使用Airbyte的Sensor任务
def wait_airbyte_sync():
    # 这里简化处理，实际应该检查Airbyte的同步状态
    import time
    time.sleep(60)  # 等待1分钟
    print("Airbyte sync completed")

wait_airbyte_task = PythonOperator(
    task_id='wait_airbyte_sync',
    python_callable=wait_airbyte_sync,
    dag=dag,
)

# 任务2：运行dbt Staging模型
dbt_staging = DbtRunOperator(
    task_id='dbt_staging',
    profiles_dir='/usr/local/airflow/dags/dbt',
    dir='/usr/local/airflow/dags/dbt',
    select=['staging'],
    dag=dag,
)

# 任务3：运行dbt Intermediate模型
dbt_intermediate = DbtRunOperator(
    task_id='dbt_intermediate',
    profiles_dir='/usr/local/airflow/dags/dbt',
    dir='/usr/local/airflow/dags/dbt',
    select=['intermediate'],
    dag=dag,
)

# 任务4：运行dbt Marts模型
dbt_marts = DbtRunOperator(
    task_id='dbt_marts',
    profiles_dir='/usr/local/airflow/dags/dbt',
    dir='/usr/local/airflow/dags/dbt',
    select=['marts'],
    dag=dag,
)

# 任务5：数据质量检查
def quality_check():
    conn = psycopg2.connect(
        host='postgres-server',
        user='etl_user',
        password='secure_password',
        database='data_warehouse'
    )
    cursor = conn.cursor()
    
    # 检查1：数据量
    cursor.execute("""
        SELECT COUNT(*) FROM dws.daily_gmv 
        WHERE date_id = (SELECT TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYYMMDD')::INT)
    """)
    count = cursor.fetchone()[0]
    
    if count == 0:
        raise Exception("No data in daily_gmv")
    
    # 检查2：GMV合理性
    cursor.execute("""
        SELECT gmv FROM dws.daily_gmv 
        WHERE date_id = (SELECT TO_CHAR(CURRENT_DATE - INTERVAL '1 day', 'YYYYMMDD')::INT)
    """)
    gmv = cursor.fetchone()[0]
    
    if gmv < 0:
        raise Exception(f"Negative GMV: {gmv}")
    
    cursor.close()
    conn.close()
    
    print(f"Quality check passed: {count} rows, GMV={gmv}")

quality_check_task = PythonOperator(
    task_id='quality_check',
    python_callable=quality_check,
    dag=dag,
)

# 设置依赖关系
wait_airbyte_task >> dbt_staging >> dbt_intermediate >> dbt_marts >> quality_check_task
```

#### 四、性能优化

##### 4.1 增量模型优化

```sql
-- models/staging/stg_orders.sql
{{ config(
    materialized='incremental',
    incremental_strategy='insert_overwrite',
    unique_key='order_id',
    schema='stg'
) }}

SELECT 
    order_id,
    user_id,
    product_id,
    order_amount,
    order_status,
    created_at,
    updated_at
FROM {{ source('ods', 'orders') }}
WHERE order_status = 'completed'
  AND order_amount > 0
  AND updated_at >= (
    SELECT COALESCE(MAX(updated_at), '1970-01-01'::TIMESTAMP) 
    FROM {{ this }}
)
OR TRUE;  -- 首次运行
```

##### 4.2 分区表优化

```sql
-- 创建分区表
CREATE TABLE dws.daily_gmv (
    date_id INT,
    order_count BIGINT,
    gmv NUMERIC(20,2),
    avg_order_amount NUMERIC(10,2),
    user_count BIGINT
) PARTITION BY RANGE (date_id);

-- 创建分区（手动创建或自动创建）
CREATE TABLE dws.daily_gmv_202601 PARTITION OF dws.daily_gmv
    FOR VALUES FROM (20260101) TO (20260201);

CREATE TABLE dws.daily_gmv_202602 PARTITION OF dws.daily_gmv
    FOR VALUES FROM (20260201) TO (20260301);

-- 创建索引
CREATE INDEX idx_daily_gmv_date ON dws.daily_gmv(date_id);
```

##### 4.3 查询优化

```sql
-- 优化前：全表扫描
EXPLAIN ANALYZE
SELECT * FROM dws.daily_gmv WHERE date_id = 20260101;

-- 优化后：使用索引
-- 创建索引后，查询速度提升10倍
```

#### 五、监控和告警

##### 5.1 性能监控

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
    status VARCHAR(50)
);

-- 记录性能
INSERT INTO etl_performance (dag_id, task_id, execution_date, start_time, end_time, duration_seconds, status)
VALUES (
    'daily_etl_pipeline',
    'dbt_marts',
    '2026-01-01',
    '2026-01-01 04:00:00',
    '2026-01-01 04:30:00',
    1800,
    'success'
);
```

##### 5.2 数据质量监控

```sql
-- 创建数据质量监控表
CREATE TABLE dq_metrics (
    check_id SERIAL PRIMARY KEY,
    check_date DATE,
    table_name VARCHAR(100),
    metric_name VARCHAR(100),
    metric_value NUMERIC(20,2),
    status VARCHAR(50),
    checked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 记录质量指标
INSERT INTO dq_metrics (check_date, table_name, metric_name, metric_value, status)
VALUES (
    '2026-01-01',
    'dws.daily_gmv',
    'row_count',
    (SELECT COUNT(*) FROM dws.daily_gmv WHERE date_id = 20260101),
    'pass'
);
```

#### 六、实施总结

##### 6.1 项目成果

```yaml
第1周：需求分析和架构设计
  - 需求文档完成
  - 架构设计完成
  - 技术栈确定
  
第2周：环境搭建
  - PostgreSQL部署
  - Airbyte部署
  - dbt项目初始化
  - Airflow部署
  
第3周：数据同步配置
  - Airbyte源配置
  - Airbyte目标配置
  - CDC同步测试
  
第4周：dbt模型开发
  - Staging层模型
  - Intermediate层模型
  - Marts层模型
  - 测试编写
  
第5周：Airflow DAG开发
  - DAG设计
  - 任务开发
  - 依赖配置
  
第6周：测试和优化
  - 单元测试
  - 集成测试
  - 性能优化
  
第7周：监控和告警
  - 性能监控
  - 质量监控
  - 告警配置
  
第8周：上线和运维
  - 生产环境部署
  - 文档完善
  - 培训和交接
```

##### 6.2 关键指标

```yaml
性能指标：
  - ETL执行时间：3小时
  - 报表查询时间：2秒
  - 数据延迟：1天
  
质量指标：
  - 数据准确率：99.95%
  - 数据完整性：100%
  - 系统可用性：99.9%
  
业务指标：
  - GMV报表：每天8点前完成
  - 留存报表：每周一9点前完成
  - 排名报表：每天9点前完成
```

#### 七、经验总结

##### 7.1 成功经验

```yaml
1. 选择合适的工具
   - Airbyte：简单高效
   - dbt：SQL-based，易维护
   - Airflow：功能强大
   
2. 分层架构
   - ODS → DWD → DWS → ADS
   - 职责清晰
   - 易于维护
   
3. 增量处理
   - CDC增量同步
   - dbt增量模型
   - 大幅提升性能
   
4. 充分测试
   - 单元测试
   - 集成测试
   - 数据质量测试
   
5. 完善文档
   - README文档
   - 模型文档
   - 运维文档
```

##### 7.2 踩过的坑

```yaml
陷阱1：Airbyte CDC延迟
  问题：CDC同步有延迟
  解决：增加等待时间
  
陷阱2：dbt增量模型配置
  问题：incremental_strategy配置错误
  解决：使用正确的策略
  
陷阱3：Airflow依赖配置
  问题：任务依赖关系错误
  解决：重新设计DAG
  
陷阱4：性能瓶颈
  问题：大表查询慢
  解决：创建索引、使用分区
  
陷阱5：数据质量问题
  问题：源数据有错误
  解决：增加数据清洗逻辑
```

#### 八、未来优化

```yaml
优化方向1：实时化
  当前：T+1
  目标：近实时
  方案：使用Kafka + Flink
  
优化方向2：自动化
  当前：部分手动
  目标：全自动
  方案：自动化测试、自动部署
  
优化方向3：扩展性
  当前：支持TB级
  目标：支持PB级
  方案：分布式架构
  
优化方向4：智能化
  当前：人工监控
  目标：智能告警
  方案：机器学习异常检测
```

#### 九、实战任务

**任务1：设计一个简单的ETL/ELT系统**

```yaml
需求：
  - 从MySQL同步用户表到PostgreSQL
  - 每天运行一次
  - 计算用户的RFM指标

设计：
  1. Airbyte配置MySQL → PostgreSQL同步
  2. dbt模型：stg_users（清洗）
  3. dbt模型：int_user_rfm（计算RFM）
  4. Airflow DAG：编排任务
```

**任务2：评估项目风险**

```yaml
技术风险：
  - Airbyte CDC可能不稳定
  - 缓解：增加重试机制
  
性能风险：
  - 数据量增长可能超预期
  - 缓解：使用增量模型、分区表
  
质量风险：
  - 源数据质量可能不好
  - 缓解：增加数据质量检查
```

**任务3：制定项目计划**

```yaml
第1周：需求分析、架构设计
第2周：环境搭建、工具部署
第3周：数据同步配置
第4周：dbt模型开发
第5周：Airflow DAG开发
第6周：测试和优化
第7周：监控和告警
第8周：上线和运维
```

#### 十、小结

ETL/ELT实战案例通过一个完整的电商数据仓库项目，展示了从需求分析到实施部署的全过程。

核心要点：
- 需求分析：业务需求、技术需求、性能需求、质量需求
- 架构设计：整体架构、工具选择（Airbyte+dbt+Airflow）
- 实施步骤：8周完整实施计划
  - 第1步：数据库初始化
  - 第2步：Airbyte数据同步
  - 第3步：dbt项目初始化
  - 第4步：创建dbt模型（Staging/Intermediate/Marts）
  - 第5步：创建Airflow DAG
  - 第6步：性能优化
  - 第7步：监控告警
  - 第8步：上线运维
- 性能优化：增量模型、分区表、查询优化
- 监控告警：性能监控、数据质量监控
- 项目成果：所有需求达成，关键指标达标
- 经验总结：成功经验、踩过的坑、未来优化

**至此，第6章"ETL/ELT"全部完成！**

第6章涵盖内容：
- 6.1 ETL vs ELT
- 6.2 数据抽取
- 6.3 数据转换
- 6.4 数据加载
- 6.5 常见ETL工具
- 6.6 工作流调度
- 6.7 数据质量监控
- 6.8 错误处理和重试
- 6.9 性能优化
- 6.10 ETL最佳实践
- 6.11 ELT最佳实践
- 6.12 ETL/ELT实战案例

下一章将进入第7章：批处理系统，了解批处理的模式、调度、优化等内容。

## 系统位置

ETL / ELT 位于业务系统和分析系统之间，是数据平台的入口层。

```text
PostgreSQL / MySQL / Logs / Files
  -> Extract / CDC
  -> Load
  -> Transform
  -> Data Warehouse / OLAP / Lakehouse
  -> BI / Feature / RAG / Governance
```

它承接第 5 章的模型设计：ODS 要接收源表，DWD 要依赖清洗和标准化，DWS 要依赖稳定明细，ADS 要依赖汇总结果。它也引出第 7 章的批处理系统：当转换数据量继续变大，单机 SQL 和简单调度就不够，需要 Hive、Spark、Trino 等分布式分析体系。

从 AI 数据系统角度看，ETL / ELT 也不是传统数仓专属能力。文档进入 RAG 知识库、日志进入评测集、用户行为进入特征平台、图谱边关系进入 GraphRAG，都需要类似的数据链路：抽取、清洗、转换、装载、质量检查和血缘记录。

## 场景案例

一个电商团队通常会同时存在两条链路。

第一条是 T+1 经营分析链路：

```text
PostgreSQL orders / users / products / payments
  -> 每日凌晨批量抽取
  -> ODS 原始表
  -> dbt / Spark SQL 清洗成 DWD 明细
  -> DWS 日汇总
  -> ADS 经营看板
```

这条链路更关注完整性、可补数和口径稳定。它允许小时级或天级延迟，但不能丢数据，也不能让昨天的 GMV 因为任务失败悄悄少算。

第二条是实时订单状态链路：

```text
PostgreSQL WAL
  -> Logical Decoding / Replication Slot
  -> Debezium
  -> Kafka
  -> Flink
  -> ClickHouse / Doris
  -> 实时订单监控
```

这条链路更关注低延迟、变更顺序和消费恢复。它可以服务实时风控、异常支付监控、实时大盘和订单状态提醒。

两条链路不互相替代。批量链路适合稳定对账和历史回算，实时链路适合低延迟监控和事件驱动。成熟平台通常同时保留两者，并通过质量校验和对账任务确认它们在关键指标上保持一致。

## 常见误区

**误区一：ETL 就是搬数据。**

搬运只是表层动作。真正重要的是数据一致性、质量、恢复、依赖、监控和责任边界。

**误区二：CDC 一定比批处理好。**

CDC 适合低延迟变更同步，但复杂度更高。低频报表和历史归档未必需要 CDC。

**误区三：有调度就有数据平台。**

调度只是运行任务。数据平台还需要建模、质量、血缘、权限、指标和可观测性。

**误区四：同步成功就代表数据可信。**

任务状态成功只说明程序跑完了，不代表数据量正确、主键没有重复、字段没有异常、指标没有波动。数据链路必须配套质量检查和对账。

**误区五：Exactly Once 是单个组件开关。**

端到端一致性涉及源端变更捕获、消息队列、计算引擎、目标写入、幂等设计和故障恢复。单个组件宣称支持某种语义，不等于整条链路天然不重不丢。

## 实战任务

设计 PostgreSQL 到数仓的两条链路：

1. 批量同步链路：订单、用户、商品每日同步到数仓。
2. 实时 CDC 链路：订单状态变化实时进入 Kafka 和 Flink。

每条链路写清：

- 源表。
- 同步方式。
- 目标系统。
- 延迟要求。
- 失败重试策略。
- 质量检查。
- 下游应用。

补充要求：

- 为批量链路设计一次失败补数流程。
- 为 CDC 链路设计一次 schema 变更处理流程。
- 为两条链路各写 3 条质量检查规则。
- 说明哪些指标需要批量链路作为最终对账口径，哪些指标可以使用实时链路作为近实时观察口径。

示例质量规则：

```text
orders 当日同步行数不应低于过去 7 日均值的 70%
orders.order_id 在 DWD 明细表中必须唯一
payments 成功支付金额与订单支付金额差异必须在可解释范围内
CDC topic 消费延迟超过 10 分钟必须告警
```

## 小结引出下一章

ETL / ELT 把 PostgreSQL 从业务数据库连接到数据平台。

CDC 进一步把数据库变更变成事件流。

下一章进入批处理系统。

因为当历史数据越来越多，转换和计算就不能只依赖单机数据库，而需要 Hive、Spark、Trino 这类分布式分析体系。
