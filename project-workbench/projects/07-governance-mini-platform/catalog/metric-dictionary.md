# 指标字典样例

| 指标 | 版本 | 负责人 | 口径 | 时间字段 | 状态 |
| --- | --- | --- | --- | --- | --- |
| GMV | v1 | analytics-team | 支付成功且订单状态为 `paid` 或 `completed` 的订单明细金额之和 | `paid_at` | active |
| paid_orders | v1 | analytics-team | 支付成功且订单状态有效的去重订单数 | `paid_at` | active |
| paid_users | v1 | growth-team | 支付成功订单中的去重用户数 | `paid_at` | active |
| retrieval_source_hit_rate | v1 | ai-platform-team | RAG 评测中命中期望来源的比例 | `evaluation_run_at` | draft |

## 口径冲突案例

问题：经营报表使用 `created_at` 统计 GMV，财务报表使用 `paid_at` 统计 GMV，导致同一天结果不一致。

处理：

- 指标字典必须记录时间字段。
- 报表必须引用指标版本。
- 如果业务确实需要两种口径，应拆成 `created_gmv` 和 `paid_gmv`，不能都叫 GMV。
