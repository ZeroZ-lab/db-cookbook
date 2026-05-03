### 2.10 SQL在不同系统中的迁移：理解差异，保持能力

前面9节学习了SQL的核心能力：查询、聚合、关联、复杂分析、窗口函数、指标计算、性能优化。

这些能力是基于PostgreSQL学习的。

但现实世界不止有PostgreSQL：
- **OLTP数据库**：MySQL、PostgreSQL、SQL Server、Oracle
- **OLAP数据库**：ClickHouse、Doris、StarRocks、BigQuery
- **大数据系统**：Hive、Spark SQL、Presto

**这些系统的SQL一样吗？**

```sql
-- PostgreSQL
SELECT date_trunc('month', created_at) FROM orders;

-- MySQL
SELECT DATE_FORMAT(created_at, '%Y-%m-01') FROM orders;

-- ClickHouse
SELECT toStartOfMonth(created_at) FROM orders;
```

**同样功能，语法不同。**

是否需要为每个系统重新学习SQL？

不是的。SQL的核心能力是一样的，只是语法有差异。

理解核心能力，掌握迁移方法，就能在不同系统间保持SQL能力。

#### 一、为什么需要理解SQL差异

**第一，多系统是常态**

**现实场景**：
- 业务用MySQL存储交易数据
- 分析用ClickHouse做用户行为分析
- 报表用PostgreSQL做数据服务
- 大数据用Spark SQL做离线分析

**问题**：
- 同一个分析需求，要在多个系统实现
- 不同系统的SQL语法不同
- 需要知道如何迁移

**第二，不同系统有不同优化**

**示例**：
```sql
-- MySQL适合：事务处理（OLTP）
- 支持ACID事务
- 行级锁
- 高并发写入

-- ClickHouse适合：分析查询（OLAP）
- 列式存储
- 聚合查询快
- 不适合事务

-- BigQuery适合：大规模数据分析
- 无服务器
- 按查询计费
- 自动扩展
```

**同一个SQL在不同系统的表现**：
- MySQL：适合查询单个用户的订单
- ClickHouse：适合查询所有用户的统计
- BigQuery：适合查询全量数据

**第三，需要选择合适的系统**

**场景1**：实时交易系统
- 用MySQL/PostgreSQL
- 特点：事务一致性、高并发

**场景2**：用户行为分析
- 用ClickHouse/Doris
- 特点：聚合查询快、压缩比高

**场景3**：全量数据挖掘
- 用Spark SQL/Hive
- 特点：处理大规模数据

**结论**：
> 理解SQL在不同系统中的差异，是为了在合适的场景使用合适的系统，并能在不同系统间迁移SQL能力。

#### 二、核心判断：SQL能力可迁移，语法需适配

> SQL跨系统迁移的核心判断是：SQL的核心能力（查询、聚合、关联、窗口函数）在不同系统中是一致的，只是语法和函数有差异，掌握迁移模式就能快速适配不同系统。

这个判断说明：
- **能力一致**：SQL的核心能力在不同系统都支持
- **语法差异**：函数名、参数、关键字有差异
- **迁移方法**：掌握常见差异和转换模式
- **能力保持**：理解核心，快速适配

#### 三、常见的SQL差异

##### 3.1 字符串处理

**PostgreSQL**：
```sql
-- 字符串拼接
SELECT 'Hello ' || 'World';

-- 字符串长度
SELECT length('hello');

-- 子串
SELECT substring('hello', 1, 2);  -- 'he'
```

**MySQL**：
```sql
-- 字符串拼接
SELECT CONCAT('Hello ', 'World');

-- 字符串长度
SELECT LENGTH('hello');

-- 子串
SELECT SUBSTRING('hello', 1, 2);  -- 'he'
```

**ClickHouse**：
```sql
-- 字符串拼接
SELECT 'Hello ' || 'World';

-- 字符串长度
SELECT length('hello');

-- 子串
SELECT substring('hello', 1, 2);  -- 'he'
```

**迁移要点**：
- PostgreSQL和ClickHouse用 `||`，MySQL用 `CONCAT()`
- 大部分函数名一致

##### 3.2 日期时间处理

**PostgreSQL**：
```sql
-- 当前时间
SELECT NOW();

-- 日期截断
SELECT date_trunc('month', created_at);

-- 日期差
SELECT age(end_time, start_time);

-- 日期加减
SELECT created_at + INTERVAL '1 day';
```

**MySQL**：
```sql
-- 当前时间
SELECT NOW();

-- 日期截断
SELECT DATE_FORMAT(created_at, '%Y-%m-01');

-- 日期差
SELECT DATEDIFF(end_date, start_date);

-- 日期加减
SELECT DATE_ADD(created_at, INTERVAL 1 DAY);
```

**ClickHouse**：
```sql
-- 当前时间
SELECT now();

-- 日期截断
SELECT toStartOfMonth(created_at);

-- 日期差
SELECT dateDiff('day', start_date, end_date);

-- 日期加减
SELECT addDays(created_at, 1);
```

**迁移要点**：
- 日期函数差异最大
- 建议参考各系统的日期函数文档
- 用CTE做中间转换

##### 3.3 聚合函数

**PostgreSQL**：
```sql
-- 数组聚合
SELECT array_agg(user_id) FROM users;

-- JSON聚合
SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM users) t;

-- 字符串聚合
SELECT string_agg(name, ',') FROM users;
```

**MySQL**：
```sql
-- 数组聚合（MySQL 5.7+）
SELECT GROUP_CONCAT(user_id) FROM users;

-- JSON聚合
SELECT JSON_ARRAYAGG(user_id) FROM users;

-- 字符串聚合
SELECT GROUP_CONCAT(name SEPARATOR ',') FROM users;
```

**ClickHouse**：
```sql
-- 数组聚合
SELECT groupArray(user_id) FROM users;

-- 字符串聚合
SELECT arrayStringConcat(groupArray(name), ',') FROM users;
```

**迁移要点**：
- 数组聚合：array_agg vs groupArray vs GROUP_CONCAT
- JSON聚合：json_agg vs JSON_ARRAYAGG
- 注意分隔符语法

##### 3.4 窗口函数

**PostgreSQL**：
```sql
SELECT
    user_id,
    order_id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) as rn
FROM orders;
```

**MySQL 8.0+**：
```sql
SELECT
    user_id,
    order_id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) as rn
FROM orders;
```

**ClickHouse**：
```sql
SELECT
    user_id,
    order_id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) as rn
FROM orders;
```

**迁移要点**：
- 窗口函数语法基本一致
- MySQL 5.7及以下不支持窗口函数
- 注意各系统的窗口函数支持度

##### 3.5 LIMIT/OFFSET

**PostgreSQL**：
```sql
SELECT * FROM orders LIMIT 10 OFFSET 20;
```

**MySQL**：
```sql
SELECT * FROM orders LIMIT 20, 10;
-- 或者
SELECT * FROM orders LIMIT 10 OFFSET 20;
```

**ClickHouse**：
```sql
SELECT * FROM orders LIMIT 10 OFFSET 20;
```

**迁移要点**：
- PostgreSQL和ClickHouse用 `LIMIT x OFFSET y`
- MySQL可以用 `LIMIT offset, count`
- 优先用 `LIMIT x OFFSET y`（更通用）

#### 四、不同系统的特性差异

##### 4.1 MySQL vs PostgreSQL

**MySQL特点**：
- 流行度高，社区活跃
- 适合OLTP（事务处理）
- InnoDB引擎支持ACID
- 复制、高可用方案成熟

**PostgreSQL特点**：
- 功能更丰富（窗口函数、JSON、数组）
- 适合OLTP和轻量级OLAP
- 扩展性好（PostGIS、pg_stat_statements）
- 开源、标准兼容性好

**选择建议**：
- 事务系统：MySQL
- 分析系统：PostgreSQL
- 复杂查询：PostgreSQL
- 简单查询：MySQL或PostgreSQL

##### 4.2 ClickHouse vs PostgreSQL

**ClickHouse特点**：
- 列式存储
- 聚合查询极快
- 不适合事务
- 适合用户行为分析、日志分析

**PostgreSQL特点**：
- 行式存储
- 单点查询快
- 支持事务
- 适合OLTP、轻量级分析

**选择建议**：
- 大规模聚合分析：ClickHouse
- 单行查询、事务处理：PostgreSQL
- 可以用PostgreSQL做OLTP，ClickHouse做OLAP

##### 4.3 BigQuery vs ClickHouse

**BigQuery特点**：
- 无服务器架构
- 按查询计费
- 自动扩展
- 适合ad-hoc分析

**ClickHouse特点**：
- 需要自己管理集群
- 按资源计费
- 手动扩展
- 适合持续查询

**选择建议**：
- 临时分析、无运维团队：BigQuery
- 持续分析、有运维团队：ClickHouse
- 可以两者配合使用

#### 五、SQL迁移实战

##### 5.1 从PostgreSQL迁移到MySQL

**原SQL**（PostgreSQL）：
```sql
SELECT
    date_trunc('month', created_at) as month,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date_trunc('month', created_at);
```

**迁移后**（MySQL）：
```sql
SELECT
    DATE_FORMAT(created_at, '%Y-%m-01') as month,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY DATE_FORMAT(created_at, '%Y-%m-01');
```

**迁移要点**：
- `date_trunc('month', ...)` → `DATE_FORMAT(..., '%Y-%m-01')`

##### 5.2 从MySQL迁移到ClickHouse

**原SQL**（MySQL）：
```sql
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY user_id;
```

**迁移后**（ClickHouse）：
```sql
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= toDate('2026-01-01')
GROUP BY user_id;
```

**迁移要点**：
- 日期字符串自动转换 → `toDate()`
- 其他语法基本一致

##### 5.3 从PostgreSQL迁移到BigQuery

**原SQL**（PostgreSQL）：
```sql
SELECT
    user_id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) as rn
FROM orders;
```

**迁移后**（BigQuery）：
```sql
SELECT
    user_id,
    row_number() OVER (PARTITION BY user_id ORDER BY created_at) as rn
FROM orders;
```

**迁移要点**：
- 窗口函数语法完全一致
- 大部分SQL语法兼容

#### 六、迁移的注意事项

##### 6.1 性能差异

**同一个SQL，不同系统性能不同**：

```sql
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY user_id;
```

**PostgreSQL**：
- 适合中小规模数据（< 1亿行）
- 聚合查询：秒级
- 需要合理索引

**ClickHouse**：
- 适合大规模数据（> 10亿行）
- 聚合查询：亚秒级
- 列式存储天然适合聚合

**BigQuery**：
- 适合大规模数据
- 聚合查询：秒级
- 按查询付费，适合临时查询

##### 6.2 功能支持度

**窗口函数支持**：
- PostgreSQL：✅ 完整支持
- MySQL 8.0+：✅ 完整支持
- MySQL 5.7及以下：❌ 不支持
- ClickHouse：✅ 大部分支持
- BigQuery：✅ 完整支持

**CTE支持**：
- PostgreSQL：✅ 完整支持
- MySQL 8.0+：✅ 完整支持
- MySQL 5.7及以下：❌ 不支持
- ClickHouse：✅ 支持
- BigQuery：✅ 支持

**JSON支持**：
- PostgreSQL：✅ 完整支持
- MySQL 8.0+：✅ 完整支持
- ClickHouse：🟡 部分支持
- BigQuery：✅ 完整支持

##### 6.3 数据类型差异

**字符串类型**：
- PostgreSQL：VARCHAR、TEXT
- MySQL：VARCHAR、TEXT
- ClickHouse：String、FixedString
- BigQuery：STRING

**日期时间类型**：
- PostgreSQL：TIMESTAMP、DATE
- MySQL：DATETIME、DATE
- ClickHouse：DateTime、Date
- BigQuery：TIMESTAMP、DATE

**数值类型**：
- PostgreSQL：INTEGER、BIGINT、NUMERIC
- MySQL：INT、BIGINT、DECIMAL
- ClickHouse：Int32、Int64、Float64
- BigQuery：INT64、FLOAT64

#### 七、迁移的最佳实践

##### 7.1 了解目标系统的能力

**迁移前**：
- 阅读目标系统的SQL文档
- 了解函数支持度
- 了解性能特性
- 了解数据类型

##### 7.2 逐步迁移和验证

**步骤**：
1. **迁移简单查询**：SELECT、WHERE
2. **迁移聚合查询**：GROUP BY、聚合函数
3. **迁移复杂查询**：JOIN、窗口函数、CTE
4. **验证结果**：对比原系统和目标系统的结果
5. **性能测试**：对比查询性能

##### 7.3 使用SQL转换工具

**工具示例**：
- SQLines：SQL转换工具
- AWS Schema Conversion Tool：数据库迁移工具
- 自定义脚本：用正则表达式批量替换

##### 7.4 建立迁移知识库

**记录常见转换模式**：
```yaml
日期截断：
  PostgreSQL: date_trunc('month', created_at)
  MySQL: DATE_FORMAT(created_at, '%Y-%m-01')
  ClickHouse: toStartOfMonth(created_at)

字符串拼接：
  PostgreSQL: 'Hello ' || 'World'
  MySQL: CONCAT('Hello ', 'World')
  ClickHouse: 'Hello ' || 'World'

数组聚合：
  PostgreSQL: array_agg(user_id)
  MySQL: GROUP_CONCAT(user_id)
  ClickHouse: groupArray(user_id)
```

#### 八、常见误区

**误区一：所有系统的SQL都一样**

- **说明**：SQL的核心能力相同，但语法和函数有差异
- **后果**：直接复制SQL，语法错误
- **正确理解**：
  - 理解核心能力（查询、聚合、关联）
  - 掌握常见语法差异
  - 参考目标系统文档

**误区二：只需要学一个系统的SQL**

- **说明**：不同系统有不同优化和特性
- **后果**：在所有系统都用同一个系统的方式，性能差
- **正确理解**：
  - 理解各系统的优化方向
  - 在合适场景用合适系统
  - 掌握各系统的最佳实践

**误区三：迁移后性能一定更好**

- **说明**：迁移到不同的系统，性能可能更好也可能更差
- **后果**：盲目迁移，性能反而下降
- **正确理解**：
  - 迁移前要了解目标系统的性能特性
  - 做性能测试
  - 根据性能选择合适系统

**误区四：可以自动迁移所有SQL**

- **说明**：SQL转换工具能处理大部分场景，但复杂SQL需要手动优化
- **后果**：完全依赖工具，迁移后性能差或有bug
- **正确理解**：
  - 工具能处理基础转换
  - 复杂SQL需要手动优化
  - 必须验证和测试

**误区五：迁移是一次性工作**

- **说明**：SQL需要持续维护，不同系统的更新可能引入新特性
- **后果**：迁移后不再关注，错过新特性
- **正确理解**：
  - 关注各系统的版本更新
  - 定期review和优化SQL
  - 利用新特性改进性能

#### 九、实战任务

**任务1：从PostgreSQL迁移到MySQL**

迁移以下SQL：

**原SQL**（PostgreSQL）：
```sql
SELECT
    date_trunc('day', created_at) as order_date,
    count(*) as order_count,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
AND created_at >= '2026-01-01'
GROUP BY date_trunc('day', created_at);
```

**迁移后**（MySQL）：
```sql
SELECT
    DATE(created_at) as order_date,
    count(*) as order_count,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
AND created_at >= '2026-01-01'
GROUP BY DATE(created_at);
```

**任务2：从MySQL迁移到ClickHouse**

迁移以下SQL：

**原SQL**（MySQL）：
```sql
SELECT
    user_id,
    GROUP_CONCAT(order_id SEPARATOR ',') as order_ids,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
GROUP BY user_id;
```

**迁移后**（ClickHouse）：
```sql
SELECT
    user_id,
    groupArray(order_id) as order_ids,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
GROUP BY user_id;
```

**任务3：跨系统性能对比**

在PostgreSQL和ClickHouse中运行同样的聚合查询：

**SQL**：
```sql
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY user_id;
```

**对比**：
- PostgreSQL执行时间：？
- ClickHouse执行时间：？
- 哪个更快？为什么？

#### 十、小结

SQL在不同系统中有差异，但核心能力是一致的。

核心要点：
- 理解SQL的核心能力：查询、聚合、关联、窗口函数
- 掌握常见语法差异：字符串、日期、聚合、窗口函数
- 了解不同系统的特性：MySQL、PostgreSQL、ClickHouse、BigQuery
- 迁移方法：逐步迁移、验证测试、建立知识库
- 性能差异：不同系统有不同优化，选择合适的系统

第2章（SQL分析能力）小结：
- SQL不是语法题，而是分析表达能力
- 基础查询：准确取出数据
- 聚合分析：从明细到统计
- 多表关联：恢复完整业务事实
- 复杂SQL：表达中间过程
- 窗口函数：组内分析
- 指标计算：从SQL到指标
- 常见指标：实战应用
- 性能优化：写出高效SQL
- 跨系统迁移：保持能力

下一章将进入PostgreSQL大表能力：当数据量增长到单表上亿行，PostgreSQL如何应对？
