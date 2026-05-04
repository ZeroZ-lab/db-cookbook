# 项目 4 交付物：Mini Lakehouse

## 架构产物

- [x] 画出 PostgreSQL、同步任务、对象存储、Parquet、Iceberg、Trino、Spark 的链路：`docs/architecture.md`。
- [x] 标出文件格式、表格式和查询引擎的职责：`docs/architecture.md`。
- [x] 标出 Catalog 管理的位置：`docs/architecture.md`。

## 数据模型产物

- [x] Parquet 文件分区设计：`storage/object-layout.md`。
- [x] Iceberg 表定义：`iceberg/orders.sql`。
- [x] schema 演化记录：`docs/evolution-record.md`。
- [x] 分区演化记录：`docs/evolution-record.md`。

## 核心任务产物

- [x] 导出明细数据到对象存储：`docs/export-pseudo-code.md`。
- [x] 注册 Iceberg 表：`iceberg/orders.sql`。
- [x] 用 Trino 查询：`trino/orders-analysis.sql`。
- [x] 用 Spark 生成派生表：`spark/build-order-items-wide.sql`。

## 验证证据

- [x] 文件清单：`storage/object-layout.md`。
- [x] Iceberg 元数据记录：`iceberg/orders.sql` 和 `docs/evolution-record.md`。
- [x] 本地静态运行入口：`run.sh`。
- [x] 运行记录模板：`reports/run-record-template.md`。
- [x] Trino 查询结果模板：`reports/trino-result-template.md`。
- [x] Spark 转换结果模板：`reports/spark-result-template.md`。

## 复盘记录

- Parquet 解决的问题：
- Iceberg 解决的问题：
- 湖仓仍然依赖哪些外部系统：
