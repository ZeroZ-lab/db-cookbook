### 5.8 事实表设计

上一节学习了维度建模基础，了解了维度建模的核心概念和设计原则。

现在深入学习事实表的设计。

**场景**：
```yaml
数据仓库DWD层设计：
  
你："维度表设计好了，现在设计事实表"
  
数据分析师："我需要分析订单、用户行为、库存..."
  
你："好的，我们需要设计不同类型的事实表"
  
新同事："什么是事务事实表？什么是快照事实表？"
```

**问题**：
- 事实表有哪些类型？
- 如何设计不同类型的事实表？
- 设计事实表需要注意什么？

**答案**：**根据业务过程选择合适的事实表类型，遵循设计原则**

#### 一、事实表的类型

##### 1.1 事务事实表

**定义**：记录业务过程中的事件

**特点**：
```yaml
业务事件：
  - 每一行是一个业务事件
  - 例如：一个订单、一次点击、一次支付
  
粒度：
  - 最细粒度
  - 不可再分
  
更新：
  - 一旦写入，很少修改
```

**示例**：
```sql
-- 订单事务事实表
CREATE TABLE fact_orders (
    -- 维度外键
    order_id BIGINT,
    date_id INT,
    time_id INT,
    user_id BIGINT,
    product_id BIGINT,
    channel_id INT,
    
    -- 度量
    order_amount NUMERIC(10,2),
    order_quantity INT,
    order_profit NUMERIC(10,2),
    order_discount NUMERIC(10,2)
);
```

##### 1.2 周期快照事实表

**定义**：定期记录业务状态

**特点**：
```yaml
定期快照：
  - 每天一次
  - 每月一次
  - 每周一次
  
状态记录：
  - 记录某个时间点的状态
  - 例如：库存快照、账户快照
```

**示例**：
```sql
-- 库存快照事实表
CREATE TABLE fact_inventory_snapshot (
    -- 维度外键
    snapshot_date_id INT,
    product_id BIGINT,
    warehouse_id BIGINT,
    
    -- 度量
    stock_on_hand INT,        -- 现有库存
    stock_in_transit INT,      -- 在途库存
    stock_reserved INT,       -- 预留库存
    stock_available INT,      -- 可用库存
    stock_cost NUMERIC(10,2)  -- 库存成本
);
```

##### 1.3 累积快照事实表

**定义**：记录业务过程的全生命周期

**特点**：
```yaml
全生命周期：
  - 从开始到结束
  - 例如：订单从创建到完成
  
状态记录：
  - 记录每个状态的时间
  - 例如：创建时间、支付时间、发货时间、完成时间
```

**示例**：
```sql
-- 订单累积快照事实表
CREATE TABLE fact_order_lifecycle (
    -- 维度外键
    order_id BIGINT,
    user_id BIGINT,
    product_id BIGINT,
    
    -- 状态时间
    created_date_id INT,      -- 创建日期
    paid_date_id INT,         -- 支付日期
    shipped_date_id INT,      -- 发货日期
    completed_date_id INT,   -- 完成日期
    
    -- 度量
    order_amount NUMERIC(10,2),
    order_quantity INT,
    
    -- 技术字段
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

#### 二、事实表设计原则

##### 2.1 原则1：事实表围绕业务过程

**定义**：事实表对应一个明确的业务过程

**示例**：
```yaml
业务过程1：用户下单
  → 事实表：fact_orders
  → 粒度：每个订单
  
业务过程2：用户浏览商品
  → 事实表：fact_product_views
  → 粒度：每次浏览
  
业务过程3：用户加入购物车
  → 事实表：fact_cart_events
  → 粒度：每次加入购物车
```

**反例**：
```yaml
错误：事实表包含多个业务过程
  CREATE TABLE fact_orders_and_views (...);
  → 不清楚是什么业务过程
  → 粒度不一致
  
正确：每个业务过程一个事实表
  CREATE TABLE fact_orders (...);
  CREATE TABLE fact_product_views (...);
  → 业务过程清晰
  → 粒度一致
```

##### 2.2 原则2：事实表包含度量

**定义**：事实表必须包含可聚合的度量

**示例**：
```sql
-- 正确：包含度量
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    amount NUMERIC(10,2),     -- 度量
    quantity INT,             -- 度量
    profit NUMERIC(10,2)      -- 度量
);

-- 错误：没有度量
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT
    -- 没有度量！
);
```

**问题**：
```yaml
没有度量：
  - 无法聚合
  - 无法分析
  
正确做法：
  - 添加度量字段
  - 确保可聚合
```

##### 2.3 原则3：事实表包含维度外键

**定义**：事实表通过维度外键关联维度表

**示例**：
```sql
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,        -- 时间维度外键
    user_id BIGINT,      -- 用户维度外键
    product_id BIGINT,   -- 商品维度外键
    channel_id INT,      -- 渠道维度外键
    
    -- 度量
    amount NUMERIC(10,2),
    quantity INT
);
```

**优势**：
```yaml
维度分析：
  - 可以按维度分组
  - 可以按维度过滤
  
数据丰富：
  - 关联维度表
  - 获取维度描述信息
```

##### 2.4 原则4：事实表保持最小粒度

**定义**：事实表记录最细粒度的数据

**示例**：
```sql
-- 正确：最小粒度（每个订单）
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2)
);

-- 错误：提前聚合（每日GMV）
CREATE TABLE fact_daily_gmv (
    date_id INT,
    gmv NUMERIC(20,2)
);
```

**问题**：
```yaml
提前聚合：
  - 丢失明细数据
  - 无法进行更细粒度的分析
  
正确做法：
  - 事实表保持最小粒度
  - 汇总表在DWS层
```

#### 三、事实表粒度设计

##### 3.1 粒度定义

**定义**：数据的详细程度

**示例**：
```yaml
粗粒度：
  - 每日GMV
  - 每月GMV
  - 每个用户的GMV
  
细粒度：
  - 每个订单
  - 每次点击
  - 每次加入购物车
```

##### 3.2 粒度选择原则

**原则1：尽可能细**

**说明**：事实表应该记录最细粒度的数据

**示例**：
```sql
-- 正确：记录每个订单
CREATE TABLE fact_orders (
    order_id BIGINT,
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2)
);

-- 从细粒度汇总到粗粒度很容易
SELECT 
    date_id,
    sum(amount) as gmv
FROM fact_orders
GROUP BY date_id;

-- 从粗粒度细分到细粒度不可能
-- 如果事实表是每日GMV，无法还原每个订单的数据
```

**原则2：粒度要一致**

**说明**：事实表的粒度要一致，不能有的行是细粒度，有的行是粗粒度

**示例**：
```sql
-- 错误：粒度不一致
CREATE TABLE fact_orders (
    order_id BIGINT,          -- 有些行是订单粒度
    date_id INT,              -- 有些行是日期粒度
    user_id BIGINT,
    gmv NUMERIC(20,2)         -- 粒度不一致
);

-- 正确：粒度一致
CREATE TABLE fact_orders (
    order_id BIGINT,          -- 所有行都是订单粒度
    date_id INT,
    user_id BIGINT,
    product_id BIGINT,
    amount NUMERIC(10,2)       -- 每个订单的金额
);
```

#### 四、事实表设计步骤

##### 4.1 步骤1：识别业务过程

**目标**：明确要分析的业务过程

**示例**：
```yaml
业务过程识别：
  1. 用户下单（order）
  2. 用户浏览商品（product_view）
  3. 用户加入购物车（add_to_cart）
  4. 用户支付（payment）
```

##### 4.2 步骤2：确定粒度

**目标**：明确事实表的粒度

**示例**：
```yaml
订单事实表：
  - 粒度：每个订单
  
用户浏览事实表：
  - 粒度：每次浏览
  
库存快照事实表：
  - 粒度：每天快照
```

##### 4.3 步骤3：确定维度

**目标**：明确需要哪些维度

**示例**：
```yaml
订单事实表的维度：
  - 时间维度（何时）
  - 用户维度（谁）
  - 商品维度（什么商品）
  - 渠道维度（通过什么渠道）
```

##### 4.4 步骤4：确定度量

**目标**：明确需要哪些度量

**示例**：
```yaml
订单事实表的度量：
  - 订单金额（order_amount）
  - 订单数量（order_quantity）
  - 订单利润（order_profit）
  - 订单折扣（order_discount）
```

##### 4.5 步骤5：设计事实表

**目标**：综合以上信息，设计事实表

**示例**：
```sql
-- 订单事实表
CREATE TABLE fact_orders (
    -- 主键
    order_id BIGINT PRIMARY KEY,
    
    -- 维度外键
    date_id INT NOT NULL,
    time_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    channel_id INT NOT NULL,
    
    -- 度量
    order_amount NUMERIC(10,2) NOT NULL,
    order_quantity INT NOT NULL,
    order_profit NUMERIC(10,2),
    order_discount NUMERIC(10,2),
    
    -- 技术字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (date_id);

-- 创建索引
CREATE INDEX idx_fact_orders_date ON fact_orders(date_id);
CREATE INDEX idx_fact_orders_user ON fact_orders(user_id);
CREATE INDEX idx_fact_orders_product ON fact_orders(product_id);
```

#### 五、事实表设计示例

##### 5.1 示例1：订单事实表

**需求**：分析订单的GMV、订单量、利润

**设计**：
```sql
-- 订单事实表
CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    date_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    channel_id INT NOT NULL,
    
    -- 度量
    order_amount NUMERIC(10,2) NOT NULL,
    order_quantity INT NOT NULL,
    order_profit NUMERIC(10,2),
    order_discount NUMERIC(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (date_id);

-- 查询示例
SELECT
    d.year,
    d.month,
    sum(f.order_amount) as gmv,
    sum(f.order_quantity) as quantity
FROM fact_orders f
JOIN dim_date d ON f.date_id = d.date_id
GROUP BY d.year, d.month;
```

##### 5.2 示例2：用户行为事实表

**需求**：分析用户行为（浏览、点击、加购）

**设计**：
```sql
-- 用户行为事实表
CREATE TABLE fact_events (
    event_id BIGINT PRIMARY KEY,
    date_id INT NOT NULL,
    time_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    page_url VARCHAR(500),
    product_id BIGINT,
    
    -- 度量
    duration INT,              -- 停留时长（秒）
    scroll_depth INT,          -- 滚动深度（像素）
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (date_id);

-- 查询示例
SELECT
    event_type,
    count(*) as event_count,
    avg(duration) as avg_duration
FROM fact_events
WHERE date_id = 20260101
GROUP BY event_type;
```

##### 5.3 示例3：库存快照事实表

**需求**：分析库存变化

**设计**：
```sql
-- 库存快照事实表
CREATE TABLE fact_inventory_snapshot (
    snapshot_id BIGINT PRIMARY KEY,
    snapshot_date_id INT NOT NULL,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    
    -- 度量
    stock_on_hand INT NOT NULL,
    stock_in_transit INT,
    stock_reserved INT,
    stock_available INT,
    stock_cost NUMERIC(10,2),
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (snapshot_date_id);

-- 查询示例
SELECT
    snapshot_date_id,
    product_id,
    stock_on_hand
FROM fact_inventory_snapshot
WHERE snapshot_date_id >= 20260101 AND snapshot_date_id < 20260201
ORDER BY snapshot_date_id, product_id;
```

#### 六、常见误区

**误区一：事实表越多越好**

- **说明**：事实表应该根据业务过程设计，不是越多越好
- **后果**：过度设计，维护成本高
- **正确理解**：
  - 每个业务过程一个事实表
  - 根据需求设计
  - 避免过度设计

**误区二：事实表必须包含所有维度**

- **说明**：事实表只包含相关维度，不是所有维度
- **后果**：表过大，查询慢
- **正确理解**：
  - 只包含相关维度
  - 不相关的维度放在其他事实表
  - 保持事实表精简

**误区三：事实表可以包含描述信息**

- **说明**：事实表应该只包含度量，描述信息放在维度表
- **后果**：表过大，冗余多
- **正确理解**：
  - 事实表：度量
  - 维度表：描述信息
  - 职责分离

**误区四：事实表可以提前聚合**

- **说明**：事实表应该保持最小粒度，汇总在DWS层
- **后果**：丢失明细数据
- **正确理解**：
  - 事实表：最小粒度
  - DWS层：汇总数据
  - 分层设计

**误区五：所有事实表都必须有度量**

- **说明**：大部分事实表需要度量，但有些事实表可以只有维度外键（无事实事实表）
- **后果**：设计局限
- **正确理解**：
  - 大部分事实表需要度量
  - 特殊情况：无事实事实表
  - 例如：记录学生出勤，只有维度（学生、日期）

#### 七、实战任务

**任务1：设计订单事实表**

设计一个订单事实表：

```sql
-- 需求分析
业务过程：用户下单
粒度：每个订单
维度：时间、用户、商品、渠道
度量：订单金额、订单数量、订单利润

-- 设计
CREATE TABLE fact_orders (
    -- 主键
    order_id BIGINT PRIMARY KEY,
    
    -- 维度外键
    date_id INT NOT NULL,
    time_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    channel_id INT NOT NULL,
    
    -- 度量
    order_amount NUMERIC(10,2) NOT NULL,
    order_quantity INT NOT NULL,
    order_profit NUMERIC(10,2),
    order_discount NUMERIC(10,2),
    
    -- 技术字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (date_id);

-- 创建索引
CREATE INDEX idx_fact_orders_date ON fact_orders(date_id);
CREATE INDEX idx_fact_orders_user ON fact_orders(user_id);
CREATE INDEX idx_fact_orders_product ON fact_orders(product_id);
```

**任务2：设计库存快照事实表**

设计一个库存快照事实表：

```sql
-- 需求分析
业务过程：库存快照
粒度：每天快照
维度：日期、商品、仓库
度量：现有库存、在途库存、预留库存、可用库存

-- 设计
CREATE TABLE fact_inventory_snapshot (
    -- 主键
    snapshot_id BIGINT PRIMARY KEY,
    
    -- 维度外键
    snapshot_date_id INT NOT NULL,
    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,
    
    -- 度量
    stock_on_hand INT NOT NULL,
    stock_in_transit INT,
    stock_reserved INT,
    stock_available INT,
    stock_cost NUMERIC(10,2),
    
    -- 技术字段
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (snapshot_date_id);

-- 创建索引
CREATE INDEX idx_inventory_snapshot_date ON fact_inventory_snapshot(snapshot_date_id);
CREATE INDEX idx_inventory_snapshot_product ON fact_inventory_snapshot(product_id);
```

**任务3：对比不同类型事实表**

对比事务事实表和快照事实表：

```sql
-- 事务事实表：订单事实表
-- 特点：记录每个订单
-- 优点：明细数据，可以分析每个订单
-- 缺点：数据量大

CREATE TABLE fact_orders (
    order_id BIGINT PRIMARY KEY,
    date_id INT NOT NULL,
    user_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    order_amount NUMERIC(10,2) NOT NULL,
    order_quantity INT NOT NULL
);

-- 快照事实表：库存快照事实表
-- 特点：记录每天快照
-- 优点：可以分析库存变化趋势
-- 缺点：数据量相对较小

CREATE TABLE fact_inventory_snapshot (
    snapshot_id BIGINT PRIMARY KEY,
    snapshot_date_id INT NOT NULL,
    product_id BIGINT NOT NULL,
    stock_on_hand INT NOT NULL
);

-- 选择：
-- 分析订单：使用事务事实表
-- 分析库存：使用快照事实表
```

#### 八、小结

事实表设计根据业务过程选择合适的事实表类型，遵循设计原则。

核心要点：
- 事实表类型：事务事实表、周期快照事实表、累积快照事实表
- 设计原则：围绕业务过程、包含度量、包含维度外键、保持最小粒度
- 粒度设计：尽可能细、保持一致
- 设计步骤：识别业务过程 → 确定粒度 → 确定维度 → 确定度量 → 设计事实表
- 设计示例：订单事实表、用户行为事实表、库存快照事实表
- 常见误区：不是越多越好、只包含相关维度、职责分离

下一节将进入维度表设计，了解维度表的类型、设计原则、设计方法等。
