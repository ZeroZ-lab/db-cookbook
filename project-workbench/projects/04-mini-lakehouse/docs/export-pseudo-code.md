# 导出到对象存储伪代码/命令说明

## 导出方式

### 方式 1：PostgreSQL COPY TO 导出 CSV，再转 Parquet

```sql
-- 导出 orders 表到 CSV
COPY (
  SELECT * FROM orders WHERE created_at >= '2026-04-01'
) TO '/tmp/orders.csv' WITH CSV HEADER;
```

```python
# Python: CSV 转 Parquet
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq

df = pd.read_csv('/tmp/orders.csv')
table = pa.Table.from_pandas(df)

# 按日期分区写入
pq.write_to_dataset(
  table,
  root_path='warehouse/parquet/orders',
  partition_cols=['dt']
)
```

### 方式 2：Spark SQL 直接导出

```sql
-- 从 PostgreSQL 读取并写入 Parquet
CREATE TEMPORARY VIEW orders_pg
USING org.apache.spark.sql.jdbc
OPTIONS (
  url 'jdbc:postgresql://postgres:5432/db_cookbook_lab',
  dbtable 'public.orders',
  user 'db_cookbook',
  password 'db_cookbook'
);

-- 写入 Parquet 分区文件
INSERT OVERWRITE DIRECTORY 'warehouse/parquet/orders'
USING parquet
PARTITIONED BY (dt)
SELECT *, date(created_at) AS dt FROM orders_pg;
```

### 方式 3：pg_dump + 外部工具

```bash
# pg_dump 导出 SQL
pg_dump -h localhost -U db_cookbook -d db_cookbook_lab \
  -t orders --data-only --column-inserts > orders.sql

# 使用 DuckDB 转换为 Parquet
duckdb -c "
  CREATE TABLE orders AS SELECT * FROM read_csv('/tmp/orders.csv');
  COPY orders TO 'warehouse/parquet/orders/' (FORMAT PARQUET, PARTITION_BY (dt));
"
```

## 对象存储目录结构

```text
warehouse/
  parquet/
    orders/
      dt=2026-04-03/
        part-0.parquet
        part-1.parquet
      dt=2026-04-04/
        part-0.parquet
      dt=2026-04-05/
        part-0.parquet
    order_items/
      dt=2026-04-03/
        part-0.parquet
      ...
```

## 注册 Iceberg 表

```sql
-- 在 Spark SQL 中注册 Iceberg 表
CREATE TABLE lakehouse.orders
USING iceberg
PARTITIONED BY (dt)
LOCATION 'warehouse/iceberg/orders';

-- 从 Parquet 加载数据
INSERT INTO lakehouse.orders
SELECT * FROM parquet.`warehouse/parquet/orders`;
```

**注意**：以上命令为伪运行流程，当前环境未安装 Spark、Trino 运行时。
