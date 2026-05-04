# Trino 查询结果模板

## 查询环境

| 维度 | 值 |
| --- | --- |
| Trino 版本 | [待填写] |
| Iceberg Catalog | [待填写] |
| 数据源 | [待填写] |

## 查询 1：订单总数和 GMV

```sql
SELECT
  COUNT(*) AS total_orders,
  SUM(total_amount) AS total_gmv
FROM lakehouse.orders;
```

| 指标 | 结果 |
| --- | --- |
| total_orders | [待运行时验证] |
| total_gmv | [待运行时验证] |

## 查询 2：每日订单趋势

```sql
SELECT
  dt,
  COUNT(*) AS order_count,
  SUM(total_amount) AS daily_gmv
FROM lakehouse.orders
GROUP BY dt
ORDER BY dt;
```

| dt | order_count | daily_gmv |
| --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 3：品类销售排名

```sql
SELECT
  category,
  SUM(item_amount) AS category_gmv,
  COUNT(DISTINCT order_id) AS order_count
FROM lakehouse.order_items_wide
GROUP BY category
ORDER BY category_gmv DESC;
```

| category | category_gmv | order_count |
| --- | --- | --- |
| [待运行时验证] | [待运行时验证] | [待运行时验证] |

## 查询 4：用户 GMV 分布

```sql
SELECT
  user_id,
  SUM(total_amount) AS user_gmv
FROM lakehouse.orders
GROUP BY user_id
ORDER BY user_gmv DESC;
```

| user_id | user_gmv |
| --- | --- |
| [待运行时验证] | [待运行时验证] |

## 查询 5：时间旅行查询（Iceberg 特性）

```sql
-- 查询历史快照
SELECT COUNT(*) FROM lakehouse.orders
FOR TIMESTAMP AS OF TIMESTAMP '2026-04-04 00:00:00';
```

| 指标 | 结果 |
| --- | --- |
| 历史快照行数 | [待运行时验证] |

**注意**：以上查询结果需要在真实 Trino + Iceberg 环境中执行，当前环境未安装。
