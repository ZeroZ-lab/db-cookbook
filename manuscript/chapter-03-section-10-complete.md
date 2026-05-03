### 3.10 批量操作与数据链路接入：高效导入导出大量数据

前面学习了多种大表优化手段：
- 分区表、索引、查询优化、物化视图、并行查询

这些都是针对"已经存储在数据库中的数据"的优化。

但还有一个重要的问题：**如何高效地将大量数据导入导出？**

**场景**：
```yaml
数据导入：
  - 从外部系统导入1亿行数据
  - 每天导入1000万行新数据
  - 如何快速导入？

数据导出：
  - 导出1亿行数据到文件
  - 导出最近一个月的数据到分析系统
  - 如何快速导出？
```

**如果使用普通的INSERT和SELECT**：
```sql
-- 导入：逐行插入（慢）
INSERT INTO orders VALUES (...);
INSERT INTO orders VALUES (...);
...（重复1亿次）

-- 导出：逐行查询（慢）
SELECT * FROM orders WHERE created_at >= '2026-04-01';
...（逐行返回1亿行）
```

**问题**：
- 导入1亿行：可能需要几天
- 导出1亿行：可能需要几小时
- 性能太差

**解决方案**：**批量操作**

- **COPY**：PostgreSQL的批量导入导出命令
- **批量INSERT**：一次插入多行
- **\copy**：psql的批量导入导出命令

性能差异：
- 逐行INSERT：1亿行需要几天
- COPY：1亿行只需30分钟

这就是批量操作的价值。

#### 一、为什么需要批量操作

**第一，逐行操作成本高**

**INSERT一行**：
```sql
INSERT INTO orders (order_id, user_id, total_amount, created_at)
VALUES (1, 123, 100.00, '2026-04-01 10:00:00');
```

**成本分解**：
1. 解析SQL语句
2. 检查约束
3. 更新索引
4. 写入WAL日志
5. 刷新到磁盘

**单行时间**：约0.1ms

**1亿行时间**：0.1ms × 1亿 = 10,000秒 ≈ 2.8小时

**实际时间**：可能更长（网络、锁、其他开销）

**第二，批量操作大幅减少开销**

**COPY 1亿行**：
```sql
COPY orders FROM '/data/orders.csv';
```

**成本分解**：
1. 读取文件（批量）
2. 批量解析
3. 批量写入
4. 批量更新索引
5. 批量写WAL日志

**1亿行时间**：约30分钟

**性能差异**：5.6倍！

**第三，数据链路需要批量接入**

**场景**：从外部系统导入数据

**数据源**：
```yaml
文件系统：
  - CSV文件
  - JSON文件
  - 日志文件

其他数据库：
  - MySQL
  - MongoDB
  - Oracle

数据仓库：
  - Hive
  - MaxCompute
  - ClickHouse
```

**问题**：
- 如何批量导入？
- 如何保证数据一致性？
- 如何处理错误？

**结论**：
> 批量操作通过减少网络往返、减少SQL解析开销、减少锁竞争，大幅提升数据导入导出的性能。

#### 二、核心判断：批量操作的关键是"减少往返次数"

> 批量操作的核心判断是：通过一次操作处理大量数据，减少网络往返、减少SQL解析开销、减少锁竞争，从而大幅提升数据导入导出的性能。

这个判断说明：
- **批量**：一次处理多行
- **减少往返**：减少客户端和数据库的交互
- **减少开销**：SQL解析、约束检查、索引更新
- **性能提升**：从几天降到几十分钟

#### 三、COPY命令

##### 3.1 COPY基础

**作用**：在文件和表之间批量复制数据

**语法**：
```sql
-- 从文件导入到表
COPY table_name FROM '/path/to/file.csv';

-- 从表导出到文件
COPY table_name TO '/path/to/file.csv';

-- 从STDIN导入
COPY table_name FROM STDIN;
```

**示例**：
```sql
-- 导入CSV文件
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ',',
    QUOTE '"'
);

-- 导出为CSV文件
COPY orders TO '/data/orders_backup.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ',',
    QUOTE '"'
);
```

##### 3.2 COPY的格式选项

**CSV格式**：
```sql
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,           -- CSV格式
    HEADER,               -- 文件包含标题行
    DELIMITER ',',        -- 分隔符
    QUOTE '"',            -- 引号符
    ESCAPE '\',           -- 转义符
    NULL ''               -- NULL表示（空字符串）
);
```

**文本格式**：
```sql
COPY orders FROM '/data/orders.txt' WITH (
    FORMAT TEXT,           -- 文本格式
    DELIMITER '\t',       -- TAB分隔
    NULL 'NULL'            -- NULL表示为'NULL'
);
```

**二进制格式**：
```sql
COPY orders FROM '/data/orders.dat' WITH (BINARY);
```

##### 3.3 COPY的列选择

**选择特定列**：
```sql
COPY orders(order_id, user_id, total_amount)
FROM '/data/orders_partial.csv' WITH (FORMAT CSV);
```

**调整列顺序**：
```sql
COPY orders(order_id, user_id, total_amount, created_at)
FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    DELIMITER ','
);
```

#### 四、批量INSERT

##### 4.1 多值INSERT

**语法**：
```sql
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1, 123, 100.00, '2026-04-01 10:00:00'),
    (2, 124, 200.00, '2026-04-01 11:00:00'),
    (3, 125, 300.00, '2026-04-01 12:00:00');
```

**优势**：
- 一次插入多行
- 减少SQL解析开销
- 减少网络往返

**性能**：
- 单行INSERT：1万行需要30秒
- 多值INSERT：1万行只需要5秒

##### 4.2 批量INSERT脚本

**脚本**：
```sql
-- 每次插入1000行
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1, 123, 100.00, '2026-04-01 10:00:00'),
    (2, 124, 200.00, '2026-04-01 11:00:00'),
    ...
    (1000, 1234, 1000.00, '2026-04-01 20:00:00');

-- 再插入1000行
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1001, 1235, 100.00, '2026-04-01 21:00:00'),
    ...
```

**优化**：
```sql
-- 开始事务
BEGIN;

-- 批量插入（减少提交次数）
INSERT INTO orders VALUES (...);
INSERT INTO orders VALUES (...);
...（重复1万次）

-- 提交事务
COMMIT;
```

#### 五、\copy命令

##### 5.1 \copy基础

**作用**：psql的批量导入导出命令（客户端）

**语法**：
```sql
-- 导入
\copy table_name FROM '/path/to/file.csv'

-- 导出
\copy table_name TO '/path/to/file.csv'

-- 查询结果导出
\copy (SELECT * FROM orders WHERE created_at >= '2026-04-01') TO '/data/orders_recent.csv'
```

**示例**：
```sql
-- 导入CSV文件
\copy orders FROM '/data/orders.csv' WITH CSV HEADER

-- 导出为CSV文件
\copy orders TO '/data/orders_backup.csv' WITH CSV HEADER

-- 导出查询结果
\copy (SELECT * FROM orders WHERE user_id = 123) TO '/data/user_orders.csv' WITH CSV HEADER
```

##### 5.2 \copy vs COPY

| 维度 | COPY | \copy |
|------|-----|-------|
| 执行位置 | 服务器端 | 客户端 |
| 文件路径 | 服务器路径 | 客户端路径 |
| 权限 | 需要superuser | 普通用户 |
| 网络 | 不经过客户端 | 经过客户端 |

**使用场景**：
```yaml
COPY：
  - 服务器文件导入导出
  - DBA操作
  - 大批量数据

\copy：
  - 客户端文件导入导出
  - 普通用户操作
  - 中小批量数据
```

#### 六、批量操作的性能优化

##### 6.1 禁用索引和约束

**导入前禁用**：
```sql
-- 1. 禁用触发器
ALTER TABLE orders DISABLE TRIGGER ALL;

-- 2. 删除索引（可选）
DROP INDEX idx_orders_user_id;

-- 3. 导入数据
COPY orders FROM '/data/orders.csv';

-- 4. 重建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 5. 启用触发器
ALTER TABLE orders ENABLE TRIGGER ALL;
```

**优势**：
- 导入速度提升5-10倍
- 索引不需要逐行更新

**注意**：
- 确保数据质量（没有错误数据）
- 准备时间较长

##### 6.2 调整WAL日志

**导入时禁用WAL**（PostgreSQL 12+）：
```sql
-- 开始事务
BEGIN;

-- 设置WAL级别
SET LOCAL wal_level = 'minimal';

-- 导入数据
COPY orders FROM '/data/orders.csv';

-- 提交事务
COMMIT;
```

**优势**：
- 减少WAL日志写入
- 提升导入速度

**风险**：
- 如果导入失败，可能无法恢复
- 只在可控环境下使用

##### 6.3 调整maintenance_work_mem

**增加维护工作内存**：
```sql
-- 设置为1GB
SET maintenance_work_mem = '1GB';

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**优势**：
- 创建索引时使用更多内存
- 索引创建速度提升2-3倍

#### 七、数据链路接入

##### 7.1 从MySQL导入数据

**方法1：使用COPY + 文件**

```bash
# 1. 从MySQL导出为CSV
mysql -u root -p -e "SELECT * FROM orders" db > orders.csv

# 2. 导入到PostgreSQL
psql -d postgres -c "\copy orders FROM 'orders.csv' WITH CSV HEADER"
```

**方法2：使用pgloader**

```bash
# 安装pgloader
pip install pgloader

# 从MySQL导入
pgloader mysql://user:pass@mysql_host/dbname postgresql://user:pass@pg_host/dbname
```

##### 7.2 从Hive导入数据

**方法1：使用COPY + 文件**

```bash
# 1. 从Hive导出为CSV
hive -e "SELECT * FROM orders" > orders.csv

# 2. 导入到PostgreSQL
psql -d postgres -c "\copy orders FROM 'orders.csv' WITH CSV HEADER"
```

**方法2：使用外部表**

```sql
-- 创建外部表（指向Hive HDFS）
CREATE FOREIGN TABLE hive_orders ()
SERVER hive_server
OPTIONS (dbname 'hive_db', table_name 'orders');

-- 导入到PostgreSQL表
INSERT INTO orders SELECT * FROM hive_orders;
```

##### 7.3 从Kafka导入数据

**方法1：使用kafka connector**

```yaml
# 使用Debezium Kafka Connector
# 自动同步MySQL数据到PostgreSQL
```

**方法2：使用自定义程序**

```python
# Python示例
from kafka import KafkaConsumer
import psycopg2

# 连接Kafka
consumer = KafkaConsumer('orders-topic')

# 连接PostgreSQL
conn = psycopg2.connect("dbname=postgres user=postgres")
cur = conn.cursor()

# 批量插入
batch = []
for message in consumer:
    batch.append(message.value)
    if len(batch) >= 1000:
        cur.executemany("INSERT INTO orders VALUES (%s, %s, %s)", batch)
        conn.commit()
        batch = []
```

#### 八、批量操作的常见问题

##### 8.1 编码问题

**问题**：导入时中文乱码

**解决**：
```bash
# 确保文件编码是UTF-8
file -I orders.csv

# 指定编码
\copy orders FROM 'orders.csv' WITH CSV HEADER ENCODING 'UTF8'
```

##### 8.2 数据类型不匹配

**问题**：数据类型错误

**示例**：
```sql
-- CSV文件：total_amount是字符串"100.00"
-- 表定义：total_amount是NUMERIC(10, 2)

-- 导入错误：ERROR: invalid input syntax for type numeric
```

**解决**：
```sql
-- 方法1：预处理CSV文件（转换数据类型）

-- 方法2：创建临时表，导入后再转换
CREATE TEMP TABLE orders_temp (
    total_amount TEXT  -- 先用TEXT接收
);

COPY orders_temp FROM '/data/orders.csv';

-- 再转换到正式表
INSERT INTO orders
SELECT
    order_id,
    user_id,
    total_amount::NUMERIC(10, 2),
    created_at
FROM orders_temp;
```

##### 8.3 错误处理

**问题**：部分行导入失败

**解决**：
```sql
-- 方法1：使用ON ERROR
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    ON_ERROR 'ignore'  -- 忽略错误行
);

-- 方法2：指定日志文件
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    LOG ERRORS INTO orders_error_log
);

-- 查看错误日志
SELECT * FROM orders_error_log;
```

#### 九、常见误区

**误区一：批量操作总是比逐行操作快**

- **说明**：批量操作通常更快，但小批量可能不如逐行操作
- **后果**：所有场景都用批量操作
- **正确理解**：
  - 大批量：COPY（快）
  - 小批量：多值INSERT（较快）
  - 实时写入：单行INSERT（合适）

**误区二：COPY不需要优化**

- **说明**：COPY可以优化，禁用索引、调整内存能进一步提升性能
- **后果**：COPY还是很慢
- **正确理解**：
  - 禁用触发器和索引
  - 调整maintenance_work_mem
  - 调整WAL级别

**误区三：批量操作不需要事务**

- **说明**：批量操作应该使用事务，保证一致性
- **后果**：中途失败，数据不一致
- **正确理解**：
  - 用事务包裹批量操作
  - 成功提交，失败回滚
  - 保证数据一致性

**误区四：导入后不需要验证**

- **说明**：导入后需要验证数据完整性和正确性
- **后果**：数据错误不知道
- **正确理解**：
  - 验证行数
  - 验证数据质量
  - 对比源数据

**误区五：导出总是很快**

- **说明**：导出大量数据也可能很慢
- **后果**：导出任务耗时太长
- **正确理解**：
  - 大数据量导出：使用COPY
  - 分批导出
  - 压缩导出文件

#### 十、实战任务

**任务1：批量导入数据**

使用COPY批量导入1000万行数据：

```sql
-- 1. 创建测试数据文件（假设已准备好）
-- 数据文件：/data/orders_10m.csv（1000万行）

-- 2. 创建表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP
);

-- 3. 批量导入
COPY orders FROM '/data/orders_10m.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ','
);

-- 4. 验证导入
SELECT count(*) FROM orders;

-- 5. 查看导入时间
-- 记录开始时间和结束时间
```

**任务2：批量导出数据**

使用COPY批量导出最近1个月的数据：

```sql
-- 1. 导出为CSV文件
COPY (
    SELECT * FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
) TO '/data/orders_recent.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ','
);

-- 2. 查看导出的文件大小
-- $ ls -lh /data/orders_recent.csv

-- 3. 验证导出
-- 导入到测试表验证数据
CREATE TABLE orders_verify AS SELECT * FROM orders;
\copy orders_verify FROM '/data/orders_recent.csv' WITH CSV HEADER
SELECT count(*) FROM orders_verify;
```

**任务3：优化批量导入性能**

优化导入性能：

```sql
-- 1. 禁用触发器
ALTER TABLE orders DISABLE TRIGGER ALL;

-- 2. 准备数据（删除索引）
DROP INDEX IF EXISTS idx_orders_user_id;
DROP INDEX IF EXISTS idx_orders_status;

-- 3. 调整配置
SET maintenance_work_mem = '1GB';
SET wal_level = 'minimal';

-- 4. 导入数据
BEGIN;
COPY orders FROM '/data/orders_10m.csv' WITH (FORMAT CSV, HEADER);
COMMIT;

-- 5. 重建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);

-- 6. 启用触发器
ALTER TABLE orders ENABLE TRIGGER ALL;

-- 7. 分析表
ANALYZE orders;
```

#### 十、小结

批量操作通过减少网络往返和解析开销，大幅提升数据导入导出性能。

核心要点：
- COPY：服务器端批量导入导出
- \copy：客户端批量导入导出
- 多值INSERT：一次插入多行
- 优化：禁用索引、调整WAL、调整内存
- 数据链路：从MySQL、Hive、Kafka等系统导入
- 错误处理：编码问题、类型转换、错误日志
- 验证：导入后验证数据完整性

**第3章（PostgreSQL大表能力）小结**：
1. ✅ 大表为什么慢：磁盘I/O瓶颈
2. ✅ PostgreSQL的能力边界：数据量、并发、场景边界
3. ✅ 分区表：物理边界优化查询
4. ✅ 表空间与存储策略：分层存储
5. ✅ 索引基础：B-tree加速查询
6. ✅ 索引进阶：BRIN、GIN、GiST特殊场景
7. ✅ 查询优化：执行计划分析与优化
8. ✅ 物化视图：预计算加速查询
9. ✅ 并行查询：多核CPU加速查询
10. ✅ 批量操作：高效导入导出数据

第3章现在是一个完整的PostgreSQL大表能力章节，可作为后续章节的参考标准！
