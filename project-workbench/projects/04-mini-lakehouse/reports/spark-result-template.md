# Spark 转换结果模板

## 执行环境

| 维度 | 值 |
| --- | --- |
| Spark 版本 | [待填写] |
| Iceberg Catalog | [待填写] |
| 执行模式 | local[*] |

## 转换 1：生成派生表 order_items_wide

```sql
INSERT OVERWRITE lakehouse.order_items_wide
SELECT
  oi.order_item_id,
  oi.order_id,
  o.user_id,
  o.order_status,
  o.created_at,
  oi.product_id,
  p.product_name,
  p.category,
  p.list_price,
  oi.quantity,
  oi.item_amount
FROM lakehouse.raw_order_items oi
JOIN lakehouse.orders o ON oi.order_id = o.order_id
JOIN lakehouse.raw_products p ON oi.product_id = p.product_id;
```

| 指标 | 结果 |
| --- | --- |
| 写入行数 | [待运行时验证] |
| 写入分区数 | [待运行时验证] |
| 执行时间 | [待运行时验证] |

## 转换 2：Schema 演化（添加列）

```sql
ALTER TABLE lakehouse.orders ADD COLUMN discount_amount DECIMAL(12,2) DEFAULT 0;
```

| 指标 | 结果 |
| --- | --- |
| 演化状态 | [待运行时验证] |
| 旧数据默认值 | [待运行时验证] |

## 转换 3：分区演化

```sql
ALTER TABLE lakehouse.orders DROP PARTITION FIELD dt;
ALTER TABLE lakehouse.orders ADD PARTITION FIELD category;
```

| 指标 | 结果 |
| --- | --- |
| 演化状态 | [待运行时验证] |
| 新分区字段 | [待运行时验证] |

## 转换 4：数据质量检查

```sql
-- 检查空值
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE order_id IS NULL) AS null_order_id,
  COUNT(*) FILTER (WHERE user_id IS NULL) AS null_user_id,
  COUNT(*) FILTER (WHERE total_amount IS NULL) AS null_total_amount
FROM lakehouse.orders;
```

| 指标 | 结果 |
| --- | --- |
| total_rows | [待运行时验证] |
| null_order_id | [待运行时验证] |
| null_user_id | [待运行时验证] |
| null_total_amount | [待运行时验证] |

**注意**：以上转换结果需要在真实 Spark + Iceberg 环境中执行，当前环境未安装。
