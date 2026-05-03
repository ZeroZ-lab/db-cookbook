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
