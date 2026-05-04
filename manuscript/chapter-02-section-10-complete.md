### 2.10 SQL在不同系统中的迁移：理解差异，保持能力

前面9节学习了SQL的核心能力：查询、聚合、关联、复杂分析、窗口函数、指标计算、性能优化。这些能力是基于PostgreSQL学习的。

但现实世界不止有PostgreSQL。OLTP数据库有MySQL、PostgreSQL、SQL Server、Oracle；OLAP数据库有ClickHouse、Doris、StarRocks、BigQuery；大数据系统有Hive、Spark SQL、Presto。

这些系统的SQL一样吗？

```sql
-- PostgreSQL
SELECT date_trunc('month', created_at) FROM orders;

-- MySQL
SELECT DATE_FORMAT(created_at, '%Y-%m-01') FROM orders;

-- ClickHouse
SELECT toStartOfMonth(created_at) FROM orders;
```

同样功能，语法不同。但SQL的核心能力是一样的，只是语法有差异。理解核心能力，掌握迁移方法，就能在不同系统间保持SQL能力。

#### 一、为什么需要理解SQL差异

多系统是常态。业务用MySQL存储交易数据，分析用ClickHouse做用户行为分析，报表用PostgreSQL做数据服务，大数据用Spark SQL做离线分析。同一个分析需求要在多个系统实现，不同系统的SQL语法不同，需要知道如何迁移。

不同系统有不同优化方向。MySQL适合事务处理（OLTP），支持ACID事务、行级锁、高并发写入。ClickHouse适合分析查询（OLAP），列式存储、聚合查询快，但不适合事务。BigQuery适合大规模数据分析，无服务器、按查询计费、自动扩展。同一个SQL在不同系统的表现也不同：MySQL适合查询单个用户的订单，ClickHouse适合查询所有用户的统计，BigQuery适合查询全量数据。

需要选择合适的系统。实时交易系统用MySQL/PostgreSQL，讲求事务一致性和高并发。用户行为分析用ClickHouse/Doris，聚合查询快、压缩比高。全量数据挖掘用Spark SQL/Hive，能处理大规模数据。

理解SQL在不同系统中的差异，是为了在合适的场景使用合适的系统，并能在不同系统间迁移SQL能力。

#### 二、SQL能力可迁移，语法需适配

SQL的核心能力（查询、聚合、关联、窗口函数）在不同系统中是一致的，只是语法和函数有差异。掌握常见差异和转换模式，就能快速适配不同系统。

#### 三、常见的SQL差异

**字符串处理：**

| 操作 | PostgreSQL | MySQL | ClickHouse |
|------|-----------|-------|------------|
| 拼接 | `'Hello ' \|\| 'World'` | `CONCAT('Hello ', 'World')` | `'Hello ' \|\| 'World'` |
| 长度 | `length('hello')` | `LENGTH('hello')` | `length('hello')` |
| 子串 | `substring('hello', 1, 2)` | `SUBSTRING('hello', 1, 2)` | `substring('hello', 1, 2)` |

PostgreSQL和ClickHouse用`||`，MySQL用`CONCAT()`。大部分函数名一致。

**日期时间处理：**

| 操作 | PostgreSQL | MySQL | ClickHouse |
|------|-----------|-------|------------|
| 当前时间 | `NOW()` | `NOW()` | `now()` |
| 日期截断 | `date_trunc('month', created_at)` | `DATE_FORMAT(created_at, '%Y-%m-01')` | `toStartOfMonth(created_at)` |
| 日期差 | `age(end_time, start_time)` | `DATEDIFF(end_date, start_date)` | `dateDiff('day', start_date, end_date)` |
| 日期加减 | `created_at + INTERVAL '1 day'` | `DATE_ADD(created_at, INTERVAL 1 DAY)` | `addDays(created_at, 1)` |

日期函数差异最大，建议迁移时参考各系统的日期函数文档。

**聚合函数：**

| 操作 | PostgreSQL | MySQL | ClickHouse |
|------|-----------|-------|------------|
| 数组聚合 | `array_agg(user_id)` | `GROUP_CONCAT(user_id)` | `groupArray(user_id)` |
| JSON聚合 | `json_agg(row_to_json(t))` | `JSON_ARRAYAGG(user_id)` | 不直接支持 |
| 字符串聚合 | `string_agg(name, ',')` | `GROUP_CONCAT(name SEPARATOR ',')` | `arrayStringConcat(groupArray(name), ',')` |

**窗口函数：** 语法基本一致，PostgreSQL、MySQL 8.0+、ClickHouse、BigQuery都完整支持。MySQL 5.7及以下不支持窗口函数，需要注意版本。

**LIMIT/OFFSET：** PostgreSQL和ClickHouse用`LIMIT x OFFSET y`，MySQL也可用`LIMIT offset, count`。优先用`LIMIT x OFFSET y`更通用。

#### 四、不同系统的特性差异

**MySQL vs PostgreSQL：** MySQL流行度高、社区活跃，适合OLTP事务处理，InnoDB引擎支持ACID，复制和高可用方案成熟。PostgreSQL功能更丰富（窗口函数、JSON、数组），适合OLTP和轻量级OLAP，扩展性好（PostGIS、pg_stat_statements），开源、标准兼容性好。选择建议：事务系统用MySQL，复杂查询和分析用PostgreSQL。

**ClickHouse vs PostgreSQL：** ClickHouse列式存储、聚合查询极快、不适合事务，适合用户行为分析和日志分析。PostgreSQL行式存储、单点查询快、支持事务，适合OLTP和轻量级分析。可以用PostgreSQL做OLTP、ClickHouse做OLAP的配合架构。

**BigQuery vs ClickHouse：** BigQuery无服务器架构、按查询计费、自动扩展，适合临时分析。ClickHouse需要自己管理集群、按资源计费、手动扩展，适合持续查询。临时分析无运维团队用BigQuery，持续分析有运维团队用ClickHouse。

#### 五、SQL迁移实战

从PostgreSQL迁移到MySQL：

```sql
-- PostgreSQL
SELECT
    date_trunc('month', created_at) as month,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY date_trunc('month', created_at);

-- MySQL
SELECT
    DATE_FORMAT(created_at, '%Y-%m-01') as month,
    sum(total_amount) as gmv
FROM orders
WHERE order_status = 'paid'
GROUP BY DATE_FORMAT(created_at, '%Y-%m-01');
```

迁移要点：`date_trunc('month', ...)`替换为`DATE_FORMAT(..., '%Y-%m-01')`。

从MySQL迁移到ClickHouse：

```sql
-- MySQL
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= '2026-01-01'
GROUP BY user_id;

-- ClickHouse
SELECT
    user_id,
    count(*) as order_count,
    sum(total_amount) as total_amount
FROM orders
WHERE created_at >= toDate('2026-01-01')
GROUP BY user_id;
```

迁移要点：日期字符串自动转换替换为`toDate()`，其他语法基本一致。

从PostgreSQL迁移到BigQuery：窗口函数语法完全一致，大部分SQL语法兼容。

#### 六、迁移的注意事项

**性能差异。** 同一个SQL，不同系统性能不同。PostgreSQL适合中小规模数据（小于1亿行），聚合查询秒级，需要合理索引。ClickHouse适合大规模数据（大于10亿行），聚合查询亚秒级，列式存储天然适合聚合。BigQuery适合大规模数据，聚合查询秒级，按查询付费适合临时查询。

**功能支持度。** 窗口函数：PostgreSQL、MySQL 8.0+、BigQuery完整支持，ClickHouse大部分支持，MySQL 5.7及以下不支持。CTE：PostgreSQL、MySQL 8.0+、ClickHouse、BigQuery均完整支持，MySQL 5.7及以下不支持。JSON：PostgreSQL、MySQL 8.0+、BigQuery完整支持，ClickHouse部分支持。

**数据类型差异。** 字符串类型：PostgreSQL用VARCHAR/TEXT，MySQL用VARCHAR/TEXT，ClickHouse用String/FixedString，BigQuery用STRING。日期时间类型：PostgreSQL用TIMESTAMP/DATE，MySQL用DATETIME/DATE，ClickHouse用DateTime/Date，BigQuery用TIMESTAMP/DATE。数值类型：PostgreSQL用INTEGER/BIGINT/NUMERIC，MySQL用INT/BIGINT/DECIMAL，ClickHouse用Int32/Int64/Float64，BigQuery用INT64/FLOAT64。

#### 七、迁移的最佳实践

了解目标系统的能力：阅读目标系统的SQL文档，了解函数支持度、性能特性、数据类型。

逐步迁移和验证：先迁移简单查询（SELECT、WHERE），再迁移聚合查询（GROUP BY、聚合函数），然后迁移复杂查询（JOIN、窗口函数、CTE）。每一步都要对比原系统和目标系统的结果，进行性能测试。

使用SQL转换工具：SQLines、AWS Schema Conversion Tool等工具可以处理基础转换，但复杂SQL需要手动优化。

建立迁移知识库，记录常见转换模式。以下是一个示例：

| 操作 | PostgreSQL | MySQL | ClickHouse |
|------|-----------|-------|------------|
| 日期截断（月） | `date_trunc('month', col)` | `DATE_FORMAT(col, '%Y-%m-01')` | `toStartOfMonth(col)` |
| 字符串拼接 | `'a' \|\| 'b'` | `CONCAT('a', 'b')` | `'a' \|\| 'b'` |
| 数组聚合 | `array_agg(col)` | `GROUP_CONCAT(col)` | `groupArray(col)` |

#### 八、常见误区

**所有系统的SQL都一样。** SQL的核心能力相同，但语法和函数有差异。直接复制SQL会语法错误。需要理解核心能力（查询、聚合、关联），掌握常见语法差异，参考目标系统文档。

**只需要学一个系统的SQL。** 不同系统有不同优化和特性。在所有系统都用同一个系统的方式会导致性能差。应该理解各系统的优化方向，在合适场景用合适系统，掌握各系统的最佳实践。

**迁移后性能一定更好。** 迁移到不同的系统，性能可能更好也可能更差。迁移前要了解目标系统的性能特性，做性能测试，根据性能选择合适系统，而不是盲目迁移。

**可以自动迁移所有SQL。** SQL转换工具能处理大部分场景，但复杂SQL需要手动优化。完全依赖工具可能导致迁移后性能差或有bug。工具处理基础转换，复杂SQL手动优化，必须验证和测试。

#### 九、小结

SQL在不同系统中有差异，但核心能力是一致的。

核心要点：
- 理解SQL的核心能力：查询、聚合、关联、窗口函数
- 掌握常见语法差异：字符串、日期、聚合、窗口函数
- 了解不同系统的特性：MySQL、PostgreSQL、ClickHouse、BigQuery
- 迁移方法：逐步迁移、验证测试、建立知识库
- 不同系统有不同优化方向，需要选择合适的系统

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
