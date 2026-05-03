# 项目 2 运行记录模板

## 环境

- PostgreSQL 版本：
- ClickHouse 版本：
- 同步方式：初始同步 / updated_at 增量 / CDC
- 同步批次号：

## 执行命令

```bash
project-workbench/projects/02-postgres-to-clickhouse/run.sh
clickhouse client --queries-file project-workbench/projects/02-postgres-to-clickhouse/clickhouse/schema.sql
clickhouse client --queries-file project-workbench/projects/02-postgres-to-clickhouse/queries/daily-gmv.sql
```

## 静态检查

- `run.sh` 结果：
- schema 检查结果：
- 查询检查结果：

## 引擎执行

- ClickHouse DDL 执行结果：
- 明细表写入行数：
- 汇总 SQL 执行结果：
- BI 查询样例：

## 对账摘要

| 指标 | PostgreSQL 源 | ClickHouse 明细 | ClickHouse 汇总 | 差异 | 解释 |
| --- | ---: | ---: | ---: | ---: | --- |
| 订单明细行数 |  |  |  |  |  |
| 支付 GMV |  |  |  |  |  |
| 支付订单数 |  |  |  |  |  |

## 结论

- 本次是否只是静态检查：
- 本次是否真实连接 ClickHouse：
- 未完成项：
