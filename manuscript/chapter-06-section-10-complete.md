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
