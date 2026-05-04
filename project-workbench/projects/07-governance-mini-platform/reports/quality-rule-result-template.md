# 质量规则运行结果模板

## 运行环境

| 维度 | 值 |
| --- | --- |
| 数据库 | PostgreSQL |
| 规则集 | quality/rules.sql |
| 运行时间 | [待填写] |

## 规则运行结果

### 规则 1: NOT NULL 检查

```sql
SELECT COUNT(*) FROM orders WHERE order_id IS NULL;
```

| 规则 | 表 | 字段 | 违规数 | 状态 |
| --- | --- | --- | --- | --- |
| NOT NULL | orders | order_id | [待运行时验证] | [待运行时验证] |
| NOT NULL | orders | user_id | [待运行时验证] | [待运行时验证] |
| NOT NULL | orders | total_amount | [待运行时验证] | [待运行时验证] |

### 规则 2: 唯一性检查

```sql
SELECT order_id, COUNT(*) FROM orders GROUP BY order_id HAVING COUNT(*) > 1;
```

| 规则 | 表 | 字段 | 重复数 | 状态 |
| --- | --- | --- | --- | --- |
| UNIQUE | orders | order_id | [待运行时验证] | [待运行时验证] |
| UNIQUE | users | email | [待运行时验证] | [待运行时验证] |

### 规则 3: 范围检查

```sql
SELECT COUNT(*) FROM orders WHERE total_amount < 0;
SELECT COUNT(*) FROM order_items WHERE quantity <= 0;
```

| 规则 | 表 | 字段 | 条件 | 违规数 | 状态 |
| --- | --- | --- | --- | --- | --- |
| RANGE | orders | total_amount | >= 0 | [待运行时验证] | [待运行时验证] |
| RANGE | order_items | quantity | > 0 | [待运行时验证] | [待运行时验证] |
| RANGE | products | list_price | >= 0 | [待运行时验证] | [待运行时验证] |

### 规则 4: 一致性检查

```sql
-- order_items 的 order_id 必须在 orders 中存在
SELECT COUNT(*) FROM order_items oi
LEFT JOIN orders o ON oi.order_id = o.order_id
WHERE o.order_id IS NULL;
```

| 规则 | 源表 | 目标表 | 孤立项数 | 状态 |
| --- | --- | --- | --- | --- |
| FK | order_items | orders | [待运行时验证] | [待运行时验证] |
| FK | payments | orders | [待运行时验证] | [待运行时验证] |
| FK | events | users | [待运行时验证] | [待运行时验证] |

### 规则 5: AI 评测来源命中

```sql
-- 检查 AI 评测结果是否有来源标注
SELECT COUNT(*) FROM governance.ai_evaluations
WHERE source_uri IS NULL OR source_uri = '';
```

| 规则 | 表 | 条件 | 违规数 | 状态 |
| --- | --- | --- | --- | --- |
| source_hit | ai_evaluations | source_uri NOT NULL | [待运行时验证] | [待运行时验证] |

## 总结

| 类别 | 总规则数 | 通过数 | 失败数 | 状态 |
| --- | --- | --- | --- | --- |
| NOT NULL | 3 | [待运行时验证] | [待运行时验证] | [待运行时验证] |
| UNIQUE | 2 | [待运行时验证] | [待运行时验证] | [待运行时验证] |
| RANGE | 3 | [待运行时验证] | [待运行时验证] | [待运行时验证] |
| FK | 3 | [待运行时验证] | [待运行时验证] | [待运行时验证] |
| source_hit | 1 | [待运行时验证] | [待运行时验证] | [待运行时验证] |
| **合计** | **12** | [待运行时验证] | [待运行时验证] | [待运行时验证] |

**注意**：以上运行结果需要在真实 PostgreSQL 环境中执行，当前环境未安装。
