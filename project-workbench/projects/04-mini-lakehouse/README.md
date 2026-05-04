# 项目 4：Mini Lakehouse

## 目标

理解对象存储、Parquet、Iceberg、Catalog、多引擎查询和湖仓表格式为什么出现。

## 系统位置

```text
PostgreSQL
  -> 同步任务
  -> Object Storage
  -> Parquet Files
  -> Iceberg Table
  -> Trino / Spark
```

## 数据模型

- 原始订单明细。
- Parquet 分区文件。
- Iceberg 表元数据。
- 批处理后的分析宽表。
- 对象存储布局见 `storage/object-layout.md`。
- Iceberg 表定义见 `iceberg/orders.sql`。
- Trino 查询样例见 `trino/orders-analysis.sql`。
- Spark 转换样例见 `spark/build-order-items-wide.sql`。
- schema 和分区演化记录见 `docs/evolution-record.md`。
- 运行记录模板见 `reports/run-record-template.md`。

## 核心链路

- 将业务表导出为 Parquet。
- 注册 Iceberg 表。
- 用 Trino 查询明细。
- 用 Spark 生成派生表。
- 记录 schema 演化和分区演化策略。
- 用 `run.sh` 做对象布局、Iceberg DDL、Trino 查询、Spark 转换和演化记录的本地静态检查。

## 验收指标

- [ ] 能说明文件格式和表格式的区别。
- [ ] 有 Parquet 分区设计。
- [ ] 有 Iceberg 表定义。
- [ ] 有 Trino 查询样例。
- [ ] 有 Spark 批处理转换说明。
- [x] 有本地静态检查入口和运行记录模板。

## 运行命令

```bash
project-workbench/projects/04-mini-lakehouse/run.sh
pnpm projects:verify
```

如果本机有 Spark、Trino 和 Iceberg Catalog，可以把 `iceberg/orders.sql`、`spark/build-order-items-wide.sql`、`trino/orders-analysis.sql` 分别放入对应引擎执行。本项目当前先提供可检查产物，不声称本仓库环境已端到端运行。

## 质量检查

- 每个派生表必须记录来源表、转换逻辑和刷新周期。
- schema 变更必须说明兼容性影响。
- 分区演化必须说明查询收益、小文件风险和回滚边界。

## 复盘问题

- 湖仓解决了哪些数仓和数据湖之间的问题？
- 哪些问题仍然需要调度、治理和质量系统解决？
