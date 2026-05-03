# 项目 2 对账记录

## 环境

- 日期：
- PostgreSQL 数据库：
- ClickHouse 版本：
- 同步方式：批量 / 增量 / CDC
- 同步版本：

## 明细行数对账

| 来源 | SQL | 行数 | 结果 |
| --- | --- | --- | --- |
| PostgreSQL | `SELECT count(*) FROM order_items` |  |  |
| ClickHouse | `SELECT count(*) FROM analytics.order_items_wide` |  |  |

## 指标对账

| 指标 | PostgreSQL 结果 | ClickHouse 结果 | 差异 | 说明 |
| --- | --- | --- | --- | --- |
| paid GMV |  |  |  |  |
| paid orders |  |  |  |  |
| paid users |  |  |  |  |

## 性能对比

| 查询 | PostgreSQL 耗时 | ClickHouse 耗时 | 说明 |
| --- | --- | --- | --- |
| 日 GMV |  |  |  |
| 品类 GMV |  |  |  |
| 渠道 GMV |  |  |  |

## 复盘

- 列式存储带来的收益：
- 排序键带来的收益：
- 预聚合带来的收益：
- 仍然不能迁移到 ClickHouse 的业务逻辑：
