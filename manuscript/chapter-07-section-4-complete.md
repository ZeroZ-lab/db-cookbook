### 7.4 批处理调度与编排

上一节学习了批处理核心技术，了解了HDFS、Spark、Hive等技术。

如何管理和调度批处理任务？如何处理任务依赖？如何保证任务按时完成？

**场景**：
```yaml
数据平台日常运营：

数据工程师："每天有几十个批处理任务"

运维工程师："任务之间有依赖关系"

产品经理："早上9点前必须看到报表"

数据平台负责人："需要任务调度系统"
```

**问题**：
- 如何调度批处理任务？
- 如何处理任务依赖？
- 如何监控任务运行？
- 如何保证SLA？
- 常用调度工具有哪些？

**答案**：**批处理调度系统负责管理任务的执行顺序、依赖关系、重试策略、资源分配，常用工具包括Airflow、Oozie、DolphinScheduler等**

#### 一、调度系统的核心功能

##### 1.1 核心功能

```yaml
任务调度：
  功能：
    - 定时调度：Cron表达式
    - 手动触发
    - 事件触发
    - 优先级调度
  
  示例：
    - 每天凌晨4点运行日报
    - 每周一运行周报
    - 上游任务完成后触发

依赖管理：
  功能：
    - 任务间依赖
    - 跨任务依赖
    - 条件依赖
  
  示例：
    - 任务B依赖任务A
    - 多个上游任务都完成后触发
    - 根据上游结果决定是否执行

重试机制：
  功能：
    - 自动重试
    - 重试次数限制
    - 重试间隔
    - 退避策略
  
  示例：
    - 失败后重试3次
    - 每次间隔5分钟
    - 指数退避

监控告警：
  功能：
    - 任务状态监控
    - 运行时长监控
    - 失败告警
    - SLA监控
  
  示例：
    - 任务失败发送邮件
    - 任务超时发送短信
    - SLA预警通知
```

##### 1.2 核心概念

```yaml
DAG（Directed Acyclic Graph）：
  定义：
    - 有向无环图
    - 节点：任务
    - 边：依赖关系
  
  示例：
    任务A → 任务B → 任务D
         ↘ 任务C ↗
    
    含义：
      - 任务A执行完后，B和C可以并行执行
      - B和C都完成后，D才能执行

任务实例：
  定义：
    - DAG的一次运行
    - 有唯一的执行ID
    - 记录运行状态
  
  示例：
    DAG：daily_report
    执行时间：2026-01-01 04:00:00
    任务实例：daily_report_20260101

调度时间：
  schedule_interval：
    - 调度周期
    - Cron表达式
    - 时间间隔
  
  execution_date：
    - 逻辑执行时间
    - 数据时间分区
  
  示例：
    schedule_interval: '0 4 * * *'  # 每天凌晨4点
    execution_date: 2026-01-01 00:00:00
```

#### 二、Airflow

##### 2.1 核心概念

```yaml
DAG：
  定义：
    - 工作流定义
    - Python代码
    - 声明式编程
  
  示例：
    from airflow import DAG
    from airflow.operators.bash import BashOperator
    from datetime import datetime
    
    with DAG(
        'daily_report',
        start_date=datetime(2026, 1, 1),
        schedule_interval='0 4 * * *',
        catchup=False
    ) as dag:
        task1 = BashOperator(
            task_id='extract_data',
            bash_command='python extract.py'
        )
        
        task2 = BashOperator(
            task_id='transform_data',
            bash_command='python transform.py'
        )
        
        task1 >> task2  # 定义依赖

Operator：
  定义：
    - 任务的具体实现
    - 可重用的组件
  
  常见Operator：
    - BashOperator：执行bash命令
    - PythonOperator：执行Python函数
    - SqlOperator：执行SQL
    - SparkSubmitOperator：提交Spark任务
    - HiveOperator：执行Hive SQL
    - SensorOperator：等待条件满足

任务依赖：
  定义方式：
    - >> ：task1 >> task2（task1完成后执行task2）
    - [] ：[task1, task2] >> task3（task1和task2都完成后执行task3）
    - 位运算符：task1 >> [task2, task3]
```

##### 2.2 DAG示例

```python
from airflow import DAG
from airflow.operators.bash import BashOperator
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
    'retries': 3,
    'retry_delay': timedelta(minutes=5),
    'sla': timedelta(hours=2)  # SLA：2小时内完成
}

with DAG(
    'daily_data_pipeline',
    default_args=default_args,
    description='Daily data processing pipeline',
    schedule_interval='0 4 * * *',  # 每天凌晨4点
    catchup=False,
    tags=['data', 'daily', 'pipeline'],
) as dag:
    
    # 任务1：数据抽取
    extract_data = BashOperator(
        task_id='extract_data',
        bash_command='python /opt/airflow/scripts/extract.py {{ ds }}',
        retries=2,
        retry_delay=timedelta(minutes=3)
    )
    
    # 任务2：数据清洗（Python函数）
    def clean_data(**context):
        ds = context['ds']
        # 清洗逻辑
        print(f"Cleaning data for {ds}")
        return f"cleaned_{ds}"
    
    clean_data_task = PythonOperator(
        task_id='clean_data',
        python_callable=clean_data,
        provide_context=True
    )
    
    # 任务3：Spark处理
    spark_process = SparkSubmitOperator(
        task_id='spark_process',
        application='/opt/airflow/jobs/process.py',
        conn_id='spark_default',
        application_args=['{{ ds }}'],
        verbose=True,
        conf={
            'spark.executor.memory': '2g',
            'spark.executor.cores': '2',
            'spark.executor.instances': '4'
        }
    )
    
    # 任务4：加载到数据仓库
    load_data = BashOperator(
        task_id='load_data',
        bash_command='python /opt/airflow/scripts/load.py {{ ds }}'
    )
    
    # 任务5：发送通知
    def send_notification(**context):
        ds = context['ds']
        # 发送邮件或Slack通知
        print(f"Pipeline completed for {ds}")
        send_email(
            to='stakeholders@example.com',
            subject=f'Daily pipeline completed for {ds}',
            body='Data pipeline completed successfully'
        )
    
    notify = PythonOperator(
        task_id='notify',
        python_callable=send_notification,
        provide_context=True,
        trigger_rule='all_success'  # 所有上游任务成功时执行
    )
    
    # 定义任务依赖
    extract_data >> clean_data_task >> spark_process >> load_data >> notify
```

##### 2.3 高级特性

```yaml
分支：
  场景：
    - 根据条件执行不同任务
    - A/B测试
  
  示例：
    from airflow.operators.python import BranchPythonOperator
    
    def branch_func(**context):
        ds = context['ds']
        if is_weekend(ds):
            return 'weekend_task'
        else:
            return 'weekday_task'
    
    branch = BranchPythonOperator(
        task_id='branch',
        python_callable=branch_func
    )
    
    weekday_task = BashOperator(task_id='weekday_task', ...)
    weekend_task = BashOperator(task_id='weekend_task', ...)
    
    branch >> [weekday_task, weekend_task]

子DAG：
  场景：
    - 复用工作流
    - 模块化
  
  示例：
    from airflow.operators.subdag import SubDagOperator
    
    def sub_dag(parent_dag_name, child_dag_name, args):
        with DAG(f'{parent_dag_name}.{child_dag_name}', 
                 schedule_interval='@daily', 
                 default_args=args) as dag:
            task1 = BashOperator(task_id='task1', ...)
            task2 = BashOperator(task_id='task2', ...)
            task1 >> task2
        return dag
    
    subdag_task = SubDagOperator(
        task_id='subdag_task',
        subdag=sub_dag('main_dag', 'sub_dag', default_args)
    )

动态任务：
  场景：
    - 动态生成任务
    - 批量处理
  
  示例：
    with dag:
        for table in ['users', 'orders', 'products']:
            task = BashOperator(
                task_id=f'process_{table}',
                bash_command=f'python process.py --table {table}'
            )
```

##### 2.4 监控和运维

```yaml
Web UI：
  功能：
    - DAG列表视图
    - 树状视图
    - 甘特图
    - 任务实例详情
  
  使用：
    - 查看任务状态
    - 手动触发任务
    - 查看日志
    - 重跑失败任务

监控指标：
  关键指标：
    - 任务成功率
    - 任务运行时长
    - 任务延迟
    - SLA达成率
  
  监控工具：
    - Airflow StatsD导出
    - Prometheus + Grafana
    - 自定义监控脚本

告警：
  告警场景：
    - 任务失败
    - 任务超时
    - SLA违约
    - 数据质量异常
  
  告警方式：
    - 邮件
    - Slack
    - 短信
    - PagerDuty
```

#### 三、其他调度工具

##### 3.1 Oozie

```yaml
特点：
  - Hadoop生态
  - XML配置
  - 基于YARN
  
工作流：
  <workflow-app name="daily-wf" xmlns="uri:oozie:workflow:0.5">
    <start to="extract"/>
    
    <action name="extract">
      <spark xmlns="uri:oozie:spark-action:0.2">
        <job-tracker>${jobTracker}</job-tracker>
        <name-node>${nameNode}</name-node>
        <master> yarn</master>
        <mode>cluster</mode>
        <name>Extract</name>
        <class>com.example.Extract</class>
        <jar>/user/oozie/app.jar</jar>
      </spark>
      <ok to="transform"/>
      <error to="kill"/>
    </action>
    
    <action name="transform">
      <spark xmlns="uri:oozie:spark-action:0.2">
        ...
      </spark>
      <ok to="end"/>
      <error to="kill"/>
    </action>
    
    <kill name="kill">
      <message>"Workflow failed"</message>
    </kill>
    
    <end name="end"/>
  </workflow-app>

优势：
  - 与Hadoop集成好
  - 稳定
  
劣势：
  - 配置复杂
  - 不够灵活
  - 社区活跃度下降
```

##### 3.2 DolphinScheduler

```yaml
特点：
  - 可视化DAG编辑
  - 中文友好
  - 去中心化
  
功能：
  - 拖拽式DAG编辑
  - 任务依赖可视化
  - 任务监控
  - 告警
  
优势：
  - 易用性高
  - 可视化
  - 社区活跃
  
劣势：
  - 相对较新
  - 生态不如Airflow
```

##### 3.3 Azkaban

```yaml
特点：
  - LinkedIn开源
  - 基于Web
  - Java编写
  
功能：
  - 工作流上传
  - 定时调度
  - 权限管理
  - 告警
  
优势：
  - 简单易用
  - 稳定性高
  
劣势：
  - 社区不太活跃
  - 功能相对简单
```

#### 四、调度系统设计

##### 4.1 DAG设计原则

```yaml
1. 任务粒度
   原则：
     - 单一职责
     - 运行时间不宜过长（建议<2小时）
     - 可重试
   
   示例：
     好的设计：
       - 抽取任务（30分钟）
       - 转换任务（1小时）
       - 加载任务（30分钟）
     
     不好的设计：
       - 一个大任务包含所有逻辑（2小时+）

2. 依赖关系
   原则：
     - 避免复杂依赖
     - 并行独立任务
     - 避免循环依赖
   
   示例：
     好的设计：
       task1 >> [task2, task3] >> task4
     
     不好的设计：
       task1 >> task2 >> task3 >> task1（循环依赖）

3. 错误处理
   原则：
     - 每个任务设置重试
     - 合理的重试次数
     - 失败后告警
   
   示例：
     retries: 3
     retry_delay: timedelta(minutes=5)
     email_on_failure: True

4. SLA设计
   原则：
     - 明确SLA
     - 设置预警
     - 监控SLA达成率
   
   示例：
     SLA：早上8点前完成
     预警：早上7点未完成
     告警：早上8点未完成
```

##### 4.2 任务监控

```yaml
监控指标：
  业务指标：
    - 任务成功率
    - SLA达成率
    - 数据产出延迟
  
  系统指标：
    - 任务运行时长
    - 资源使用率
    - 队列等待时长

监控工具：
  Grafana：
    - 可视化Dashboard
    - 实时监控
    - 告警
  
  Prometheus：
    - 指标采集
    - 时序数据
    - 告警规则

告警策略：
  告警级别：
    P0：
      - 立即处理
      - 电话+短信+邮件
      - 示例：核心任务失败
    
    P1：
      - 30分钟内处理
      - 邮件+Slack
      - 示例：SLA预警
    
    P2：
      - 当天处理
      - 邮件
      - 示例：非核心任务失败
```

##### 4.3 资源管理

```yaml
资源隔离：
  队列隔离：
    - 生产队列
    - 开发队列
    - 测试队列
  
  资源配额：
    - 生产队列：70%
    - 开发队列：20%
    - 测试队列：10%

资源调度：
  优先级调度：
    - P0任务最高优先级
    - P1任务次之
    - P2任务最低
  
  资源预估：
    - 根据历史数据预估
    - 动态调整资源
    - 避免资源浪费

成本优化：
  错峰运行：
    - 非高峰期运行非核心任务
    - 使用spot实例
    - 自动扩缩容
  
  示例：
    核心任务：凌晨4点（高峰时段）
    非核心任务：上午10点（非高峰时段）
```

#### 五、最佳实践

##### 5.1 DAG编写规范

```yaml
命名规范：
  DAG ID：
    - 小写字母
    - 下划线分隔
    - 描述性命名
    - 示例：daily_data_pipeline
  
  任务ID：
    - 描述动作
    - 小写字母
    - 下划线分隔
    - 示例：extract_orders、transform_users

代码规范：
  每个DAG一个文件：
    - 文件名：dag_id.py
    - 路径：dags/project/dag_id.py
  
  参数化：
    - 使用变量
    - 避免硬编码
    - 使用环境变量
  
  示例：
    # 不好的做法
    bash_command='python script.py --date 2026-01-01'
    
    # 好的做法
    bash_command='python script.py --date {{ ds }}'
```

##### 5.2 任务设计规范

```yaml
幂等性：
  定义：
    - 多次执行结果一致
    - 可以重跑
  
  实现方式：
    - 使用分区
    - 先删除再写入
    - 使用唯一键约束
  
  示例：
    -- 好的做法：幂等
    INSERT OVERWRITE TABLE daily_gmv
    PARTITION (dt='{{ ds }}')
    SELECT ...
    
    -- 不好的做法：非幂等
    INSERT INTO daily_gmv
    VALUES (...)

原子性：
  定义：
    - 任务要么全成功，要么全失败
    - 不产生中间结果
  
  实现方式：
    - 使用事务
    - 先写入临时表，再重命名
    - 原子操作

可观测性：
  日志：
    - 记录关键信息
    - 记录错误信息
    - 结构化日志
  
  指标：
    - 输出记录数
    - 运行时长
    - 资源使用
  
  示例：
    print(f"Processed {count} records")
    print(f"Duration: {duration} seconds")
```

##### 5.3 运维规范

```yaml
变更管理：
  代码审查：
    - 所有DAG变更需要审查
    - 测试环境先验证
    - 逐步灰度
  
  版本控制：
    - 使用Git
    - 打标签
    - 回滚机制

故障处理：
  故障发现：
    - 监控告警
    - 定期巡检
  
  故障恢复：
    - 重跑失败任务
    - 修复代码后重跑
    - 回滚到上一版本
  
  故障复盘：
    - 写故障报告
    - 改进流程
    - 防止再次发生

容量规划：
  资源评估：
    - 任务数量
    - 任务运行时长
    - 资源需求
  
  扩展计划：
    - 水平扩展
    - 垂直扩展
    - 提前规划
```

#### 六、常见误区

**误区一：所有任务都要串行执行**

- **说明**：可以并行执行独立任务
- **后果**：整体运行时间长
- **正确理解**：
  - 识别独立任务
  - 并行执行
  - 缩短总运行时间

**误区二：任务越复杂越好**

- **说明**：复杂任务难以维护
- **后果**：调试困难、重跑成本高
- **正确理解**：
  - 任务拆分
  - 单一职责
  - 易于维护

**误区三：重试次数越多越好**

- **说明**：重试需要时间
- **后果**：延迟发现问题
- **正确理解**：
  - 合理设置重试次数
  - 临时错误重试
  - 持续性错误立即告警

**误区四：所有任务都设置高优先级**

- **说明**：优先级应该有差异
- **后果**：资源争抢
- **正确理解**：
  - 核心任务高优先级
  - 非核心任务低优先级
  - 分级管理

#### 七、实战清单

##### 7.1 调度系统检查清单

```yaml
DAG设计：
  □ 任务粒度是否合理
  □ 依赖关系是否清晰
  □ 是否设置重试
  □ 是否设置SLA

代码质量：
  □ 是否符合命名规范
  □ 是否参数化
  □ 是否有日志
  □ 是否有文档

监控告警：
  □ 是否设置监控
  □ 是否设置告警
  □ 告警方式是否合理
  □ 告警级别是否合理

资源管理：
  □ 是否预估资源
  □ 是否设置资源限制
  □ 是否优化成本
  □ 是否有容量规划

运维支持：
  □ 是否有运维文档
  □ 是否有故障处理流程
  □ 是否有备份方案
  □ 是否有回滚方案
```

#### 八、小结

批处理调度与编排是批处理系统的重要组成部分，负责管理任务的执行顺序、依赖关系、重试策略等。

核心要点：
- 核心功能：任务调度、依赖管理、重试机制、监控告警
- 核心概念：DAG、任务实例、调度时间
- Airflow：Python定义DAG、丰富的Operator、灵活的依赖管理
- 其他工具：Oozie、DolphinScheduler、Azkaban
- DAG设计：任务粒度、依赖关系、错误处理、SLA
- 监控运维：监控指标、告警策略、资源管理
- 最佳实践：命名规范、任务设计、运维规范
- 常见误区：串行执行、任务复杂、重试过多、优先级混乱

下一节将学习批处理性能优化，了解如何提升批处理任务的性能。
