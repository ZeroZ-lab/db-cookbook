# 查询分类说明

## 业务查询（OLTP 侧）

业务查询以点查为主，返回单条或少量记录，通常带精确索引条件。

| 查询 | 用途 | 典型 WHERE 条件 |
| --- | --- | --- |
| 查询单个订单详情 | 用户查看自己的订单 | `WHERE order_id = ?` |
| 查询用户历史订单 | 用户订单列表页 | `WHERE user_id = ? ORDER BY created_at DESC` |
| 查询商品信息 | 商品详情页 | `WHERE product_id = ?` |
| 查询支付状态 | 支付结果页 | `WHERE order_id = ? AND payment_status = ?` |
| 查询用户信息 | 用户中心 | `WHERE user_id = ?` |

## 分析查询（OLAP 侧）

分析查询以聚合为主，扫描大范围数据，返回统计结果。

| 查询 | 用途 | 典型聚合方式 |
| --- | --- | --- |
| 每日 GMV | 运营日报 | `GROUP BY date(created_at)` |
| 品类销售排名 | 品类分析 | `GROUP BY category ORDER BY gmv DESC` |
| 用户 GMV 分布 | 用户分层 | `GROUP BY user_id` 后统计分布 |
| 转化漏斗 | 产品分析 | `COUNT(DISTINCT user_id) GROUP BY event_name` |
| 复购率 | 用户忠诚度 | 子查询 + 聚合 |
| 支付方式分布 | 支付分析 | `GROUP BY payment_method` |
| 渠道转化率 | 渠道效果 | `JOIN users GROUP BY channel` |
| 用户留存 | 用户生命周期 | 自连接 + 时间差 |
