### 7.3 批处理核心技术

上一节学习了批处理的应用场景，了解了批处理在数据仓库、机器学习、日志分析等领域的应用。

如何实现批处理系统？需要掌握哪些核心技术？

**场景**：
```yaml
数据平台建设：

架构师："我们需要构建批处理系统"

数据工程师："应该使用什么技术？"

新工程师："Hadoop、Spark、Flink，应该选哪个？"

资深工程师："需要了解各种技术的特点"
```

**问题**：
- 批处理有哪些核心技术？
- Hadoop、Spark、Flink有什么区别？
- 如何选择合适的技术？
- 如何设计批处理任务？

**答案**：**批处理核心技术包括分布式存储（HDFS、S3）、分布式计算框架（MapReduce、Spark）、资源调度（YARN、Kubernetes），选择时需要考虑性能、成本、复杂度**

#### 一、分布式存储

##### 1.1 HDFS（Hadoop Distributed File System）

**特点**：
```yaml
设计思想：
  - 存储超大文件
  - 流式数据访问
  - 商品硬件
  
核心特性：
  - 高容错性：数据副本（默认3副本）
  - 高吞吐量：批量数据处理
  - 横向扩展：增加节点即可扩展
  
架构：
  NameNode：
    - 管理文件系统元数据
    - 管理数据块映射
    - 单点故障（需要HA）
  
  DataNode：
    - 存储实际数据块
    - 处理读写请求
    - 向NameNode汇报状态
  
  SecondaryNameNode：
    - 定期合并FsImage和EditLog
    - 不是NameNode的热备
```

**示例**：
```bash
# 查看HDFS文件
hdfs dfs -ls /data/warehouse/

# 上传文件到HDFS
hdfs dfs -put local_file.csv /data/warehouse/

# 从HDFS下载文件
hdfs dfs -get /data/warehouse/result.csv local_result.csv

# 查看文件内容
hdfs dfs -cat /data/warehouse/file.txt

# 删除文件
hdfs dfs -rm /data/warehouse/old_file.csv
```

**适用场景**：
```yaml
适合：
  - 超大文件（TB、PB级）
  - 批量处理
  - 离线分析
  
不适合：
  - 大量小文件
  - 低延迟访问
  - 随机写入
```

##### 1.2 对象存储（S3、OSS）

**特点**：
```yaml
对比HDFS：
  存储方式：
    HDFS：数据块（Block）
    S3：对象（Object）
  
  访问方式：
    HDFS：HDFS API
    S3：REST API
  
  元数据：
    HDFS：NameNode集中管理
    S3：元数据和数据一起存储
  
  成本：
    HDFS：需要自己维护集群
    S3：按使用量付费
  
优势：
  - 无限扩展
  - 高可用性
  - 成本相对较低
  - 简单易用
  
劣势：
  - 一致性模型（最终一致性）
  - 列出文件性能较差
```

**示例**：
```python
# 使用AWS S3
import boto3

s3 = boto3.client('s3')

# 上传文件
s3.upload_file('local_file.csv', 'my-bucket', 'data/file.csv')

# 下载文件
s3.download_file('my-bucket', 'data/file.csv', 'local_file.csv')

# 列出文件
response = s3.list_objects_v2(Bucket='my-bucket', Prefix='data/')
for obj in response.get('Contents', []):
    print(obj['Key'])

# 删除文件
s3.delete_object(Bucket='my-bucket', Key='data/file.csv')
```

**适用场景**：
```yaml
适合：
  - 数据湖
  - 备份归档
  - 非结构化数据
  
不适合：
  - 高频访问（成本高）
  - 需要强一致性
```

#### 二、分布式计算框架

##### 2.1 MapReduce

**原理**：
```yaml
计算模型：
  Map阶段：
    - 输入：键值对（K1, V1）
    - 处理：map函数
    - 输出：键值对（K2, V2）
  
  Shuffle阶段：
    - 按键分组
    - 数据排序
    - 数据传输
  
  Reduce阶段：
    - 输入：键值对列表（K2, [V2]）
    - 处理：reduce函数
    - 输出：键值对（K3, V3）

示例：WordCount
  输入：
    ["hello world", "hello spark"]
  
  Map输出：
    [("hello", 1), ("world", 1), ("hello", 1), ("spark", 1)]
  
  Shuffle后：
    [("hello", [1, 1]), ("world", [1]), ("spark", [1])]
  
  Reduce输出：
    [("hello", 2), ("world", 1), ("spark", 1)]
```

**代码示例**：
```java
public class WordCount {

  public static class TokenizerMapper 
      extends Mapper<Object, Text, Text, IntWritable>{
    
    private final static IntWritable one = new IntWritable(1);
    private Text word = new Text();
    
    public void map(Object key, Text value, Context context
                    ) throws IOException, InterruptedException {
      StringTokenizer itr = new StringTokenizer(value.toString());
      while (itr.hasMoreTokens()) {
        word.set(itr.nextToken());
        context.write(word, one);
      }
    }
  }

  public static class IntSumReducer 
      extends Reducer<Text,IntWritable,Text,IntWritable> {
    
    private IntWritable result = new IntWritable();
    
    public void reduce(Text key, Iterable<IntWritable> values, 
                        Context context
                        ) throws IOException, InterruptedException {
      int sum = 0;
      for (IntWritable val : values) {
        sum += val.get();
      }
      result.set(sum);
      context.write(key, result);
    }
  }

  public static void main(String[] args) throws Exception {
    Configuration conf = new Configuration();
    Job job = Job.getInstance(conf, "word count");
    job.setJarByClass(WordCount.class);
    job.setMapperClass(TokenizerMapper.class);
    job.setCombinerClass(IntSumReducer.class);
    job.setReducerClass(IntSumReducer.class);
    job.setOutputKeyClass(Text.class);
    job.setOutputValueClass(IntWritable.class);
    FileInputFormat.addInputPath(job, new Path(args[0]));
    FileOutputFormat.setOutputPath(job, new Path(args[1]));
    System.exit(job.waitForCompletion(true) ? 0 : 1);
  }
}
```

**优点**：
```yaml
优势：
  - 高容错性
  - 高扩展性
  - 适合批处理
  
劣势：
  - 编程复杂
  - 性能相对较低
  - 磁盘IO多
```

##### 2.2 Spark

**核心概念**：
```yaml
RDD（Resilient Distributed Dataset）：
  特性：
    - 弹性：自动容错
    - 分布式：数据分布在不同节点
    - 不可变：创建后不能修改
  
  操作：
    Transformation（转换）：
      - 惰性执行
      - 生成新的RDD
      - 示例：map、filter、flatMap、reduceByKey
    
    Action（动作）：
      - 立即执行
      - 返回结果
      - 示例：collect、count、saveAsTextFile

DataFrame：
  特性：
    - 结构化数据
    - 类似关系表
    - 优化执行计划
  
  优势：
    - 比RDD性能更好
    - SQL支持
    - 自动优化

Dataset：
  特性：
    - 类型安全
    - DataFrame + 类型信息
    - Scala/Java友好
```

**示例**：
```python
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, sum as _sum, count

# 创建SparkSession
spark = SparkSession.builder \
    .appName("BatchProcessing") \
    .getOrCreate()

# 读取数据
orders = spark.read.csv("hdfs://data/orders.csv", 
                        header=True, 
                        inferSchema=True)

# 转换操作
filtered_orders = orders.filter(col("status") == "completed")

# 聚合操作
daily_gmv = filtered_orders.groupBy("date_id") \
    .agg(
        _sum("amount").alias("gmv"),
        count("*").alias("order_count")
    )

# 动作：保存结果
daily_gmv.write.csv("hdfs://output/daily_gmv", 
                    mode="overwrite",
                    header=True)

# SQL查询
orders.createOrReplaceTempView("orders")
result = spark.sql("""
    SELECT 
        date_id,
        SUM(amount) as gmv,
        COUNT(*) as order_count
    FROM orders
    WHERE status = 'completed'
    GROUP BY date_id
""")

result.show()
```

**Spark vs MapReduce**：
```yaml
性能：
  MapReduce：
    - 磁盘IO多
    - 慢
  
  Spark：
    - 内存计算
    - 快10-100倍

易用性：
  MapReduce：
    - 代码冗长
    - 难以维护
  
  Spark：
    - 代码简洁
    - 支持SQL、Python、Scala、R

通用性：
  MapReduce：
    - 只适合批处理
  
  Spark：
    - 批处理
    - 流处理（Spark Streaming）
    - 机器学习（MLlib）
    - 图计算（GraphX）
```

##### 2.3 Hive

**特点**：
```yaml
定义：
  - 构建在Hadoop上的数据仓库
  - SQL-like查询语言（HQL）
  - 将SQL转换为MapReduce/Tez/Spark

架构：
  用户接口：
    - CLI（命令行）
    - JDBC/ODBC
    - WebUI
  
  元数据存储：
    - Metastore（默认使用Derby，生产用MySQL）
  
  执行引擎：
    - MapReduce（慢）
    - Tez（中）
    - Spark（快）
```

**示例**：
```sql
-- 创建表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    amount DECIMAL(10, 2),
    status STRING,
    created_at TIMESTAMP
)
PARTITIONED BY (dt STRING)
STORED AS ORC;

-- 加载数据
LOAD DATA INPATH '/data/orders/20260101' 
INTO TABLE orders 
PARTITION (dt='20260101');

-- 查询数据
SELECT 
    dt,
    SUM(amount) as gmv,
    COUNT(*) as order_count
FROM orders
WHERE status = 'completed'
GROUP BY dt;

-- 创建视图
CREATE VIEW daily_gmv AS
SELECT 
    dt,
    SUM(amount) as gmv,
    COUNT(*) as order_count
FROM orders
WHERE status = 'completed'
GROUP BY dt;
```

**适用场景**：
```yaml
适合：
  - SQL分析师
  - 不想写代码
  - 对延迟不敏感
  
不适合：
  - 低延迟查询
  - 复杂的非SQL逻辑
```

#### 三、资源调度

##### 3.1 YARN（Yet Another Resource Negotiator）

**架构**：
```yaml
ResourceManager：
  功能：
    - 全局资源管理
    - 任务调度
    - 资源分配
  
  组件：
    Scheduler：
      - 纯调度器
      - 不负责任务监控
      - 支持容量调度、公平调度
    
    ApplicationsManager（ASM）：
      - 管理ApplicationMaster
      - 任务重启

NodeManager：
  功能：
    - 管理单个节点资源
    - 向ResourceManager汇报
    - 处理Container请求

ApplicationMaster：
  功能：
    - 管理单个应用
    - 向ResourceManager申请资源
    - 和NodeManager协作
```

**调度策略**：
```yaml
FIFO Scheduler（先进先出）：
  原理：
    - 按提交顺序执行
    - 简单但效率低
  
  适合：
    - 简单场景

Capacity Scheduler（容量调度）：
  原理：
    - 划分资源队列
    - 每个队列保证资源
    - 队列间资源共享
  
  示例：
    队列：
      - prod：70%
      - dev：30%
  
  适合：
    - 多租户环境

Fair Scheduler（公平调度）：
  原理：
    - 所有应用平均分配资源
    - 动态调整
  
  适合：
    - 多用户共享集群
```

##### 3.2 Kubernetes

**对比YARN**：
```yaml
通用性：
  YARN：
    - 专为大数据设计
    - 与Hadoop生态集成
  
  Kubernetes：
    - 通用容器编排
    - 支持多种工作负载

资源管理：
  YARN：
    - 基于队列
    - 资源抽象：Container
  
  Kubernetes：
    - 基于Pod/Node
    - 资源抽象：Pod、Deployment

部署：
  YARN：
    - 复杂
    - 需要Hadoop
  
  Kubernetes：
    - 标准化
    - 云原生
```

**示例**：
```yaml
# Spark on Kubernetes
apiVersion: sparkoperator.k8s.io/v1beta2
kind: SparkApplication
metadata:
  name: spark-pi
  namespace: default
spec:
  type: Python
  pythonVersion: "3"
  mode: cluster
  image: ghcr.io/my-project/spark:latest
  imagePullPolicy: Always
  mainApplicationFile: local:///app/pi.py
  sparkVersion: "3.5.0"
  restartPolicy: OnFailure
  driver:
    cores: 1
    coreLimit: "1200m"
    memory: "512m"
    serviceAccount: spark
  executor:
    cores: 1
    instances: 2
    memory: "512m"
    coresLimit: "1200m"
```

#### 四、技术选型

##### 4.1 存储选型

```yaml
HDFS：
  选择场景：
    - 已有Hadoop集群
    - 需要数据本地性优化
    - 成本敏感
  
  不选场景：
    - 大量小文件
    - 需要低延迟

对象存储（S3/OSS）：
  选择场景：
    - 数据湖架构
    - 需要无限扩展
    - 不想运维存储
  
  不选场景：
    - 高频访问（成本高）
    - 需要强一致性

混合存储：
  热数据：HDFS（高性能）
  冷数据：S3（低成本）
```

##### 4.2 计算框架选型

```yaml
MapReduce：
  选择场景：
    - 已有Hadoop生态
    - 超大规模批处理
    - 成本敏感
  
  不选场景：
    - 需要高性能
    - 需要低延迟

Spark：
  选择场景：
    - 需要高性能
    - 需要多种计算（批处理、流处理、ML）
    - 团队熟悉Python/SQL
  
  不选场景：
    - 超大规模（PB级）一次性批处理
    - 内存不足

Hive：
  选择场景：
    - SQL分析师
    - 不想写复杂代码
    - 对延迟不敏感
  
  不选场景：
    - 需要低延迟
    - 需要复杂逻辑

Presto/Trino：
  选择场景：
    - 交互式查询
    - 需要低延迟
    - 联邦查询
  
  不选场景：
    - 大规模ETL（不如Spark）
```

##### 4.3 调度选型

```yaml
YARN：
  选择场景：
    - 已有Hadoop集群
    - Hadoop生态集成
  
  不选场景：
    - 非Hadoop工作负载

Kubernetes：
  选择场景：
    - 云原生架构
    - 混合工作负载
    - 容器化应用
  
  不选场景：
    - 纯Hadoop生态
```

#### 五、技术栈组合

##### 5.1 传统Hadoop栈

```yaml
组合：
  存储：HDFS
  计算：MapReduce / Hive
  调度：YARN
  调度工具：Oozie / Azkaban

优势：
  - 成熟稳定
  - 生态完善
  - 成本较低

劣势：
  - 性能一般
  - 复杂度高
  - 维护成本高

适合：
  - 传统企业
  - 成本敏感
  - 已有Hadoop团队
```

##### 5.2 现代批处理栈

```yaml
组合：
  存储：S3/OSS
  计算：Spark / Hive
  调度：Kubernetes
  调度工具：Airflow

优势：
  - 性能好
  - 易扩展
  - 云原生

劣势：
  - 成本较高
  - 需要云平台

适合：
  - 互联网公司
  - 云原生架构
  - 快速迭代
```

##### 5.3 混合栈

```yaml
组合：
  存储：HDFS + S3
  计算：Spark + Hive
  调度：YARN + Kubernetes
  调度工具：Airflow

优势：
  - 灵活性高
  - 成本和性能平衡

劣势：
  - 复杂度高

适合：
  - 大型企业
  - 多样化需求
```

#### 六、常见误区

**误区一：批处理必须用Hadoop**

- **说明**：批处理工具很多
- **后果**：过度依赖Hadoop
- **正确理解**：
  - Spark更主流
  - 云平台有托管服务
  - 根据场景选择

**误区二：MapReduce过时了**

- **说明**：MapReduce仍有价值
- **后果**：忽略MapReduce
- **正确理解**：
  - 超大规模批处理仍有优势
  - 某些场景Spark不如MapReduce
  - 根据规模选择

**误区三：内存越大越好**

- **说明**：内存不是唯一因素
- **后果**：资源浪费
- **正确理解**：
  - 考虑磁盘IO
  - 考虑网络带宽
  - 考虑CPU核心数
  - 综合优化

**误区四：SQL最简单**

- **说明**：SQL也有复杂场景
- **后果**：低估SQL复杂度
- **正确理解**：
  - 复杂逻辑SQL难表达
  - SQL性能需要优化
  - 有时代码更清晰

#### 七、小结

批处理核心技术包括分布式存储、分布式计算框架、资源调度。

核心要点：
- 分布式存储：HDFS适合大规模文件，S3适合数据湖
- 计算框架：MapReduce稳定但慢，Spark快且通用，Hive适合SQL分析
- 资源调度：YARN适合Hadoop生态，Kubernetes适合云原生
- 技术选型：根据规模、性能、成本、团队选择
- 技术栈组合：传统Hadoop栈、现代批处理栈、混合栈
- 常见误区：不只是Hadoop、MapReduce不过时、内存不是唯一因素、SQL不一定最简单

下一节将学习批处理调度，了解如何管理和调度批处理任务。
