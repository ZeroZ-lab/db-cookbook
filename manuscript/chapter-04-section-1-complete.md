### 4.1 为什么一个数据库很难同时做好交易和分析

前3章学习了SQL能力和PostgreSQL大表能力。

但现实业务中，经常遇到一个矛盾：

**交易系统和分析系统总是打架**。

**场景**：
```text
上午9点：运营同学说"今天GMV报表怎么这么慢？"
   → 数据库正在处理大量订单写入，查询慢

下午2点：技术团队说"订单系统卡顿，能不能停掉分析查询？"
   → 分析查询占用了大量资源，影响交易

结果：
- 交易慢：用户体验差
- 分析慢：决策不及时
- 两个团队都不满意
```

**为什么会这样？**

因为**OLTP（交易处理）和OLAP（分析处理）的需求完全不同**：

**OLTP的需求**：
```yaml
- 事务一致性：订单和支付必须同时成功或失败
- 高并发写入：每秒1000个订单
- 响应时间：<100ms
- 数据精确：不能有错误
```

**OLAP的需求**：
```yaml
- 复杂查询：关联多张表，聚合计算
- 大量扫描：扫描数亿行数据
- 响应时间：秒级到分钟级可接受
- 历史数据：分析几年的数据
```

**同一个数据库**：
- 既要快速写入（OLTP）
- 又要快速查询（OLAP）
- 两者互相干扰

**结论**：
> 一个数据库很难同时做好交易和分析，需要根据需求选择合适的系统，或者拆分成两个系统。

#### 一、为什么OLTP和OLAP会冲突

**第一，资源竞争**

**场景**：订单系统

**OLTP操作**：
```sql
-- 用户下单（高频写入）
INSERT INTO orders (...) VALUES (...);
UPDATE orders SET status = 'paid' WHERE order_id = 123;
```

**OLAP操作**：
```sql
-- 运营看板查询（大查询）
SELECT
    date(created_at),
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at);
```

**冲突**：
- OLTP需要快速写入
- OLAP需要大量扫描
- 两者竞争CPU、内存、磁盘I/O
- 结果：都变慢

**第二，优化方向相反**

**OLTP优化**：
```yaml
写入优化：
  - 减少索引（加快写入）
  - 小事务（减少锁时间）
  - 行级锁（提高并发）

数据模型：
  - 规范化（减少冗余）
  - 分表（减少单表数据量）
```

**OLAP优化**：
```yaml
查询优化：
  - 增加索引（加快查询）
  - 预计算（物化视图）
  - 大内存（缓存数据）

数据模型：
  - 反规范化（增加冗余）
  - 宽表（减少JOIN）
  - 星型模型
```

**矛盾**：
- OLTP要减少索引，OLAP要增加索引
- OLTP要规范化，OLAP要反规范化
- 优化方向相反，无法兼顾

**第三，数据量级不同**

**OLTP数据量**：
```yaml
实时数据：
  - 订单：最近3个月
  - 用户：全部用户
  - 商品：全部商品

数据量：几GB到几十GB
```

**OLAP数据量**：
```yaml
历史数据：
  - 订单：最近3年
  - 用户行为：每天1000万行
  - 日志数据：每天1亿行

数据量：几TB到几十TB
```

**问题**：
- OLTP处理小数据量（几十GB）
- OLAP处理大数据量（几十TB）
- 如果放在一起，OLTP会被拖慢

#### 二、核心判断：OLTP和OLAP是两种不同的系统模式

> OLTP和OLAP的核心判断是：它们是两种根本不同的系统模式，分别优化交易处理和分析查询，强行合并会导致两者都做不好，应该根据场景选择或拆分。

这个判断说明：
- **OLTP**：优化交易处理（快速写入、事务一致性）
- **OLAP**：优化分析查询（复杂查询、历史数据）
- **冲突**：资源竞争、优化方向相反、数据量级不同
- **解决方案**：拆分或选择专用系统

#### 三、OLTP和OLAP的本质区别

##### 3.1 用户群体不同

**OLTP的用户**：
```yaml
前台用户：
  - 客户：下单、支付、查询
  - 客服：处理订单、退款
  - 运营：配置活动、查看实时数据

特点：
  - 并发高（每秒数千次）
  - 操作简单（单行查询、简单写入）
  - 响应时间要求高（<100ms）
```

**OLAP的用户**：
```yaml
后台用户：
  - 数据分析师：做报表、分析
  - 运营经理：看GMV、转化率
  - 管理层：看决策报表

特点：
  - 并发低（每小时几次）
  - 操作复杂（多表JOIN、聚合计算）
  - 响应时间要求低（秒级可接受）
```

##### 3.2 数据特性不同

**OLTP数据**：
```yaml
实时性：
  - 当前数据状态
  - 频繁变化（每秒数千次）

数据量：
  - 相对较小（GB级）

精度：
  - 精确数据（不能有错误）
  - 强一致性（ACID事务）

示例：
  - 当前库存：100件
  - 当前订单：5笔待支付
  - 当前余额：1000元
```

**OLAP数据**：
```yaml
历史性：
  - 历史数据快照
  - 相对稳定（每天或每小时更新）

数据量：
  - 非常大（TB级）

精度：
  - 可以有近似（分析结果不需要100%精确）
  - 最终一致性（可以有几秒延迟）

示例：
  - 昨天的GMV：100万元
  - 上周的转化率：5%
  - 去年的留存率：30%
```

##### 3.3 查询模式不同

**OLTP查询**：
```sql
-- 查询1：查询单个订单
SELECT * FROM orders WHERE order_id = 123;

-- 查询2：查询单个用户的最近订单
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at DESC LIMIT 10;

-- 查询3：查询商品库存
SELECT stock FROM products WHERE product_id = 456;
```

**特点**：
- 返回少量数据（几行到几十行）
- 简单查询（单表、简单JOIN）
- 通过索引快速定位

**OLAP查询**：
```sql
-- 查询1：每天GMV趋势
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at)
ORDER BY order_date;

-- 查询2：用户留存分析
WITH cohort_users AS (
    SELECT
        user_id,
        min(date(registered_at)) as cohort_date
    FROM users
    GROUP BY user_id
),
retention AS (
    SELECT
        c.user_id,
        c.cohort_date,
        count(DISTINCT date(o.created_at)) as active_days
    FROM cohort_users c
    LEFT JOIN orders o ON c.user_id = o.user_id
    GROUP BY c.user_id, c.cohort_date
)
SELECT * FROM retention;

-- 查询3：同群分析
SELECT
    date(created_at) as order_date,
    count(DISTINCT user_id) as unique_users
FROM events
GROUP BY date(created_at);
```

**特点**：
- 返回大量数据（数百万行）
- 复杂查询（多表JOIN、子查询、窗口函数）
- 全表扫描或大量扫描

#### 四、混合使用的问题

##### 4.1 性能干扰

**场景**：订单系统

**OLTP影响OLAP**：
```sql
-- 下午2点：订单高峰期
-- 每秒1000个订单写入
-- OLAP查询：分析最近7天的GMV

-- 问题：
-- 1. OLAP查询扫描大量数据，占用CPU
-- 2. OLTP写入等待CPU，响应时间增加
-- 3. 用户体验变差（下单慢）
```

**OLAP影响OLTP**：
```sql
-- 晚上8点：分析高峰期
-- 运营同学看GMV报表
-- 复杂查询执行5分钟

-- 问题：
-- 1. OLAP查询占用大量内存
-- 2. OLTP可用内存减少
-- 3. 数据库整体性能下降
```

##### 4.2 锁竞争

**OLTP事务**：
```sql
BEGIN;
UPDATE inventory SET stock = stock - 1 WHERE product_id = 456;
INSERT INTO orders (...) VALUES (...);
COMMIT;
```

**OLAP查询**：
```sql
SELECT * FROM orders o JOIN inventory i ON o.product_id = i.product_id;
```

**冲突**：
- OLAP扫描orders表，可能锁表
- OLTP等待锁，响应时间增加
- 并发下降

##### 4.3 索引策略冲突

**OLTP需要的索引**：
```sql
-- 快速查找订单
CREATE INDEX idx_orders_id ON orders(order_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 快速更新订单
CREATE INDEX idx_orders_status ON orders(order_status);
```

**OLAP需要的索引**：
```sql
-- 快速分析
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 覆盖索引（包含查询的所有字段）
CREATE INDEX idx_orders_covering ON orders(user_id, total_amount, created_at);
```

**问题**：
- 索引太多，OLTP写入慢
- 索引维护成本高
- 存储空间占用大

#### 五、实际案例

##### 5.1 案例一：电商订单系统

**原始架构**：
```yaml
单一PostgreSQL数据库：
  - 处理订单写入（OLTP）
  - 生成GMV报表（OLAP）
```

**问题**：
```yaml
大促期间：
  - 订单量增加10倍
  - GMV报表查询时间从5秒增加到5分钟
  - 订单写入响应时间从50ms增加到500ms
  
用户投诉：
  - 下单慢
  - 支付慢
  - 经常超时
```

**优化方案**：
```yaml
方案A：读写分离
  - 主库：处理订单写入
  - 从库：生成GMV报表
  - 问题：从库也有压力，报表还是慢

方案B：分库分表
  - 按用户ID分片
  - 问题：报表需要跨库查询
  
方案C：拆分OLTP和OLAP
  - OLTP：MySQL（处理订单）
  - OLAP：ClickHouse（生成报表）
  - 通过ETL同步数据
  - 结果：OLTP响应时间<100ms，OLAP查询时间<10秒
```

##### 5.2 案例二：用户行为分析

**原始架构**：
```yaml
单一PostgreSQL数据库：
  - 存储用户行为事件（每天1000万行）
  - 分析用户留存、转化漏斗
```

**问题**：
```yaml
数据增长：
  - 3个月：10亿行
  - 1年：100亿行
  - 数据库大小：1TB → 10TB

性能下降：
  - 查询越来越慢（5秒 → 5分钟）
  - 数据库维护困难（备份、恢复需要数小时）
  - 索引重建需要很长时间
```

**优化方案**：
```yaml
方案A：分表
  - 按月分表
  - 问题：跨表查询复杂
  
方案B：归档旧数据
  - 删除1年前数据
  - 问题：无法分析历史数据

方案C：OLAP专用系统
  - OLTP：PostgreSQL（存储最近3个月数据）
  - OLAP：ClickHouse（存储全部历史数据）
  - 通过ETL同步数据
  - 结果：
    - OLTP：轻快，处理实时数据
    - OLAP：快速分析全部历史数据
```

#### 六、常见误区

**误区一：一个数据库可以同时做好OLTP和OLAP**

- **说明**：OLTP和OLAP需求完全不同，强行合并会导致两者都做不好
- **后果**：交易慢、分析慢、用户体验差
- **正确理解**：
  - 小规模（<1000万行，<100 QPS）：可以合并
  - 大规模：必须拆分
  - 根据实际场景选择

**误区二：读写分离可以解决问题**

- **说明**：读写分离可以缓解问题，但不是根本解决方案
- **后果**：从库也有压力，OLAP查询还是慢
- **正确理解**：
  - 读写分离是过渡方案
  - 最终还是需要OLAP专用系统
  - 大数据量必须用OLAP专用系统

**误区三：OLTP数据可以实时用于OLAP**

- **说明**：OLTP数据实时变化，OLAP需要稳定快照
- **后果**：分析结果不准确、性能差
- **正确理解**：
  - OLAP使用OLTP的数据副本
  - 通过ETL定期同步
  - 有延迟（几分钟到几小时）

**误区四：OLAP系统必须很贵**

- **说明**：OLAP系统有很多选择，不一定贵
- **后果**：不敢上OLAP，继续受影响
- **正确理解**：
  - 开源方案：ClickHouse、Doris（免费）
  - 云方案：BigQuery、Redshift（按需付费）
  - 根据数据量和查询频率选择

**误区五：拆分后实时性会变差**

- **说明**：拆分后OLTP和OLAP分离，但可以通过ETL保证准实时性
- **后果**：担心实时性差，不敢拆分
- **正确理解**：
  - OLTP：实时（毫秒级）
  - OLAP：准实时（几分钟延迟）
  - 对于大部分分析场景，几分钟延迟完全可以接受

#### 七、实战任务

**任务1：分析系统瓶颈**

给定一个电商系统，分析OLTP和OLAP的冲突：

```sql
-- 当前架构：单一PostgreSQL数据库
-- 数据量：订单表5000万行，用户表1000万行
-- QPS：500（400读，100写）
-- 主要OLTP操作：
--   - 创建订单（INSERT）
--   - 更新订单状态（UPDATE）
--   - 查询订单（SELECT）
-- 主要OLAP操作：
--   - 每日GMV报表
--   - 用户留存分析
--   - 商品销量排行
```

**分析**：
```yaml
性能问题：
  - 高峰期订单响应时间>500ms
  - GMV报表查询时间>5分钟
  - 数据库CPU使用率>80%

瓶颈分析：
  - OLAP查询扫描大量数据（数千万行）
  - 占用大量CPU和内存
  - 影响OLTP写入性能

优化建议：
  - 短期：读写分离，报表查询走从库
  - 中期：历史数据归档，OLAP只查最近3个月
  - 长期：OLTP和OLAP拆分，OLAP用ClickHouse
```

**任务2：设计拆分方案**

设计OLTP和OLAP拆分方案：

```yaml
需求：
  - 订单量：每天10万笔
  - 查询QPS：100（读）+ 500（写）
  - 分析需求：每天GMV、用户留存、转化漏斗

OLTP系统（PostgreSQL）：
  功能：订单写入、查询、更新
  数据量：最近3个月数据（约1000万行）
  性能要求：响应时间<100ms
  优化：
    - 只保留必要索引
    - 规范化设计
    - 读写分离

OLAP系统（ClickHouse）：
  功能：GMV报表、用户分析、转化漏斗
  数据量：全部历史数据
  性能要求：查询时间<10秒
  优化：
    - 宽表设计
    - 物化视图
    - 分区表

数据同步（ETL）：
  频率：每小时一次
  方式：从PostgreSQL抽取增量数据，导入ClickHouse
  延迟：最多1小时
```

**任务3：验证拆分效果**

验证拆分后的性能：

```sql
-- OLTP系统（PostgreSQL）
-- 测试写入性能
INSERT INTO orders (...) VALUES (...);
-- 响应时间：50ms（符合要求<100ms）

-- 测试查询性能
SELECT * FROM orders WHERE order_id = 123;
-- 响应时间：10ms（符合要求<100ms）

-- OLAP系统（ClickHouse）
-- 测试分析查询
SELECT
    toDate(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= now() - INTERVAL 30 DAY
GROUP BY toDate(created_at);
-- 响应时间：5秒（符合要求<10秒）
```

#### 八、小结

一个数据库很难同时做好交易和分析。

核心要点：
- OLTP和OLAP需求完全不同（用户、数据、查询）
- 混合使用会导致性能干扰、锁竞争、索引冲突
- 小规模可以合并，大规模必须拆分
- 拆分后各有优化：OLTP快速写入、OLAP快速查询
- 数据同步通过ETL实现

下一节将进入从单机到分工：系统的自然演化，了解为什么系统会从单一数据库演化为分工架构。
