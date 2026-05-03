### 3.4 表空间与存储策略：让数据存储更高效

前面学习了分区表，通过物理边界优化查询和维护。

但分区表还引出一个问题：**不同分区的存储成本和访问频率不同，能否优化存储？**

**场景**：
```yaml
最近3个月的订单（热数据）：
  - 访问频繁
  - 需要高性能
  - 存储在SSD上

3-12个月的订单（温数据）：
  - 偶尔访问
  - 性能要求一般
  - 存储在HDD上

12个月以上的订单（冷数据）：
  - 很少访问
  - 性能要求低
  - 压缩存储，存储在廉价HDD上
```

**如何实现？**

这就需要**表空间（Tablespace）**和存储策略。

#### 一、为什么需要存储策略

**第一，不同数据的访问频率不同**

**热数据**：
```yaml
特征：
  - 访问频繁（每天数千次）
  - 响应时间要求高（<100ms）
  - 数据量相对较小

优化：
  - 放在SSD上
  - 更多的内存缓存
  - 更激进的索引

成本：
  - 存储成本高（SSD贵）
  - 但访问性能好
```

**冷数据**：
```yaml
特征：
  - 很少访问（每月几次）
  - 响应时间要求低（<1s可接受）
  - 数据量大

优化：
  - 放在HDD上
  - 压缩存储
  - 较少的索引

成本：
  - 存储成本低（HDD便宜）
  - 访问性能差一些
```

**第二，存储成本优化**

**场景**：1TB的订单数据

**全部用SSD**：
```yaml
成本：SSD 1TB约1000元
性能：所有查询都快
问题：成本高，冷数据不需要这么高的性能
```

**混合存储**：
```yaml
热数据（100GB）：SSD，约100元
温数据（400GB）：SATA SSD，约200元
冷数据（500GB）：HDD，约100元
总成本：约400元
性能：热数据快，冷数据可接受
```

**结论**：通过分层存储，可以在性能和成本之间取得平衡。

**第三，存储隔离和安全性**

**场景**：不同业务的数据

```yaml
业务A：订单数据（重要，高优先级）
业务B：日志数据（次要，低优先级）

问题：
  - 日志数据可能占用大量空间
  - 可能影响订单数据的性能

解决：
  - 订单数据：放在高速SSD上
  - 日志数据：放在独立的HDD上
  - 通过表空间隔离存储
```

#### 二、核心判断：存储策略不是"全部用SSD"，而是"按需分层"

> 存储策略的核心判断是：根据数据的访问频率、性能要求、成本预算，将数据分层存储在不同介质上，实现性能和成本的最优平衡。

这个判断说明：
- **数据分层**：热数据、温数据、冷数据
- **存储介质**：SSD、SATA SSD、HDD、对象存储
- **性能优化**：热数据在高速存储
- **成本优化**：冷数据在廉价存储

#### 三、表空间基础

##### 3.1 什么是表空间

**定义**：表空间是PostgreSQL中存储数据的逻辑容器，对应文件系统上的目录。

**作用**：
- 控制数据存储位置
- 隔离不同业务的数据
- 优化存储性能

**默认表空间**：
```sql
-- 查看表空间
SELECT * FROM pg_tablespace;

-- 结果：
--  pg_default：默认表空间
--  pg_global：全局表空间（系统表）
```

##### 3.2 创建表空间

**步骤1**：创建目录
```bash
# 在文件系统上创建目录
sudo mkdir -p /data/ssd_tablespace
sudo chown postgres:postgres /data/ssd_tablespace
```

**步骤2**：创建表空间
```sql
-- 创建表空间
CREATE TABLESPACE ssd_space LOCATION '/data/ssd_tablespace';

-- 查看表空间
SELECT * FROM pg_tablespace;
```

**步骤3**：在表空间中创建表
```sql
-- 在表空间中创建表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) TABLESPACE ssd_space;

-- 将现有表移到表空间
ALTER TABLE orders SET TABLESPACE ssd_space;
```

##### 3.3 表空间的管理

**查看表空间使用情况**：
```sql
-- 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size
FROM pg_tablespace;

-- 查看表空间中的表
SELECT
    schemaname,
    tablename,
    tablespace
FROM pg_tables
WHERE tablespace = 'ssd_space';
```

**删除表空间**：
```sql
-- 删除表空间前必须移走所有表
DROP TABLESPACE ssd_space;
```

#### 四、存储策略设计

##### 4.1 分层存储策略

**三层存储架构**：

```yaml
热数据层（SSD）：
  - 访问频率：高（每天数千次）
  - 数据量：最近1-3个月
  - 性能要求：响应时间<100ms
  - 存储介质：NVMe SSD
  - 成本：高

温数据层（SATA SSD）：
  - 访问频率：中（每天数十次）
  - 数据量：3-12个月
  - 性能要求：响应时间<1s
  - 存储介质：SATA SSD
  - 成本：中

冷数据层（HDD）：
  - 访问频率：低（每月几次）
  - 数据量：12个月以上
  - 性能要求：响应时间<10s
  - 存储介质：HDD
  - 成本：低
```

**实现方案**：
```sql
-- 创建三个表空间
CREATE TABLESPACE hot_data LOCATION '/data/ssd/hot';
CREATE TABLESPACE warm_data LOCATION '/data/sata_ssd/warm';
CREATE TABLESPACE cold_data LOCATION '/data/hdd/cold';

-- 热数据分区：放在SSD上
CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    TABLESPACE hot_data;

-- 温数据分区：放在SATA SSD上
CREATE TABLE orders_202503 PARTITION OF orders
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01')
    TABLESPACE warm_data;

-- 冷数据分区：放在HDD上
CREATE TABLE orders_202401 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    TABLESPACE cold_data;
```

##### 4.2 分区表的存储策略

**策略**：新分区默认在热数据层，旧分区逐步迁移到冷数据层

```sql
-- 1. 创建新分区（默认在热数据层）
CREATE TABLE orders_202606 PARTITION OF orders
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    TABLESPACE hot_data;

-- 2. 3个月后，迁移到温数据层
ALTER TABLE orders_202606 SET TABLESPACE warm_data;

-- 3. 12个月后，迁移到冷数据层
ALTER TABLE orders_202606 SET TABLESPACE cold_data;
```

**自动化迁移脚本**：
```sql
-- 创建函数自动迁移分区
CREATE OR REPLACE FUNCTION migrate_partition()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    partition_age INT;
BEGIN
    -- 查找3个月前的分区
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'orders_%'
        AND substring(tablename FROM 8 FOR 6) <= to_char(CURRENT_DATE - INTERVAL '3 months', 'YYYYMM')
    LOOP
        -- 迁移到温数据层
        EXECUTE format('ALTER TABLE %I SET TABLESPACE warm_data', partition_name);
    END LOOP;

    -- 查找12个月前的分区
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'orders_%'
        AND substring(tablename FROM 8 FOR 6) <= to_char(CURRENT_DATE - INTERVAL '12 months', 'YYYYMM')
    LOOP
        -- 迁移到冷数据层
        EXECUTE format('ALTER TABLE %I SET TABLESPACE cold_data', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 定期执行（如每月1号）
SELECT migrate_partition();
```

##### 4.3 不同业务的存储隔离

**场景**：不同业务使用不同的表空间

```sql
-- 订单业务：高性能SSD
CREATE TABLESPACE orders_space LOCATION '/data/ssd/orders';

-- 日志业务：廉价HDD
CREATE TABLESPACE logs_space LOCATION '/data/hdd/logs';

-- 分析业务：SATA SSD
CREATE TABLESPACE analytics_space LOCATION '/data/sata_ssd/analytics';

-- 订单表放在SSD上
CREATE TABLE orders (...) TABLESPACE orders_space;

-- 日志表放在HDD上
CREATE TABLE event_logs (...) TABLESPACE logs_space;

-- 分析表放在SATA SSD上
CREATE TABLE user_stats (...) TABLESPACE analytics_space;
```

#### 五、存储压缩策略

##### 5.1 PostgreSQL的压缩

**TOAST压缩**：
```sql
-- PostgreSQL自动压缩大字段
-- TOAST（The Oversized-Attribute Storage Technique）
-- 自动压缩超过2KB的字段

-- 查看表的TOAST表
SELECT
    relname,
    pg_size_pretty(pg_relation_size(oid)) as size
FROM pg_class
WHERE relname LIKE 'pg_toast%'
AND relname LIKE '%orders%';
```

**表压缩**：
```sql
-- PostgreSQL不直接支持表级压缩
-- 但可以通过文件系统压缩实现

-- 方法1：使用ZFS文件系统（支持透明压缩）
-- 方法2：使用压缩文件系统（如btrfs）
-- 方法3：使用pg_compress扩展
```

##### 5.2 分区级的压缩策略

**冷数据分区压缩**：
```sql
-- 1. 导出冷数据分区
COPY orders_202401 TO '/tmp/orders_202401.csv' CSV;

-- 2. 压缩文件
gzip /tmp/orders_202401.csv;

-- 3. 删除原分区
DROP TABLE orders_202401;

-- 4. 后续查询时，可以从压缩文件中解压
-- （需要应用层支持）
```

**或使用外部表**：
```sql
-- 创建外部表（file_fdw）
CREATE EXTENSION file_fdw;

CREATE SERVER csv_server FOREIGN DATA WRAPPER file_fdw;

-- 创建外部表指向压缩文件
CREATE EXTERNAL TABLE orders_202401_ext (
    order_id BIGINT,
    user_id BIGINT,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
)
SERVER csv_server
OPTIONS (filename '/data/orders_202401.csv.gz', format 'csv');
```

#### 六、存储监控和优化

##### 6.1 监控表空间使用情况

```sql
-- 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size,
    pg_tablespace_size(spcname) as size_bytes
FROM pg_tablespace
ORDER BY pg_tablespace_size(spcname) DESC;

-- 查看每个表空间中的表大小
SELECT
    tablespace,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablespace IS NOT NULL
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

##### 6.2 监控I/O性能

```sql
-- 查看表的I/O统计
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read + idx_tup_fetch DESC;
```

**分析**：
- `seq_scan`：顺序扫描次数（越多，可能需要优化）
- `idx_scan`：索引扫描次数（越多，索引使用越好）
- `n_tup_ins`：插入的行数
- `n_tup_upd`：更新的行数
- `n_tup_del`：删除的行数

##### 6.3 优化存储成本

**定期归档**：
```sql
-- 1. 归档一年前的数据到对象存储
-- （如S3、OSS）

-- 2. 删除本地数据
DROP TABLE orders_202401;

-- 3. 需要时可以从对象存储恢复
```

**数据生命周期管理**：
```yaml
0-3个月：热数据（SSD）
3-12个月：温数据（SATA SSD）
12-36个月：冷数据（HDD）
36个月以上：归档（对象存储）
```

#### 七、存储安全性和备份

##### 7.1 表空间级别的备份

```bash
# 备份特定表空间
pg_dump -t orders -f orders_backup.sql

# 或使用pg_dump备份整个数据库
pg_dump -d mydb -f mydb_backup.sql
```

##### 7.2 存储故障恢复

**主从复制**：
```yaml
# 设置主从复制
# 主库：写入
# 从库：只读查询

# 如果主库存储故障，可以切换到从库
```

#### 八、常见误区

**误区一：所有数据都应该用SSD**

- **说明**：SSD性能好，但成本高，应该按需使用
- **后果**：存储成本过高
- **正确理解**：
  - 热数据用SSD
  - 温数据用SATA SSD
  - 冷数据用HDD
  - 分层存储平衡性能和成本

**误区二：表空间设置后就不能改**

- **说明**：表空间可以随时更改
- **后果**：不敢使用表空间
- **正确理解**：
  - 可以用ALTER TABLE更改表空间
  - 可以定期迁移数据到合适的存储层
  - 支持动态调整

**误区三：压缩总是好的**

- **说明**：压缩节省空间，但增加CPU开销
- **后果**：过度压缩，查询变慢
- **正确理解**：
  - 冷数据适合压缩（访问少）
  - 热数据不建议压缩（访问频繁）
  - 根据访问频率决定是否压缩

**误区四：存储策略不重要**

- **说明**：存储策略直接影响性能和成本
- **后果**：性能差、成本高
- **正确理解**：
  - 存储策略是数据库优化的重要部分
  - 分层存储能显著降低成本
  - 存储隔离能提升性能

**误区五：表空间只用于性能优化**

- **说明**：表空间不仅用于性能，还用于隔离和管理
- **后果**：忽视其他价值
- **正确理解**：
  - 性能优化：热数据在SSD
  - 成本优化：冷数据在HDD
  - 安全隔离：不同业务分开存储
  - 管理便利：分区级别的备份恢复

#### 九、实战任务

**任务1：创建分层存储**

创建三层存储架构：

```sql
-- 1. 创建三个表空间
-- （假设目录已创建）
CREATE TABLESPACE hot_data LOCATION '/data/ssd/hot';
CREATE TABLESPACE warm_data LOCATION '/data/sata_ssd/warm';
CREATE TABLESPACE cold_data LOCATION '/data/hdd/cold';

-- 2. 创建分区表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. 创建不同存储层的分区
CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    TABLESPACE hot_data;

CREATE TABLE orders_202503 PARTITION OF orders
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01')
    TABLESPACE warm_data;

CREATE TABLE orders_202401 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    TABLESPACE cold_data;

-- 4. 验证表空间
SELECT
    schemaname,
    tablename,
    tablespace
FROM pg_tables
WHERE tablename LIKE 'orders_%'
ORDER BY tablename;
```

**任务2：迁移数据到不同存储层**

模拟数据迁移：

```sql
-- 1. 查看当前表空间
SELECT tablename, tablespace FROM pg_tables WHERE tablename = 'orders_202605';

-- 2. 迁移到温数据层
ALTER TABLE orders_202605 SET TABLESPACE warm_data;

-- 3. 迁移回热数据层
ALTER TABLE orders_202605 SET TABLESPACE hot_data;

-- 4. 查看迁移前后的大小变化
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'orders_%';
```

**任务3：监控存储使用情况**

监控存储空间和性能：

```sql
-- 1. 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size
FROM pg_tablespace
ORDER BY pg_tablespace_size(spcname) DESC;

-- 2. 查看各表的I/O统计
SELECT
    tablename,
    seq_scan,
    idx_scan,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan + idx_scan DESC;

-- 3. 分析哪些表需要优化
-- - seq_scan多，idx_scan少：可能需要加索引
-- - 表很大，但访问少：考虑迁移到冷存储
```

#### 十、小结

表空间和存储策略让数据存储更高效。

核心要点：
- 表空间控制数据的物理存储位置
- 分层存储：热数据（SSD）、温数据（SATA SSD）、冷数据（HDD）
- 存储策略平衡性能和成本
- 分区表可以结合表空间优化存储
- 定期迁移数据到合适的存储层
- 压缩节省空间，但有CPU开销
- 监控存储使用情况，持续优化

第3章前4节小结：
- 大表为什么慢：磁盘I/O、索引效率、内存不足
- PostgreSQL的能力边界：OLTP擅长、OLAP有限、数据量和并发边界
- 分区表：通过物理边界优化查询和维护
- 表空间和存储策略：分层存储优化性能和成本

下一节将进入索引基础和进阶：索引是大表优化的核心手段。
