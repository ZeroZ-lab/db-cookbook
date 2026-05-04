# 项目 4 架构链路图

## 系统架构

```text
PostgreSQL (源库)
  |
  |-- 业务表: orders, order_items, products, users
  |
  v
导出任务
  |
  |-- COPY TO / pg_dump -> Parquet 文件
  |-- 分区: dt=YYYY-MM-DD
  |
  v
对象存储 (本地 / S3 / MinIO)
  |
  |-- warehouse/parquet/orders/dt=2026-04-03/*.parquet
  |-- warehouse/parquet/order_items/dt=2026-04-03/*.parquet
  |
  v
Iceberg Catalog
  |
  |-- lakehouse.orders (Iceberg 表, format-version=2)
  |-- lakehouse.order_items (Iceberg 表)
  |-- lakehouse.order_items_wide (派生表, Spark 生成)
  |
  v
查询引擎
  |
  |-- Trino: 交互式分析查询
  |-- Spark SQL: 批量 ETL、派生表生成
  |
  v
BI / 分析
```

## 职责分工

### 文件格式 (Parquet)

- 列式存储，压缩率高
- 支持谓词下推
- 适合批量读取

### 表格式 (Iceberg)

- Schema 演化（加列、改列）
- 分区演化（从 dt 分区到 category 分区）
- 时间旅行（查询历史快照）
- ACID 事务保证

### Catalog 管理

- 记录表的元数据、schema、分区信息
- 支持多引擎共享同一份数据

### 查询引擎

- Trino：低延迟交互式查询
- Spark：高吞吐批量处理
