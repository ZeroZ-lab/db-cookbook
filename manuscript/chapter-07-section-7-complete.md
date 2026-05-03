### 7.7 批处理实战案例

前面学习了批处理的核心技术、调度编排、性能优化、监控运维等理论知识。

如何将理论知识应用到实际项目？如何设计和实现完整的批处理系统？

**场景**：
```yaml
电商平台数据平台：

数据平台负责人："我们需要构建完整的批处理系统"

数据工程师："从哪里开始？"

架构师："先看一个完整的案例"

新工程师："有参考案例吗？"
```

**问题**：
- 如何设计批处理系统架构？
- 如何实现数据链路？
- 如何优化性能？
- 如何保证数据质量？
- 如何监控和运维？

**答案**：**通过电商数据仓库批处理系统案例，学习从需求分析、架构设计、系统实现、性能优化、监控运维的完整过程**

#### 一、项目背景

##### 1.1 业务需求

```yaml
业务场景：
  公司背景：
    - 中型电商平台
    - 日订单量：100万
    - 日活跃用户：50万
    - 数据增长：10TB/月
  
  业务痛点：
    - 数据分散在多个系统
    - 报表生成慢（2小时+）
    - 数据分析师等待时间长
    - 无法支持实时分析
  
  业务目标：
    - 统一数据平台
    - 报表生成时间<30分钟
    - 支持自助分析
    - 支持实时看板

技术需求：
  功能需求：
    - 数据采集：从MySQL、日志、API采集数据
    - 数据处理：ETL/ELT
    - 数据存储：数据仓库
    - 数据服务：API、BI工具
  
  非功能需求：
    - 性能：日报表30分钟内完成
    - 可靠性：99.9%可用性
    - 可扩展性：支持10倍数据增长
    - 成本：月成本<$10,000

数据需求：
  数据源：
    - 业务库（MySQL）：订单、用户、商品
    - 日志系统：用户行为日志
    - 第三方API：支付、物流
  
  数据产出：
    - 日报表：GMV、订单量、用户数
    - 用户分析：留存、复购、分层
    - 商品分析：销量、库存、转化
    - 营销分析：活动效果、ROI
```

##### 1.2 技术栈

```yaml
存储层：
  数据湖：
    - AWS S3
    - 格式：Parquet
    - 压缩：Snappy
    - 分区：按日期分区
  
  数据仓库：
    - AWS Redshift
    - 规模：10节点
    - 存储：500TB
    - 计算：320cores

计算层：
  批处理引擎：
    - Spark 3.5
    - 集群：20节点
    - 资源：640cores, 2TB内存
    - 最大并发：20个job
  
  调度系统：
    - Airflow 2.7
    - 集群：3节点（HA）
    - 数据库：PostgreSQL
    - Executor：Kubernetes

数据集成：
  CDC工具：
    - Debezium + Kafka
    - 捕获MySQL变更
    - 实时同步到S3
  
  批量同步：
    - Airbyte
    - 每小时同步
    - 增量同步

监控运维：
  监控：
    - Prometheus + Grafana
    - CloudWatch
    - Spark UI
  
  告警：
    - PagerDuty
    - Slack
    - Email
```

#### 二、架构设计

##### 2.1 整体架构

```text
┌─────────────────────────────────────────────────────┐
│                    数据源层                           │
├──────────────┬──────────────┬──────────────────────┤
│  MySQL       │  日志系统     │  第三方API            │
│  - 订单       │  - 用户行为   │  - 支付               │
│  - 用户       │  - 点击流     │  - 物流               │
│  - 商品       │  - 曝光       │                       │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       │ CDC          │ Flume            │ API
       │ Debezium     │                  │
       ↓              ↓                  ↓
┌─────────────────────────────────────────────────────┐
│                 消息队列层（Kafka）                   │
├──────────────┬──────────────┬──────────────────────┤
│  订单变更     │  用户行为     │  支付事件             │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       │              │                  │
       ↓              ↓                  ↓
┌─────────────────────────────────────────────────────┐
│                   数据湖层（S3）                      │
├──────────────┬──────────────┬──────────────────────┤
│  ODS层       │  DWD层       │  DWS/ADS层            │
│  原始数据     │  明细数据     │  汇总数据             │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       │              │                  │
       ↓              ↓                  ↓
┌─────────────────────────────────────────────────────┐
│                  计算层（Spark）                      │
├──────────────┬──────────────┬──────────────────────┤
│  批处理       │  流处理       │  即时查询             │
│  - Spark     │  - Flink     │  - Presto            │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       │              │                  │
       ↓              ↓                  ↓
┌─────────────────────────────────────────────────────┐
│                  数据仓库层（Redshift）                │
├──────────────┬──────────────┬──────────────────────┤
│  DWD层       │  DWS层       │  ADS层                │
│  事实表       │  汇总表       │  应用表               │
└──────┬───────┴──────┬───────┴──────────┬───────────┘
       │              │                  │
       │              │                  │
       ↓              ↓                  ↓
┌─────────────────────────────────────────────────────┐
│                   应用层                             │
├──────────────┬──────────────┬──────────────────────┤
│  BI工具       │  API服务     │  即时查询             │
│  - Tableau   │  - GraphQL   │  - Superset          │
│  - PowerBI   │              │                       │
└─────────────────────────────────────────────────────┘
```

##### 2.2 数据分层

```yaml
ODS层（Original Data Storage）：
  目的：
    - 原始数据备份
    - 数据溯源
  
  数据：
    - MySQL CDC数据
    - 原始日志
    - API快照
  
  格式：
    - JSON（原始）
    - 分区：dt/hour
  
  示例：
    s3://data-lake/ods/orders/dt=20260101/hour=04/
    s3://data-lake/ods/user_events/dt=20260101/hour=04/

DWD层（Data Warehouse Detail）：
  目的：
    - 数据清洗
    - 统一格式
    - 数据质量
  
  数据：
    - 事实表
    - 维度表
  
  格式：
    - Parquet
    - 压缩：Snappy
    - 分区：dt
  
  示例：
    s3://data-lake/dwd/fact_orders/dt=20260101/
    s3://data-lake/dwd/dim_users/
    s3://data-lake/dwd/dim_products/

DWS层（Data Warehouse Summary）：
  目的：
    - 数据汇总
    - 宽表
    - 预聚合
  
  数据：
    - 日汇总表
    - 主题宽表
  
  格式：
    - Parquet
    - 压缩：Snappy
    - 分区：dt
  
  示例：
    s3://data-lake/dws/dws_daily_gmv/dt=20260101/
    s3://data-lake/dws/dws_user_profile/dt=20260101/

ADS层（Application Data Service）：
  目的：
    - 应用数据
    - 业务指标
    - 报表数据
  
  数据：
    - 日报表
    - 分析表
  
  格式：
    - Parquet
    - Redshift表
  
  示例：
    s3://data-lake/ads/ads_daily_report/dt=20260101/
    redshift://ads.user_retention
```

#### 三、核心实现

##### 3.1 数据采集

```python
# CDC数据采集（Debezium + Kafka）

from kafka import KafkaProducer
import json
import psycopg2
from datetime import datetime

class CDCCollector:
    def __init__(self, config):
        self.kafka_producer = KafkaProducer(
            bootstrap_servers=config['kafka_servers'],
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        self.pg_conn = psycopg2.connect(
            host=config['pg_host'],
            database=config['pg_database'],
            user=config['pg_user'],
            password=config['pg_password']
        )
    
    def collect_orders(self):
        """采集订单变更"""
        cursor = self.pg_conn.cursor()
        
        # 使用逻辑槽
        cursor.execute("""
            SELECT * FROM pg_logical_slot_get_changes(
                'debezium_slot',
                NULL,
                NULL,
                '{"format-version": 2}'
            )
        """)
        
        for change in cursor:
            event = {
                'table': 'orders',
                'operation': change[2],  # INSERT/UPDATE/DELETE
                'data': change[3],
                'timestamp': datetime.now().isoformat()
            }
            
            # 发送到Kafka
            self.kafka_producer.send(
                'mysql-cdc-orders',
                value=event
            )
        
        self.kafka_producer.flush()
    
    def collect_users(self):
        """采集用户变更"""
        # 类似实现
        pass
```

```python
# 日志采集（Flume + Kafka）

# Flume配置文件：flume.conf
agent1.sources = src1
agent1.channels = ch1
agent1.sinks = sink1

# Source：监听日志文件
agent1.sources.src1.type = exec
agent1.sources.src1.command = tail -F /var/log/user_events.log
agent1.sources.src1.channels = ch1

# Channel：内存通道
agent1.channels.ch1.type = memory
agent1.channels.ch1.capacity = 10000
agent1.channels.ch1.transactionCapacity = 1000

# Sink：Kafka Sink
agent1.sinks.sink1.type = org.apache.flume.sink.kafka.KafkaSink
agent1.sinks.sink1.kafka.bootstrap.servers = kafka-broker1:9092,kafka-broker2:9092
agent1.sinks.sink1.kafka.topic = user-events
agent1.sinks.sink1.channel = ch1

# 启动Flume
# flume-ng agent -n agent1 -f conf/flume.conf
```

##### 3.2 数据处理

```python
# Spark批处理作业

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count, when
from datetime import datetime

class DailyBatchJob:
    def __init__(self):
        self.spark = SparkSession.builder \
            .appName("DailyBatchJob") \
            .config("spark.sql.shuffle.partitions", "400") \
            .config("spark.dynamicAllocation.enabled", "true") \
            .config("spark.dynamicAllocation.maxExecutors", "50") \
            .getOrCreate()
    
    def process_orders(self, dt):
        """处理订单数据"""
        # 读取ODS层数据
        orders = self.spark.read.parquet(
            f"s3://data-lake/ods/orders/dt={dt}"
        )
        
        # 数据清洗
        orders_clean = orders.filter(
            (col("status") == "completed") &
            (col("amount") > 0) &
            (col("user_id").isNotNull()) &
            (col("product_id").isNotNull())
        )
        
        # 关联维度
        users = self.spark.read.parquet("s3://data-lake/dwd/dim_users")
        products = self.spark.read.parquet("s3://data-lake/dwd/dim_products")
        
        orders_enriched = orders_clean \
            .join(users, "user_id", "left") \
            .join(products, "product_id", "left")
        
        # 写入DWD层
        orders_enriched.write \
            .mode("overwrite") \
            .parquet(f"s3://data-lake/dwd/fact_orders/dt={dt}")
        
        return orders_enriched
    
    def calculate_daily_gmv(self, dt):
        """计算每日GMV"""
        # 读取DWD层数据
        orders = self.spark.read.parquet(
            f"s3://data-lake/dwd/fact_orders/dt={dt}"
        )
        
        # 计算GMV
        daily_gmv = orders.groupBy("dt", "city", "category") \
            .agg(
                count("*").alias("order_count"),
                _sum("amount").alias("gmv"),
                _sum("amount") / count("*").alias("avg_order_amount"),
                count(distinct("user_id")).alias("user_count")
            )
        
        # 写入DWS层
        daily_gmv.write \
            .mode("overwrite") \
            .parquet(f"s3://data-lake/dws/dws_daily_gmv/dt={dt}")
        
        # 写入Redshift
        daily_gmv.write \
            .format("com.databricks.spark.redshift") \
            .option("url", "jdbc:redshift://redshift-cluster:5439/data_warehouse") \
            .option("dbtable", "dws.daily_gmv") \
            .option("tempdir", "s3://data-lake/temp/") \
            .mode("overwrite") \
            .save()
        
        return daily_gmv
    
    def calculate_user_retention(self, dt):
        """计算用户留存"""
        # 读取用户注册和登录数据
        user_registrations = self.spark.read.parquet(
            f"s3://data-lake/dwd/fact_user_registrations/dt={dt}"
        )
        
        user_logins = self.spark.read.parquet(
            f"s3://data-lake/dwd/fact_user_logins/dt={dt}"
        )
        
        # 计算次日留存
        from pyspark.sql.window import Window
        from pyspark.sql.functions import lag, datediff
        
        window_spec = Window.partitionBy("user_id").orderBy("dt")
        
        user_activity = user_logins.groupBy("user_id", "dt") \
            .agg(count("*").alias("login_count"))
        
        user_activity_with_lag = user_activity.withColumn(
            "prev_dt",
            lag("dt", 1).over(window_spec)
        )
        
        # 次日留存
        next_day_retention = user_activity_with_lag.filter(
            datediff("dt", "prev_dt") == 1
        ).agg(
            count("*").alias("retained_users"),
            count(distinct("user_id")).alias("total_users")
        ).withColumn(
            "retention_rate",
            col("retained_users") / col("total_users")
        )
        
        # 写入ADS层
        next_day_retention.withColumn("dt", lit(dt)) \
            .write \
            .mode("append") \
            .parquet(f"s3://data-lake/ads/ads_user_retention/dt={dt}")
        
        return next_day_retention

# 主程序
if __name__ == "__main__":
    import sys
    
    dt = sys.argv[1]  # 数据日期
    
    job = DailyBatchJob()
    
    # 处理订单
    job.process_orders(dt)
    
    # 计算GMV
    job.calculate_daily_gmv(dt)
    
    # 计算用户留存
    job.calculate_user_retention(dt)
    
    print(f"Batch job completed for {dt}")
```

##### 3.3 任务调度

```python
# Airflow DAG定义

from airflow import DAG
from airflow.operators.python import PythonOperator
from airflow.providers.apache.spark.operators.spark_submit import SparkSubmitOperator
from datetime import datetime, timedelta
from airflow.utils.dates import days_ago

default_args = {
    'owner': 'data-team',
    'depends_on_past': False,
    'start_date': days_ago(1),
    'email': ['data-team@example.com'],
    'email_on_failure': True,
    'email_on_retry': False,
    'retries': 2,
    'retry_delay': timedelta(minutes=5),
    'sla': timedelta(hours=1)
}

with DAG(
    'daily_data_pipeline',
    default_args=default_args,
    description='Daily data processing pipeline',
    schedule_interval='0 4 * * *',  # 每天凌晨4点
    catchup=False,
    tags=['daily', 'pipeline'],
    max_active_runs=1  # 同一时间只运行一个实例
) as dag:
    
    # 任务1：数据采集
    data_collection = BashOperator(
        task_id='data_collection',
        bash_command='python /opt/airflow/scripts/data_collection.py {{ ds }}'
    )
    
    # 任务2：数据质量检查
    data_quality_check = PythonOperator(
        task_id='data_quality_check',
        python_callable=check_data_quality,
        provide_context=True,
        op_kwargs={'dt': '{{ ds }}'}
    )
    
    # 任务3：处理订单数据
    process_orders = SparkSubmitOperator(
        task_id='process_orders',
        application='/opt/airflow/jobs/process_orders.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True,
        conf={
            'spark.executor.memory': '4g',
            'spark.executor.cores': '4',
            'spark.executor.instances': '20',
            'spark.dynamicAllocation.enabled': 'true',
            'spark.dynamicAllocation.maxExecutors': '50'
        }
    )
    
    # 任务4：计算GMV
    calculate_gmv = SparkSubmitOperator(
        task_id='calculate_gmv',
        application='/opt/airflow/jobs/calculate_gmv.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 任务5：计算用户留存
    calculate_retention = SparkSubmitOperator(
        task_id='calculate_retention',
        application='/opt/airflow/jobs/calculate_retention.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True
    )
    
    # 任务6：发送通知
    send_notification = PythonOperator(
        task_id='send_notification',
        python_callable=send_completion_notification,
        provide_context=True,
        op_kwargs={'dt': '{{ ds }}'},
        trigger_rule='all_success'
    )
    
    # 定义任务依赖
    data_collection >> data_quality_check >> process_orders
    process_orders >> [calculate_gmv, calculate_retention]
    [calculate_gmv, calculate_retention] >> send_notification
```

##### 3.4 数据质量监控

```python
# 数据质量检查

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, count, sum as _sum

class DataQualityChecker:
    def __init__(self):
        self.spark = SparkSession.builder \
            .appName("DataQualityCheck") \
            .getOrCreate()
    
    def check_orders(self, dt):
        """检查订单数据质量"""
        orders = self.spark.read.parquet(
            f"s3://data-lake/dwd/fact_orders/dt={dt}"
        )
        
        total = orders.count()
        
        # 检查1：空值率
        null_checks = orders.select(
            _sum(when(col("order_id").isNull(), 1).otherwise(0)).alias("null_order_id"),
            _sum(when(col("user_id").isNull(), 1).otherwise(0)).alias("null_user_id"),
            _sum(when(col("amount").isNull(), 1).otherwise(0)).alias("null_amount")
        ).first()
        
        null_order_id_ratio = null_checks[0] / total
        null_user_id_ratio = null_checks[1] / total
        null_amount_ratio = null_checks[2] / total
        
        # 检查2：金额范围
        amount_range = orders.agg(
            min("amount").alias("min_amount"),
            max("amount").alias("max_amount")
        ).first()
        
        # 检查3：重复记录
        duplicate_count = orders.count() - orders.dropDuplicates(["order_id"]).count()
        
        # 生成质量报告
        quality_report = {
            'dt': dt,
            'total_records': total,
            'null_order_id_ratio': null_order_id_ratio,
            'null_user_id_ratio': null_user_id_ratio,
            'null_amount_ratio': null_amount_ratio,
            'min_amount': amount_range[0],
            'max_amount': amount_range[1],
            'duplicate_count': duplicate_count,
            'quality_score': self._calculate_quality_score(
                null_order_id_ratio,
                null_user_id_ratio,
                null_amount_ratio,
                duplicate_count,
                total
            )
        }
        
        # 检查是否通过
        if quality_report['quality_score'] < 0.95:
            # 发送告警
            send_alert(f"Data quality issue detected for {dt}: {quality_report}")
            raise Exception(f"Data quality check failed: {quality_report}")
        
        return quality_report
    
    def _calculate_quality_score(self, null_order_id_ratio, null_user_id_ratio, 
                                 null_amount_ratio, duplicate_count, total):
        """计算质量分数"""
        score = 1.0
        
        # 空值扣分
        score -= null_order_id_ratio * 10
        score -= null_user_id_ratio * 5
        score -= null_amount_ratio * 5
        
        # 重复扣分
        score -= (duplicate_count / total) * 10
        
        return max(0, min(1, score))

# 在Airflow中使用
def check_data_quality(**context):
    dt = context['ds']
    
    checker = DataQualityChecker()
    
    # 检查订单数据
    orders_quality = checker.check_orders(dt)
    
    # 检查用户数据
    # users_quality = checker.check_users(dt)
    
    # 检查商品数据
    # products_quality = checker.check_products(dt)
    
    print(f"Data quality check passed for {dt}")
```

#### 四、性能优化

##### 4.1 数据倾斜处理

```python
# 处理用户行为数据倾斜

from pyspark.sql.functions import col, concat, lit, rand, regexp_replace
from pyspark.sql.functions import sum as _sum

class SkewOptimizer:
    def optimize_user_events(self, dt):
        """优化用户事件聚合（处理数据倾斜）"""
        
        # 读取数据
        events = self.spark.read.parquet(
            f"s3://data-lake/dwd/fact_user_events/dt={dt}"
        )
        
        # 识别倾斜的user_id（某些超级用户事件特别多）
        skewed_users = events.groupBy("user_id") \
            .count() \
            .filter(col("count") > 100000) \
            .select("user_id")
        
        # 分离倾斜和非倾斜数据
        skewed_events = events.join(skewed_users, "user_id", "inner")
        normal_events = events.join(skewed_users, "user_id", "left_anti")
        
        # 处理非倾斜数据（正常聚合）
        normal_aggregated = normal_events.groupBy("user_id", "event_type") \
            .agg(
                count("*").alias("event_count"),
                _sum("duration").alias("total_duration")
            )
        
        # 处理倾斜数据（使用随机前缀）
        skewed_with_salt = skewed_events.withColumn(
            "salt",
            (rand() * 10).cast("int")
        )
        
        skewed_aggregated_1 = skewed_with_salt \
            .groupBy("user_id", "event_type", "salt") \
            .agg(
                count("*").alias("event_count"),
                _sum("duration").alias("total_duration")
            )
        
        # 第二次聚合（去掉salt）
        skewed_aggregated_2 = skewed_aggregated_1 \
            .groupBy("user_id", "event_type") \
            .agg(
                _sum("event_count").alias("event_count"),
                _sum("total_duration").alias("total_duration")
            )
        
        # 合并结果
        final_result = normal_aggregated.union(skewed_aggregated_2)
        
        return final_result
```

##### 4.2 资源优化

```python
# 动态资源分配

spark = SparkSession.builder \
    .appName("OptimizedJob") \
    .config("spark.dynamicAllocation.enabled", "true") \
    .config("spark.dynamicAllocation.minExecutors", "10") \
    .config("spark.dynamicAllocation.maxExecutors", "50") \
    .config("spark.dynamicAllocation.initialExecutors", "20") \
    .config("spark.executor.memory", "8g") \
    .config("spark.executor.cores", "4") \
    .config("spark.sql.shuffle.partitions", "400") \
    .getOrCreate()
```

#### 五、监控告警

```python
# 监控指标收集

from prometheus_client import Counter, Histogram, Gauge
import time

# 定义监控指标
job_duration = Histogram('spark_job_duration_seconds', 'Spark job duration')
job_success = Counter('spark_job_success_total', 'Total successful jobs')
job_failure = Counter('spark_job_failure_total', 'Total failed jobs')
data_volume = Gauge('data_volume_bytes', 'Data volume processed')

class MonitoredBatchJob:
    @job_duration.time()
    def run_job(self, dt):
        try:
            # 运行批处理作业
            result = self.process_data(dt)
            
            # 记录成功
            job_success.inc()
            
            # 记录数据量
            data_volume.set(result['bytes_processed'])
            
            return result
            
        except Exception as e:
            # 记录失败
            job_failure.inc()
            raise e
```

#### 六、项目成果

##### 6.1 性能提升

```yaml
优化前：
  日报表生成时间：2小时
  数据延迟：4小时
  资源使用率：60%
  月成本：$15,000

优化后：
  日报表生成时间：20分钟（提升83%）
  数据延迟：30分钟（提升87%）
  资源使用率：85%（提升42%）
  月成本：$8,000（降低47%）

关键优化：
  1. 数据倾斜优化：提升50%性能
  2. 动态资源分配：降低40%成本
  3. 列式存储+压缩：节省60%存储
  4. 分区优化：提升30%查询性能
```

##### 6.2 业务价值

```yaml
数据分析师：
  - 报表等待时间：从2小时降到20分钟
  - 自助分析：支持Ad-hoc查询
  - 工作效率：提升200%

业务方：
  - 决策速度：从天级到小时级
  - 数据时效性：从T+4到T+1
  - 业务洞察：更及时、更准确

技术团队：
  - 系统稳定性：99.9%
  - 运维效率：自动化监控告警
  - 扩展性：支持10倍增长
```

#### 七、经验总结

##### 7.1 成功经验

```yaml
1. 分层架构
   - ODS → DWD → DWS → ADS
   - 职责清晰
   - 易于维护

2. 数据质量
   - 多维度检查
   - 自动化监控
   - 及时告警

3. 性能优化
   - 持续优化
   - 监控驱动
   - 数据倾斜处理

4. 成本控制
   - 动态资源分配
   - 数据生命周期管理
   - 错峰调度
```

##### 7.2 踩坑记录

```yaml
1. 数据倾斜
   问题：
     - 某些task运行30分钟+
   解决：
     - 识别倾斜key
     - 分离处理
     - 添加随机前缀

2. 小文件问题
   问题：
     - NameNode压力大
   解决：
     - 合理分区
     - 定期合并
     - 使用distribute by

3. OOM问题
   问题：
     - Executor频繁OOM
   解决：
     - 优化内存配置
     - 使用off-heap memory
     - 减少executor cores

4. SLA违约
   问题：
     - 任务超时
   解决：
     - 性能优化
     - 资源扩容
     - 优化调度逻辑
```

#### 八、小结

通过电商数据仓库批处理系统案例，学习了从需求分析、架构设计、系统实现、性能优化、监控运维的完整过程。

核心要点：
- 项目背景：业务需求、技术需求、数据需求
- 架构设计：整体架构、数据分层（ODS/DWD/DWS/ADS）
- 核心实现：数据采集（CDC、日志）、数据处理（Spark）、任务调度（Airflow）
- 数据质量：空值检查、重复检查、范围检查、质量评分
- 性能优化：数据倾斜处理、资源优化、动态分配
- 监控告警：指标采集、可视化、告警
- 项目成果：性能提升83%、成本降低47%、稳定性99.9%
- 经验总结：分层架构、数据质量、性能优化、成本控制

下一节将学习批处理系统设计，了解如何从零开始设计批处理系统架构。
