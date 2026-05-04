# DDL 和样例数据来源说明

## DDL 来源

PostgreSQL DDL 定义在 `site/public/examples/ecommerce-postgres.sql`，包含：

- 6 张核心表：`users`, `products`, `orders`, `order_items`, `payments`, `events`
- 完整的 `CREATE TABLE` 语句，含主键、外键、CHECK 约束
- 2 个索引：`idx_orders_user_created`, `idx_events_time`

## 样例数据来源

样例数据为手工构造的教学数据，不来自真实生产环境：

| 表 | 行数 | 构造方式 |
| --- | --- | --- |
| users | 4 | 手工构造，覆盖 organic/ads/partner 渠道 |
| products | 4 | 手工构造，覆盖 electronics/books 品类 |
| orders | 5 | 手工构造，覆盖 paid/created 状态 |
| order_items | 7 | 手工构造，一个订单可含多个商品 |
| payments | 4 | 手工构造，覆盖 card/wallet 支付方式 |
| events | 9 | 手工构造，覆盖 app_open/view_product/purchase 事件 |

## 数据装载方式

```bash
# 方式 1：直接执行 SQL 文件
psql -h localhost -U db_cookbook -d db_cookbook_lab -f site/public/examples/ecommerce-postgres.sql

# 方式 2：通过 Docker Compose
docker compose -f project-workbench/projects/01-postgresql-analytics/docker-compose.yml up -d
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=db_cookbook PGPASSWORD=db_cookbook DB_NAME=db_cookbook_lab \
  psql -f site/public/examples/ecommerce-postgres.sql
```

## 数据局限性

- 行数过少，无法体现真实查询性能差异
- 时间范围仅 3 天，无法做月度趋势分析
- 无退款、取消等复杂状态流转
- 无多仓、多币种等真实业务场景
