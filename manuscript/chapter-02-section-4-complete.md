### 2.4 多表关联：从分散数据中恢复完整业务事实

基础查询从单表中取出数据，聚合分析从明细数据中计算统计指标。

但现实业务数据通常不会都在一张表里。

假设你在分析电商订单，需要回答这些问题：

```text
哪个用户的订单金额最高？
用户最近一次购买是什么时候？
用户购买最多的商品是什么？
```

这些问题的答案分散在多张表里：
- 用户基本信息在 `users` 表
- 订单记录在 `orders` 表
- 订单明细在 `order_items` 表
- 商品信息在 `products` 表

要回答这些业务问题，你需要把分散在多表的数据"拼"起来。

这就是多表关联（JOIN）。

#### 一、为什么数据会分散在多张表

**第一，规范化设计减少数据冗余**

如果把用户信息和订单放在一张表：

```sql
-- 错误设计：单表存储所有信息
orders_denormalized
├── order_id
├── user_id
├── user_name         -- 用户信息重复
├── user_email        -- 用户信息重复
├── user_phone        -- 用户信息重复
├── order_status
├── total_amount
└── created_at
```

**问题**：
- 一个用户有10笔订单，用户信息就重复10次
- 用户邮箱变了，需要更新10条记录
- 数据冗余导致不一致风险

**正确做法**：拆分成用户表和订单表
```sql
users
├── user_id
├── name
├── email
└── registered_at

orders
├── order_id
├── user_id          -- 外键关联用户表
├── order_status
├── total_amount
└── created_at
```

**好处**：
- 用户信息只存储一次
- 更新用户信息只需修改一行
- 数据一致性有保障

**第二，不同实体的数据自然分离**

业务中的不同实体通常分开存储：
- 用户实体：`users` 表
- 商品实体：`products` 表
- 订单实体：`orders` 表
- 支付实体：`payments` 表

这些表通过外键关联，形成关系模型。

**第三，分析需要关联多个维度**

分析一个业务问题通常需要多个维度：

```sql
-- 问题：哪个地区的用户购买力最高？
SELECT u.region, avg(o.total_amount)
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.region;

-- 问题：哪个类目的商品销售额最高？
SELECT p.category_name, sum(oi.quantity)
FROM order_items oi
JOIN products p ON oi.product_id = p.product_id
GROUP BY p.category_name;
```

这些问题都需要从多表中提取数据并关联。

**结论**：
> 多表关联是关系数据库的核心能力，也是从分散数据中恢复完整业务事实的必要手段。

#### 二、核心判断：关联回答"如何从分散数据中恢复业务事实"

> 多表关联的核心判断是：通过外键关系，将分散在不同表中的数据按照业务逻辑重新组合，恢复完整的业务事实。

这个判断说明：
- **输入**：多张分散的业务表
- **关系**：通过外键定义的关联关系
- **过程**：按关联条件匹配记录
- **输出**：包含多表字段的完整记录
- **目的**：回答跨表的业务问题

#### 三、JOIN的类型与用法

##### 3.1 INNER JOIN：内连接

**作用**：只返回两边都匹配的记录

**示例**：
```sql
-- 查询有订单的用户及其订单
SELECT
    u.user_id,
    u.name,
    o.order_id,
    o.total_amount
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;
```

**结果**：
- 只有在 `users` 和 `orders` 中都存在的 user_id 才会返回
- 没有下过单的用户不会出现
- 订单表中 user_id 为 NULL 的记录不会出现

**使用场景**：
- 只关心有匹配的记录
- 不需要孤儿数据（orphaned records）
- 最常用的 JOIN 类型

##### 3.2 LEFT JOIN：左连接

**作用**：返回左表所有记录，右表没有匹配时填 NULL

**示例**：
```sql
-- 查询所有用户的订单情况（包括没下过单的）
SELECT
    u.user_id,
    u.name,
    o.order_id,
    o.total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id;
```

**结果**：
- 所有用户都会返回
- 没有订单的用户，order_id 和 total_amount 为 NULL
- 右表（orders）没有匹配的记录不会返回

**使用场景**：
- 需要保留左表的所有记录
- 找出左表中没有匹配的记录（通过 WHERE right.key IS NULL）
- 统计"缺失数据"

**常见模式**：找没下单的用户
```sql
SELECT u.user_id, u.name
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_id IS NULL;
```

##### 3.3 RIGHT JOIN：右连接

**作用**：返回右表所有记录，左表没有匹配时填 NULL

**示例**：
```sql
-- 查询所有订单对应的用户（包括用户已删除的）
SELECT
    u.user_id,
    u.name,
    o.order_id,
    o.total_amount
FROM users u
RIGHT JOIN orders o ON u.user_id = o.user_id;
```

**使用场景**：
- 相对较少用
- 可以用 LEFT JOIN 通过交换表的顺序实现

##### 3.4 FULL OUTER JOIN：全连接

**作用**：返回两边所有记录，没有匹配时填 NULL

**示例**：
```sql
-- 查询所有用户和所有订单（包括没下单的用户和没用户认领的订单）
SELECT
    u.user_id,
    u.name,
    o.order_id,
    o.total_amount
FROM users u
FULL OUTER JOIN orders o ON u.user_id = o.user_id;
```

**注意**：MySQL 不支持 FULL OUTER JOIN，可以用 UNION 模拟：
```sql
SELECT u.user_id, u.name, o.order_id, o.total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
UNION
SELECT u.user_id, u.name, o.order_id, o.total_amount
FROM users u
RIGHT JOIN orders o ON u.user_id = o.user_id;
```

##### 3.5 CROSS JOIN：交叉连接

**作用**：返回两表的笛卡尔积（每行与每行组合）

**示例**：
```sql
-- 每个用户与每个商品的组合
SELECT u.name, p.name
FROM users u
CROSS JOIN products p;
```

**使用场景**：
- 生成所有可能的组合
- 需要慎用，数据量会爆炸

##### 3.6 SELF JOIN：自连接

**作用**：表与自己关联

**示例**：找出员工的上级
```sql
-- 假设 employees 表有 employee_id 和 manager_id
SELECT
    e.name as employee_name,
    m.name as manager_name
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id;
```

**使用场景**：
- 层级结构（组织架构、分类树）
- 找出配对记录

#### 四、多表关联的粒度问题

##### 4.1 一对一关联

**场景**：一个用户对应一个用户扩展信息

```sql
users
├── user_id
├── name
└── email

user_profiles
├── user_id
├── avatar
└── bio
```

**关联方式**：
```sql
SELECT u.*, p.avatar, p.bio
FROM users u
LEFT JOIN user_profiles p ON u.user_id = p.user_id;
```

##### 4.2 一对多关联

**场景**：一个用户有多个订单

```sql
users (1) ←→ (N) orders
```

**关联方式**：
```sql
SELECT u.*, o.order_id, o.total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id;
```

**注意**：关联后行数会增加（一个用户有多笔订单时会展开）

##### 4.3 多对多关联

**场景**：一个订单有多个商品，一个商品在多个订单中

```sql
orders (N) ←→ (N) products
```

**关联方式**：通过中间表
```sql
SELECT
    o.order_id,
    p.product_id,
    oi.quantity
FROM orders o
JOIN order_items oi ON o.order_id = oi.order_id
JOIN products p ON oi.product_id = p.product_id;
```

**注意**：关联后的行数 = 订单数 × 平均商品数

##### 4.4 关联导致的数据膨胀

**问题示例**：
```sql
-- 问题：统计每个用户的GMV，但因为有订单明细，结果膨胀了
SELECT
    u.user_id,
    sum(oi.item_amount) as gmv
FROM users u
JOIN orders o ON u.user_id = o.user_id
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY u.user_id;
```

**分析**：
- 如果一个订单有3个商品，关联后订单会展开成3行
- 直接 SUM(order_item.item_amount) 会重复计算

**正确做法**：先聚合再关联
```sql
WITH order_totals AS (
    SELECT order_id, sum(item_amount) as order_amount
    FROM order_items
    GROUP BY order_id
)
SELECT
    u.user_id,
    sum(ot.order_amount) as gmv
FROM users u
JOIN orders o ON u.user_id = o.user_id
JOIN order_totals ot ON o.order_id = ot.order_id
GROUP BY u.user_id;
```

#### 五、JOIN的性能考虑

##### 5.1 JOIN的执行顺序

**原则**：
- 从小表 JOIN 大表
- 先过滤再 JOIN
- 确保 JOIN 字段有索引

**示例**：
```sql
-- 不好的写法：先 JOIN 再过滤
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-01-01';

-- 好的写法：先过滤再 JOIN
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT order_id, user_id
    FROM orders
    WHERE created_at >= '2026-01-01'
) o ON u.user_id = o.user_id;
```

##### 5.2 避免过多的JOIN

**问题**：JOIN 越多，性能越差

**建议**：
- 单个 SQL 中 JOIN 不超过 5 个
- 考虑是否可以通过宽表减少 JOIN
- 分步骤查询，用应用层组装

##### 5.3 使用EXPLAIN分析JOIN

**示例**：
```sql
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id;
```

**观察**：
- 是否使用了索引
- 是否有全表扫描
- 每一步的执行成本

#### 六、常见误区

**误区一：JOIN越多越强大**

- **说明**：JOIN 能关联表，但不是越多越好，JOIN 会增加复杂度和性能开销
- **后果**：SQL 难以理解，性能下降，数据膨胀难以察觉
- **正确理解**：
  - 只 JOIN 必要的表
  - 考虑用宽表或物化视图减少 JOIN
  - 单个 SQL 中 JOIN 不超过 5 个

**误区二：LEFT JOIN 总是安全的**

- **说明**：LEFT JOIN 会保留左表所有记录，但可能引入 NULL 值，导致后续计算错误
- **后果**：聚合函数（SUM、AVG）可能被 NULL 影响，COUNT(*) 和 COUNT(字段) 结果不一致
- **正确理解**：
  - 使用 LEFT JOIN 后要处理 NULL
  - 用 COALESCE 处理可能为 NULL 的字段
  - 明确是否需要保留左表所有记录

**误区三：JOIN 字段不需要索引**

- **说明**：JOIN 字段如果没有索引，会导致全表扫描，性能极差
- **后果**：查询很慢，系统负载高
- **正确理解**：
  - 所有 JOIN 字段都应该建立索引
  - 外键自动建立索引（PostgreSQL）
  - 定期检查 EXPLAIN 输出

**误区四：JOIN 和子查询可以随便选**

- **说明**：JOIN 和子查询可以互相转换，但性能和可读性不同
- **后果**：选择不当导致性能问题或 SQL 难以维护
- **正确理解**：
  - 简单关联用 JOIN
  - 复杂过滤用子查询
  - 用 EXPLAIN 对比不同写法的性能

**误区五：关联后数据量不变**

- **说明**：JOIN 会改变数据量，一对多、多对多关联会导致行数膨胀
- **后果**：聚合计算错误（重复计算），SUM、AVG 等指标不准确
- **正确理解**：
  - 一对一关联：行数不变
  - 一对多关联：行数增加
  - 多对多关联：行数大幅增加
  - 先聚合再 JOIN 可以避免膨胀

#### 七、实战任务

**任务1：基础JOIN练习**

给定 users 和 orders 表，完成以下查询：

1. 查询所有有订单的用户及其订单数：
```sql
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;
```

2. 查询所有用户的订单情况（包括没下单的）：
```sql
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;
```

3. 查询每个用户的总消费金额：
```sql
SELECT
    u.user_id,
    u.name,
    sum(o.total_amount) as total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name
ORDER BY total_amount DESC;
```

**任务2：对比实验**

同一个"用户订单数"指标，用两种方式计算：

**方式A**：直接 JOIN
```sql
SELECT
    u.user_id,
    count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id;
```

**方式B**：子查询
```sql
SELECT
    u.user_id,
    (
        SELECT count(*)
        FROM orders
        WHERE user_id = u.user_id
    ) as order_count
FROM users u;
```

**对比**：
- 两种方式的结果是否一致？
- 哪种性能更好？（用 EXPLAIN 分析）
- 在什么情况下选择哪种方式？

**任务3：粒度实验**

统计每个用户的 GMV，用三种方式：

**方式A**：三表直接 JOIN
```sql
SELECT
    u.user_id,
    sum(oi.item_amount) as gmv
FROM users u
JOIN orders o ON u.user_id = o.user_id
JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY u.user_id;
```

**方式B**：先聚合订单金额再 JOIN
```sql
WITH order_totals AS (
    SELECT
        order_id,
        sum(item_amount) as order_amount
    FROM order_items
    GROUP BY order_id
)
SELECT
    u.user_id,
    sum(ot.order_amount) as gmv
FROM users u
JOIN orders o ON u.user_id = o.user_id
JOIN order_totals ot ON o.order_id = ot.order_id
GROUP BY u.user_id;
```

**方式C**：从订单表直接统计
```sql
SELECT
    user_id,
    sum(total_amount) as gmv
FROM orders
GROUP BY user_id;
```

**分析**：
- 三种方式的结果是否一致？
- 哪种方式最准确？
- 哪种方式性能最好？

#### 八、小结

基础查询从单表中取数据，聚合分析从明细数据中计算指标。

多表关联从分散的数据中恢复完整的业务事实。

核心要点：
- INNER JOIN 只返回匹配的记录，LEFT JOIN 保留左表所有记录
- 一对一、一对多、多对多关联有不同的行为
- JOIN 会导致数据膨胀，要先聚合再 JOIN
- JOIN 字段必须建立索引
- 不是 JOIN 越多越好，要考虑性能和可读性

下一节将进入复杂分析SQL：现实分析往往需要多个步骤，如何把中间过程表达清楚。
