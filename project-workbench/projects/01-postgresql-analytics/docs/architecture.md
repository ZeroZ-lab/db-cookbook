# 项目 1 架构链路图

## 系统架构

```text
PostgreSQL 业务明细库
  |
  |-- users (用户主数据)
  |-- products (商品主数据)
  |-- orders (订单主表)
  |-- order_items (订单明细)
  |-- payments (支付记录)
  |-- events (行为事件)
  |
  v
SQL 分析查询层
  |
  |-- 业务查询：订单状态、用户信息、商品详情
  |-- 分析查询：GMV 趋势、复购率、转化漏斗、客单价
  |-- 窗口查询：用户订单序号、累计 GMV、移动平均
  |
  v
指标口径层
  |
  |-- GMV = SUM(total_amount) WHERE order_status = 'paid'
  |-- 订单数 = COUNT(DISTINCT order_id) WHERE order_status = 'paid'
  |-- 客单价 = GMV / 付费用户数
  |-- 复购率 = 二次及以上购买用户数 / 付费用户数
  |-- 转化率 = 下单用户数 / 活跃用户数
  |
  v
执行计划分析
  |
  |-- EXPLAIN ANALYZE 查看实际执行计划
  |-- Seq Scan vs Index Scan 判断
  |-- Nested Loop vs Hash Join vs Merge Join 选择
  |-- 索引优化前后对比
```

## 业务事实关系

```text
users (1) ----< (N) orders
  |                  |
  |                  |-- order_status: created / paid / shipped / completed / cancelled
  |                  |-- total_amount: 订单总金额
  |                  |-- created_at: 下单时间
  |                  |-- paid_at: 支付时间
  |
  v                  v
events            order_items (N) >---- (1) products
(行为事件)           |                        |
  |-- app_open      |-- quantity: 数量        |-- category: 品类
  |-- view_product  |-- item_amount: 行金额   |-- list_price: 标价
  |-- purchase
  |-- add_to_cart
                    payments (N) >---- (1) orders
                      |
                      |-- payment_status: pending / success / failed
                      |-- payment_method: card / wallet / bank_transfer
                      |-- paid_amount: 实付金额
```

## 查询分类

### 业务查询（OLTP 侧）

- 查询单个订单详情
- 查询用户历史订单
- 查询商品库存和价格
- 更新订单状态

### 分析查询（OLAP 侧）

- 每日 GMV 趋势
- 品类销售排名
- 用户复购率
- 转化漏斗分析
- 支付方式分布

## 支撑分析问题

### payments 支撑

- 支付成功率分析
- 支付方式偏好
- 支付失败原因分布
- 实付金额 vs 标价差异（优惠分析）

### events 支撑

- 用户行为漏斗（浏览 -> 加购 -> 下单）
- DAU / MAU 活跃度
- 商品浏览热度
- 渠道转化率
