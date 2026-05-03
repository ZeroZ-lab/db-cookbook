### 7.9 批处理与流处理的融合

前面学习了批处理系统的设计和实现。

实际场景中，往往需要批处理和流处理结合使用。如何融合批处理和流处理？Lambda架构和Kappa架构如何选择？

**场景**：
```yaml
实时数据分析需求：

产品经理："我们需要实时看板"

数据工程师："需要流处理"

架构师："但是批处理也不能少"

CTO："如何结合批处理和流处理？"
```

**问题**：
- 为什么要融合批处理和流处理？
- Lambda架构是什么？
- Kappa架构是什么？
- 如何选择架构模式？
- 如何实现融合架构？

**答案**：**批处理与流处理的融合通过Lambda架构或Kappa架构实现，前者批流分离后者统一流处理，选择时需要权衡复杂度、实时性、成本等因素**

#### 一、为什么需要融合

##### 1.1 单一架构的局限

```yaml
纯批处理架构的局限：
  问题1：实时性差
    现象：
      - 数据延迟：小时级
      - 报表延迟：天级
    
    影响：
      - 无法支持实时决策
      - 错过市场机会
      - 用户体验差
    
    示例：
      电商大促：
        - 用户：现在看到的是昨天数据
        - 运营：无法实时调整策略
        - 损失：潜在GMV损失

  问题2：数据不完整
    现象：
      - 最新数据缺失
      - 分析不准确
    
    影响：
      - 判断偏差
      - 决策失误
    
    示例：
      风控场景：
        - 刷单行为：无法实时发现
        - 欺诈交易：延迟处理

  问题3：资源浪费
    现象：
      - 全量处理
      - 重复计算
    
    影响：
      - 成本高
      - 效率低
    
    示例：
      每日GMV：
        - 批处理：处理100年数据
        - 实际：只需今天数据

纯流处理架构的局限：
  问题1：准确性问题
    现象：
      - 乱序数据
      - 迟到数据
      - 窗口计算复杂
    
    影响：
      - 结果不准确
      - 需要修正
    
    示例：
      实时GMV：
        - 某些订单延迟到达
        - 结果偏低
        - 需要回溯修正

  问题2：容错性差
    现象：
      - 数据丢失
      - 恢复困难
    
    影响：
      - 数据不准确
      - 可靠性差
    
    示例：
      系统故障：
        - 流处理中断
        - 数据丢失
        - 无法恢复

  问题3：复杂计算困难
    现象：
      - 状态管理复杂
      - 内存压力大
    
    影响：
      - 应用受限
      - 性能差
    
    示例：
      复杂分析：
        - 同期群分析
        - 漏斗分析
        - 流处理难以实现
```

##### 1.2 融合架构的优势

```yaml
Lambda架构优势：
  优势1：准确性和实时性兼顾
    批处理层：
      - 处理全量数据
      - 保证准确性
      - 产出：精确视图
    
    流处理层：
      - 处理实时数据
      - 保证实时性
      - 产出：实时视图
    
    服务层：
      - 合并批处理和实时视图
      - 提供统一查询
      - 平衡准确和实时

  优势2：容错性强
    批处理层：
      - 数据可重跑
      - 容错性好
    
    流处理层：
      - 实时处理
      - 故障可恢复
    
    互补：
      - 流处理故障：降级到批处理
      - 批处理故障：流处理继续

  优势3：支持复杂计算
    批处理层：
      - 复杂算法
      - 全量计算
    
    流处理层：
      - 简单聚合
      - 实时计算
    
    分工：
      - 复杂分析：批处理
      - 实时监控：流处理

Kappa架构优势：
  优势1：架构简单
    统一流处理：
      - 只需要维护一套代码
      - 批处理和流处理统一
      - 降低复杂度
    
    示例：
      Lambda：2套代码（批处理+流处理）
      Kappa：1套代码（流处理）

  优势2：易于维护
    代码统一：
      - 修改一处
      - 批流同步
    
    示例：
      业务变更：
        Lambda：修改2套代码
        Kappa：修改1套代码

  优势3：资源效率高
    资源复用：
      - 同一集群
      - 资源共享
    
    示例：
      Lambda：批处理集群 + 流处理集群
      Kappa：流处理集群（批处理也是流处理）

选择建议：
  选择Lambda：
    - 准确性要求高
    - 复杂计算多
    - 团队熟悉批处理
  
  选择Kappa：
    - 实时性要求高
    - 架构简单优先
    - 团队熟悉流处理
```

#### 二、Lambda架构

##### 2.1 架构组成

```yaml
三层架构：
  Batch Layer（批处理层）：
    功能：
      - 处理全量数据
      - 复杂计算
      - 批量视图
    
    特点：
      - 数据：全量历史数据
      - 计算：定期批量处理
      - 输出：批处理视图
    
    技术：
      - 存储：HDFS、S3
      - 计算：Spark、Hive
      - 调度：Airflow
    
    示例：
      每日GMV批处理：
        输入：全量订单数据
        处理：Spark计算
        输出：每日GMV表

  Speed Layer（加速层）：
    功能：
      - 处理实时数据
      - 实时计算
      - 实时视图
    
    特点：
      - 数据：增量实时数据
      - 计算：流式处理
      - 输出：实时视图
    
    技术：
      - 消息：Kafka
      - 计算：Flink、Spark Streaming
      - 存储：Redis、Cassandra
    
    示例：
      实时GMV计算：
        输入：Kafka订单流
        处理：Flink实时聚合
        输出：实时GMV（Redis）

  Serving Layer（服务层）：
    功能：
      - 合并批处理和实时视图
      - 提供查询服务
      - 统一数据访问
    
    特点：
      - 数据：合并视图
      - 查询：低延迟
      - 服务：API/SQL
    
    技术：
      - 存储：Cassandra、HBase
      - 查询：Druid、ClickHouse
      - API：GraphQL、REST
    
    示例：
      GMV查询：
        批处理视图：每日GMV（历史）
        实时视图：实时GMV增量（今天）
        合并：历史GMV + 实时GMV = 完整GMV
```

##### 2.2 数据流

```text
┌─────────────────────────────────────────────────────┐
│                     数据源                           │
│  MySQL、日志、API                                     │
└────────────┬────────────────────────────────────────┘
             │
             ├─────────────┬─────────────┐
             │             │             │
             ↓             ↓             ↓
       ┌──────────┐  ┌──────────┐  ┌──────────┐
       │  新数据   │  │  新数据   │  │  新数据   │
       └─────┬────┘  └─────┬────┘  └─────┬────┘
             │             │             │
             ↓             │             │
       ┌──────────┐       │             │
       │   Kafka   │───────┴─────────────┘
       └─────┬────┘
             │
     ┌───────┴────────┐
     │                │
     ↓                ↓
┌──────────────┐  ┌──────────────┐
│  Batch Layer  │  │  Speed Layer  │
│              │  │              │
│  - 全量数据  │  │  - 实时数据  │
│  - Spark     │  │  - Flink     │
│  - 批处理   │  │  - 流处理   │
│  - 批视图   │  │  - 实时视图  │
└──────┬───────┘  └──────┬───────┘
       │                │
       │                │
       └────────┬───────┘
                ↓
         ┌──────────────┐
         │Serving Layer  │
         │              │
         │  - 合并视图  │
         │  - Cassandra │
         │  - 查询服务  │
         └──────┬───────┘
                │
                ↓
         ┌──────────────┐
         │   应用层     │
         │  - BI工具    │
         │  - API       │
         │  - Dashboard │
         └──────────────┘
```

##### 2.3 实现示例

```python
# Batch Layer：Spark批处理

from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count

class BatchLayer:
    def __init__(self):
        self.spark = SparkSession.builder \
            .appName("BatchLayer") \
            .getOrCreate()
    
    def process_daily_gmv(self, dt):
        """批处理：计算每日GMV"""
        # 读取全量数据
        orders = self.spark.read.parquet(
            "s3://data-lake/batch/fact_orders"
        ).filter(col("dt") <= dt)
        
        # 计算历史GMV
        historical_gmv = orders.groupBy("dt") \
            .agg(
                count("*").alias("order_count"),
                _sum("amount").alias("gmv")
            )
        
        # 写入批处理视图
        historical_gmv.write \
            .mode("overwrite") \
            .parquet(f"s3://data-lake/batch/views/daily_gmv")
        
        return historical_gmv

# Speed Layer：Flink流处理

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment

class SpeedLayer:
    def __init__(self):
        env = StreamExecutionEnvironment.get_execution_environment()
        self.table_env = StreamTableEnvironment.create(env)
    
    def process_realtime_gmv(self):
        """流处理：实时计算GMV增量"""
        # 创建Kafka源表
        self.table_env.execute_sql("""
            CREATE TABLE orders_kafka (
                order_id BIGINT,
                user_id BIGINT,
                amount DECIMAL(10, 2),
                event_time TIMESTAMP(3),
                WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
            ) WITH (
                'connector' = 'kafka',
                'topic' = 'orders',
                'properties.bootstrap.servers' = 'kafka:9092',
                'format' = 'json'
            )
        """)
        
        # 创建Redis结果表
        self.table_env.execute_sql("""
            CREATE TABLE realtime_gmv (
                dt STRING,
                gmv DECIMAL(20, 2),
                order_count BIGINT
            ) WITH (
                'connector' = 'redis',
                'mode' = 'single',
                'host' = 'redis',
                'port' = '6379'
            )
        """)
        
        # 实时聚合
        self.table_env.execute_sql("""
            INSERT INTO realtime_gmv
            SELECT 
                DATE_FORMAT(event_time, 'yyyyMMdd') as dt,
                SUM(amount) as gmv,
                COUNT(*) as order_count
            FROM orders_kafka
            GROUP BY DATE_FORMAT(event_time, 'yyyyMMdd')
        """)

# Serving Layer：合并查询

import redis
import psycopg2

class ServingLayer:
    def __init__(self):
        self.redis_client = redis.Redis(host='redis', port=6379)
        self.pg_conn = psycopg2.connect(
            host='postgres',
            database='data_warehouse',
            user='postgres',
            password='password'
        )
    
    def get_gmv(self, dt):
        """获取完整GMV（批处理+实时）"""
        # 1. 从批处理视图获取历史GMV
        cursor = self.pg_conn.cursor()
        cursor.execute("""
            SELECT dt, gmv, order_count
            FROM batch_daily_gmv
            WHERE dt < %s
        """, (dt,))
        
        historical_gmv = {}
        for row in cursor.fetchall():
            historical_gmv[row[0]] = {
                'gmv': float(row[1]),
                'order_count': row[2]
            }
        
        # 2. 从Redis获取实时GMV
        realtime_key = f"realtime_gmv:{dt}"
        realtime_data = self.redis_client.hgetall(realtime_key)
        
        realtime_gmv = {
            'dt': dt,
            'gmv': float(realtime_data.get(b'gmv', 0)),
            'order_count': int(realtime_data.get(b'order_count', 0))
        }
        
        # 3. 合并结果
        if dt in historical_gmv:
            # 如果批处理已有当天数据，用实时更新
            historical_gmv[dt] = realtime_gmv
        else:
            # 如果批处理没有，添加实时数据
            historical_gmv[dt] = realtime_gmv
        
        return historical_gmv
```

#### 三、Kappa架构

##### 3.1 架构设计

```yaml
核心思想：
  统一流处理：
    - 批处理是特殊的流处理
    - 有界流 = 批处理
    - 无界流 = 流处理
  
  设计：
    - 只有流处理层
    - 批处理作为流处理的一种
    - 通过重放消息队列实现批处理

架构组成：
  消息队列：
    功能：
      - 数据缓存
      - 数据回放
      - 数据分发
    
    特点：
      - 长期保留（数天/数周）
      - 支持回放
      - 高吞吐
    
    技术：
      - Kafka（推荐）
      - Pulsar
    
    示例：
      Kafka：
        - 保留7天数据
        - 支持offset回放
        - 批处理：从最早offset消费
        - 流处理：从最新offset消费

  流处理层：
    功能：
      - 统一流处理
      - 批处理和流处理
      - 实时和批量
    
    特点：
      - 统一API
      - 统一代码
      - 统一部署
    
    技术：
      - Flink（推荐）
      - Spark Streaming
    
    示例：
      Flink：
        - 流处理：实时模式
        - 批处理：批处理模式（bounded stream）
        - 同一套代码

  服务层：
    功能：
      - 存储流处理结果
      - 提供查询服务
    
    特点：
      - 实时更新
      - 低延迟查询
    
    技术：
      - Elasticsearch
      - ClickHouse
      - Redis
```

##### 3.2 数据流

```text
┌─────────────────────────────────────────────────────┐
│                     数据源                           │
│  MySQL、日志、API                                     │
└────────────┬────────────────────────────────────────┘
             │
             ↓
       ┌──────────┐
       │   Kafka   │  ← 保留7天数据，支持回放
       └─────┬────┘
             │
     ┌───────┴────────┐
     │                │
     ↓                ↓
┌──────────────────────────────┐
│      统一流处理层（Flink）     │
│                              │
│  流处理模式：                 │
│  - 从最新offset消费           │
│  - 实时处理                   │
│  - 低延迟输出                 │
│                              │
│  批处理模式：                 │
│  - 从最早offset消费           │
│  - 批量处理                   │
│  - 全量计算                   │
└────────────┬─────────────────┘
             │
             ↓
         ┌──────────┐
         │服务层    │
         │- ES      │
         │- ClickHouse
         └──────┬────┘
                │
                ↓
         ┌──────────┐
         │   应用层  │
         └──────────┘
```

##### 3.3 实现示例

```python
# 统一流处理：Flink

from pyflink.datastream import StreamExecutionEnvironment
from pyflink.table import StreamTableEnvironment, EnvironmentSettings

class UnifiedStreamProcessor:
    def __init__(self, mode='streaming'):
        """
        mode:
          - streaming: 流处理模式（实时）
          - batch: 批处理模式（批量）
        """
        # 创建执行环境
        env_settings = EnvironmentSettings.new_instance() \
            .in_streaming_mode() \
            .build()
        
        self.env = StreamExecutionEnvironment.get_execution_environment()
        self.table_env = StreamTableEnvironment.create(
            self.env, 
            settings=env_settings
        )
        
        self.mode = mode
    
    def create_source_table(self):
        """创建源表"""
        if self.mode == 'streaming':
            # 流处理模式：从最新offset消费
            scan_startup_mode = 'latest'
        else:
            # 批处理模式：从最早offset消费
            scan_startup_mode = 'earliest-offset'
        
        self.table_env.execute_sql(f"""
            CREATE TABLE orders_kafka (
                order_id BIGINT,
                user_id BIGINT,
                amount DECIMAL(10, 2),
                event_time TIMESTAMP(3),
                WATERMARK FOR event_time AS event_time - INTERVAL '5' SECOND
            ) WITH (
                'connector' = 'kafka',
                'topic' = 'orders',
                'properties.bootstrap.servers' = 'kafka:9092',
                'properties.group.id' = 'gmv-calculator-{self.mode}',
                'scan.startup.mode' = '{scan_startup_mode}',
                'format' = 'json'
            )
        """)
    
    def create_sink_table(self):
        """创建结果表"""
        if self.mode == 'streaming':
            # 流处理：写入Redis（实时更新）
            sink_connector = """
                'connector' = 'redis',
                'mode' = 'single',
                'host' = 'redis',
                'port' = '6379'
            """
        else:
            # 批处理：写入ClickHouse（批量更新）
            sink_connector = """
                'connector' = 'clickhouse',
                'url' = 'clickhouse:8123',
                'database' = 'analytics',
                'table' = 'daily_gmv'
            """
        
        self.table_env.execute_sql(f"""
            CREATE TABLE daily_gmv_result (
                dt STRING,
                gmv DECIMAL(20, 2),
                order_count BIGINT,
                PRIMARY KEY (dt) NOT ENFORCED
            ) WITH (
                {sink_connector}
            )
        """)
    
    def process(self):
        """流/批处理：计算GMV"""
        self.create_source_table()
        self.create_sink_table()
        
        # 统一的SQL逻辑（批流一体）
        self.table_env.execute_sql("""
            INSERT INTO daily_gmv_result
            SELECT 
                DATE_FORMAT(event_time, 'yyyyMMdd') as dt,
                SUM(amount) as gmv,
                COUNT(*) as order_count
            FROM orders_kafka
            GROUP BY DATE_FORMAT(event_time, 'yyyyMMdd')
        """)

# 使用示例

# 流处理模式：实时计算
stream_processor = UnifiedStreamProcessor(mode='streaming')
stream_processor.process()

# 批处理模式：批量计算（如需要重新计算）
batch_processor = UnifiedStreamProcessor(mode='batch')
batch_processor.process()
```

#### 四、架构对比与选择

##### 4.1 详细对比

```yaml
复杂度：
  Lambda架构：
    代码复杂：
      - 两套代码（批处理+流处理）
      - 逻辑可能不一致
      - 维护成本高
    
    架构复杂：
      - 三个层次
      - 数据合并复杂
      - 调试困难
  
  Kappa架构：
    代码简单：
      - 一套代码
      - 逻辑一致
      - 维护成本低
    
    架构简单：
      - 一个层次
      - 无需合并
      - 易于调试

准确性：
  Lambda架构：
    批处理保证准确：
      - 全量处理
      - 结果精确
    
    流处理保证实时：
      - 增量处理
      - 结果快速
    
    合并结果：
      - 历史准确
      - 实时快速
  
  Kappa架构：
    流处理保证：
      - 实时性好
      - 准确性略差
    
    重放修正：
      - 可以回放重算
      - 但需要时间

容错性：
  Lambda架构：
    批处理容错：
      - 可重跑
      - 容错性好
    
    流处理容错：
      - checkpoint
      - 容错性一般
    
    整体容错：
      - 层间容错
      - 容错性强
  
  Kappa架构：
    统一容错：
      - checkpoint
      - 状态恢复
      - 容错性好

成本：
  Lambda架构：
    硬件成本：
      - 两套集群
      - 成本高
    
    开发成本：
      - 两套代码
      - 开发成本高
    
  Kappa架构：
    硬件成本：
      - 一套集群
      - 成本低
    
    开发成本：
      - 一套代码
      - 开发成本低
```

##### 4.2 选择决策树

```yaml
问题1：实时性要求
  实时性要求极高（秒级）：
    → Kappa架构
    原因：流处理天然实时
  
  实时性要求中等（分钟级）：
    → Lambda架构
    原因：批处理保证准确，流处理补充实时
  
  实时性要求低（小时级）：
    → 纯批处理
    原因：无需流处理

问题2：准确性要求
  准确性要求极高（财务、合规）：
    → Lambda架构
    原因：批处理保证准确性
  
  准确性要求一般（监控、分析）：
    → Kappa架构
    原因：流处理足够准确

问题3：计算复杂度
  复杂计算（机器学习、图计算）：
    → Lambda架构
    原因：批处理擅长复杂计算
  
  简单聚合（求和、计数）：
    → Kappa架构
    原因：流处理足够

问题4：团队能力
    团队熟悉批处理：
    → Lambda架构
  
  团队熟悉流处理：
    → Kappa架构
  
  团队新手：
    → 现代数据栈（简化版Lambda）

问题5：成本约束
  成本敏感：
    → Kappa架构
    原因：一套集群
  
  成本不敏感：
    → Lambda架构
    原因：功能更强大
```

#### 五、实战建议

##### 5.1 Lambda架构实践

```yaml
建议1：批处理为主，流处理为辅
  场景：
    - 实时性要求不高
    - 准确性要求高
  
  实现：
    - 核心业务：批处理
    - 监控告警：流处理

建议2：代码复用
  问题：
    - 批处理和流处理逻辑重复
  
  解决：
    - 抽取公共逻辑
    - 使用统一API
    - 测试一致性

建议3：数据一致性
  问题：
    - 批处理和流处理结果不一致
  
  解决：
    - 定期对比
    - 以批处理为准
    - 流处理仅作参考
```

##### 5.2 Kappa架构实践

```yaml
建议1：消息队列长期保留
  原因：
    - 支持回放
    - 批处理重算
  
  实现：
    - Kafka保留7-30天
    - 足够存储空间

建议2：完善的监控
  原因：
    - 流处理故障影响大
  
  实现：
    - 实时监控
    - 及时告警
    - 快速恢复

建议3：幂等性设计
  原因：
    - 可能重复消费
  
  实现：
    - 使用主键
    - UPSERT操作
    - 去重逻辑
```

#### 六、小结

批处理与流处理的融合通过Lambda架构或Kappa架构实现。

核心要点：
- 为什么融合：单一架构有局限，融合兼顾准确性和实时性
- Lambda架构：Batch Layer + Speed Layer + Serving Layer，批流分离，准确性和实时性兼顾
- Kappa架构：统一流处理，批处理是特殊的流处理，架构简单
- 架构对比：复杂度、准确性、容错性、成本各有优劣
- 选择建议：根据实时性、准确性、计算复杂度、团队能力、成本选择
- 实践建议：Lambda以批为主流为辅、代码复用、数据一致性；Kappa消息队列长期保留、完善监控、幂等性设计

下一节将学习批处理最佳实践总结，汇总批处理系统的经验和教训。
