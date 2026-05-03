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
