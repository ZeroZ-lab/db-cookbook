# 分区和物化视图设计说明

## 分区设计

### 适用场景

- 单表数据量超过千万行
- 查询经常带时间范围条件
- 需要按时间归档或删除旧数据

### 设计方案：orders 表按月分区

```sql
-- 创建分区父表
CREATE TABLE orders_partitioned (
  order_id integer NOT NULL,
  user_id integer NOT NULL,
  order_status text NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  created_at timestamp NOT NULL,
  paid_at timestamp
) PARTITION BY RANGE (created_at);

-- 创建月度分区
CREATE TABLE orders_2026_04 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE orders_2026_05 PARTITION OF orders_partitioned
  FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

-- 分区键上的索引会自动创建
CREATE INDEX idx_orders_part_user ON orders_partitioned(user_id, created_at DESC);
```

### 分区优势

- 查询带 `WHERE created_at >= '2026-04-01'` 时，只扫描对应分区
- 删除旧数据只需 `DROP TABLE orders_2026_04`，无需 DELETE
- 每个分区独立维护索引，索引更小

### 分区局限

- 分区键必须包含在主键和唯一约束中
- 跨分区查询需要扫描多个分区
- 小数据量下分区反而增加管理复杂度

## 物化视图设计

### 适用场景

- 聚合查询频繁但数据变化不频繁
- 查询延迟要求高（秒级返回）
- 可接受数据延迟（分钟级到小时级）

### 设计方案：每日 GMV 物化视图

```sql
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT
  date(created_at) AS dt,
  COUNT(DISTINCT order_id) AS order_count,
  SUM(total_amount) AS gmv,
  COUNT(DISTINCT user_id) AS paid_users,
  ROUND(SUM(total_amount) / COUNT(DISTINCT user_id), 2) AS arpu
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 创建唯一索引，支持 CONCURRENTLY 刷新
CREATE UNIQUE INDEX idx_mv_daily_gmv_dt ON mv_daily_gmv(dt);
```

### 刷新策略

```sql
-- 全量刷新（锁表）
REFRESH MATERIALIZED VIEW mv_daily_gmv;

-- 并发刷新（不锁表，需要唯一索引）
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_gmv;
```

### 物化视图 vs 普通视图

| 维度 | 普通视图 | 物化视图 |
| --- | --- | --- |
| 存储 | 不存储数据 | 存储查询结果 |
| 查询速度 | 每次实时计算 | 直接读取结果 |
| 数据新鲜度 | 实时 | 需要手动刷新 |
| 适用场景 | 简单封装 | 复杂聚合加速 |

### 物化视图 vs 汇总表

| 维度 | 物化视图 | 汇总表 |
| --- | --- | --- |
| 定义 | 由查询自动派生 | 手工维护 |
| 刷新 | `REFRESH MATERIALIZED VIEW` | 手工 INSERT/UPDATE |
| 一致性 | 刷新时原子替换 | 需要自己保证一致性 |
| 灵活性 | 受限于 SQL 定义 | 完全灵活 |
