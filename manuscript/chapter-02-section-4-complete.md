### 2.4 多表关联：从分散数据中恢复完整业务事实

基础查询从单表中取出数据，聚合分析从明细数据中计算统计指标。

但现实业务数据通常不会都在一张表里。

假设你在分析电商订单，需要回答这些问题：

```text
哪个用户的订单金额最高？
用户最近一次购买是什么时候？
用户购买最多的商品是什么？
```

这些问题的答案分散在多张表里：用户基本信息在`users`表，订单记录在`orders`表，订单明细在`order_items`表，商品信息在`products`表。

要回答这些业务问题，需要把分散在多表的数据"拼"起来。这就是多表关联。

#### 一、为什么数据会分散在多张表

规范化设计减少数据冗余。如果把用户信息和订单放在一张表里，一个用户有10笔订单，用户信息就重复10次。用户邮箱变了，需要更新10条记录。拆分成users和orders两张表后，用户信息只存储一次，更新只需修改一行。

不同实体的数据自然分离。用户、商品、订单、支付这些不同实体通常分开存储，通过外键关联形成关系模型。

分析需要关联多个维度。比如"哪个地区的用户购买力最高？"需要JOIN users和orders，"哪个类目的商品销售额最高？"需要JOIN order_items和products。这些都是跨表的业务问题。

#### 二、JOIN的类型与用法

INNER JOIN只返回两边都匹配的记录：

```sql
SELECT
    u.user_id, u.name, o.order_id, o.total_amount
FROM users u
INNER JOIN orders o ON u.user_id = o.user_id;
```

结果：只有在users和orders中都存在的user_id才会返回。没有下过单的用户不会出现。这是最常用的JOIN类型。

LEFT JOIN返回左表所有记录，右表没有匹配时填NULL：

```sql
SELECT
    u.user_id, u.name, o.order_id, o.total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id;
```

所有用户都会返回，没有订单的用户order_id和total_amount为NULL。典型应用是找出左表中没有匹配的记录：

```sql
SELECT u.user_id, u.name
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_id IS NULL;
```

RIGHT JOIN返回右表所有记录，相对较少用，可以用LEFT JOIN通过交换表的顺序实现。

FULL OUTER JOIN返回两边所有记录，没有匹配时填NULL。MySQL不支持FULL OUTER JOIN，可以用UNION模拟。

CROSS JOIN返回两表的笛卡尔积，用于生成所有可能的组合，需要慎用——数据量会爆炸。

SELF JOIN让表与自己关联，适合层级结构（组织架构、分类树）：

```sql
SELECT
    e.name as employee_name,
    m.name as manager_name
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id;
```

#### 三、多表关联的粒度问题

一对一关联：一个用户对应一个用户扩展信息，JOIN后行数不变。

一对多关联：一个用户有多个订单，JOIN后行数增加（一个用户有多笔订单时会展开）。

多对多关联：一个订单有多个商品，一个商品在多个订单中，通过中间表关联。关联后的行数等于订单数乘以平均商品数。

关联导致数据膨胀是最常见的陷阱。统计每个用户的GMV时，如果直接JOIN orders和order_items，一个订单如果有3个商品，关联后订单会展开成3行，直接SUM会重复计算。正确做法是先聚合再关联：

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

#### 四、JOIN的性能考虑

从小表JOIN大表，先过滤再JOIN，确保JOIN字段有索引。所有JOIN字段都应该建立索引——外键在PostgreSQL中会自动建立索引，但明确创建的索引需要自己管理。

经验规则是单个SQL中JOIN不超过5个。超过时考虑宽表或物化视图减少JOIN，或者分步骤查询，用应用层组装。

用EXPLAIN分析JOIN执行计划：

```sql
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id;
```

观察是否使用了索引、是否有全表扫描、每一步的执行成本。

#### 五、常见误区

**JOIN越多越强大**。JOIN能关联表，但不是越多越好。每增加一个JOIN就增加一层复杂度和性能开销，数据膨胀也更难察觉。只JOIN必要的表。

**LEFT JOIN后不注意NULL**。LEFT JOIN会保留左表所有记录，但可能引入NULL值，导致聚合函数（SUM、AVG）被NULL影响。使用LEFT JOIN后要用COALESCE处理可能为NULL的字段。

**关联后数据量不变**。JOIN会改变数据量。一对一关联行数不变，一对多关联行数增加，多对多关联行数大幅增加。先聚合再JOIN可以避免膨胀。

**JOIN字段没有索引**。如果没有索引，JOIN会导致全表扫描，性能极差。定期检查EXPLAIN输出确认索引使用情况。

#### 六、小结

基础查询从单表中取数据，聚合分析从明细数据中计算指标。多表关联从分散的数据中恢复完整的业务事实。

核心要点：
- INNER JOIN只返回匹配的记录，LEFT JOIN保留左表所有记录
- 一对一、一对多、多对多关联有不同的行为
- JOIN会导致数据膨胀，要先聚合再JOIN
- JOIN字段必须建立索引
- 单个SQL中JOIN不超过5个，超过时考虑物化视图或宽表

下一节将进入复杂分析SQL：现实分析往往需要多个步骤，如何把中间过程表达清楚。
