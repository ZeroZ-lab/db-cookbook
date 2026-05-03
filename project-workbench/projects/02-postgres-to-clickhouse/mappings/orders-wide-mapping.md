# PostgreSQL 到 ClickHouse 字段映射

目标表：`analytics.order_items_wide`

| ClickHouse 字段 | PostgreSQL 来源 | 语义 | 同步规则 |
| --- | --- | --- | --- |
| `order_item_id` | `order_items.order_item_id` | 订单明细主键 | 全量同步后按明细主键去重 |
| `order_id` | `orders.order_id` | 订单主键 | 与 `orders` JOIN |
| `user_id` | `orders.user_id` | 下单用户 | 与 `users` JOIN 获取用户属性 |
| `channel` | `users.channel` | 注册渠道 | 作为分析维度 |
| `user_level` | `users.user_level` | 用户等级 | 作为分析维度 |
| `product_id` | `order_items.product_id` | 商品主键 | 与 `products` JOIN |
| `product_name` | `products.product_name` | 商品名称 | 作为展示字段 |
| `category` | `products.category` | 商品品类 | 作为分析维度 |
| `quantity` | `order_items.quantity` | 商品数量 | 用于销量分析 |
| `item_amount` | `order_items.item_amount` | 明细金额 | 用于 GMV 明细汇总 |
| `order_status` | `orders.order_status` | 订单状态 | 口径过滤字段 |
| `payment_status` | `payments.payment_status` | 支付状态 | 口径过滤字段 |
| `payment_method` | `payments.payment_method` | 支付方式 | 作为分析维度 |
| `created_at` | `orders.created_at` | 下单时间 | 分区和排序字段 |
| `paid_at` | `payments.paid_at` | 支付时间 | GMV 口径时间字段 |
| `sync_version` | 同步任务生成 | 同步批次或增量版本 | 用于重跑和对账 |

## 边界

- ClickHouse 表不承担订单事务约束，主外键和状态流转仍以 PostgreSQL 为准。
- 宽表中的用户、商品属性是分析快照，不代表业务系统当前最新状态。
- 退款、取消和迟到支付需要通过后续修正批次或 CDC 链路处理。
