# 对账口径说明

## 对账目标

验证 PostgreSQL 源数据与 ClickHouse 目标数据的一致性。

## 对账维度

### 1. 行数对账

```sql
-- PostgreSQL 源
SELECT COUNT(*) FROM orders WHERE order_status = 'paid';

-- ClickHouse 目标
SELECT COUNT(*) FROM analytics.orders_wide WHERE order_status = 'paid';
```

**预期**：行数一致。如果不一致，检查同步任务是否有遗漏或重复。

### 2. GMV 对账

```sql
-- PostgreSQL 源
SELECT SUM(total_amount) FROM orders WHERE order_status = 'paid';

-- ClickHouse 目标
SELECT sumIf(item_amount, order_status = 'paid') FROM analytics.orders_wide;
```

**预期**：GMV 一致。如果不一致，检查字段映射和金额计算逻辑。

### 3. 订单数对账

```sql
-- PostgreSQL 源
SELECT COUNT(DISTINCT order_id) FROM orders WHERE order_status = 'paid';

-- ClickHouse 目标
SELECT uniqExactIf(order_id, order_status = 'paid') FROM analytics.orders_wide;
```

**预期**：订单数一致。

## 对账记录模板

| 对账项 | PostgreSQL 值 | ClickHouse 值 | 差异 | 原因 |
| --- | --- | --- | --- | --- |
| 订单行数 | [待填写] | [待填写] | [待填写] | [待填写] |
| GMV | [待填写] | [待填写] | [待填写] | [待填写] |
| 订单数 | [待填写] | [待填写] | [待填写] | [待填写] |

## 不一致时的排查步骤

1. 检查同步任务日志，确认是否有失败或跳过
2. 检查增量同步的时间窗口，是否有遗漏
3. 检查 ReplacingMergeTree 的 version 字段，是否有旧版本覆盖
4. 检查字段映射，是否有精度丢失或类型转换问题
