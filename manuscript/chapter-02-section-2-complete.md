### 2.2 基础查询：从表中准确取出你需要的数据

基础查询解决的是取数边界问题。

一条最简单的查询是：

```sql
SELECT * FROM orders;
```

但在真实数据分析中，这条SQL通常不够好。它没有说明你要哪些字段、哪些记录、什么顺序、返回多少行，也没有表达清楚业务边界。

更好的写法是：

```sql
SELECT
    order_id,
    user_id,
    total_amount,
    order_status,
    created_at
FROM orders
WHERE order_status = 'paid'
ORDER BY created_at DESC
LIMIT 20;
```

这条SQL表达了五个判断：

```text
SELECT      取哪些字段
FROM        从哪张表取
WHERE       取哪些行
ORDER BY    按什么顺序返回
LIMIT       返回多少行
```

基础查询不是为了"查出来"，而是为了清楚定义数据范围。

#### 一、为什么SELECT *不够好

**很多人习惯用SELECT ***

原因很简单：
- 写起来快
- 不需要知道表有哪些字段
- 看起来"什么都有了"

**但SELECT *有五个问题**：

**问题1：读取不必要的数据**

假设`orders`表有50个字段，但你只需要5个字段：
```sql
-- SELECT * 读取全部50个字段
SELECT * FROM orders;

-- 明确字段只读取5个字段
SELECT order_id, user_id, total_amount, order_status, created_at FROM orders;
```

区别：
- SELECT *读取50个字段的数据
- 明确字段只读取5个字段
- 如果表有1000万行，差异巨大

**问题2：无法使用覆盖索引**

如果`(user_id, order_status, created_at)`上有索引：
```sql
-- SELECT * 无法使用覆盖索引，需要回表
SELECT * FROM orders WHERE user_id = 123;

-- 明确字段可以使用覆盖索引，不需要回表
SELECT user_id, order_status, created_at FROM orders WHERE user_id = 123;
```

**问题3：结果集难以理解和控制**

SELECT *返回所有字段：
- 你不知道返回了哪些数据
- 表结构变更时，SQL结果会隐式改变
- 难以理解业务含义

**问题4：后续维护困难**

当表增加新字段时：
- 所有SELECT *都会自动包含新字段
- 可能导致意外的结果变化
- 难以追踪问题

**问题5：无法表达业务语义**

明确字段有业务含义：
```sql
SELECT 
    order_id as 订单号,
    user_id as 用户ID,
    total_amount as 订单金额,
    order_status as 订单状态
FROM orders;
```

SELECT *只是原始数据，没有语义。

**结论**：
> 小表和探索阶段可以用SELECT *，生产环境、大表、跨系统查询必须明确字段。

#### 二、核心判断：基础查询是为了清楚定义数据范围

> 基础查询不只是"查出来"，而是清楚定义：取哪些字段、取哪些记录、什么顺序、返回多少行

这个判断说明：

**1. 明确字段 = 定义数据边界**
- 你需要哪些数据？
- 这些数据代表什么？
- 不需要的字段不读取

**2. 明确过滤 = 定义取数范围**
- 哪些记录符合条件？
- 哪些记录应该排除？
- 边界在哪里？

**3. 明确排序和限制 = 定义结果集**
- 按什么顺序返回？
- 需要多少行？
- 是否需要分页？

#### 三、SELECT与投影：选择需要的字段

##### 3.1 字段选择的原则

**原则1：只选择需要的字段**

为什么？
- 减少I/O
- 减少网络传输
- 减少内存使用
- 提高查询可读性

示例：
```sql
-- 差：读取所有字段
SELECT * FROM orders;

-- 好：只选择需要的字段
SELECT order_id, user_id, total_amount, created_at 
FROM orders;
```

**原则2：明确字段别名**

字段别名让结果更清晰：
```sql
SELECT 
    order_id,
    user_id,
    total_amount,
    created_at
FROM orders;
```

对比：
```sql
SELECT 
    order_id as 订单编号,
    user_id as 用户编号,
    total_amount as 订单金额,
    created_at as 创建时间
FROM orders;
```

**原则3：避免SELECT子查询中的***

```sql
-- 差：SELECT子查询中的*
SELECT u.*, 
       (SELECT count(*) FROM orders WHERE user_id = u.user_id) as order_count
FROM users u;

-- 好：明确字段
SELECT u.user_id, u.name, u.email,
       (SELECT count(*) FROM orders WHERE user_id = u.user_id) as order_count
FROM users u;
```

##### 3.2 计算字段

可以在SELECT中创建计算字段：
```sql
SELECT 
    order_id,
    total_amount,
    tax_amount,
    total_amount + tax_amount as final_amount,
    (total_amount + tax_amount) * 0.9 as discounted_amount
FROM orders;
```

**注意**：
- 计算字段不会持久化
- 可以在ORDER BY和HAVING中使用
- 复杂计算可以考虑用视图封装

##### 3.3 CASE WHEN在SELECT中的使用

CASE WHEN可以把业务规则转成字段：

```sql
SELECT 
    order_id,
    total_amount,
    CASE 
        WHEN total_amount >= 1000 THEN 'high'
        WHEN total_amount >= 100 THEN 'middle'
        ELSE 'low'
    END as amount_level,
    CASE 
        WHEN order_status = 'paid' THEN 1
        WHEN order_status = 'pending' THEN 0
        ELSE -1
    END as is_paid
FROM orders;
```

CASE WHEN特别适合：
- 数据分类
- 标志位计算
- 业务规则实现

#### 四、WHERE与过滤：定义数据边界

##### 4.1 比较运算符

**基本比较**：
```sql
-- 等于
SELECT * FROM orders WHERE user_id = 123;

-- 不等于
SELECT * FROM orders WHERE order_status != 'cancelled';

-- 大于
SELECT * FROM orders WHERE total_amount > 100;

-- 小于等于
SELECT * FROM orders WHERE created_at <= '2026-04-01';
```

**注意**：
- 比较运算符可以用于数字、字符串、日期
- 字符串比较是字典序
- 日期比较要确保格式一致

##### 4.2 逻辑运算符

**AND、OR、NOT**：
```sql
-- AND：同时满足
SELECT * FROM orders 
WHERE user_id = 123 AND order_status = 'paid';

-- OR：满足任一
SELECT * FROM orders 
WHERE order_status = 'paid' OR order_status = 'shipped';

-- NOT：取反
SELECT * FROM orders 
WHERE NOT (order_status = 'cancelled');

-- 组合条件
SELECT * FROM orders 
WHERE (user_id = 123 OR user_id = 456) 
  AND order_status = 'paid'
  AND total_amount > 100;
```

**优先级**：
- NOT > AND > OR
- 不确定时用括号

##### 4.3 NULL的处理

**NULL的特殊性**：
- NULL不等于任何值，包括NULL本身
- NULL与任何运算结果都是NULL
- 不能用=或!=判断NULL

**正确的做法**：
```sql
-- 判断是否为NULL
SELECT * FROM orders WHERE paid_at IS NULL;

-- 判断是否不为NULL
SELECT * FROM orders WHERE paid_at IS NOT NULL;

-- COALESCE：返回第一个非NULL值
SELECT 
    order_id,
    COALESCE(discount_amount, 0) as final_discount
FROM orders;
```

##### 4.4 模糊匹配：LIKE和ILIKE

**LIKE**：
```sql
-- 前缀匹配
SELECT * FROM products WHERE name LIKE 'iPhone%';

-- 后缀匹配
SELECT * FROM products WHERE name LIKE '%Pro';

-- 包含匹配
SELECT * FROM products WHERE name LIKE '%iPhone%';

-- 单字符匹配
SELECT * FROM products WHERE name LIKE 'iPhone_1_';
```

**ILIKE**（PostgreSQL特有，不区分大小写）：
```sql
SELECT * FROM products WHERE name ILIKE 'iphone%';
```

**注意**：
- LIKE和ILIKE可能无法使用索引（前缀匹配除外）
- 大小写敏感取决于数据库
- 考虑用全文检索替代模糊匹配

##### 4.5 范围过滤：BETWEEN和IN

**BETWEEN**：
```sql
-- 数值范围
SELECT * FROM orders 
WHERE total_amount BETWEEN 100 AND 500;

-- 日期范围
SELECT * FROM orders 
WHERE created_at BETWEEN '2026-04-01' AND '2026-04-30';
```

**注意**：
- BETWEEN是闭区间，包含两端
- 日期范围要考虑时间部分

**IN**：
```sql
-- 列表匹配
SELECT * FROM orders 
WHERE order_status IN ('paid', 'shipped', 'completed');

-- NOT IN
SELECT * FROM orders 
WHERE order_status NOT IN ('cancelled', 'refunded');
```

**IN vs OR**：
```sql
-- 等价写法
WHERE status IN ('a', 'b', 'c')
-- 等于
WHERE status = 'a' OR status = 'b' OR status = 'c'
```

IN通常更清晰，也可能被优化器优化。

#### 五、ORDER BY与LIMIT：控制结果集

##### 5.1 排序：ORDER BY

**单字段排序**：
```sql
-- 升序（默认）
SELECT * FROM orders ORDER BY created_at;

-- 降序
SELECT * FROM orders ORDER BY created_at DESC;
```

**多字段排序**：
```sql
SELECT * FROM orders 
ORDER BY user_id ASC, created_at DESC;
```

含义：
- 先按user_id升序
- user_id相同的，按created_at降序

**注意**：
- 排序增加内存和CPU开销
- 大结果集排序要谨慎
- 能用索引排序会更快

##### 5.2 限制结果：LIMIT

**基本用法**：
```sql
-- 返回前20行
SELECT * FROM orders 
WHERE user_id = 123 
ORDER BY created_at DESC
LIMIT 20;
```

**分页：LIMIT和OFFSET**：
```sql
-- 第1页（每页20条）
SELECT * FROM orders 
ORDER BY created_at DESC
LIMIT 20 OFFSET 0;

-- 第2页
SELECT * FROM orders 
ORDER BY created_at DESC
LIMIT 20 OFFSET 20;

-- 第3页
SELECT * FROM orders 
ORDER BY created_at DESC
LIMIT 20 OFFSET 40;
```

**OFFSET的性能问题**：
- OFFSET越大，性能越差
- 需要跳过前面的所有行
- 大数据集分页考虑用游标或WHERE条件

#### 六、DISTINCT与去重

##### 6.1 DISTINCT的基本用法

**单字段去重**：
```sql
-- 查看有哪些用户下过单
SELECT DISTINCT user_id FROM orders;
```

**多字段去重**：
```sql
-- 查看每个用户每天是否下过单
SELECT DISTINCT user_id, date(created_at) 
FROM orders;
```

##### 6.2 DISTINCT vs GROUP BY

```sql
-- DISTINCT写法
SELECT DISTINCT user_id FROM orders;

-- GROUP BY写法
SELECT user_id FROM orders GROUP BY user_id;
```

**功能相似，但区别在于**：
- DISTINCT更简洁
- GROUP BY可以做聚合
- GROUP BY更灵活

#### 七、常见过滤场景的SQL模式

##### 7.1 按时间范围过滤

**固定时间范围**：
```sql
-- 某一天
SELECT * FROM orders 
WHERE date(created_at) = '2026-04-01';

-- 最近7天
SELECT * FROM orders 
WHERE created_at >= current_date - interval '7 days';

-- 某个月
SELECT * FROM orders 
WHERE date_trunc('month', created_at) = '2026-04-01';
```

**注意**：
- `date(created_at)`无法使用索引
- `created_at >= '2026-04-01' AND created_at < '2026-04-02'`可以使用索引

##### 7.2 按状态过滤

**单一状态**：
```sql
SELECT * FROM orders WHERE order_status = 'paid';
```

**多状态**：
```sql
SELECT * FROM orders 
WHERE order_status IN ('paid', 'shipped', 'completed');
```

**排除状态**：
```sql
SELECT * FROM orders 
WHERE order_status NOT IN ('cancelled', 'refunded');
```

##### 7.3 组合过滤

**注意括号的使用**：
```sql
-- 错误：优先级导致逻辑错误
SELECT * FROM orders 
WHERE user_id = 123 OR user_id = 456 AND order_status = 'paid';
-- 实际执行为：user_id = 123 OR (user_id = 456 AND order_status = 'paid')

-- 正确：用括号明确优先级
SELECT * FROM orders 
WHERE (user_id = 123 OR user_id = 456) AND order_status = 'paid';
```

#### 八、常见误区

**误区一：长期依赖SELECT ***

- **说明**：小表可以，大表、生产库、跨系统查询不行
- **后果**：性能差、维护难、容易出bug
- **正确理解**：明确字段是基础查询的基本要求

**误区二：不注意NULL的语义**

- **说明**：NULL与任何运算都是NULL
- **后果**：聚合结果可能错误
- **正确理解**：用IS NULL/IS NOT NULL判断，用COALESCE处理

**误区三：用字符串函数过滤日期**

- **说明**：`date_format(created_at, '%Y-%m-%d') = '2026-04-01'`
- **后果**：无法使用索引，性能差
- **正确理解**：用范围过滤：`created_at >= '2026-04-01' AND created_at < '2026-04-02'`

**误区四：OR条件不加括号导致逻辑错误**

- **说明**：AND优先级高于OR
- **后果**：查询结果不符合预期
- **正确理解**：不确定优先级时，用括号明确

**误区五：不知道LIMIT OFFSET在数据量大时性能差**

- **说明**：OFFSET需要跳过前面的所有行
- **后果**：分页越后面越慢
- **正确理解**：大数据集分页考虑用游标或WHERE条件

#### 九、实战任务

**任务1：基础查询练习**

给定orders表，写SQL完成：
1. 查询最近20笔已支付订单，返回订单号、用户、金额、状态、创建时间
2. 查询某个用户（user_id = 123）的最近10笔订单
3. 查询2026年4月的所有订单
4. 查询金额在100-500之间的订单

**任务2：字段选择对比**

对同一个查询，写两个版本：
```sql
-- 版本A：SELECT *
SELECT * FROM orders WHERE user_id = 123;

-- 版本B：明确字段
SELECT order_id, user_id, total_amount, order_status, created_at 
FROM orders WHERE user_id = 123;
```

对比：
- 返回的字段数
- 是否能使用索引
- 查询可读性

**任务3：过滤条件练习**

写SQL查询满足以下条件的订单：
- 状态为paid或completed
- 金额大于100
- 创建时间在2026年4月
- 或者用户ID为123（特殊处理）

注意括号的使用。

**任务4：分页查询**

假设每页20条，写SQL查询：
- 第1页订单
- 第2页订单
- 第3页订单

观察OFFSET增大的性能影响。

#### 十、小结

基础查询看起来简单，但直接决定数据边界和查询成本：

1. **明确字段**：只选择需要的字段，减少I/O和网络传输
2. **明确过滤**：用WHERE定义取数范围，考虑索引使用
3. **明确排序**：ORDER BY定义返回顺序
4. **明确限制**：LIMIT定义返回行数，控制结果集大小

这些判断会直接影响：
- 查询性能
- 数据准确性
- 可维护性
- 跨系统迁移

下一节将进入聚合分析，看看如何从明细记录统计出指标。
