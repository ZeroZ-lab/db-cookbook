### 5.3 数仓的基本术语

维度建模有一套专门的词汇：维度、度量、事实表、维度表、星型模型、雪花模型、粒度。这套词汇不是学院派术语堆砌——每个词对应一个具体的表设计决策。把这些术语搞清楚，动手建数仓时才知道每个字段该放在哪张表里。

#### 维度和度量

这是最基础的两个概念。

**维度（Dimension）**回答"在什么条件下"的问题。日期、城市、产品品类、用户分群——这些都是维度。维度的特征是：取值有限（离散值），用来做 GROUP BY 和 WHERE 过滤。

**度量（Measure）**回答"是多少"的问题。GMV、订单数、利润、客单价——这些都是度量。度量的特征是：数值型，可聚合（SUM、COUNT、AVG、MAX）。

一个简单的分辨方法：看它能不能放进 GROUP BY。能的是维度，不能的是度量。

```sql
SELECT
    date(order_date) as 维度_日期,
    user_city as 维度_城市,
    sum(order_amount) as 度量_GMV,
    count(*) as 度量_订单量
FROM fact_orders f
JOIN dim_users u ON f.user_id = u.user_id
WHERE order_date >= '2026-01-01'
GROUP BY date(order_date), user_city;
```

实践中需要注意的细节：并非所有数值都是度量，年龄可以作为维度（GROUP BY age_group），因为它描述的是"谁"，不是"多少"。反过来，某些计数可以是度量（订单数、用户数），因为它们是聚合的结果。

#### 事实表和维度表

**事实表（Fact Table）**存储业务事件和度量数据。每一行代表一个真实的业务事件——一笔订单、一次页面浏览、一次登录。事实表的数据量是最大的，每天以百万到千万行的速度增长。

事实表有三种类型：

- **事务事实表**：记录每个业务事件。订单事实表（每行 = 一笔订单），页面浏览事实表（每行 = 一次PV）。这是最常见、最细粒度的事实表。
- **周期快照事实表**：记录定期状态。库存快照表（每天一张快照），账户余额表（每月一张快照）。适合分析趋势变化。
- **累积快照事实表**：记录一个业务过程的完整生命周期。订单生命周期表（从 created 到 paid 到 shipped 到 delivered 的时间点）。适合分析流程效率和瓶颈。

**维度表（Dimension Table）**存储描述信息。数据量相对小（百万级 vs 事实表的亿级），更新频率低，但查询时 JOIN 频率高。

一个典型的订单事实表和它的维度表：

```sql
-- 事实表
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,           -- 关联 dim_date
    user_id BIGINT,        -- 关联 dim_users
    product_id BIGINT,     -- 关联 dim_products
    order_amount NUMERIC(10,2),  -- 度量
    order_quantity INT           -- 度量
);

-- 维度表
CREATE TABLE dim_date (
    date_id INT PRIMARY KEY,
    date_value DATE,
    year INT, quarter INT, month INT, day INT,
    is_holiday BOOLEAN,
    is_weekend BOOLEAN
);

CREATE TABLE dim_users (
    user_id BIGINT PRIMARY KEY,
    user_name VARCHAR(100),
    user_city VARCHAR(100),
    user_segment VARCHAR(50)
);

CREATE TABLE dim_products (
    product_id BIGINT PRIMARY KEY,
    product_name VARCHAR(100),
    product_category VARCHAR(100),
    product_brand VARCHAR(100)
);
```

#### 星型模型和雪花模型

**星型模型（Star Schema）**：事实表在中心，所有维度表直接连接事实表。查询时每个维度只需要一次 JOIN。维度表反规范化——允许冗余（比如用户表里同时存 city 和 province），换取查询性能。

```
         商品维度表
              |
用户维度表 — 事实表 — 日期维度表
              |
         渠道维度表
```

星型模型是数据分析场景的默认选择。查询简单（SQL 清晰），性能好（JOIN 次数少），维护成本低。

**雪花模型（Snowflake Schema）**：维度表进一步规范化。比如商品维度拆成"商品表 → 三级分类表 → 二级分类表 → 一级分类表"。好处是节省存储空间，减少数据冗余。代价是查询需要多层 JOIN，SQL 变复杂，执行时间变长。

```sql
-- 雪花模型：商品查询需要 JOIN 三层
SELECT p.product_name, c3.category_name, c2.category_name
FROM fact_orders f
JOIN dim_products p ON f.product_id = p.product_id
JOIN dim_category_l3 c3 ON p.category_l3_id = c3.category_l3_id
JOIN dim_category_l2 c2 ON c3.category_l2_id = c2.category_l2_id;
```

实践证明，大多数情况下选星型模型就够了。只有当维度表自身非常大（比如 1000 万行的产品表），且维度属性经常独立变化时，才值得用雪花模型。存储成本已经很低了，为了省几十 MB 的空间牺牲查询性能不划算。

#### 粒度（Granularity）

粒度是事实表中每一行代表什么业务含义。这是一个设计决策，一旦确定就很难改。

- **订单粒度**：每行 = 一笔订单。可以回答"单笔订单金额是多少"。
- **日粒度**：每行 = 一天的汇总。只能回答"每天 GMV 多少"，不能下钻到单笔订单。
- **订单-商品粒度**：每行 = 一笔订单中的一个商品。可以回答"每个商品的销量"和"每笔订单包含哪些商品"。

粒度的选择原则很简单：事实表用最细粒度。你永远可以从细粒度汇总到粗粒度（`GROUP BY date_id`），但无法从粗粒度下钻到细粒度。汇总工作留给 DWS 层。

#### 数据立方体、下钻和上卷

当你有多个维度和一个度量，组合起来就是一个多维数据立方体。比如三个维度"时间 x 地区 x 产品"，加上度量"GMV"。

- **切片（Slice）**：固定一个维度。只看"北京"的数据。
- **切块（Dice）**：固定多个维度。看"2026 年 1 月北京地区电子产品"的数据。
- **下钻（Drill-down）**：从粗到细。从"年度 GMV"下钻到"月度 GMV"，再下钻到"每日 GMV"。
- **上卷（Roll-up）**：从细到粗。与下钻相反。

这些操作在 SQL 中就是不同的 GROUP BY 组合。BI 工具（Tableau、Metabase）的拖拽分析本质上就是在做这些多维操作。

#### 聚合和预计算

直接查事实表很慢（一次扫描几亿行）。预计算就是把常用的聚合结果提前算好存起来。

```sql
-- 创建物化视图做预计算
CREATE MATERIALIZED VIEW mv_daily_gmv AS
SELECT
    order_date,
    sum(order_amount) as gmv
FROM fact_orders
GROUP BY order_date;

-- 查询物化视图比查事实表快 100 倍以上
SELECT * FROM mv_daily_gmv WHERE order_date >= '2026-01-01';
```

预计算的核心决策不是"要不要做"，而是"哪些指标值得预计算"。经验规则：每天被查询超过 10 次的聚合，预计算。偶尔查一次的，没必要。

#### 常见误区

**"维度只能是文本"**。维度可以是数字（年龄、年份），关键在于它用于分组，不用于聚合。年龄在用户画像分析中就是维度（GROUP BY age_group）。

**"星型模型一定比雪花模型好"**。星型模型是大多数场景的正确选择，但在维度表非常大且属性频繁变化的场景，雪花模型有其合理性。关键在于判断标准不是"哪个模型更好"，而是"你的维度表多大、变化多频繁"。

**"事实表只能有一个"**。一个数仓通常有多个事实表，每个对应一个业务过程——订单事实表、浏览事实表、支付事实表。它们共享一致性维度（同一个用户维度表、同一个时间维度表），可以跨事实表做关联分析。

#### 小结

维度和度量是维度建模的基本元素，事实表和维度表是物理实现，星型模型和雪花模型是两种组织方式。粒度决定了你能回答什么层次的问题。这些术语贯穿后续所有章节——第 5.7-5.10 节会详细展开每种设计模式的实现。下一节回到数仓架构本身，讲分层的必要性：为什么要分 ODS/DWD/DWS/ADS 四层。
