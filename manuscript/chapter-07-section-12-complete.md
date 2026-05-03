### 7.12 批处理实战任务

前面学习了批处理的理论知识、技术实现、常见问题和解决方案。

如何通过实战任务巩固所学知识？如何从0到1构建批处理系统？

**场景**：
```yaml
新人学习批处理：

新工程师："学了很多理论"

资深工程师："需要实践"

新工程师："有什么实战任务吗？"

资深工程师："完成这几个任务就入门了"
```

**问题**：
- 有哪些实战任务？
- 如何完成任务？
- 需要掌握哪些技能？
- 如何验证学习效果？

**答案**：**通过从简单到复杂的实战任务，循序渐进地掌握批处理的核心技能，包括数据采集、数据处理、任务调度、性能优化、监控运维等**

#### 一、任务一：基础数据处理

##### 1.1 任务描述

```yaml
任务名称：
  每日GMV批处理作业

业务背景：
  - 电商平台
  - 日订单量：100万
  - 需要每天计算GMV报表

技术要求：
  - 语言：Python + Spark SQL
  - 数据源：MySQL（订单表）
  - 输出：Parquet文件

功能需求：
  1. 从MySQL读取订单数据
  2. 数据清洗
  3. 计算每日GMV
  4. 保存为Parquet格式

性能要求：
  - 运行时间：<30分钟
  - 数据准确性：100%

交付物：
  - Python脚本
  - SQL脚本
  - README文档
```

##### 1.2 实现步骤

```python
# 步骤1：环境准备

# 安装依赖
# pip install pyspark psycopg2-binary

# 步骤2：数据采集

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count, to_date

# 创建SparkSession
spark = SparkSession.builder \
    .appName("DailyGMV") \
    .config("spark.jars", "/path/to/postgresql-jdbc.jar") \
    .getOrCreate()

# 从MySQL读取数据
jdbc_url = "jdbc:postgresql://mysql-host:3306/ecommerce"
properties = {
    "user": "user",
    "password": "password",
    "driver": "org.postgresql.Driver"
}

orders = spark.read.jdbc(
    url=jdbc_url,
    table="orders",
    properties=properties
)

# 步骤3：数据清洗

# 过滤条件
orders_clean = orders.filter(
    (col("status") == "completed") &  # 只保留已完成订单
    (col("amount") > 0) &              # 过滤负数订单
    (col("created_at").isNotNull())    # 过滤空时间
)

# 步骤4：计算GMV

daily_gmv = orders_clean \
    .withColumn("dt", to_date(col("created_at"))) \
    .groupBy("dt") \
    .agg(
        count("*").alias("order_count"),
        _sum("amount").alias("gmv"),
        _sum("amount") / count("*").alias("avg_order_amount"),
        count(distinct("user_id")).alias("user_count")
    ) \
    .orderBy("dt")

# 步骤5：保存结果

daily_gmv.write \
    .mode("overwrite") \
    .partitionBy("dt") \
    .parquet("s3://data/output/daily_gmv")

print("Daily GMV job completed!")
```

##### 1.3 验收标准

```yaml
功能验收：
  □ 能正确从MySQL读取数据
  □ 数据清洗逻辑正确
  □ GMV计算准确
  □ Parquet文件格式正确

性能验收：
  □ 运行时间<30分钟
  □ 内存使用合理
  □ 无OOM错误

代码质量：
  □ 代码结构清晰
  □ 有适当注释
  □ 错误处理完善
```

#### 二、任务二：复杂数据处理

##### 2.1 任务描述

```yaml
任务名称：
  用户留存分析批处理

业务背景：
  - 需要分析用户留存
  - 计算次日、7日、30日留存率

技术要求：
  - 语言：Python + Spark
  - 需要窗口函数
  - 复杂关联查询

功能需求：
  1. 读取用户注册数据
  2. 读取用户登录数据
  3. 计算留存率
  4. 生成留存报表

性能要求：
  - 运行时间：<1小时
  - 支持千万级用户
```

##### 2.2 实现步骤

```python
# 步骤1：读取数据

# 用户注册数据
registrations = spark.read.parquet("s3://data/dwd/fact_user_registrations")

# 用户登录数据
logins = spark.read.parquet("s3://data/dwd/fact_user_logins")

# 步骤2：数据准备

from pyspark.sql.window import Window
from pyspark.sql.functions import col, date_add, datediff, when, lag, count as _count

# 用户注册日期
user_registrations = registrations.select(
    "user_id",
    to_date(col("created_at")).alias("registration_date")
)

# 用户登录日期
user_logins = logins.select(
    "user_id",
    to_date(col("login_time")).alias("login_date")
).distinct()

# 步骤3：计算留存

# 定义窗口
window_spec = Window.partitionBy("user_id").orderBy("login_date")

# 计算每个用户的首次登录日期
first_login = user_logins \
    .withColumn("rn", _count("*").over(window_spec)) \
    .filter(col("rn") == 1) \
    .select("user_id", col("login_date").alias("first_login_date"))

# 关联注册和首次登录
user_activity = user_registrations.join(
    first_login,
    "user_id",
    "inner"
)

# 计算留存
user_retention = user_activity \
    .withColumn("days_diff", datediff(col("login_date"), col("registration_date"))) \
    .groupBy("registration_date") \
    .agg(
        count("*").alias("total_users"),
        _sum(when(col("days_diff") == 1, 1).otherwise(0)).alias("day1_retained"),
        _sum(when(col("days_diff") == 7, 1).otherwise(0)).alias("day7_retained"),
        _sum(when(col("days_diff") == 30, 1).otherwise(0)).alias("day30_retained")
    ) \
    .withColumn("day1_retention_rate", col("day1_retained") / col("total_users")) \
    .withColumn("day7_retention_rate", col("day7_retained") / col("total_users")) \
    .withColumn("day30_retention_rate", col("day30_retained") / col("total_users"))

# 步骤4：保存结果

user_retention.write \
    .mode("overwrite") \
    .partitionBy("registration_date") \
    .parquet("s3://data/output/user_retention")

print("User retention job completed!")
```

##### 2.3 验收标准

```yaml
功能验收：
  □ 留存率计算准确
  □ 支持多维度留存（次日、7日、30日）
  □ 数据逻辑正确
  □ 边界情况处理正确

性能验收：
  □ 运行时间<1小时
  □ 支持千万级用户
  □ 内存使用合理

代码质量：
  □ 使用窗口函数
  □ 代码可读性好
  □ 注释完善
```

#### 三、任务三：数据集成与调度

##### 3.1 任务描述

```yaml
任务名称：
  构建完整的数据链路

业务背景：
  - 从多个数据源采集数据
  - 经过ODS、DWD、DWS、ADS四层
  - 使用Airflow调度

技术要求：
  - Airflow DAG
  - 多个Spark任务
  - 任务依赖管理

功能需求：
  1. 数据采集（MySQL → S3）
  2. 数据清洗（ODS → DWD）
  3. 数据汇总（DWD → DWS）
  4. 报表生成（DWS → ADS）

性能要求：
  - 全流程完成时间<2小时
  - SLA：早上9点前完成
```

##### 3.2 实现步骤

```python
# 步骤1：创建Airflow DAG

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from datetime import datetime, timedelta

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': datetime(2026, 1, 1),
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
}

with DAG(
    'daily_data_pipeline',
    default_args=default_args,
    description='Daily data processing pipeline',
    schedule_interval='0 4 * * *',  # 每天凌晨4点
    catchup=False,
) as dag:
    
    # 任务1：数据采集
    extract_orders = SparkSubmitOperator(
        task_id='extract_orders',
        application='/opt/airflow/jobs/extract_orders.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 任务2：数据清洗
    transform_orders = SparkSubmitOperator(
        task_id='transform_orders',
        application='/opt/airflow/jobs/transform_orders.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 任务3：数据汇总
    aggregate_gmv = SparkSubmitOperator(
        task_id='aggregate_gmv',
        application='/opt/airflow/jobs/aggregate_gmv.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 任务4：报表生成
    generate_report = SparkSubmitOperator(
        task_id='generate_report',
        application='/opt/airflow/jobs/generate_report.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 定义任务依赖
    extract_orders >> transform_orders >> aggregate_gmv >> generate_report

# 步骤2：实现各个任务

# extract_orders.py
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("ExtractOrders").getOrCreate()

dt = sys.argv[1]

# 从MySQL读取
orders = spark.read.jdbc(
    url="jdbc:postgresql://mysql-host:3306/ecommerce",
    table="orders",
    properties={"user": "user", "password": "password", "driver": "org.postgresql.Driver"}
)

# 写入ODS层
orders.write \
    .mode("overwrite") \
    .partitionBy("dt") \
    .parquet(f"s3://data/ods/orders/dt={dt}")

# transform_orders.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col

spark = SparkSession.builder.appName("TransformOrders").getOrCreate()

dt = sys.argv[1]

# 读取ODS层数据
orders = spark.read.parquet(f"s3://data/ods/orders/dt={dt}")

# 数据清洗
orders_clean = orders.filter(
    (col("status") == "completed") &
    (col("amount") > 0)
)

# 写入DWD层
orders_clean.write \
    .mode("overwrite") \
    .partitionBy("dt") \
    .parquet(f"s3://data/dwd/fact_orders/dt={dt}")

# aggregate_gmv.py
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count

spark = SparkSession.builder.appName("AggregateGMV").getOrCreate()

dt = sys.argv[1]

# 读取DWD层数据
orders = spark.read.parquet(f"s3://data/dwd/fact_orders/dt={dt}")

# 计算GMV
daily_gmv = orders.groupBy("dt", "city") \
    .agg(
        count("*").alias("order_count"),
        _sum("amount").alias("gmv")
    )

# 写入DWS层
daily_gmv.write \
    .mode("overwrite") \
    .partitionBy("dt") \
    .parquet(f"s3://data/dws/dws_daily_gmv/dt={dt}")

# generate_report.py
from pyspark.sql import SparkSession

spark = SparkSession.builder.appName("GenerateReport").getOrCreate()

dt = sys.argv[1]

# 读取DWS层数据
gmv = spark.read.parquet(f"s3://data/dws/dws_daily_gmv/dt={dt}")

# 写入ADS层（Redshift）
gmv.write \
    .format("com.databricks.spark.redshift") \
    .option("url", "jdbc:redshift://redshift:5439/data_warehouse") \
    .option("dbtable", "ads.daily_gmv_report") \
    .option("tempdir", "s3://data/temp/") \
    .mode("overwrite") \
    .save()
```

##### 3.3 验收标准

```yaml
功能验收：
  □ DAG定义正确
  □ 任务依赖正确
  □ 数据流转正确
  □ 分层清晰

性能验收：
  □ 全流程<2小时
  □ SLA达成（9点前完成）
  □ 资源使用合理

代码质量：
  □ DAG代码规范
  □ 任务代码规范
  □ 错误处理完善
  □ 文档齐全
```

#### 四、任务四：性能优化实战

##### 4.1 任务描述

```yaml
任务名称：
  优化慢批处理作业

背景：
  - 现有作业运行时间长（3小时）
  - 需要优化到<1小时

问题：
  - 数据倾斜严重
  - shuffle数据量大
  - 内存不足

要求：
  - 诊断性能瓶颈
  - 提出优化方案
  - 实施优化
  - 验证效果
```

##### 4.2 实现步骤

```python
# 步骤1：性能诊断

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count

spark = SparkSession.builder.appName("PerformanceDiagnostics").getOrCreate()

# 读取数据
df = spark.read.parquet("s3://data/dwd/fact_orders")

# 诊断1：数据分布
print("=== Key Distribution ===")
key_dist = df.groupBy("user_id").count().orderBy(col("count").desc())
key_dist.show(20)

# 诊断2：统计信息
stats = key_dist.agg({
    "count": "max",
    "count": "avg"
}).collect()[0]

print(f"\nMax count: {stats[0]}")
print(f"Avg count: {stats[1]}")
print(f"Skew ratio: {stats[0] / stats[1]:.2f}")

# 步骤2：实施优化

# 优化1：提高并行度
spark.conf.set("spark.sql.shuffle.partitions", "1000")

# 优化2：处理数据倾斜
from pyspark.sql.functions import concat, lit, rand

# 识别倾斜key
skewed_keys = df.groupBy("user_id") \
    .count() \
    .filter(col("count") > 100000) \
    .select("user_id")

# 分离倾斜和非倾斜数据
skewed_df = df.join(skewed_keys, "user_id", "inner")
normal_df = df.join(skewed_keys, "user_id", "left_anti")

# 分别处理
normal_result = normal_df.groupBy("user_id") \
    .agg(sum("amount"))

# 倾斜数据使用salting
skewed_with_salt = skewed_df.withColumn(
    "salt", (rand() * 10).cast("int")
)

stage1 = skewed_with_salt.groupBy("user_id", "salt") \
    .agg(sum("amount").alias("partial_amount"))

stage2 = stage1.groupBy("user_id") \
    .agg(sum("partial_amount"))

# 合并结果
final_result = normal_result.union(stage2)

# 优化3：使用序列化
spark.conf.set("spark.serializer", "org.apache.spark.serializer.KryoSerializer")

# 优化4：内存优化
spark.conf.set("spark.executor.memory", "8g")
spark.conf.set("spark.memory.fraction", "0.8")
spark.conf.set("spark.memory.storageFraction", "0.3")

# 步骤3：验证效果

import time

start_time = time.time()

# 运行优化后的代码
result = final_result.collect()

end_time = time.time()
duration = end_time - start_time

print(f"优化后运行时间: {duration:.2f}秒")

# 对比优化前后
# 优化前：3小时
# 优化后：45分钟
# 提升：75%
```

##### 4.3 验收标准

```yaml
诊断能力：
  □ 能识别性能瓶颈
  □ 能分析数据倾斜
  □ 能使用Spark UI

优化能力：
  □ 能提出优化方案
  □ 能实施优化
  □ 能验证效果

效果：
  □ 运行时间<1小时
  □ 提升>50%
```

#### 五、任务五：监控与运维

##### 5.1 任务描述

```yaml
任务名称：
  构建监控运维体系

背景：
  - 批处理系统需要监控
  - 需要及时发现和解决问题

要求：
  1. 设计监控指标
  2. 配置告警规则
  3. 实现故障处理
  4. 编写运维文档
```

##### 5.2 实现步骤

```python
# 步骤1：监控指标定义

class BatchJobMonitor:
    def __init__(self, job_name):
        self.job_name = job_name
    
    def collect_metrics(self, spark_context):
        """收集监控指标"""
        metrics = {}
        
        # 任务状态
        status = self.get_job_status(spark_context)
        metrics['status'] = status
        
        # 运行时长
        duration = self.get_job_duration(spark_context)
        metrics['duration'] = duration
        
        # 数据量
        data_volume = self.get_data_volume(spark_context)
        metrics['data_volume'] = data_volume
        
        # 资源使用
        resource_usage = self.get_resource_usage(spark_context)
        metrics.update(resource_usage)
        
        return metrics
    
    def get_job_status(self, spark_context):
        """获取任务状态"""
        # 实现逻辑
        return "RUNNING"
    
    def get_job_duration(self, spark_context):
        """获取任务时长"""
        # 实现逻辑
        return 1800  # 秒
    
    def get_data_volume(self, spark_context):
        """获取数据量"""
        # 实现逻辑
        return 100 * 1024 * 1024 * 1024  # 100GB
    
    def get_resource_usage(self, spark_context):
        """获取资源使用"""
        # 实现逻辑
        return {
            'cpu_usage': 0.75,
            'memory_usage': 0.80,
            'disk_usage': 0.60
        }

# 步骤2：告警规则

class AlertRule:
    def __init__(self, name, condition, severity):
        self.name = name
        self.condition = condition
        self.severity = severity
    
    def evaluate(self, metrics):
        """评估告警"""
        if self.condition(metrics):
            return {
                'alert_name': self.name,
                'severity': self.severity,
                'metrics': metrics,
                'timestamp': datetime.now()
            }
        return None

# 定义告警规则
alert_rules = [
    AlertRule(
        "Job Failure",
        lambda m: m['status'] == 'FAILED',
        "P0"
    ),
    AlertRule(
        "Job Timeout",
        lambda m: m['duration'] > 7200,
        "P1"
    ),
    AlertRule(
        "High CPU Usage",
        lambda m: m['cpu_usage'] > 0.9,
        "P2"
    ),
    AlertRule(
        "High Memory Usage",
        lambda m: m['memory_usage'] > 0.9,
        "P2"
    ),
]

# 步骤3：告警发送

class AlertSender:
    def send_alert(self, alert):
        """发送告警"""
        if alert['severity'] == 'P0':
            # 电话 + 短信
            self.send_phone_call(alert)
            self.send_sms(alert)
        elif alert['severity'] == 'P1':
            # 邮件 + Slack
            self.send_email(alert)
            self.send_slack(alert)
        else:
            # 邮件
            self.send_email(alert)
    
    def send_phone_call(self, alert):
        """打电话"""
        # 实现逻辑
        pass
    
    def send_sms(self, alert):
        """发短信"""
        # 实现逻辑
        pass
    
    def send_email(self, alert):
        """发邮件"""
        # 实现逻辑
        pass
    
    def send_slack(self, alert):
        """发Slack"""
        # 实现逻辑
        pass

# 步骤4：监控主流程

def monitor_job(job_name):
    """监控批处理任务"""
    monitor = BatchJobMonitor(job_name)
    
    # 收集指标
    spark_context = SparkContext.getOrCreate()
    metrics = monitor.collect_metrics(spark_context)
    
    # 评估告警
    for rule in alert_rules:
        alert = rule.evaluate(metrics)
        if alert:
            # 发送告警
            sender = AlertSender()
            sender.send_alert(alert)
            print(f"Alert triggered: {alert['alert_name']}")
```

##### 5.3 验收标准

```yaml
监控能力：
  □ 监控指标完整
  □ 告警规则合理
  □ 告警及时准确
  □ 告警方式合适

运维能力：
  □ 运维文档完善
  □ 故障处理流程清晰
  □ 快速响应
  □ 持续优化
```

#### 六、学习路径

##### 6.1 循序渐进

```yaml
第1周：基础
  - 任务一：基础数据处理
  - 学习目标：
    - 熟悉Spark
    - 掌握基础操作
    - 理解数据流程

第2周：进阶
  - 任务二：复杂数据处理
  - 学习目标：
    - 掌握窗口函数
    - 处理复杂逻辑
    - 优化性能

第3周：集成
  - 任务三：数据集成与调度
  - 学习目标：
    - 掌握Airflow
    - 理解数据分层
    - 管理任务依赖

第4周：优化
  - 任务四：性能优化实战
  - 学习目标：
    - 诊断性能问题
    - 实施优化方案
    - 验证优化效果

第5周：运维
  - 任务五：监控与运维
  - 学习目标：
    - 构建监控体系
    - 配置告警规则
    - 处理故障
```

##### 6.2 技能清单

```yaml
必备技能：
  Spark：
    □ Spark SQL
    □ DataFrame API
    □ 性能调优
  
  Airflow：
    □ DAG定义
    □ Operator使用
    □ 任务调度
  
  SQL：
    □ 复杂查询
    □ 窗口函数
    □ 性能优化

加分技能：
  □ 流处理（Flink）
  □ NoSQL（Redis、MongoDB）
  □ 容器化（Docker、Kubernetes）
  □ 云平台（AWS、GCP、Azure）
```

#### 七、小结

通过实战任务巩固批处理知识：

核心要点：
- 任务一：基础数据处理（数据采集、清洗、计算、存储）
- 任务二：复杂数据处理（留存分析、窗口函数、复杂关联）
- 任务三：数据集成与调度（Airflow DAG、多层架构、任务依赖）
- 任务四：性能优化（诊断瓶颈、实施优化、验证效果）
- 任务五：监控与运维（监控指标、告警规则、故障处理）
- 学习路径：循序渐进（5周计划）、技能清单

完成这些任务后，将掌握批处理的核心技能，可以独立设计和实现批处理系统。

下一章将学习实时数据处理，了解流处理技术。
