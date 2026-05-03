# 项目 1：PostgreSQL 电商数据分析库

## 目标

用 PostgreSQL 完成一个最小电商分析库，训练表设计、约束、JOIN、聚合、窗口函数、指标口径和执行计划判断。

## 系统位置

```text
PostgreSQL 业务明细
  -> SQL 分析查询
  -> 指标口径
  -> 慢查询解释
```

这是从“会查询数据”进入“能解释数据”的第一步。

## 数据模型

- `users`：用户和注册来源。
- `products`：商品和品类。
- `orders`：订单状态、金额和时间。
- `order_items`：订单明细。
- `payments`：支付状态和支付方式。
- `events`：浏览、加购、下单等行为事件。

## 核心链路

- 使用 `site/public/examples/ecommerce-postgres.sql` 建表和装载样例数据。
- 使用 `site/public/examples/chapter-02-queries.sql` 执行分析查询。
- 为 GMV、订单数、客单价、复购率、转化率写出口径说明。
- 对至少 3 条查询执行 `EXPLAIN` 并记录慢在哪里。

## 验收指标

- [ ] 6 张核心表能创建成功。
- [ ] 样例查询能在 PostgreSQL 中真实执行。
- [ ] 至少 20 条分析 SQL 有口径说明。
- [ ] 至少 3 条查询有执行计划解释。
- [ ] 能说明索引、分区、物化视图分别适合解决什么问题。

## 运行命令

如果本机已有 PostgreSQL 客户端：

```bash
bash project-workbench/projects/01-postgresql-analytics/run.sh
```

如果本机没有 PostgreSQL，但有 Docker：

```bash
docker compose -f project-workbench/projects/01-postgresql-analytics/docker-compose.yml up -d
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=db_cookbook PGPASSWORD=db_cookbook DB_NAME=db_cookbook_lab \
  bash project-workbench/projects/01-postgresql-analytics/run.sh
```

运行完成后，把环境、命令输出和 `EXPLAIN` 结果记录到 `reports/run-record-template.md` 的副本中。

## 质量检查

- `pnpm sql:verify` 检查 SQL 样例与 schema 引用是否一致。
- 真实 PostgreSQL 执行结果需要另行记录到本项目复盘文档。

## 复盘问题

- 哪些查询适合保留在 PostgreSQL？
- 哪些查询已经暴露单机分析边界？
- 哪些指标最容易因为口径不清导致误判？
