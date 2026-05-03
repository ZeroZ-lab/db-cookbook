# Schema 与分区演化记录

## Schema 演化

| 版本 | 变更 | 兼容性 | 处理动作 |
| --- | --- | --- | --- |
| v1 | 建立 `lakehouse.orders` 和 `lakehouse.order_items_wide` | 初始版本 | 记录字段来源和分区规则 |
| v2 | 为订单表增加 `source_system` | 向后兼容 | 新写入任务填充，历史数据允许为空 |
| v3 | 为宽表增加 `transformed_at` | 向后兼容 | 批处理任务统一写入转换时间 |

## 分区演化

| 表 | 初始分区 | 后续分区 | 触发原因 |
| --- | --- | --- | --- |
| `lakehouse.orders` | `days(created_at)` | 待观察 | 日级订单查询为主 |
| `lakehouse.order_items_wide` | `days(created_at), category` | 可改为 `months(created_at), category` | 如果日分区文件过碎 |

## 边界

- schema 演化不能替代数据质量检查。
- 分区演化不能自动解决小文件问题，仍需要 compaction。
- 时间旅行能帮助回溯历史版本，但不能解释指标口径为什么变化。
