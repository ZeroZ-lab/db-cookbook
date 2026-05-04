---
title: "3. PostgreSQL 大表能力：理解单机数据库边界"
description: "从分区、索引、物化视图和执行计划理解 PostgreSQL 如何支撑大表，以及边界在哪里。"
prev: { text: "2. SQL 分析能力：大数据方向第一硬技能", link: "/chapters/02-sql-analysis" }
next: { text: "4. OLTP vs OLAP：大数据系统的第一分水岭", link: "/chapters/04-oltp-olap" }
---
# 3. PostgreSQL 大表能力：理解单机数据库边界

::: tip 本章导读
从分区、索引、物化视图和执行计划理解 PostgreSQL 如何支撑大表，以及边界在哪里。
:::
::: info 本章验收问题
- 你能否区分索引、分区、物化视图分别解决什么问题？
- 你能否判断一个慢查询是 SQL 写法问题还是单机边界问题？
:::


![PostgreSQL 大表能力：理解单机数据库边界](/images/chapter-03.svg)



```mermaid
flowchart LR
  A["大表变慢"] --> B{"访问模式"}
  B --> C["索引"]
  B --> D["分区"]
  B --> E["物化视图"]
  C --> F["EXPLAIN 验证"]
  D --> F
  E --> F
  F --> G["识别 OLAP 边界"]
```

大数据不是一开始就分布式。

## 问题切入

很多大数据系统的问题，最早都会在 PostgreSQL 大表上出现：表变大，查询变慢，写入变重，历史分析干扰在线业务，索引越来越多，维护越来越复杂。

先理解 PostgreSQL 大表，再理解 OLAP 和分布式计算，会更自然。

一个常见场景是：电商系统刚上线时，`orders`、`order_items`、`events` 都很小，报表直接查业务库没有明显问题。半年后，订单表有几千万行，行为事件表有数十亿行，运营仍然希望在业务库里查询过去一年的 GMV、用户路径、复购和商品排行。

这时问题不再是“SQL 会不会写”，而是：

```text
数据库到底扫描了多少数据？
索引是否真的被用上？
分区是否能裁剪无关历史数据？
重复聚合是否应该提前计算？
报表查询是否正在和业务交易争抢资源？
```

如果不理解这些问题，就会误以为“换一条 SQL”可以解决所有性能问题。

## 核心判断

> 大数据系统不是为了替代单机数据库而凭空出现，而是单机数据库在数据规模、分析负载和团队协作上遇到边界后的系统演化。

单表到了几千万行就开始慢了？这一章不劝你立刻上分布式系统。PostgreSQL 的索引、分区、物化视图、并行查询能把单机能力推到远超多数人预期的程度。但每种机制都有代价——理解这些代价，你就知道什么时候单机真的不够了。

它们解决的是单机数据库内部的访问路径、物理组织、预计算和资源利用问题，不解决长期历史分析、跨系统统一建模、低成本海量存储、多团队指标复用和分布式计算问题。正是这些未解决的问题，会在下一章引出 OLTP 与 OLAP 的分化。

## 机制解释

本章从六个机制理解 PostgreSQL 如何面对大表：

```text
分区表
  -> 物化视图
  -> 索引体系
  -> 执行计划
  -> 批量导入导出
  -> 并行查询
```

它们不是彼此替代关系，而是分别作用在不同压力点上。

| 压力 | PostgreSQL 内部机制 | 主要代价 |
| --- | --- | --- |
| 历史数据太多 | 分区表 | 分区设计和维护成本 |
| 重复聚合太重 | 物化视图 | 刷新成本和数据延迟 |
| 点查或范围查慢 | 索引 | 存储和写入维护成本 |
| 不知道慢在哪里 | 执行计划 | 需要理解优化器和实际行数 |
| 数据批量进入或离开 | `COPY`、批量导入导出 | 文件、事务和锁管理 |
| 大范围扫描耗时 | 并行查询 | 仍受单机 CPU、内存和 I/O 限制 |

### 3.1 大表为什么慢：从现象到本质

第2章学习了SQL分析能力，假设数据表规模合理，查询能快速返回。

但现实业务中，数据会持续增长：

```text
订单表：从10万行 → 100万行 → 1000万行 → 1亿行
用户行为表：每天100万行 → 一个月3000万行
日志表：每天1000万行 → 一个月3亿行
```

当表越来越大，你会遇到三个现象。一是查询变慢，以前10万行只需0.1秒，现在1亿行需要30秒。二是索引可能失效，即使有索引优化器也可能选择全表扫描。三是存储和备份困难，表大小从100GB到1TB，备份时间从10分钟到2小时。

大表变慢不完全是因为数据多，而是因为数据库需要扫描更多数据、索引变得庞大且低效、内存装不下数据和索引、磁盘I/O成为瓶颈。理解大表为什么慢，是解决大表问题的第一步。

#### 一、为什么大表会变慢

数据量增加导致扫描时间增长。COUNT(*)需要扫描全表，时间与行数成正比——10万行0.1秒，100万行1秒，1000万行10秒，1亿行100秒。即使有索引，COUNT(*)也慢，因为`WHERE user_id = 123`能用索引直接定位，但`SELECT count(*) FROM orders`需要统计所有行，索引无法减少扫描量。

索引变得庞大且低效。索引大小随数据增长：10万行索引10MB，100万行100MB，1000万行1GB，1亿行10GB。索引太大时内存装不下，需要频繁磁盘I/O。B-Tree索引的查找成本随行数增长：10万行树高度3需3次I/O，1亿行树高度5需5次I/O。每次I/O约10ms，5次就是50ms。

内存不足导致频繁磁盘I/O。PostgreSQL的shared_buffers默认128MB，即使调到系统内存的25%，面对100GB的表也无法全部装入内存。理想场景下，表大小10GB、内存32GB时数据可缓存在内存；但表大小100GB、内存8GB时查询需要频繁磁盘I/O。

锁竞争和并发问题加剧。删除一个月前的1000万行旧数据，执行时间长（可能数小时）、锁定表影响其他查询、产生大量WAL日志、导致表膨胀需要VACUUM回收空间。导入1亿行数据同样很慢，且索引维护成本高、影响其他查询。

大表变慢的根本原因是：数据量增长导致磁盘I/O增加、内存不足、索引效率下降、锁竞争加剧。

#### 二、大表性能问题的本质

大表慢不是因为数据量大，而是因为访问模式不适合数据规模。需要通过分区、索引、缓存、归档等手段提升访问效率。

磁盘I/O是主要瓶颈。顺序读取100-200 MB/s，随机读取1-5 MB/s，内存访问几GB/s。磁盘比内存慢100-1000倍。大表数据太大无法全部装入内存，查询时间主要由磁盘I/O决定。

全表扫描（Seq Scan）从头到尾扫描整个表，适合返回大量数据（如表大小的5%以上）的场景。索引扫描（Index Scan）通过索引快速定位数据，适合只返回少量数据（如表大小的1%以下）的场景。但如果返回大量数据，索引扫描反而更慢，因为需要先读索引再读表数据。

索引选择性也影响效果。user_id有100万个不同值，选择性高（90%的行都不同），适合索引。order_status只有5个不同值，选择性低（0.0005%），索引效果差，优化器可能选择全表扫描。

数据分布也有影响。数据倾斜时，大部分订单集中在少数用户，查询这些用户即使有索引也很慢（需要扫描百万行）。时间局部性意味着最近的数据经常被查询，如果通过分区实现，可以只扫描最近分区的数据而不是整个表。

#### 三、大表性能问题的分类

查询性能问题的症状是SELECT慢、执行时间长、资源占用高。原因在于全表扫描、索引不适用、数据量大、JOIN复杂。

写入性能问题的症状是INSERT/UPDATE/DELETE慢、锁等待。原因在于索引维护成本高、表锁竞争、WAL日志量大、磁盘I/O瓶颈。

维护性能问题的症状是VACUUM慢、备份慢、恢复慢、索引重建慢。原因在于表太大、死元组多、磁盘I/O瓶颈。

#### 四、大表性能优化思路

减少扫描的数据量。分区表按日期分区后，查询只扫描相关分区。时间归档将旧数据移到归档表。冷热分离：热数据是最近3个月频繁访问的，温数据是3-12个月偶尔访问的，冷数据是12个月以上很少访问的。

提升索引效率。创建合适的索引：单列索引、组合索引、部分索引（只索引已支付订单）。使用覆盖索引让查询只读索引不需要读表。

优化查询方式。尽早过滤，先过滤再JOIN而不是先JOIN再过滤。使用物化视图预计算常用的聚合结果。

硬件优化。增加内存（shared_buffers从8GB到32GB），使用SSD（随机读取比HDD快100倍），增加CPU（更多核心支持并行查询）。

#### 五、常见误区

**大表一定要分区。** 分区表有适用场景，不是所有大表都需要。不当分区导致性能更差。按时间范围查询适合分区，按ID查询不需要分区，数据量小于1000万行通常不需要分区。

**索引越多越快。** 索引加速查询但降低写入速度。只为常用查询创建索引，定期清理无用索引，平衡查询和写入性能。

**删除旧数据就能解决问题。** 删除数据只是暂时缓解，不解决根本。数据继续增长问题重复出现。需要建立数据归档策略，通过分区表管理数据生命周期。

**升级硬件就能解决。** 硬件升级能缓解问题但有成本和上限。先优化SQL和索引，再考虑分区和归档，最后才升级硬件。

#### 六、小结

大表变慢是业务发展的自然结果。

核心要点：
- 大表慢不是因为数据多，而是访问效率低
- 磁盘I/O是主要瓶颈，比内存慢100-1000倍
- 索引不是万能的，有选择性要求
- 优化思路：减少扫描量、提升索引效率、优化查询方式
- 大表优化是持续工作，需要监控和维护

下一节将进入PostgreSQL的单机边界：理解PostgreSQL能做什么，不能做什么，帮助判断何时需要其他方案。

### 3.2 PostgreSQL的单机边界：能做什么，不能做什么

上一节讨论了大表为什么慢，核心问题是数据量增长导致的访问效率下降。

但这引出一个更根本的问题：PostgreSQL能处理多大规模的数据？

```text
单表1亿行：PostgreSQL能处理吗？
单表1TB：PostgreSQL能处理吗？
总数据100TB：PostgreSQL能处理吗？
并发1000 QPS：PostgreSQL能处理吗？
并发10000 QPS：PostgreSQL能处理吗？
```

答案是：看场景。有些场景PostgreSQL能轻松应对，有些场景则超出PostgreSQL的能力边界。理解PostgreSQL的能力边界，才能选择合适的场景使用它，知道何时需要其他方案（如分库分表、OLAP数据库），避免过度设计或欠设计。

#### 一、为什么需要理解边界

避免过度设计。创业公司的订单系统当前数据量只有100万行，PostgreSQL单机完全够用。但有人担心将来数据量太大，设计了分库分表加Redis加消息队列的复杂架构，开发复杂度增加、维护成本高，而实际数据量远未达到需要这些方案的规模。合理设计应该是PostgreSQL单机，开发简单、维护成本低、性能足够、未来可扩展。

避免欠设计。用户行为分析系统每天1亿行事件数据，如果用PostgreSQL单机，一年后365亿行数据会让查询从秒级变成小时级，存储成本高，不适合分析场景。合理设计应该是ClickHouse集群，分析场景、数据量大、需要快速聚合查询。查询快到秒级，压缩比高存储成本低，适合分析场景。

知道何时升级。PostgreSQL能应对的阶段是数据量小于10亿行、并发小于1000 QPS、OLTP事务处理场景。需要升级的阶段是数据量大于10亿行、并发大于1000 QPS、OLAP分析查询场景，这时需要分库分表或OLAP数据库。

理解PostgreSQL的能力边界，是为了在合适的场景使用合适的工具，避免过度设计和欠设计。

#### 二、PostgreSQL的能力边界

**单表规模边界：**

| 规模 | 行数 | 大小 | 性能 | 建议 |
|------|------|------|------|------|
| 小表 | < 100万 | < 1GB | 毫秒级 | 无需优化 |
| 中表 | 100万-1000万 | 1GB-10GB | 秒级 | 需要索引 |
| 大表 | 1000万-1亿 | 10GB-100GB | 秒级到分钟级 | 需要分区 |
| 超大表 | > 1亿 | > 100GB | 分钟级以上 | 考虑分库分表 |

**总数据量边界：**

| 规模 | 大小 | 性能 | 建议 |
|------|------|------|------|
| 小型 | < 100GB | 毫秒级 | 单机即可 |
| 中型 | 100GB-1TB | 秒级 | 单机 + 分区 |
| 大型 | 1TB-10TB | 秒级到分钟级 | 考虑分库分表 |
| 超大型 | > 10TB | 分钟级以上 | 需要专用系统 |

具体场景判断：订单表5000万行20GB，PostgreSQL单机可以应对，建议创建索引、考虑按日期分区。事件表每天1亿行每天30GB，PostgreSQL单机不适合，建议使用ClickHouse等OLAP数据库。日志表每天10亿行每天300GB，PostgreSQL完全不适合，建议使用Elasticsearch或日志系统。

**并发边界：**

| 并发级别 | QPS | 响应时间 | 建议 |
|---------|-----|----------|------|
| 低并发 | < 100 | 毫秒级 | 单机即可 |
| 中并发 | 100-1000 | 毫秒级到秒级 | 需要连接池、索引优化 |
| 高并发 | 1000-10000 | 秒级 | 需要读写分离、缓存 |
| 超高并发 | > 10000 | 秒级到分钟级 | 需要分库分表 |

**场景边界：** PostgreSQL擅长OLTP（事务处理），支持完整ACID事务和行级锁，适合订单系统、支付系统、库存系统。PostgreSQL可以做OLAP（分析查询）但不擅长，行式存储不适合分析、聚合查询慢。混合场景的最佳实践是PostgreSQL做OLTP、ClickHouse/Doris做OLAP，通过ETL同步数据。

#### 三、PostgreSQL的优势场景

事务处理（OLTP）方面，PostgreSQL支持完整ACID事务、行级锁、MVCC多版本并发控制、外键约束保证数据一致性。复杂查询方面，支持CTE、窗口函数、丰富的数据类型（JSON、数组）、复杂JOIN优化器。地理信息方面，通过PostGIS扩展支持地理索引（GiST）和空间查询优化。全文搜索方面，内置全文搜索支持中文分词和Gin索引加速。

#### 四、PostgreSQL的劣势场景

大规模数据分析：行式存储不适合分析，聚合查询慢，压缩比低。每天1亿行事件数据的分析在PostgreSQL上可能需要几分钟，建议使用ClickHouse、Doris等OLAP数据库。

超高并发写入：单机写入能力有限（几千TPS），每秒10000次INSERT需要分库分表、使用Kafka等消息队列缓冲。

海量数据存储：单机存储上限几十TB、成本高，PB级数据存储建议数据归档到对象存储（S3、OSS）或数据湖。

#### 五、何时需要分库分表

分库分表的信号：数据量方面，单表超过1亿行、单表超过100GB、总数据量超过1TB时考虑。性能方面，查询时间超过10秒、索引无法优化、数据库连接数不够时考虑。并发方面，QPS超过5000、主从复制延迟、锁等待严重时考虑。

垂直分库按业务拆分：一个数据库包含users、orders、products、payments，拆分成四个数据库各管一个业务。优点是业务隔离、便于扩展、降低单库压力。

水平分表按数据量拆分：一个orders表1亿行分成多个表各1000万行，分片规则如user_id % 10。优点是单表数据量可控、查询性能提升、便于扩展。

分库分表的挑战包括：分布式事务（需要最终一致性和补偿机制）、跨库JOIN（需要应用层JOIN或数据冗余）、数据迁移（需要双写和在线迁移）。

#### 六、常见误区

**PostgreSQL能处理所有场景。** PostgreSQL是通用数据库但不是所有场景的最优选择。大规模分析考虑OLAP数据库，超高并发考虑分库分表。

**数据量大了就一定要分库分表。** 分库分表是手段不是目的。1亿行以内通常不需要，1-10亿行考虑分区表，10亿行以上考虑分库分表。

**单机一定比集群差。** 小规模（小于100GB）单机更简单，中规模（100GB-1TB）单机加分区，大规模（大于1TB）才考虑集群。

#### 七、小结

PostgreSQL不是万能的，但有明确的适用边界。

核心要点：
- PostgreSQL擅长OLTP和轻量级OLAP
- 数据量边界：单表小于1亿行，总数据量小于1TB
- 并发边界：QPS小于1000
- 超出边界：考虑分库分表或专用系统
- 分库分表有成本，要权衡
- 迁移到专用系统要规划

下一节将进入分区表：让大表具有物理边界，在不迁移的情况下提升大表性能。

### 3.3 分区表：让大表具有物理边界

前两节讨论了大表为什么慢，以及PostgreSQL的能力边界。结论之一是：当数据量增长时，需要优化访问模式。优化访问模式的一个核心手段是分区表（Partitioning）。

分区表就是把一个大表物理上拆分成多个小表，但逻辑上还是一个大表。

```sql
-- 不分区：一个大表orders（1亿行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 需要扫描整个表（1亿行）

-- 分区：按月分成12个分区表（每个月约800万行）
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
-- 只扫描4月的分区（800万行）
```

分区表的价值：查询优化（只扫描相关分区，减少I/O）、维护便利（可以单独删除、备份、恢复某个分区）、扩展性（可以在不同分区使用不同存储策略）。

#### 一、为什么需要分区表

按时间查询是大表的常见场景。查询今天的订单、本月的订单、去年的订单，即使有索引也可能需要扫描大量数据。如果按月分区，查询今天的订单只扫描当前月的分区。

数据生命周期管理需要物理边界。不分区时，删除一年前的日志需要扫描全表数十亿行、产生大量WAL日志、锁表时间长、需要VACUUM回收空间。按月分区后，直接`DROP TABLE events_202504`，不产生WAL日志、不锁表、不需要VACUUM。

不同时间的数据有不同访问模式。最近3个月频繁访问（热数据），3-12个月偶尔访问（温数据），12个月以上很少访问（冷数据）。分区后可以将热数据放在SSD、分配更多内存和索引，冷数据放在HDD、压缩存储、较少索引。

分区表的价值在于：通过物理边界，让查询、维护、存储优化成为可能。

#### 二、分区表的类型

**RANGE分区（范围分区）：** 按时间、ID范围等有序字段分区，最常用的是按月分区。

```sql
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

CREATE TABLE orders_202601 PARTITION OF orders
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE orders_202602 PARTITION OF orders
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- 查询时自动分区裁剪，只扫描orders_202603分区
SELECT * FROM orders WHERE created_at >= '2026-03-01' AND created_at < '2026-04-01';
```

优势是按时间查询性能好、删除旧数据简单（DROP分区）、符合数据生命周期。

**LIST分区（列表分区）：** 按离散值分区（如地区、状态）。

```sql
CREATE TABLE users (
    user_id BIGINT, name VARCHAR(100), region VARCHAR(50), registered_at TIMESTAMP
) PARTITION BY LIST (region);

CREATE TABLE users_east PARTITION OF users
    FOR VALUES IN ('beijing', 'shanghai', 'hangzhou');

CREATE TABLE users_west PARTITION OF users
    FOR VALUES IN ('chengdu', 'xian', 'chongqing');

-- 查询时自动分区裁剪，只扫描users_east分区
SELECT * FROM users WHERE region = 'beijing';
```

优势是按地区查询性能好、地区数据隔离、便于地域化部署。

**HASH分区（哈希分区）：** 按用户ID哈希分区，均匀分布数据避免热点。

```sql
CREATE TABLE events (
    event_id BIGINT, user_id BIGINT, event_name VARCHAR(100), event_time TIMESTAMP
) PARTITION BY HASH (user_id);

CREATE TABLE events_0 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE events_1 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE events_2 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE events_3 PARTITION OF events FOR VALUES WITH (MODULUS 4, REMAINDER 3);
```

优势是数据均匀分布、避免热点、适合并行写入。

#### 三、分区表的实战应用

按日期分区是最常见的场景。需要创建主表、创建默认分区（防止数据写入失败）、创建分区（可用脚本自动创建）。自动创建分区的函数可以定期执行，如每月1号自动创建下月分区。

分区表的索引需要注意：在主表创建索引会自动为每个分区创建索引，在单个分区可以创建额外索引。跨分区查询需要查询所有分区的索引。

分区表的主键约束是：主键必须包含分区键。`PRIMARY KEY (order_id, created_at)`是正确的写法。外键不需要包含分区键。更新分区键可能导致行在分区之间移动，建议避免更新分区键。

#### 四、分区表的性能优化

分区裁剪（Partition Pruning）是核心优化机制。查询时只扫描相关的分区，大幅减少I/O。确保分区裁剪生效的关键是：分区键在WHERE条件中直接使用，不要被函数包装。`WHERE created_at >= '2026-04-01'`可以裁剪，`WHERE date(created_at) = '2026-04-01'`可能无法裁剪。

分区表支持并行查询。查询跨越多个分区时，`max_parallel_workers_per_gather = 4`配置下3个分区可以并行扫描，每个Worker扫描一个分区。

#### 五、分区表的维护

创建新分区可以手动创建，也可以用pg_cron设置每月1号自动创建。删除旧分区直接DROP TABLE，快速且不产生WAL日志。备份单个分区用`pg_dump -t orders_202601`。

分区数量不宜过多。按月分区1-3年的数据有12-36个分区合理；按日分区同理。太多分区会导致查询规划器需要评估更多分区、内存占用增加、文件句柄占用多。

#### 六、常见误区

**分区表一定能提升性能。** 分区表只对按分区键查询提升性能。不按分区键查询可能性能下降，分区数量太多会导致查询规划慢。

**所有大表都需要分区。** 小于1000万行通常不需要分区，1000万-1亿行考虑分区，超过1亿行建议分区。

**分区后不需要索引。** 分区表仍然需要索引，在主表创建索引会自动应用到所有分区，也可以在单个分区创建额外索引。

**分区表的维护很简单。** 需要定期创建新分区、删除旧分区、监控分区大小和性能、定期VACUUM和ANALYZE。

#### 七、小结

分区表让大表具有物理边界。

核心要点：
- 分区表通过分区键定义物理边界
- 常见分区类型：RANGE、LIST、HASH
- 按时间分区是最常见的场景
- 分区裁剪能显著提升查询性能
- 分区表便于维护（删除旧数据、备份单个分区）
- 分区表有限制（主键必须包含分区键）
- 分区表仍然需要索引和维护

下一节将进入表空间与存储策略：如何通过存储优化进一步提升分区表的价值。

### 3.4 表空间与存储策略：让数据存储更高效

前面学习了分区表，通过物理边界优化查询和维护。

但分区表还引出一个问题：**不同分区的存储成本和访问频率不同，能否优化存储？**

**场景**：
```yaml
最近3个月的订单（热数据）：
  - 访问频繁
  - 需要高性能
  - 存储在SSD上

3-12个月的订单（温数据）：
  - 偶尔访问
  - 性能要求一般
  - 存储在HDD上

12个月以上的订单（冷数据）：
  - 很少访问
  - 性能要求低
  - 压缩存储，存储在廉价HDD上
```

**如何实现？**

这就需要**表空间（Tablespace）**和存储策略。

#### 一、为什么需要存储策略

**第一，不同数据的访问频率不同**

**热数据**：
```yaml
特征：
  - 访问频繁（每天数千次）
  - 响应时间要求高（<100ms）
  - 数据量相对较小

优化：
  - 放在SSD上
  - 更多的内存缓存
  - 更激进的索引

成本：
  - 存储成本高（SSD贵）
  - 但访问性能好
```

**冷数据**：
```yaml
特征：
  - 很少访问（每月几次）
  - 响应时间要求低（<1s可接受）
  - 数据量大

优化：
  - 放在HDD上
  - 压缩存储
  - 较少的索引

成本：
  - 存储成本低（HDD便宜）
  - 访问性能差一些
```

**第二，存储成本优化**

**场景**：1TB的订单数据

**全部用SSD**：
```yaml
成本：SSD 1TB约1000元
性能：所有查询都快
问题：成本高，冷数据不需要这么高的性能
```

**混合存储**：
```yaml
热数据（100GB）：SSD，约100元
温数据（400GB）：SATA SSD，约200元
冷数据（500GB）：HDD，约100元
总成本：约400元
性能：热数据快，冷数据可接受
```

**结论**：通过分层存储，可以在性能和成本之间取得平衡。

**第三，存储隔离和安全性**

**场景**：不同业务的数据

```yaml
业务A：订单数据（重要，高优先级）
业务B：日志数据（次要，低优先级）

问题：
  - 日志数据可能占用大量空间
  - 可能影响订单数据的性能

解决：
  - 订单数据：放在高速SSD上
  - 日志数据：放在独立的HDD上
  - 通过表空间隔离存储
```

#### 二、核心判断：存储策略不是"全部用SSD"，而是"按需分层"

> 存储策略的核心判断是：根据数据的访问频率、性能要求、成本预算，将数据分层存储在不同介质上，实现性能和成本的最优平衡。

这个判断说明：
- **数据分层**：热数据、温数据、冷数据
- **存储介质**：SSD、SATA SSD、HDD、对象存储
- **性能优化**：热数据在高速存储
- **成本优化**：冷数据在廉价存储

#### 三、表空间基础

##### 3.1 什么是表空间

**定义**：表空间是PostgreSQL中存储数据的逻辑容器，对应文件系统上的目录。

**作用**：
- 控制数据存储位置
- 隔离不同业务的数据
- 优化存储性能

**默认表空间**：
```sql
-- 查看表空间
SELECT * FROM pg_tablespace;

-- 结果：
--  pg_default：默认表空间
--  pg_global：全局表空间（系统表）
```

##### 3.2 创建表空间

**步骤1**：创建目录
```bash
# 在文件系统上创建目录
sudo mkdir -p /data/ssd_tablespace
sudo chown postgres:postgres /data/ssd_tablespace
```

**步骤2**：创建表空间
```sql
-- 创建表空间
CREATE TABLESPACE ssd_space LOCATION '/data/ssd_tablespace';

-- 查看表空间
SELECT * FROM pg_tablespace;
```

**步骤3**：在表空间中创建表
```sql
-- 在表空间中创建表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
) TABLESPACE ssd_space;

-- 将现有表移到表空间
ALTER TABLE orders SET TABLESPACE ssd_space;
```

##### 3.3 表空间的管理

**查看表空间使用情况**：
```sql
-- 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size
FROM pg_tablespace;

-- 查看表空间中的表
SELECT
    schemaname,
    tablename,
    tablespace
FROM pg_tables
WHERE tablespace = 'ssd_space';
```

**删除表空间**：
```sql
-- 删除表空间前必须移走所有表
DROP TABLESPACE ssd_space;
```

#### 四、存储策略设计

##### 4.1 分层存储策略

**三层存储架构**：

```yaml
热数据层（SSD）：
  - 访问频率：高（每天数千次）
  - 数据量：最近1-3个月
  - 性能要求：响应时间<100ms
  - 存储介质：NVMe SSD
  - 成本：高

温数据层（SATA SSD）：
  - 访问频率：中（每天数十次）
  - 数据量：3-12个月
  - 性能要求：响应时间<1s
  - 存储介质：SATA SSD
  - 成本：中

冷数据层（HDD）：
  - 访问频率：低（每月几次）
  - 数据量：12个月以上
  - 性能要求：响应时间<10s
  - 存储介质：HDD
  - 成本：低
```

**实现方案**：
```sql
-- 创建三个表空间
CREATE TABLESPACE hot_data LOCATION '/data/ssd/hot';
CREATE TABLESPACE warm_data LOCATION '/data/sata_ssd/warm';
CREATE TABLESPACE cold_data LOCATION '/data/hdd/cold';

-- 热数据分区：放在SSD上
CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    TABLESPACE hot_data;

-- 温数据分区：放在SATA SSD上
CREATE TABLE orders_202503 PARTITION OF orders
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01')
    TABLESPACE warm_data;

-- 冷数据分区：放在HDD上
CREATE TABLE orders_202401 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    TABLESPACE cold_data;
```

##### 4.2 分区表的存储策略

**策略**：新分区默认在热数据层，旧分区逐步迁移到冷数据层

```sql
-- 1. 创建新分区（默认在热数据层）
CREATE TABLE orders_202606 PARTITION OF orders
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
    TABLESPACE hot_data;

-- 2. 3个月后，迁移到温数据层
ALTER TABLE orders_202606 SET TABLESPACE warm_data;

-- 3. 12个月后，迁移到冷数据层
ALTER TABLE orders_202606 SET TABLESPACE cold_data;
```

**自动化迁移脚本**：
```sql
-- 创建函数自动迁移分区
CREATE OR REPLACE FUNCTION migrate_partition()
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    partition_age INT;
BEGIN
    -- 查找3个月前的分区
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'orders_%'
        AND substring(tablename FROM 8 FOR 6) <= to_char(CURRENT_DATE - INTERVAL '3 months', 'YYYYMM')
    LOOP
        -- 迁移到温数据层
        EXECUTE format('ALTER TABLE %I SET TABLESPACE warm_data', partition_name);
    END LOOP;

    -- 查找12个月前的分区
    FOR partition_name IN
        SELECT tablename
        FROM pg_tables
        WHERE tablename LIKE 'orders_%'
        AND substring(tablename FROM 8 FOR 6) <= to_char(CURRENT_DATE - INTERVAL '12 months', 'YYYYMM')
    LOOP
        -- 迁移到冷数据层
        EXECUTE format('ALTER TABLE %I SET TABLESPACE cold_data', partition_name);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 定期执行（如每月1号）
SELECT migrate_partition();
```

##### 4.3 不同业务的存储隔离

**场景**：不同业务使用不同的表空间

```sql
-- 订单业务：高性能SSD
CREATE TABLESPACE orders_space LOCATION '/data/ssd/orders';

-- 日志业务：廉价HDD
CREATE TABLESPACE logs_space LOCATION '/data/hdd/logs';

-- 分析业务：SATA SSD
CREATE TABLESPACE analytics_space LOCATION '/data/sata_ssd/analytics';

-- 订单表放在SSD上
CREATE TABLE orders (...) TABLESPACE orders_space;

-- 日志表放在HDD上
CREATE TABLE event_logs (...) TABLESPACE logs_space;

-- 分析表放在SATA SSD上
CREATE TABLE user_stats (...) TABLESPACE analytics_space;
```

#### 五、存储压缩策略

##### 5.1 PostgreSQL的压缩

**TOAST压缩**：
```sql
-- PostgreSQL自动压缩大字段
-- TOAST（The Oversized-Attribute Storage Technique）
-- 自动压缩超过2KB的字段

-- 查看表的TOAST表
SELECT
    relname,
    pg_size_pretty(pg_relation_size(oid)) as size
FROM pg_class
WHERE relname LIKE 'pg_toast%'
AND relname LIKE '%orders%';
```

**表压缩**：
```sql
-- PostgreSQL不直接支持表级压缩
-- 但可以通过文件系统压缩实现

-- 方法1：使用ZFS文件系统（支持透明压缩）
-- 方法2：使用压缩文件系统（如btrfs）
-- 方法3：使用pg_compress扩展
```

##### 5.2 分区级的压缩策略

**冷数据分区压缩**：
```sql
-- 1. 导出冷数据分区
COPY orders_202401 TO '/tmp/orders_202401.csv' CSV;

-- 2. 压缩文件
gzip /tmp/orders_202401.csv;

-- 3. 删除原分区
DROP TABLE orders_202401;

-- 4. 后续查询时，可以从压缩文件中解压
-- （需要应用层支持）
```

**或使用外部表**：
```sql
-- 创建外部表（file_fdw）
CREATE EXTENSION file_fdw;

CREATE SERVER csv_server FOREIGN DATA WRAPPER file_fdw;

-- 创建外部表指向压缩文件
CREATE EXTERNAL TABLE orders_202401_ext (
    order_id BIGINT,
    user_id BIGINT,
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP
)
SERVER csv_server
OPTIONS (filename '/data/orders_202401.csv.gz', format 'csv');
```

#### 六、存储监控和优化

##### 6.1 监控表空间使用情况

```sql
-- 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size,
    pg_tablespace_size(spcname) as size_bytes
FROM pg_tablespace
ORDER BY pg_tablespace_size(spcname) DESC;

-- 查看每个表空间中的表大小
SELECT
    tablespace,
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE tablespace IS NOT NULL
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

##### 6.2 监控I/O性能

```sql
-- 查看表的I/O统计
SELECT
    schemaname,
    tablename,
    seq_scan,
    seq_tup_read,
    idx_scan,
    idx_tup_fetch,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_tup_read + idx_tup_fetch DESC;
```

**分析**：
- `seq_scan`：顺序扫描次数（越多，可能需要优化）
- `idx_scan`：索引扫描次数（越多，索引使用越好）
- `n_tup_ins`：插入的行数
- `n_tup_upd`：更新的行数
- `n_tup_del`：删除的行数

##### 6.3 优化存储成本

**定期归档**：
```sql
-- 1. 归档一年前的数据到对象存储
-- （如S3、OSS）

-- 2. 删除本地数据
DROP TABLE orders_202401;

-- 3. 需要时可以从对象存储恢复
```

**数据生命周期管理**：
```yaml
0-3个月：热数据（SSD）
3-12个月：温数据（SATA SSD）
12-36个月：冷数据（HDD）
36个月以上：归档（对象存储）
```

#### 七、存储安全性和备份

##### 7.1 表空间级别的备份

```bash
# 备份特定表空间
pg_dump -t orders -f orders_backup.sql

# 或使用pg_dump备份整个数据库
pg_dump -d mydb -f mydb_backup.sql
```

##### 7.2 存储故障恢复

**主从复制**：
```yaml
# 设置主从复制
# 主库：写入
# 从库：只读查询

# 如果主库存储故障，可以切换到从库
```

#### 八、常见误区

**误区一：所有数据都应该用SSD**

- **说明**：SSD性能好，但成本高，应该按需使用
- **后果**：存储成本过高
- **正确理解**：
  - 热数据用SSD
  - 温数据用SATA SSD
  - 冷数据用HDD
  - 分层存储平衡性能和成本

**误区二：表空间设置后就不能改**

- **说明**：表空间可以随时更改
- **后果**：不敢使用表空间
- **正确理解**：
  - 可以用ALTER TABLE更改表空间
  - 可以定期迁移数据到合适的存储层
  - 支持动态调整

**误区三：压缩总是好的**

- **说明**：压缩节省空间，但增加CPU开销
- **后果**：过度压缩，查询变慢
- **正确理解**：
  - 冷数据适合压缩（访问少）
  - 热数据不建议压缩（访问频繁）
  - 根据访问频率决定是否压缩

**误区四：存储策略不重要**

- **说明**：存储策略直接影响性能和成本
- **后果**：性能差、成本高
- **正确理解**：
  - 存储策略是数据库优化的重要部分
  - 分层存储能显著降低成本
  - 存储隔离能提升性能

**误区五：表空间只用于性能优化**

- **说明**：表空间不仅用于性能，还用于隔离和管理
- **后果**：忽视其他价值
- **正确理解**：
  - 性能优化：热数据在SSD
  - 成本优化：冷数据在HDD
  - 安全隔离：不同业务分开存储
  - 管理便利：分区级别的备份恢复

#### 九、实战任务

**任务1：创建分层存储**

创建三层存储架构：

```sql
-- 1. 创建三个表空间
-- （假设目录已创建）
CREATE TABLESPACE hot_data LOCATION '/data/ssd/hot';
CREATE TABLESPACE warm_data LOCATION '/data/sata_ssd/warm';
CREATE TABLESPACE cold_data LOCATION '/data/hdd/cold';

-- 2. 创建分区表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP,
    PRIMARY KEY (order_id, created_at)
) PARTITION BY RANGE (created_at);

-- 3. 创建不同存储层的分区
CREATE TABLE orders_202605 PARTITION OF orders
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01')
    TABLESPACE hot_data;

CREATE TABLE orders_202503 PARTITION OF orders
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01')
    TABLESPACE warm_data;

CREATE TABLE orders_202401 PARTITION OF orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01')
    TABLESPACE cold_data;

-- 4. 验证表空间
SELECT
    schemaname,
    tablename,
    tablespace
FROM pg_tables
WHERE tablename LIKE 'orders_%'
ORDER BY tablename;
```

**任务2：迁移数据到不同存储层**

模拟数据迁移：

```sql
-- 1. 查看当前表空间
SELECT tablename, tablespace FROM pg_tables WHERE tablename = 'orders_202605';

-- 2. 迁移到温数据层
ALTER TABLE orders_202605 SET TABLESPACE warm_data;

-- 3. 迁移回热数据层
ALTER TABLE orders_202605 SET TABLESPACE hot_data;

-- 4. 查看迁移前后的大小变化
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
FROM pg_tables
WHERE tablename LIKE 'orders_%';
```

**任务3：监控存储使用情况**

监控存储空间和性能：

```sql
-- 1. 查看表空间大小
SELECT
    spcname,
    pg_size_pretty(pg_tablespace_size(spcname)) as size
FROM pg_tablespace
ORDER BY pg_tablespace_size(spcname) DESC;

-- 2. 查看各表的I/O统计
SELECT
    tablename,
    seq_scan,
    idx_scan,
    n_tup_ins,
    n_tup_upd,
    n_tup_del
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY seq_scan + idx_scan DESC;

-- 3. 分析哪些表需要优化
-- - seq_scan多，idx_scan少：可能需要加索引
-- - 表很大，但访问少：考虑迁移到冷存储
```

#### 十、小结

表空间和存储策略让数据存储更高效。

核心要点：
- 表空间控制数据的物理存储位置
- 分层存储：热数据（SSD）、温数据（SATA SSD）、冷数据（HDD）
- 存储策略平衡性能和成本
- 分区表可以结合表空间优化存储
- 定期迁移数据到合适的存储层
- 压缩节省空间，但有CPU开销
- 监控存储使用情况，持续优化

第3章前4节小结：
- 大表为什么慢：磁盘I/O、索引效率、内存不足
- PostgreSQL的能力边界：OLTP擅长、OLAP有限、数据量和并发边界
- 分区表：通过物理边界优化查询和维护
- 表空间和存储策略：分层存储优化性能和成本

下一节将进入索引基础和进阶：索引是大表优化的核心手段。

### 3.5 索引基础：B-tree与查询加速

前几节讨论了大表性能问题的根本原因：磁盘I/O慢。

解决磁盘I/O慢的核心手段之一是：**索引（Index）**。

**什么是索引？**

生活中的索引：
- 书的目录：快速找到章节，不用从第一页翻到最后一页
- 字典：按字母顺序排列，快速查到单词
- 通讯录：按姓名排序，快速找到联系人

数据库中的索引：
- 数据结构：B-tree、Hash、GiST、GIN等
- 作用：快速定位数据，避免全表扫描
- 代价：占用存储空间，降低写入速度

**为什么需要索引？**

```sql
-- 无索引：全表扫描（慢）
SELECT * FROM orders WHERE user_id = 123;
-- 扫描1亿行，需要30秒

-- 有索引：索引扫描（快）
SELECT * FROM orders WHERE user_id = 123;
-- 通过索引直接定位到user_id=123的记录，只需0.1秒
```

**性能差异**：300倍！

但索引不是万能的，需要理解其原理和适用场景。

#### 一、为什么需要索引

**第一，全表扫描成本高**

**场景**：查询单个用户的订单

**无索引**：
```sql
-- 全表扫描
SELECT * FROM orders WHERE user_id = 123;

-- 执行计划
Seq Scan on orders  (cost=0.00..1234567.89 rows=100 width=200)
  Filter: (user_id = 123)

-- 执行时间：30秒（1亿行）
```

**问题**：
- 从头到尾扫描整个表
- 即使只有100行符合条件，也要扫描1亿行
- 磁盘I/O成本高

**有索引**：
```sql
-- 索引扫描
CREATE INDEX idx_orders_user_id ON orders(user_id);

SELECT * FROM orders WHERE user_id = 123;

-- 执行计划
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)

-- 执行时间：0.1秒
```

**优势**：
- 通过索引直接定位到user_id=123的记录
- 不需要扫描全表
- 磁盘I/O大幅减少

**第二，索引能加速排序**

**场景**：按用户ID查询，并按订单时间排序

**无索引**：
```sql
-- 先过滤，再排序
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 执行步骤：
-- 1. 全表扫描找到user_id=123的记录
-- 2. 对结果排序
-- 执行时间：35秒
```

**有索引**：
```sql
-- 组合索引（user_id, created_at）
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 执行步骤：
-- 1. 索引直接找到user_id=123的记录
-- 2. 索引已经按created_at排序
-- 执行时间：0.1秒
```

**优势**：
- 索引本身是有序的
- 不需要额外排序
- 直接返回有序结果

**第三，索引能加速JOIN**

**场景**：关联查询用户和订单

**无索引**：
```sql
-- 嵌套循环JOIN
SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 执行计划
Nested Loop  (cost=0.00..12345678.90 rows=1000000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Seq Scan on users u
  ->  Seq Scan on orders o

-- 执行时间：10分钟
```

**问题**：
- 对users的每一行，都扫描整个orders表
- 复杂度：O(users × orders)

**有索引**：
```sql
-- 为orders.user_id创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 执行计划
Hash Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
  ->  Hash
        ->  Seq Scan on users u

-- 执行时间：5秒
```

**优势**：
- 优化器选择Hash Join
- 索引加速JOIN过程

**结论**：
> 索引是通过有序数据结构加速查询、排序、JOIN的核心手段，是大表优化的基础。

#### 二、核心判断：索引不是"越多越好"，而是"按需创建"

> 索引的核心判断是：通过牺牲写入性能和存储空间，换取查询性能的提升，因此需要根据查询模式创建合适的索引，避免过度索引。

这个判断说明：
- **收益**：查询性能大幅提升
- **代价**：写入性能下降、存储空间增加
- **原则**：按需创建，不是越多越好
- **策略**：分析查询模式，创建必要索引

#### 三、B-tree索引原理

##### 3.1 什么是B-tree

**定义**：B-tree是一种平衡树数据结构，PostgreSQL的默认索引类型

**特点**：
- **平衡**：所有叶子节点在同一层
- **有序**：数据按键值有序存储
- **多路**：每个节点可以有多个子节点（PostgreSQL默认是几万个）

**结构**：
```
                    [根节点]
                   /    |    \
              [内部节点1] [内部节点2] [内部节点3]
              /   |   \
        [叶子1] [叶子2] [叶子3] ...
```

**查找过程**：
1. 从根节点开始
2. 根据键值选择合适的子节点
3. 递归查找，直到叶子节点
4. 在叶子节点中找到数据

**时间复杂度**：O(log n)
- 100万行：约3-4次I/O
- 1亿行：约4-5次I/O
- 100亿行：约5-6次I/O

##### 3.2 B-tree索引的存储

**索引结构**：
```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- PostgreSQL会在文件系统上创建索引文件
-- 例如：base/16384/16385 INDEX (idx_orders_user_id)
```

**索引内容**：
```
user_id | row_id (CTID)
--------|------------
1       | (0,1)
1       | (0,2)
2       | (0,3)
3       | (0,4)
...
```

**说明**：
- 索引存储：user_id + row_id（指向表数据的物理位置）
- 有序：按user_id排序
- 压缩：PostgreSQL会压缩索引

##### 3.3 B-tree索引的查找

**等值查询**：
```sql
SELECT * FROM orders WHERE user_id = 123;
```

**查找过程**：
1. 在B-tree中查找user_id=123
2. 找到对应的row_id（可能有多个）
3. 通过row_id从表中读取完整行

**范围查询**：
```sql
SELECT * FROM orders WHERE user_id BETWEEN 100 AND 200;
```

**查找过程**：
1. 在B-tree中找到user_id=100的位置
2. 从这个位置开始，顺序扫描到user_id=200
3. 收集所有row_id
4. 从表中读取完整行

**排序查询**：
```sql
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;
```

**查找过程**：
1. 如果有组合索引(user_id, created_at)
2. 索引已经按created_at排序（在user_id=123的范围内）
3. 直接返回有序结果

#### 四、索引的使用场景

##### 4.1 适合索引的场景

**场景1：等值查询**
```sql
-- 适合
SELECT * FROM orders WHERE user_id = 123;
SELECT * FROM orders WHERE order_status = 'paid';

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
```

**场景2：范围查询**
```sql
-- 适合
SELECT * FROM orders WHERE created_at >= '2026-04-01' AND created_at < '2026-05-01';
SELECT * FROM orders WHERE total_amount > 1000;

-- 创建索引
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_amount ON orders(total_amount);
```

**场景3：排序查询**
```sql
-- 适合
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;
SELECT * FROM orders ORDER BY user_id, created_at;

-- 创建索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

**场景4：JOIN查询**
```sql
-- 适合
SELECT * FROM users u JOIN orders o ON u.user_id = o.user_id;

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

##### 4.2 不适合索引的场景

**场景1：低选择性字段**
```sql
-- 不适合（order_status只有5个不同值）
SELECT * FROM orders WHERE order_status = 'paid';

-- 原因：选择性低，索引效果差
-- 优化器可能选择全表扫描
```

**选择性计算**：
```sql
-- 高选择性（适合索引）
SELECT count(DISTINCT user_id) / count(*) FROM orders;
-- 结果：0.9（90%的行都是不同的）

-- 低选择性（不适合索引）
SELECT count(DISTINCT order_status) / count(*) FROM orders;
-- 结果：0.000005（只有5个不同状态）
```

**场景2：频繁更新的表**
```sql
-- 不适合（写入频繁，索引维护成本高）
INSERT INTO events (user_id, event_name, event_time) VALUES (?, ?, ?);
-- 每秒1000次写入，如果有索引，每次写入都要更新索引

-- 建议减少索引数量
```

**场景3：小表**
```sql
-- 不适合（表太小，全表扫描更快）
SELECT * FROM status WHERE code = 'active';
-- 只有10行，全表扫描比索引扫描还快
```

**场景4：返回大量数据**
```sql
-- 不适合（返回>10%的数据，全表扫描更快）
SELECT * FROM orders WHERE created_at >= '2020-01-01';
-- 返回90%的数据，全表扫描更快
```

#### 五、索引的类型

##### 5.1 单列索引

**定义**：在一个字段上创建的索引

```sql
-- 创建单列索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
```

**使用场景**：
- 单字段查询
- 单字段排序

**限制**：
- 无法优化多字段查询
- 可能产生索引重叠

##### 5.2 组合索引

**定义**：在多个字段上创建的索引

```sql
-- 创建组合索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);
```

**使用场景**：
```sql
-- 能优化
SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01';
SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 不能优化（created_at在前，user_id在后）
SELECT * FROM orders WHERE created_at >= '2026-04-01' AND user_id = 123;
```

**最左前缀原则**：
```sql
-- 索引：(user_id, created_at, order_status)

-- 能使用索引
WHERE user_id = 123
WHERE user_id = 123 AND created_at >= '2026-04-01'
WHERE user_id = 123 AND created_at >= '2026-04-01' AND order_status = 'paid'

-- 不能使用索引（或部分使用）
WHERE created_at >= '2026-04-01'
WHERE order_status = 'paid'
```

**建议**：
- 将最常用的查询字段放在前面
- 将选择性高的字段放在前面
- 避免过多字段（通常<5个）

##### 5.3 唯一索引

**定义**：确保字段值唯一的索引

```sql
-- 创建唯一索引
CREATE UNIQUE INDEX idx_users_email ON users(email);

-- 或者在创建表时定义
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE,
    name VARCHAR(100)
);
```

**作用**：
- 保证数据唯一性
- 加速查询

**使用场景**：
- 主键（PRIMARY KEY）
- 邮箱、手机号等唯一字段
- 业务键（如订单号）

##### 5.4 部分索引

**定义**：只对表中符合条件的行创建索引

```sql
-- 创建部分索引（只索引已支付订单）
CREATE INDEX idx_orders_paid ON orders(user_id) WHERE order_status = 'paid';

-- 使用索引
SELECT * FROM orders WHERE user_id = 123 AND order_status = 'paid';
```

**优势**：
- 减少索引大小
- 节省存储空间
- 加速索引扫描

**使用场景**：
- 只查询特定条件的数据（如已支付订单）
- 数据分布不均（大部分是未支付订单）

##### 5.5 表达式索引

**定义**：在函数或表达式上创建的索引

```sql
-- 创建表达式索引
CREATE INDEX idx_orders_date ON orders(date(created_at));
CREATE INDEX idx_orders_email_lower ON users(LOWER(email));

-- 使用索引
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';
SELECT * FROM users WHERE LOWER(email) = 'test@example.com';
```

**使用场景**：
- 需要在函数或表达式上查询
- 无法修改查询逻辑

#### 六、索引的维护

##### 6.1 查看索引

**查看表的索引**：
```sql
-- 查看orders表的所有索引
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'orders';

-- 查看索引大小
SELECT
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
AND relname = 'orders';
```

##### 6.2 索引的使用统计

**查看索引使用情况**：
```sql
-- 查看索引扫描次数
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- 分析：
-- idx_scan = 0：索引从未使用，考虑删除
-- idx_scan很少：索引使用频率低，考虑是否需要
```

##### 6.3 重建索引

**什么时候需要重建索引**：
- 索引膨胀（size很大）
- 索引碎片化
- 性能下降

**重建索引**：
```sql
-- 方法1：REINDEX
REINDEX INDEX idx_orders_user_id;

-- 方法2：CREATE INDEX CONCURRENTLY
DROP INDEX idx_orders_user_id;
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);

-- 注意：
-- - REINDEX会锁表
-- - CREATE INDEX CONCURRENTLY不锁表，但耗时更长
```

##### 6.4 删除无用索引

**查找未使用的索引**：
```sql
-- 查找从未使用的索引
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexname NOT LIKE '%_pkey';
```

**删除索引**：
```sql
-- 删除前确认
-- 1. 索引确实未被使用
-- 2. 不是主键或唯一约束
-- 3. 不影响查询性能

DROP INDEX idx_orders_unused;
```

#### 七、索引的性能影响

##### 7.1 索引对查询的影响

**正面影响**：
- 查询速度提升10-1000倍
- 排序加速
- JOIN加速

**负面影响**：
- 占用存储空间（通常是表的10%-50%）
- 降低写入性能（INSERT、UPDATE、DELETE需要更新索引）

##### 7.2 索引对写入的影响

**写入过程**：
```sql
INSERT INTO orders (user_id, total_amount) VALUES (123, 100.00);
```

**有索引时**：
1. 写入表数据
2. 更新所有索引（每个索引都需要更新）
3. 如果有3个索引，需要写入4次（1次表 + 3次索引）

**写入性能**：
- 无索引：1000行/秒
- 有3个索引：300行/秒
- 性能下降3倍

**平衡**：
- 查询频繁的表：多索引
- 写入频繁的表：少索引
- 分析场景：可以有很多索引
- 事务场景：索引要少

#### 八、常见误区

**误区一：索引越多查询越快**

- **说明**：索引能加速查询，但优化器需要评估所有索引，索引太多反而慢
- **后果**：查询优化时间长，索引维护成本高
- **正确理解**：
  - 只为常用查询创建索引
  - 定期清理无用索引
  - 避免重叠索引

**误区二：所有字段都需要索引**

- **说明**：只有查询、排序、JOIN的字段需要索引
- **后果**：索引太多，写入慢，存储浪费
- **正确理解**：
  - WHERE条件中的字段
  - ORDER BY中的字段
  - JOIN条件中的字段
  - 其他字段不需要索引

**误区三：索引能解决所有性能问题**

- **说明**：索引只解决特定类型的性能问题，不是万能的
- **后果**：过度依赖索引，忽视其他优化手段
- **正确理解**：
  - 索引优化：查询性能
  - 分区优化：数据访问模式
  - 缓存优化：热点数据
  - 综合优化

**误区四：索引一旦创建就不管了**

- **说明**：索引需要维护，需要定期检查和优化
- **后果**：索引膨胀、碎片化，性能下降
- **正确理解**：
  - 定期查看索引使用情况
  - 删除无用索引
  - 重建膨胀的索引
  - 根据查询模式调整索引

**误区五：索引名称不重要**

- **说明**：索引名称很重要，需要能看出索引的用途
- **后果**：难以维护，不知道索引是干什么的
- **正确理解**：
  - 使用有意义的命名（如idx_orders_user_id）
  - 避免自动生成的名称（如idx_12345）
  - 便于查看和维护

#### 九、实战任务

**任务1：创建索引优化查询**

为以下查询创建合适的索引：

```sql
-- 查询1：查询单个用户的订单
SELECT * FROM orders WHERE user_id = 123;

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 查询2：查询某天的订单
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 创建索引
CREATE INDEX idx_orders_created_date ON orders(date(created_at));

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 查询3：查询用户在某个时间段的订单
SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01' AND created_at < '2026-05-01';

-- 创建组合索引
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123 AND created_at >= '2026-04-01' AND created_at < '2026-05-01';
```

**任务2：查找无用索引**

查找并删除无用索引：

```sql
-- 1. 查看所有索引
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;

-- 2. 找出从未使用的索引
-- idx_scan = 0 且不是主键

-- 3. 删除前确认
-- - 查看索引定义
SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_orders_unused';

-- - 确认是否是约束索引
SELECT * FROM pg_constraint WHERE conname = 'idx_orders_unused';

-- 4. 删除无用索引
DROP INDEX IF EXISTS idx_orders_unused;
```

**任务3：监控索引性能**

监控索引的使用情况和性能：

```sql
-- 1. 查看索引使用统计
SELECT
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- 2. 查看索引大小
SELECT
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as table_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) as indexes_size,
    (pg_indexes_size(schemaname||'.'||tablename)::numeric / pg_total_relation_size(schemaname||'.'||tablename)) * 100 as index_ratio
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_indexes_size(schemaname||'.'||tablename) DESC;

-- 3. 分析：
-- - 哪些索引使用最频繁？
-- - 哪些索引从未使用？
-- - 索引占多少空间？（通常<表大小的50%）
```

#### 十、小结

索引是大表优化的基础。

核心要点：
- B-tree是PostgreSQL的默认索引类型
- 索引通过有序数据结构加速查询、排序、JOIN
- 索引的类型：单列、组合、唯一、部分、表达式
- 索引有代价：写入性能下降、存储空间增加
- 按需创建索引，不是越多越好
- 定期维护索引：查看使用情况、删除无用索引、重建膨胀索引

下一节将进入索引进阶：BRIN、GIN、GiST等特殊索引类型，针对特定场景优化。

### 3.6 索引进阶：BRIN、GIN、GiST与特殊场景

上一节学习了B-tree索引，这是PostgreSQL的默认索引类型，也是最常用的。

但PostgreSQL还支持其他索引类型：
- **BRIN**：块范围索引，适合超大表
- **GIN**：倒排索引，适合数组、JSON、全文搜索
- **GiST**：通用搜索树，适合地理信息、范围查询

**为什么需要不同的索引类型？**

因为不同的数据结构和查询场景需要不同的优化：

```sql
-- 场景1：时间序列数据（按时间插入，很少查询旧数据）
-- 适合：BRIN索引（索引小，维护成本低）

-- 场景2：标签查询（一个商品有多个标签）
SELECT * FROM products WHERE tags @> ARRAY['电子产品', '智能'];
-- 适合：GIN索引（支持数组、JSON包含查询）

-- 场景3：地理查询（附近的人）
SELECT * FROM shops WHERE ST_DWithin(location, 'POINT(121.47 31.23)', 1000);
-- 适合：GiST索引（支持地理信息、范围查询）
```

理解不同索引类型的适用场景，才能选择最合适的索引。

#### 一、为什么需要多种索引类型

**第一，B-tree不是万能的**

**B-tree的局限**：
```sql
-- 场景：时间序列表（每天1000万行，一年365亿行）
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_name VARCHAR(100),
    event_time TIMESTAMP
);

-- 创建B-tree索引
CREATE INDEX idx_events_time ON events(event_time);

-- 问题：
-- 1. B-tree索引很大（365亿行，索引可能几十GB）
-- 2. 每次插入都需要更新索引（写入慢）
-- 3. 大部分查询只查最近数据（索引利用率低）
```

**更适合的方案**：
```sql
-- 创建BRIN索引
CREATE INDEX idx_events_time_brin ON events USING BRIN(event_time);

-- 优势：
-- 1. 索引很小（只有几MB）
-- 2. 维护成本低（插入快）
-- 3. 适合按时间查询的大表
```

**第二，不同的数据结构需要不同的索引**

**数组数据**：
```sql
-- 商品有多个标签
CREATE TABLE products (
    product_id BIGINT,
    name VARCHAR(100),
    tags TEXT[]
);

-- 插入数据
INSERT INTO products (product_id, name, tags) VALUES
(1, 'iPhone', ARRAY['电子产品', '手机', '智能']);

-- 查询：包含特定标签的商品
SELECT * FROM products WHERE tags @> ARRAY['电子产品'];
```

**问题**：B-tree无法高效支持数组包含查询

**解决方案**：
```sql
-- 创建GIN索引
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- 优势：
-- 1. 支持数组包含查询（@>）
-- 2. 支持JSON包含查询（@>）
-- 3. 支持全文搜索
```

**第三，不同的查询模式需要不同的索引**

**地理查询**：
```sql
-- 店铺位置
CREATE TABLE shops (
    shop_id BIGINT,
    name VARCHAR(100),
    location GEOGRAPHY(POINT, 4326)
);

-- 插入数据
INSERT INTO shops (shop_id, name, location) VALUES
(1, '星巴克', ST_MakePoint(121.47, 31.23)::geography);

-- 查询：附近的店铺
SELECT * FROM shops WHERE ST_DWithin(location, ST_MakePoint(121.47, 31.23)::geography, 1000);
```

**问题**：B-tree无法高效支持地理距离查询

**解决方案**：
```sql
-- 创建GiST索引
CREATE INDEX idx_shops_location ON shops USING GIST(location);

-- 优势：
-- 1. 支持地理距离查询（ST_DWithin）
-- 2. 支持范围查询
-- 3. 支持地理包含查询
```

**结论**：
> 不同索引类型适用不同场景，选择正确的索引类型能大幅提升性能。

#### 二、核心判断：索引类型选择基于数据结构和查询模式

> 索引类型选择的核心判断是：根据数据结构（数组、JSON、地理信息）和查询模式（包含查询、范围查询、距离查询），选择最合适的索引类型，而不是默认使用B-tree。

这个判断说明：
- **B-tree**：默认选择，适合大部分场景
- **BRIN**：时间序列、超大表
- **GIN**：数组、JSON、全文搜索
- **GiST**：地理信息、范围查询
- **选择依据**：数据结构 + 查询模式

#### 三、BRIN索引

##### 3.1 什么是BRIN

**定义**：Block Range INdex（块范围索引），按表的物理存储块（通常每块128KB）建立索引

**特点**：
- **极小**：索引大小只有B-tree的1/1000
- **快速**：维护成本极低，插入快
- **有序**：适合按时间顺序插入的数据

**存储结构**：
```
数据块：
Block 1: 1-1000行（2026-01-01的数据）
Block 2: 1001-2000行（2026-01-02的数据）
...

BRIN索引：
Block 1: min=2026-01-01, max=2026-01-01
Block 2: min=2026-01-02, max=2026-01-02
...
```

**说明**：
- BRIN只记录每个块的min和max值
- 查询时根据min/max判断是否需要扫描这个块
- 索引非常小（几千行只需几KB）

##### 3.2 BRIN的使用场景

**适合场景**：
```yaml
时间序列数据：
  - 按时间顺序插入
  - 按时间范围查询
  - 表非常大（>1亿行）

日志数据：
  - 按时间顺序写入
  - 很少查询旧数据
  - 表非常大（>10亿行）

监控数据：
  - 定时批量写入
  - 按时间范围查询
  - 表非常大
```

**示例**：
```sql
-- 创建时间序列表
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_name VARCHAR(100),
    event_time TIMESTAMP
);

-- 创建BRIN索引
CREATE INDEX idx_events_time_brin ON events USING BRIN(event_time);

-- 查询（自动使用BRIN索引）
SELECT * FROM events WHERE event_time >= '2026-04-01' AND event_time < '2026-04-02';

-- 优势：
-- 1. 索引小（1亿行只有几MB）
-- 2. 查询只扫描相关块
-- 3. 维护成本低（插入快）
```

##### 3.3 BRIN vs B-tree

| 维度 | B-tree | BRIN |
|------|--------|------|
| 索引大小 | 1亿行约1GB | 1亿行约1MB |
| 维护成本 | 高（每次插入更新） | 低（只记录块范围） |
| 查询性能 | 快（精确查找） | 较快（范围查找） |
| 适合场景 | 通用、高频查询 | 时间序列、大表 |

**选择建议**：
```yaml
<1000万行：B-tree
1000万-1亿行：B-tree或BRIN
>1亿行且按时间查询：BRIN
>1亿行且随机查询：B-tree
```

#### 四、GIN索引

##### 4.1 什么是GIN

**定义**：Generalized Inverted Index（广义倒排索引），适合包含查询

**倒排索引**：
```
文档：
Doc1: "PostgreSQL is awesome"
Doc2: "MySQL is popular"
Doc3: "PostgreSQL and MySQL"

倒排索引：
"PostgreSQL" -> [Doc1, Doc3]
"MySQL" -> [Doc2, Doc3]
"awesome" -> [Doc1]
```

**特点**：
- **包含查询**：支持数组、JSON的包含查询（@>、&&）
- **全文搜索**：支持文本搜索
- **多值**：一个字段可以有多个值

##### 4.2 GIN的使用场景

**场景1：数组包含查询**
```sql
-- 商品有多个标签
CREATE TABLE products (
    product_id BIGINT,
    name VARCHAR(100),
    tags TEXT[]
);

-- 插入数据
INSERT INTO products (product_id, name, tags) VALUES
(1, 'iPhone', ARRAY['电子产品', '手机', '智能']),
(2, 'MacBook', ARRAY['电子产品', '电脑', '智能']),
(3, 'AirPods', ARRAY['电子产品', '耳机']);

-- 创建GIN索引
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- 查询：包含特定标签的商品
SELECT * FROM products WHERE tags @> ARRAY['电子产品', '智能'];
-- 返回：iPhone, MacBook

-- 查询：包含任一标签的商品
SELECT * FROM products WHERE tags && ARRAY['手机', '耳机'];
-- 返回：iPhone, AirPods
```

**场景2：JSON包含查询**
```sql
-- 用户属性（JSON）
CREATE TABLE users (
    user_id BIGINT,
    name VARCHAR(100),
    attributes JSONB
);

-- 插入数据
INSERT INTO users (user_id, name, attributes) VALUES
(1, 'Alice', '{"age": 25, "city": "Beijing", "interests": ["music", "travel"]}'::jsonb),
(2, 'Bob', '{"age": 30, "city": "Shanghai", "interests": ["sports", "reading"]}'::jsonb);

-- 创建GIN索引
CREATE INDEX idx_users_attributes ON users USING GIN(attributes);

-- 查询：包含特定属性的用户
SELECT * FROM users WHERE attributes @> '{"age": 25}';
-- 返回：Alice

-- 查询：包含特定兴趣的用户
SELECT * FROM users WHERE attributes @> '{"interests": ["music"]}';
-- 返回：Alice
```

**场景3：全文搜索**
```sql
-- 文章表
CREATE TABLE articles (
    article_id BIGINT,
    title VARCHAR(200),
    content TEXT
);

-- 创建全文搜索索引
CREATE INDEX idx_articles_content ON articles USING GIN(to_tsvector('chinese', content));

-- 查询：搜索包含"PostgreSQL"的文章
SELECT * FROM articles WHERE to_tsvector('chinese', content) @@ to_tsquery('chinese', 'PostgreSQL');
```

##### 4.3 GIN的优化

**gin_pending_list_limit**：
```yaml
默认值：4MB
作用：控制GIN索引的pending list大小

优化：
  - 写入频繁：增大到16MB或更大
  - 查询频繁：保持默认值
```

**快速更新**：
```sql
-- 启用快速更新（减少维护成本）
CREATE INDEX idx_products_tags ON products USING GIN(tags) WITH (fastupdate = on);

-- 快速更新后，索引更新会先放入pending list
-- 当pending list满时，才批量更新索引
```

#### 五、GiST索引

##### 5.1 什么是GiST

**定义**：Generalized Search Tree（通用搜索树），适合复杂数据类型和范围查询

**特点**：
- **通用**：支持多种数据类型
- **范围**：支持范围查询、地理查询
- **树结构**：类似B-tree，但更灵活

**适用数据类型**：
- 地理信息（POINT、POLYGON）
- 范围（INT4RANGE、TSTZRANGE）
- 全文搜索（与GIN重叠）

##### 5.2 GiST的使用场景

**场景1：地理距离查询**
```sql
-- 启用PostGIS扩展
CREATE EXTENSION postgis;

-- 店铺表
CREATE TABLE shops (
    shop_id BIGINT,
    name VARCHAR(100),
    location GEOGRAPHY(POINT, 4326)
);

-- 插入数据
INSERT INTO shops (shop_id, name, location) VALUES
(1, '星巴克', ST_MakePoint(121.47, 31.23)::geography),
(2, '喜茶', ST_MakePoint(121.48, 31.24)::geography);

-- 创建GiST索引
CREATE INDEX idx_shops_location ON shops USING GIST(location);

-- 查询：附近的店铺（1km范围内）
SELECT
    name,
    ST_Distance(location, ST_MakePoint(121.47, 31.23)::geography) as distance
FROM shops
WHERE ST_DWithin(location, ST_MakePoint(121.47, 31.23)::geography, 1000)
ORDER BY distance;
```

**场景2：范围查询**
```sql
-- 会议表（有开始时间和结束时间）
CREATE TABLE meetings (
    meeting_id BIGINT,
    name VARCHAR(100),
    time_range TSRANGE
);

-- 插入数据
INSERT INTO meetings (meeting_id, name, time_range) VALUES
(1, '晨会', '[2026-04-01 09:00:00, 2026-04-01 09:30:00)'),
(2, '周会', '[2026-04-01 14:00:00, 2026-04-01 15:00:00)');

-- 创建GiST索引
CREATE INDEX idx_meetings_time ON meetings USING GIST(time_range);

-- 查询：某个时间段内的会议
SELECT * FROM meetings
WHERE time_range && '[2026-04-01 09:15:00, 2026-04-01 14:30:00]';
-- 返回：晨会、周会（都部分重叠）
```

**场景3：范围包含查询**
```sql
-- 查询：完全包含某个时间范围的会议
SELECT * FROM meetings
WHERE time_range @> '[2026-04-01 09:00:00, 2026-04-01 09:30:00]';
-- 返回：晨会（完全包含）
```

#### 六、不同索引类型的对比

| 索引类型 | 适合场景 | 查询类型 | 示例 |
|---------|---------|---------|------|
| B-tree | 通用、等值、范围、排序 | =, <, >, BETWEEN, ORDER BY | WHERE user_id = 123 |
| BRIN | 时间序列、大表 | 范围查询 | WHERE event_time >= '2026-04-01' |
| GIN | 数组、JSON、全文搜索 | @>, &&, @@ | WHERE tags @> ARRAY['a'] |
| GiST | 地理、范围 | ST_DWithin, &&, @> | WHERE ST_DWithin(location, ...) |

**选择流程**：
```
开始
  |
  v
是否是地理查询？
  Yes → GiST
  No  |
      v
  是否是数组/JSON/全文搜索？
    Yes → GIN
    No  |
        v
    是否是时间序列大表（>1亿行）？
      Yes → BRIN
      No  |
          v
        B-tree（默认）
```

#### 七、索引类型的组合

**单个表可以有多个不同类型的索引**：

```sql
-- 用户行为表
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_name VARCHAR(100),
    event_time TIMESTAMP,
    properties JSONB
);

-- B-tree索引：通用查询
CREATE INDEX idx_events_user_id ON events(user_id);
CREATE INDEX idx_events_time ON events(event_time);

-- BRIN索引：时间范围查询
CREATE INDEX idx_events_time_brin ON events USING BRIN(event_time);

-- GIN索引：JSON属性查询
CREATE INDEX idx_events_properties ON events USING GIN(properties);

-- 查询时优化器自动选择最合适的索引
SELECT * FROM events WHERE user_id = 123;  -- 使用idx_events_user_id
SELECT * FROM events WHERE event_time >= '2026-04-01';  -- 使用idx_events_time_brin
SELECT * FROM events WHERE properties @> '{"page": "home"}';  -- 使用idx_events_properties
```

#### 八、常见误区

**误区一：B-tree总是最好的选择**

- **说明**：B-tree是默认选择，但不是所有场景的最优选择
- **后果**：性能未优化，索引维护成本高
- **正确理解**：
  - 时间序列大表：BRIN
  - 数组/JSON：GIN
  - 地理查询：GiST
  - 其他场景：B-tree

**误区二：BRIN可以替代B-tree**

- **说明**：BRIN只适合特定场景（时间序列大表）
- **后果**：误用BRIN，查询性能差
- **正确理解**：
  - BRIN适合：按时间顺序插入的大表
  - BRIN不适合：随机查询、小表
  - 大多数场景还是用B-tree

**误区三：GIN只用于全文搜索**

- **说明**：GIN不仅用于全文搜索，还支持数组、JSON包含查询
- **后果**：忽视GIN在其他场景的应用
- **正确理解**：
  - 全文搜索：GIN
  - 数组包含查询：GIN
  - JSON包含查询：GIN

**误区四：GiST只用于地理信息**

- **说明**：GiST不仅用于地理信息，还支持范围查询
- **后果**：忽视GiST在其他场景的应用
- **正确理解**：
  - 地理查询：GiST
  - 范围查询：GiST
  - 全文搜索：GiST（但GIN更常用）

**误区五：不同索引类型不能共存**

- **说明**：单个表可以有多个不同类型的索引
- **后果**：不敢使用不同索引类型
- **正确理解**：
  - 可以组合使用不同索引类型
  - 优化器自动选择最合适的索引
  - 根据查询模式创建索引

#### 九、实战任务

**任务1：为时间序列表选择索引**

给定events表（每天1000万行），选择合适的索引：

```sql
-- 表定义
CREATE TABLE events (
    event_id BIGINT,
    user_id BIGINT,
    event_name VARCHAR(100),
    event_time TIMESTAMP
);

-- 问题1：按时间范围查询
SELECT * FROM events WHERE event_time >= '2026-04-01' AND event_time < '2026-04-02';

-- 创建BRIN索引
CREATE INDEX idx_events_time_brin ON events USING BRIN(event_time);

-- 问题2：按用户查询
SELECT * FROM events WHERE user_id = 123;

-- 创建B-tree索引
CREATE INDEX idx_events_user_id ON events(user_id);

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM events WHERE event_time >= '2026-04-01' AND event_time < '2026-04-02';
EXPLAIN ANALYZE SELECT * FROM events WHERE user_id = 123;
```

**任务2：为标签数据创建索引**

给定products表（商品有多个标签），创建合适的索引：

```sql
-- 表定义
CREATE TABLE products (
    product_id BIGINT,
    name VARCHAR(100),
    tags TEXT[]
);

-- 插入数据
INSERT INTO products (product_id, name, tags) VALUES
(1, 'iPhone', ARRAY['电子产品', '手机', '智能']),
(2, 'MacBook', ARRAY['电子产品', '电脑', '智能']),
(3, 'AirPods', ARRAY['电子产品', '耳机']);

-- 创建GIN索引
CREATE INDEX idx_products_tags ON products USING GIN(tags);

-- 查询：包含特定标签的商品
SELECT * FROM products WHERE tags @> ARRAY['电子产品', '智能'];

-- 查询：包含任一标签的商品
SELECT * FROM products WHERE tags && ARRAY['手机', '耳机'];

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM products WHERE tags @> ARRAY['电子产品', '智能'];
```

**任务3：为地理数据创建索引**

给定shops表（店铺位置），创建合适的索引：

```sql
-- 启用PostGIS
CREATE EXTENSION postgis;

-- 表定义
CREATE TABLE shops (
    shop_id BIGINT,
    name VARCHAR(100),
    location GEOGRAPHY(POINT, 4326)
);

-- 插入数据
INSERT INTO shops (shop_id, name, location) VALUES
(1, '星巴克', ST_MakePoint(121.47, 31.23)::geography),
(2, '喜茶', ST_MakePoint(121.48, 31.24)::geography);

-- 创建GiST索引
CREATE INDEX idx_shops_location ON shops USING GIST(location);

-- 查询：附近的店铺（1km范围内）
SELECT
    name,
    ST_Distance(location, ST_MakePoint(121.47, 31.23)::geography) as distance
FROM shops
WHERE ST_DWithin(location, ST_MakePoint(121.47, 31.23)::geography, 1000)
ORDER BY distance;

-- 验证效果
EXPLAIN ANALYZE SELECT * FROM shops
WHERE ST_DWithin(location, ST_MakePoint(121.47, 31.23)::geography, 1000);
```

#### 十、小结

不同的索引类型适用不同场景。

核心要点：
- B-tree：默认选择，通用场景
- BRIN：时间序列大表，索引小、维护成本低
- GIN：数组、JSON、全文搜索，支持包含查询
- GiST：地理信息、范围查询
- 选择依据：数据结构 + 查询模式
- 不同索引类型可以共存
- 优化器自动选择最合适的索引

下一节将进入查询优化基础：如何通过执行计划分析找出性能瓶颈，并优化查询。

### 3.7 查询优化基础：执行计划分析与优化

前面学习了索引（B-tree、BRIN、GIN、GiST），知道索引能加速查询。

但有两个问题：

**问题1**：什么时候需要创建索引？
- 创建索引前，如何知道查询慢？
- 如何找出性能瓶颈？

**问题2**：索引创建后，是否真的使用了？
- 如何验证索引是否被使用？
- 如果没有使用，为什么？

这就需要**查询优化**：通过分析执行计划，找出性能瓶颈，优化查询。

**什么是执行计划？**

执行计划是数据库执行SQL的具体步骤，包括：
- 使用了哪个索引？
- 扫描了多少行？
- JOIN的顺序是什么？
- 每一步的成本是多少？

通过分析执行计划，可以：
1. 找出慢查询的原因
2. 验证索引是否被使用
3. 优化查询逻辑
4. 提升查询性能

#### 一、为什么需要查询优化

**第一，查询可能很慢但不明显**

**示例**：
```sql
-- 这个查询看起来很简单
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 执行时间：30秒
-- 为什么慢？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 可能发现：
-- 1. orders表全表扫描（Seq Scan）
-- 2. 没有使用索引
-- 3. 扫描了1亿行
```

**优化方案**：
```sql
-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次查询
-- 执行时间：0.5秒
-- 性能提升：60倍
```

**第二，索引可能未被使用**

**示例**：
```sql
-- 创建了索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 但查询还是慢
SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 执行时间：25秒
-- 为什么？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE date(created_at) = '2026-04-01';

-- 可能发现：
-- 1. 全表扫描（Seq Scan）
-- 2. 没有使用idx_orders_user_id索引
-- 3. 原因：WHERE条件中有函数，无法使用索引
```

**优化方案**：
```sql
-- 创建表达式索引
CREATE INDEX idx_orders_created_date ON orders(date(created_at));

-- 再次查询
-- 执行时间：0.1秒
-- 性能提升：250倍
```

**第三，查询逻辑可能不优**

**示例**：
```sql
-- 先JOIN再过滤
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 执行时间：20秒
-- 为什么？看执行计划
```

**执行计划分析**：
```sql
EXPLAIN ANALYZE
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 可能发现：
-- 1. 先JOIN（扫描所有orders）
-- 2. 再过滤created_at
-- 3. 如果大部分订单是2026年前的，JOIN浪费
```

**优化方案**：
```sql
-- 先过滤再JOIN
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-04-01'
) o ON u.user_id = o.user_id;

-- 再次查询
-- 执行时间：2秒
-- 性能提升：10倍
```

**结论**：
> 查询优化的核心是：通过分析执行计划，找出性能瓶颈（全表扫描、索引未使用、JOIN顺序不当），针对性地优化查询或索引。

#### 二、核心判断：优化不是"试错"，而是"分析"

> 查询优化的核心判断是：通过EXPLAIN ANALYZE分析执行计划，找出性能瓶颈（扫描行数、JOIN成本、索引使用），针对性地优化查询逻辑或创建索引，而不是盲目试错。

这个判断说明：
- **工具**：EXPLAIN ANALYZE
- **分析**：找出瓶颈
- **优化**：针对性改进
- **验证**：对比优化效果

#### 三、EXPLAIN ANALYZE基础

##### 3.1 什么是执行计划

**定义**：数据库执行SQL的具体步骤

**作用**：
- 显示SQL如何执行
- 显示每一步的成本
- 显示实际执行时间

**使用方法**：
```sql
-- 基础EXPLAIN（只显示计划，不执行）
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 完整EXPLAIN ANALYZE（执行并显示实际时间）
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;
```

##### 3.2 执行计划的结构

**执行计划示例**：
```sql
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200) (actual time=0.021..0.123 rows=100 loops=1)
  Index Cond: (user_id = 123)
Planning Time: 0.123 ms
Execution Time: 0.456 ms
```

**关键指标**：
- **Index Scan**：索引扫描（好）
- **Seq Scan**：顺序扫描（全表扫描，通常不好）
- **cost**：预估成本（0.42..123.45，越低越好）
- **rows**：预估行数（100行）
- **actual time**：实际执行时间（0.021..0.123 ms，越低越好）
- **loops**：循环次数（1次）

**执行计划的层级**：
```sql
EXPLAIN ANALYZE
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Hash Join  (cost=123.45..234.56 rows=100 width=200) (actual time=1.234..5.678 rows=100 loops=1)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o  (cost=0.00..123.45 rows=10000 width=100) (actual time=0.123..2.345 rows=10000 loops=1)
  ->  Hash  (cost=1.23..123.45 rows=100 width=100) (actual time=0.456..0.789 rows=100 loops=1)
        ->  Index Scan using idx_users_user_id on users u  (cost=0.42..1.23 rows=1 width=100) (actual time=0.012..0.034 rows=1 loops=1)
Planning Time: 0.234 ms
Execution Time: 6.123 ms
```

**说明**：
- 最外层：Hash Join
- 内层1：Seq Scan on orders（扫描整个orders表）
- 内层2：Index Scan on users（通过索引查找用户）

#### 四、执行计划的读取

##### 4.1 扫描方式

**Seq Scan（顺序扫描）**：
```sql
Seq Scan on orders  (cost=0.00..12345.67 rows=1000000 width=200)
```

**特点**：
- 从头到尾扫描整个表
- 成本高（cost大）
- 适合：返回大量数据（>表大小的5%）
- 不适合：只返回少量数据

**Index Scan（索引扫描）**：
```sql
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
```

**特点**：
- 通过索引快速定位数据
- 成本低（cost小）
- 适合：返回少量数据（<表大小的1%）
- 不适合：返回大量数据

**Bitmap Index Scan（位图索引扫描）**：
```sql
Bitmap Heap Scan on orders  (cost=123.45..234.56 rows=10000 width=200)
  Recheck Cond: (user_id = ANY (ARRAY[123, 456, 789]))
  ->  Bitmap Index Scan on idx_orders_user_id  (cost=0.00..123.45 rows=10000 width=0)
```

**特点**：
- 先用索引找到所有符合条件的row_id
- 再批量读取表数据
- 适合：多个OR条件、范围查询

##### 4.2 JOIN方式

**Nested Loop（嵌套循环）**：
```sql
Nested Loop  (cost=0.00..1234567.89 rows=1000000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Seq Scan on users u
  ->  Seq Scan on orders o
```

**特点**：
- 对users的每一行，扫描整个orders表
- 复杂度：O(users × orders)
- 适合：小表JOIN、有索引
- 不适合：大表JOIN

**Hash Join（哈希连接）**：
```sql
Hash Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Hash Cond: (o.user_id = u.user_id)
  ->  Seq Scan on orders o
  ->  Hash
        ->  Seq Scan on users u
```

**特点**：
- 对users表构建哈希表
- 用orders表的user_id去哈希表中查找
- 适合：大表JOIN、等值连接
- 不适合：范围连接、非等值连接

**Merge Join（归并连接）**：
```sql
Merge Join  (cost=123.45..23456.78 rows=1000000 width=400)
  Merge Cond: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u
  ->  Index Scan using idx_orders_user_id on orders o
```

**特点**：
- 两个表都按user_id排序
- 类似归并排序
- 适合：大表JOIN、已经排序
- 不适合：小表JOIN

##### 4.3 聚合方式

**HashAggregate**：
```sql
HashAggregate  (cost=123.45..234.56 rows=100 width=200)
  Group Key: u.user_id
  ->  Nested Loop  (cost=0.00..123.45 rows=10000 width=150)
```

**特点**：
- 使用哈希表进行聚合
- 适合：少量GROUP BY字段
- 不适合：大量GROUP BY字段

**GroupAggregate**：
```sql
GroupAggregate  (cost=123.45..234.56 rows=100 width=200)
  Group Key: u.user_id, u.name
  ->  Sort  (cost=123.45..234.56 rows=10000 width=150)
        Sort Key: u.user_id, u.name
```

**特点**：
- 先排序，再聚合
- 适合：大量GROUP BY字段
- 不适合：少量GROUP BY字段

#### 五、执行计划的优化

##### 5.1 识别全表扫描

**问题**：全表扫描（Seq Scan）

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Seq Scan on orders  (cost=0.00..12345.67 rows=100 width=200)
  Filter: (user_id = 123)
```

**优化**：创建索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次执行
EXPLAIN SELECT * FROM orders WHERE user_id = 123;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
```

##### 5.2 识别高成本查询

**问题**：cost很高

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 OR user_id = 456;

-- 输出：
Seq Scan on orders  (cost=0.00..12345.67 rows=200 width=200)
  Filter: (user_id = 123 OR user_id = 456)
```

**优化**：改用IN
```sql
-- 使用IN（可能使用索引）
SELECT * FROM orders WHERE user_id IN (123, 456);

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.84..246.90 rows=200 width=200)
  Index Cond: (user_id = ANY (ARRAY[123, 456]))
```

##### 5.3 识别低效的JOIN

**问题**：Nested Loop（嵌套循环）

```sql
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Nested Loop  (cost=0.00..1234567.89 rows=100000 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u  (cost=0.42..8.44 rows=1 width=100)
        Index Cond: (user_id = 123)
  ->  Seq Scan on orders o  (cost=0.00..12345.67 rows=100000 width=300)
```

**优化**：为orders.user_id创建索引
```sql
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 再次执行
EXPLAIN SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE u.user_id = 123;

-- 输出：
Nested Loop  (cost=0.42..123.45 rows=100 width=400)
  Join Filter: (u.user_id = o.user_id)
  ->  Index Scan using idx_users_user_id on users u  (cost=0.42..8.44 rows=1 width=100)
        Index Cond: (user_id = 123)
  ->  Index Scan using idx_orders_user_id on orders o  (cost=0.42..123.45 rows=100 width=300)
        Index Cond: (user_id = 123)
```

##### 5.4 识别排序开销

**问题**：额外排序

```sql
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 输出：
Index Scan using idx_orders_user_id on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
  Sort Key: created_at
  Sort Method: quicksort  Memory: 25kB
```

**优化**：创建组合索引
```sql
CREATE INDEX idx_orders_user_date ON orders(user_id, created_at);

-- 再次执行
EXPLAIN SELECT * FROM orders WHERE user_id = 123 ORDER BY created_at;

-- 输出：
Index Scan using idx_orders_user_date on orders  (cost=0.42..123.45 rows=100 width=200)
  Index Cond: (user_id = 123)
```

**说明**：索引已经按created_at排序，不需要额外排序

#### 六、查询优化的步骤

##### 6.1 识别慢查询

**方法1：查看pg_stat_statements**
```sql
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

**方法2：查看日志**
```sql
-- 启用慢查询日志
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- 记录超过1秒的查询

-- 重载配置
SELECT pg_reload_conf();
```

##### 6.2 分析执行计划

**步骤**：
```sql
-- 1. 使用EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 找出瓶颈
-- - 全表扫描（Seq Scan）
-- - 高成本（cost大）
-- - 扫描行数多（rows大）

-- 3. 确认索引情况
SELECT * FROM pg_indexes WHERE tablename = 'orders';
```

##### 6.3 优化方案

**方案1：创建索引**
```sql
-- 针对全表扫描
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**方案2：重写查询**
```sql
-- 针对低效JOIN
-- 原来：先JOIN再过滤
SELECT u.name, o.order_id
FROM users u
JOIN orders o ON u.user_id = o.user_id
WHERE o.created_at >= '2026-04-01';

-- 优化：先过滤再JOIN
SELECT u.name, o.order_id
FROM users u
JOIN (
    SELECT * FROM orders WHERE created_at >= '2026-04-01'
) o ON u.user_id = o.user_id;
```

**方案3：使用物化视图**
```sql
-- 针对复杂聚合
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

##### 6.4 验证效果

**步骤**：
```sql
-- 1. 再次EXPLAIN ANALYZE
EXPLAIN ANALYZE SELECT * FROM orders WHERE user_id = 123;

-- 2. 对比优化前后
-- 优化前：30秒
-- 优化后：0.1秒
-- 性能提升：300倍

-- 3. 对比cost
-- 优化前：12345.67
-- 优化后：123.45
```

#### 七、常见的性能问题

##### 7.1 全表扫描

**症状**：Seq Scan

**原因**：
- 没有索引
- 索引不适用
- 返回大量数据

**优化**：
- 创建索引
- 重写查询
- 使用分区表

##### 7.2 索引未使用

**症状**：有索引但执行计划显示Seq Scan

**原因**：
- 索引选择性低
- WHERE条件中有函数
- 返回大量数据

**优化**：
- 创建表达式索引
- 重写查询（避免函数）
- 创建部分索引

##### 7.3 低效JOIN

**症状**：Nested Loop，cost很高

**原因**：
- 缺少索引
- JOIN顺序不当
- 数据量太大

**优化**：
- 为JOIN字段创建索引
- 重写查询（先过滤再JOIN）
- 使用Hash Join或Merge Join

##### 7.4 过度排序

**症状**：Sort，Memory很大

**原因**：
- 缺少组合索引
- ORDER BY字段未索引

**优化**：
- 创建组合索引
- 调整查询逻辑

#### 八、常见误区

**误区一：EXPLAIN的结果就是准确的**

- **说明**：EXPLAIN显示的是预估，不一定准确
- **后果**：只看EXPLAIN，不看EXPLAIN ANALYZE
- **正确理解**：
  - EXPLAIN：只显示计划，不执行
  - EXPLAIN ANALYZE：执行并显示实际时间
  - 必须用EXPLAIN ANALYZE验证

**误区二：cost越小越好**

- **说明**：cost是优化器的估算，不是实际执行时间
- **后果**：只看cost，不看actual time
- **正确理解**：
  - cost：估算成本
  - actual time：实际执行时间
  - 主要看actual time

**误区三：Seq Scan一定不好**

- **说明**：Seq Scan在某些场景下是最优选择
- **后果**：看到Seq Scan就优化
- **正确理解**：
  - 返回大量数据（>5%）：Seq Scan更好
  - 返回少量数据（<1%）：Index Scan更好
  - 根据实际场景判断

**误区四：索引越多查询越快**

- **说明**：索引能加速查询，但优化器需要评估所有索引
- **后果**：索引太多，查询规划时间长
- **正确理解**：
  - 合理的索引数量
  - 删除无用索引
  - 定期review索引

**误区五：优化一次就够了**

- **说明**：查询优化是持续工作，数据变化后需要重新优化
- **后果**：优化后不再关注，性能再次下降
- **正确理解**：
  - 定期检查慢查询
  - 数据增长后重新优化
  - 持续监控和维护

#### 九、实战任务

**任务1：分析慢查询**

找出并优化慢查询：

```sql
-- 1. 找出慢查询
SELECT
    query,
    calls,
    mean_exec_time,
    max_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- 2. 分析最慢的查询
EXPLAIN ANALYZE <最慢的查询>;

-- 3. 识别瓶颈
-- - 全表扫描？
-- - 缺少索引？
-- - JOIN效率低？

-- 4. 优化
-- 创建索引
-- 重写查询
-- 使用物化视图

-- 5. 验证效果
EXPLAIN ANALYZE <优化后的查询>;
```

**任务2：优化JOIN查询**

优化以下JOIN查询：

```sql
-- 原查询（慢）
SELECT u.name, count(o.order_id) as order_count
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name
ORDER BY order_count DESC;

-- 分析执行计划
EXPLAIN ANALYZE <原查询>;

-- 优化：为orders.user_id创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 验证效果
EXPLAIN ANALYZE <优化后的查询>;
```

**任务3：优化聚合查询**

优化以下聚合查询：

```sql
-- 原查询（慢）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 分析执行计划
EXPLAIN ANALYZE <原查询>;

-- 优化：创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 刷新物化视图
REFRESH MATERIALIZED VIEW daily_gmv;

-- 查询物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

#### 十、小结

查询优化是通过分析执行计划，找出性能瓶颈。

核心要点：
- 使用EXPLAIN ANALYZE分析执行计划
- 关键指标：扫描方式、cost、rows、actual time
- 常见瓶颈：全表扫描、索引未使用、低效JOIN、过度排序
- 优化方法：创建索引、重写查询、使用物化视图
- 验证效果：对比优化前后的执行时间和cost
- 优化是持续工作，需要定期review

下一节将进入物化视图：把重复计算提前做掉，进一步提升查询性能。

### 3.8 物化视图：把重复计算提前做掉

前几节学习了多种优化手段：
- 分区表：通过物理边界优化查询
- 索引：加速数据查找
- 查询优化：分析执行计划，优化查询逻辑

但这些优化都是针对单个查询的。

**问题**：如果一个复杂查询被频繁执行怎么办？

**场景**：
```sql
-- 复杂聚合查询（每天执行1000次）
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 执行时间：5秒
-- 总时间：5秒 × 1000次 = 5000秒（约1.4小时）
```

**问题**：
- 每次都重新计算
- 浪费CPU资源
- 响应时间慢

**解决方案**：**物化视图（Materialized View）**

**什么是物化视图？**

普通视图（View）：
```sql
-- 只存储查询逻辑，不存储数据
CREATE VIEW daily_gmv_view AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询时重新计算
SELECT * FROM daily_gmv_view WHERE order_date = '2026-04-01';
-- 执行时间：5秒（每次都计算）
```

物化视图（Materialized View）：
```sql
-- 存储查询结果（物理存储）
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT date(created_at) as order_date, sum(total_amount) as gmv
FROM orders
GROUP BY date(created_at);

-- 查询时直接读取预计算结果
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- 执行时间：0.01秒（直接读取）
```

**性能差异**：500倍！

#### 一、为什么需要物化视图

**第一，复杂聚合查询计算成本高**

**场景**：每日GMV统计

**计算内容**：
```sql
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users,
    avg(total_amount) as avg_amount,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount) as median_amount
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);
```

**问题**：
- 需要扫描大量数据（可能数亿行）
- 需要多个聚合函数（SUM、COUNT、AVG、百分位数）
- 需要去重计算（DISTINCT）
- 每次查询都重新计算

**成本**：
- 执行时间：10秒
- CPU占用：高
- 磁盘I/O：高

**物化视图**：
```sql
CREATE MATERIALIZED VIEW daily_gmv_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users,
    avg(total_amount) as avg_amount,
    percentile_cont(0.5) WITHIN GROUP (ORDER BY total_amount) as median_amount
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 查询时直接读取
SELECT * FROM daily_gmv_stats WHERE order_date = '2026-04-01';
-- 执行时间：0.01秒
```

**第二，报表查询需要固定数据**

**场景**：运营看板

**需求**：
```yaml
实时性：每小时更新一次
查询频率：每天1000次
数据范围：最近30天
```

**问题**：
- 每次查询都重新计算30天的数据
- 浪费资源
- 响应慢

**物化视图**：
```sql
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at);

-- 每小时刷新一次
REFRESH MATERIALIZED VIEW dashboard_stats;

-- 查询时直接读取
SELECT * FROM dashboard_stats ORDER BY order_date DESC;
```

**第三，JOIN查询可以预计算**

**场景**：用户订单统计

**查询**：
```sql
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;
```

**问题**：
- 需要JOIN两个大表
- 需要聚合计算
- 每次都重新计算

**物化视图**：
```sql
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 定期刷新
REFRESH MATERIALIZED VIEW user_order_stats;

-- 查询时直接读取
SELECT * FROM user_order_stats WHERE user_id = 123;
```

**结论**：
> 物化视图通过预计算和存储查询结果，将复杂查询的时间从秒级降到毫秒级，特别适合报表、看板、统计分析等场景。

#### 二、核心判断：物化视图用空间换时间

> 物化视图的核心判断是：通过预计算并存储查询结果，牺牲存储空间和实时性，换取查询性能的大幅提升，适合重复执行、计算成本高的查询。

这个判断说明：
- **预计算**：提前执行复杂查询
- **存储**：存储查询结果
- **代价**：占用存储空间、数据有延迟
- **收益**：查询性能大幅提升

#### 三、物化视图的基础

##### 3.1 创建物化视图

**基本语法**：
```sql
CREATE MATERIALIZED VIEW mv_name AS
SELECT ...
FROM ...
WHERE ...
GROUP BY ...;
```

**示例**：
```sql
-- 创建每日GMV物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 查看物化视图
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

**查看物化视图**：
```sql
-- 查看所有物化视图
SELECT
    schemaname,
    matviewname,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews;
```

##### 3.2 刷新物化视图

**为什么需要刷新？**
- 物化视图存储的是查询结果
- 底表数据变化后，物化视图不会自动更新
- 需要手动刷新

**刷新方式**：
```sql
-- 完全刷新（删除并重新创建）
REFRESH MATERIALIZED VIEW daily_gmv;

-- 并发刷新（PostgreSQL 9.4+）
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_gmv;
```

**区别**：
- 完全刷新：锁定物化视图，刷新期间无法查询
- 并发刷新：不锁定物化视图，刷新期间可以查询

**注意**：
- 并发刷新需要创建UNIQUE索引
- 刷新成本高，不要频繁刷新

##### 3.3 删除物化视图

```sql
-- 删除物化视图
DROP MATERIALIZED VIEW daily_gmv;

-- 删除并重建
DROP MATERIALIZED VIEW IF EXISTS daily_gmv;
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT ...
```

#### 四、物化视图的高级用法

##### 4.1 增量刷新

**问题**：完全刷新成本高

**场景**：
```sql
-- 物化视图有1亿行
-- 每次刷新都要重新计算
-- 刷新时间：30分钟
```

**解决方案**：增量刷新（PostgreSQL 9.4+）

```sql
-- 创建物化视图时指定刷新方式
CREATE MATERIALIZED VIEW daily_gmv WITH (refresh = incremental) AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 增量刷新（只刷新变化的数据）
REFRESH MATERIALIZED VIEW daily_gmv;
```

**注意**：
- 增量刷新需要特定条件
- 需要有UNIQUE索引
- 不是所有场景都支持

##### 4.2 物化视图的索引

**为什么需要索引？**
- 物化视图也是表，可以创建索引
- 加速对物化视图的查询

**示例**：
```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 创建索引
CREATE INDEX idx_daily_gmv_date ON daily_gmv(order_date);

-- 查询时使用索引
EXPLAIN SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

##### 4.3 物化视图的分区

**场景**：物化视图也可以分区

```sql
-- 创建分区表
CREATE TABLE orders (...) PARTITION BY RANGE (created_at);

-- 创建分区物化视图
CREATE MATERIALIZED VIEW daily_gmv_partitioned AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count
FROM orders
GROUP BY date(created_at);

-- 按月分区（手动创建分区）
CREATE TABLE daily_gmv_202601 PARTITION OF daily_gmv_partitioned
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
```

#### 五、物化视图的使用场景

##### 5.1 报表和看板

**场景**：运营看板

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW dashboard_stats AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY date(created_at);

-- 每小时刷新一次
REFRESH MATERIALIZED VIEW dashboard_stats;

-- 看板查询
SELECT
    order_date,
    gmv,
    order_count,
    unique_users
FROM dashboard_stats
ORDER BY order_date DESC;
```

##### 5.2 数据聚合

**场景**：用户行为分析

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW user_daily_stats AS
SELECT
    user_id,
    date(event_time) as activity_date,
    count(*) as event_count,
    count(DISTINCT event_name) as unique_events
FROM events
WHERE event_time >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY user_id, date(event_time);

-- 每天刷新一次
REFRESH MATERIALIZED VIEW user_daily_stats;

-- 分析查询
SELECT * FROM user_daily_stats WHERE user_id = 123;
```

##### 5.3 预计算JOIN结果

**场景**：用户订单统计

```sql
-- 创建物化视图
CREATE MATERIALIZED VIEW user_order_stats AS
SELECT
    u.user_id,
    u.name,
    count(o.order_id) as order_count,
    sum(o.total_amount) as total_amount,
    avg(o.total_amount) as avg_amount
FROM users u
LEFT JOIN orders o ON u.user_id = o.user_id
WHERE o.order_status = 'paid'
GROUP BY u.user_id, u.name;

-- 每天刷新一次
REFRESH MATERIALIZED VIEW user_order_stats;

-- 查询
SELECT * FROM user_order_stats ORDER BY total_amount DESC LIMIT 10;
```

#### 六、物化视图的维护

##### 6.1 自动刷新

**方法1：使用pg_cron**
```sql
-- 启用扩展
CREATE EXTENSION pg_cron;

-- 每小时刷新一次
SELECT cron.schedule('refresh-daily-gmv', '0 * * * *', 'REFRESH MATERIALIZED VIEW daily_gmv');
```

**方法2：使用系统定时任务**
```bash
# crontab -e
# 每小时刷新一次
0 * * * * psql -d mydb -c "REFRESH MATERIALIZED VIEW daily_gmv"
```

##### 6.2 监控物化视图

**查看物化视图大小**：
```sql
SELECT
    matviewname,
    pg_size_pretty(pg_total_relation_size('public.'||matviewname)) as size
FROM pg_matviews
WHERE matviewname = 'daily_gmv';
```

**查看物化视图的依赖**：
```sql
-- 查看哪些表依赖这个物化视图
SELECT * FROM pg_mv_dependency WHERE matviewid = 'daily_gmv'::regclass;
```

##### 6.3 刷新策略

**刷新频率选择**：
```yaml
实时数据：不使用物化视图
准实时（5分钟）：每5分钟刷新
小时级：每小时刷新
天级：每天刷新
周级：每周刷新
```

**刷新成本**：
```sql
-- 查看刷新时间
EXPLAIN ANALYZE REFRESH MATERIALIZED VIEW daily_gmv;

-- 根据刷新时间决定刷新频率
-- 刷新时间5秒：可以每小时刷新
-- 刷新时间30分钟：只能每天刷新
```

#### 七、物化视图 vs 其他方案

##### 7.1 物化视图 vs 普通视图

| 维度 | 物化视图 | 普通视图 |
|------|---------|---------|
| 存储 | 存储查询结果 | 只存储查询逻辑 |
| 查询速度 | 快（直接读取） | 慢（重新计算） |
| 实时性 | 延迟（需刷新） | 实时 |
| 存储成本 | 高 | 低 |
| 适用场景 | 报表、看板 | 复杂查询封装 |

##### 7.2 物化视图 vs 缓存

| 维度 | 物化视图 | Redis缓存 |
|------|---------|----------|
| 存储 | PostgreSQL | Redis |
| 数据结构 | 表 | KV |
| 查询 | SQL | GET |
| 一致性 | 强（ACID） | 弱（最终一致） |
| 适用场景 | 复杂聚合 | 简单KV查询 |

**建议**：
- 复杂聚合：物化视图
- 简单KV：Redis缓存
- 可以结合使用

##### 7.3 物化视图 vs 定时任务

| 维度 | 物化视图 | 定时任务 |
|------|---------|---------|
| 实现 | SQL | 应用代码 |
| 存储 | PostgreSQL | 应用或数据库 |
| 查询 | SQL | 读取预计算结果 |
| 维护 | SQL刷新 | 任务调度 |
| 适用场景 | 纯SQL场景 | 需要复杂处理的场景 |

#### 八、常见误区

**误区一：物化视图总是比直接查询快**

- **说明**：物化视图预计算了结果，查询快，但数据有延迟
- **后果**：在需要实时数据的场景使用物化视图
- **正确理解**：
  - 报表、看板：物化视图
  - 实时查询：直接查询
  - 根据实时性要求选择

**误区二：物化视图不需要维护**

- **说明**：物化视图需要定期刷新，否则数据过时
- **后果**：数据过时，误导决策
- **正确理解**：
  - 根据业务需求设定刷新频率
  - 监控刷新是否成功
  - 定期review物化视图

**误区三：物化视图可以实时更新**

- **说明**：PostgreSQL的物化视图不支持实时更新（需要手动刷新）
- **后果**：以为物化视图是实时的，数据过时
- **正确理解**：
  - 物化视图有延迟
  - 需要定期刷新
  - 或者使用其他方案（如触发器、应用层计算）

**误区四：所有查询都应该用物化视图**

- **说明**：物化视图占用存储空间，只适合重复执行的查询
- **后果**：创建太多物化视图，存储浪费
- **正确理解**：
  - 重复执行的查询：物化视图
  - 偶尔执行的查询：直接查询
  - 计算成本高的查询：物化视图

**误区五：物化视图不需要索引**

- **说明**：物化视图也是表，可以创建索引
- **后果**：查询物化视图还是很慢
- **正确理解**：
  - 为物化视图创建索引
  - 特别是WHERE条件中的字段
  - 加速对物化视图的查询

#### 九、实战任务

**任务1：创建物化视图**

创建每日GMV物化视图：

```sql
-- 1. 创建物化视图
CREATE MATERIALIZED VIEW daily_gmv AS
SELECT
    date(created_at) as order_date,
    sum(total_amount) as gmv,
    count(*) as order_count,
    count(DISTINCT user_id) as unique_users
FROM orders
WHERE order_status = 'paid'
GROUP BY date(created_at);

-- 2. 创建索引
CREATE INDEX idx_daily_gmv_date ON daily_gmv(order_date);

-- 3. 查询
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';

-- 4. 验证性能
EXPLAIN ANALYZE SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
```

**任务2：刷新物化视图**

模拟数据变化后的刷新：

```sql
-- 1. 插入新数据
INSERT INTO orders (user_id, order_status, total_amount, created_at)
VALUES (999, 'paid', 100.00, '2026-04-01 10:00:00');

-- 2. 查询物化视图（数据未更新）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- order_count没有变化

-- 3. 刷新物化视图
REFRESH MATERIALIZED VIEW daily_gmv;

-- 4. 再次查询（数据已更新）
SELECT * FROM daily_gmv WHERE order_date = '2026-04-01';
-- order_count已经更新
```

**任务3：自动刷新**

设置自动刷新：

```sql
-- 1. 启用pg_cron
CREATE EXTENSION pg_cron;

-- 2. 创建定时任务（每小时刷新一次）
SELECT cron.schedule(
    'refresh-daily-gmv',
    '0 * * * *',
    'REFRESH MATERIALIZED VIEW daily_gmv'
);

-- 3. 查看定时任务
SELECT * FROM cron.job WHERE jobname = 'refresh-daily-gmv';

-- 4. 手动触发刷新（测试）
REFRESH MATERIALIZED VIEW daily_gmv;
```

#### 十、小结

物化视图通过预计算和存储查询结果，大幅提升查询性能。

核心要点：
- 物化视图存储查询结果，查询时直接读取
- 用空间换时间，适合重复执行的查询
- 需要定期刷新，数据有延迟
- 可以为物化视图创建索引
- 适合场景：报表、看板、数据聚合
- 刷新策略：根据业务需求设定频率
- 与普通视图、缓存、定时任务各有优劣

下一节将进入并行查询：利用多核CPU加速大表查询。

### 3.9 并行查询：利用多核CPU加速大表查询

前面学习了多种优化手段：
- 分区表：通过物理边界优化查询
- 索引：加速数据查找
- 物化视图：预计算查询结果

但这些优化都是在单线程、单核CPU上执行的。

**问题**：现代服务器通常有多核CPU（8核、16核、32核），如何利用多核加速查询？

**示例**：
```sql
-- 单线程扫描1亿行数据
SELECT count(*) FROM orders;

-- 执行时间：30秒（单核）
-- 如果能利用8核，理论上可以降到4秒（30/8）
```

**PostgreSQL的并行查询**：
```sql
-- 设置并行度
SET max_parallel_workers_per_gather = 4;

-- 再次查询
SELECT count(*) FROM orders;

-- 执行时间：8秒（4核并行）
-- 性能提升：3.75倍
```

**这就是并行查询的价值**：通过利用多核CPU，加速大表扫描和聚合计算。

#### 一、为什么需要并行查询

**第一，单核CPU性能有限**

**单核瓶颈**：
```sql
-- 单核扫描1亿行
SELECT count(*) FROM orders;

-- 执行时间：30秒
-- CPU使用率：100%（单核）
-- 其他7核空闲
```

**潜力**：
```yaml
8核CPU：
  - 单核：30秒
  - 8核理论：4秒（30/8）
  - 8核实际：8秒（考虑并行开销）

32核CPU：
  - 单核：30秒
  - 32核理论：1秒（30/32）
  - 32核实际：3秒（考虑并行开销）
```

**第二，大表扫描天然适合并行**

**示例**：
```sql
-- 扫描1亿行，计算GMV
SELECT sum(total_amount) FROM orders;
```

**单线程执行**：
1. 扫描第1行-第1000万行
2. 扫描第1000万行-第2000万行
3. 扫描第2000万行-第3000万行
4. 扫描第3000万行-第1亿行
总时间：30秒

**4核并行执行**：
- Worker1：扫描第1行-第2500万行
- Worker2：扫描第2500万行-第5000万行
- Worker3：扫描第5000万行-第7500万行
- Worker4：扫描第7500万行-第1亿行
总时间：8秒

**说明**：
- 每个Worker扫描一部分数据
- Leader进程汇总结果
- 总时间 = 单个Worker的时间

**第三，聚合计算适合并行**

**示例**：
```sql
-- 计算每天的GMV
SELECT date(created_at), sum(total_amount) FROM orders GROUP BY date(created_at);
```

**单线程执行**：
1. 扫描所有数据
2. 按date(created_at)分组
3. 计算SUM
总时间：40秒

**4核并行执行**：
- Worker1：扫描第1季度数据，按date分组，计算SUM
- Worker2：扫描第2季度数据，按date分组，计算SUM
- Worker3：扫描第3季度数据，按date分组，计算SUM
- Worker4：扫描第4季度数据，按date分组，计算SUM
- Leader：汇总4个Worker的结果
总时间：12秒

**结论**：
> 并行查询通过利用多核CPU，加速大表扫描和聚合计算，是大表优化的重要手段。

#### 二、核心判断：并行查询是"多核协同"，不是"所有查询都适合"

> 并行查询的核心判断是：通过多个Worker进程并行处理数据，利用多核CPU加速查询，但只适合数据量大、计算成本高的查询，小查询反而可能更慢。

这个判断说明：
- **适用场景**：大表扫描、复杂聚合
- **不适用场景**：小表、简单查询
- **核心参数**：max_parallel_workers_per_gather
- **权衡**：并行开销 vs 并行收益

#### 三、并行查询的基础

##### 3.1 启用并行查询

**配置参数**：
```sql
-- 1. 设置最大并行Worker数（每个查询）
SET max_parallel_workers_per_gather = 4;

-- 2. 设置全局并行Worker数
SET max_parallel_workers = 8;

-- 3. 设置并行阈值（表大小超过此值才考虑并行）
SET min_parallel_table_scan_size = '8MB';

-- 4. 启用并行计划
SET parallel_setup_cost = 100;
SET parallel_tuple_cost = 0.1;
```

**配置文件（postgresql.conf）**：
```ini
# 并行查询配置
max_parallel_workers_per_gather = 4
max_parallel_workers = 8
min_parallel_table_scan_size = 8MB
parallel_setup_cost = 100
parallel_tuple_cost = 0.1
```

##### 3.2 查看并行度

**当前配置**：
```sql
-- 查看当前并行度
SHOW max_parallel_workers_per_gather;

-- 查看全局配置
SHOW max_parallel_workers;
```

##### 3.3 强制使用并行

**强制并行**：
```sql
-- 设置并行度为2
SET max_parallel_workers_per_gather = 2;

-- 或者强制并行计划
SET parallel_setup_cost = 0;
SET parallel_tuple_cost = 0;
```

#### 四、并行查询的执行计划

##### 4.1 并行Seq Scan

**单线程**：
```sql
EXPLAIN SELECT count(*) FROM orders;

-- 执行计划：
Aggregate  (cost=12345.67..12345.89 rows=1 width=8)
  ->  Seq Scan on orders  (cost=0.00..12345.67 rows=1000000 width=0)

-- 单个Seq Scan
```

**并行**：
```sql
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT count(*) FROM orders;

-- 执行计划：
Aggregate  (cost=1234.56..1234.78 rows=1 width=8)
  ->  Gather  (cost=1234.00..1234.56 rows=1 width=8)
        Workers Planned: 4
        ->  Partial Aggregate  (cost=234.00..234.56 rows=1 width=8)
              ->  Parallel Seq Scan on orders  (cost=0.00..12345.67 rows=250000 width=0)

-- 4个Worker并行扫描
```

**说明**：
- **Gather**：收集并行Worker的结果
- **Workers Planned**：计划使用4个Worker
- **Parallel Seq Scan**：并行顺序扫描
- **Partial Aggregate**：部分聚合（每个Worker先聚合自己的数据）

##### 4.2 并行JOIN

**示例**：
```sql
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT u.name, count(o.order_id)
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id, u.name;

-- 执行计划：
Finalize Aggregate  (cost=1234.56..1234.78 rows=100 width=200)
  ->  Gather  (cost=1234.00..1234.56 rows=100 width=200)
        Workers Planned: 4
        ->  Partial HashAggregate  (cost=234.00..234.56 rows=100 width=200)
              Group Key: u.user_id, u.name
              ->  Hash Join  (cost=100.00..200.00 rows=1000 width=150)
                    Hash Cond: (o.user_id = u.user_id)
                    ->  Parallel Seq Scan on orders o
                    ->  Hash
                          ->  Parallel Seq Scan on users u
```

**说明**：
- 两个表都并行扫描
- 4个Worker各自执行Hash Join
- Leader汇总结果

#### 五、并行查询的适用场景

##### 5.1 适合并行的场景

**场景1：大表扫描**
```sql
-- 表大小：1亿行（10GB）
SELECT count(*) FROM orders;
```

**单线程**：30秒
**4核并行**：8秒

**场景2：复杂聚合**
```sql
-- 表大小：1亿行
SELECT
    date(created_at),
    sum(total_amount),
    count(*),
    count(DISTINCT user_id),
    avg(total_amount)
FROM orders
GROUP BY date(created_at);
```

**单线程**：60秒
**4核并行**：18秒

**场景3：大表JOIN**
```sql
-- 两个大表：1亿行 vs 1000万行
SELECT u.name, sum(o.total_amount)
FROM users u
JOIN orders o ON u.user_id = o.user_id
GROUP BY u.user_id;
```

**单线程**：120秒
**4核并行**：40秒

##### 5.2 不适合并行的场景

**场景1：小表**
```sql
-- 表大小：1万行（<1MB）
SELECT count(*) FROM small_table;
```

**单线程**：0.01秒
**4核并行**：0.05秒（并行开销>并行收益）

**场景2：快速查询**
```sql
-- 通过索引快速定位
SELECT * FROM orders WHERE user_id = 123;
```

**单线程**：0.1秒
**4核并行**：0.15秒（不需要并行）

**场景3：瓶颈不在CPU**
```sql
-- 瓶颈在I/O或网络
SELECT * FROM large_table WHERE column = 'value';
```

**并行查询**：无法加速I/O或网络瓶颈

#### 六、并行查询的优化

##### 6.1 调整并行度

**原则**：
```yaml
CPU核数少（2-4核）：并行度2
CPU核数多（8-16核）：并行度4
CPU核数很多（32+核）：并行度8
```

**方法**：
```sql
-- 设置并行度
SET max_parallel_workers_per_gather = 4;

-- 或者按会话设置
ALTER SYSTEM SET max_parallel_workers_per_gather = 4;
SELECT pg_reload_conf();
```

##### 6.2 调整并行成本

**并行成本估算**：
```sql
-- 查看当前配置
SHOW parallel_setup_cost;    -- 默认1000
SHOW parallel_tuple_cost;     -- 默认0.1

-- 调整（让优化器更倾向于使用并行）
SET parallel_setup_cost = 100;
SET parallel_tuple_cost = 0.01;
```

**说明**：
- **parallel_setup_cost**：启动并行进程的成本
- **parallel_tuple_cost**：并行处理每行的成本
- 调低这些值，优化器更倾向于使用并行

##### 6.3 分区表 + 并行查询

**示例**：
```sql
-- 分区表 + 并行查询
SET max_parallel_workers_per_gather = 4;

EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-01-01';

-- 执行计划：
Gather  (cost=100.00..200.00 rows=1000 width=200)
  Workers Planned: 4
  ->  Append  (cost=0.00..100.00 rows=250 width=200)
        ->  Parallel Seq Scan on orders_202601
        ->  Parallel Seq Scan on orders_202602
        ...
```

**说明**：
- 每个Worker扫描不同的分区
- 并行度 = Worker数 × 分区数

#### 七、并行查询的限制

##### 7.1 限制条件

**不适合并行的查询**：
```sql
-- 1. 包含限制的SQL
-- CTE（WITH query）
-- 2. 某些类型的JOIN
-- 3. 写入操作（INSERT/UPDATE/DELETE）
-- 4. 某些类型的函数
```

**示例**：
```sql
-- CTE（不支持并行）
WITH cte AS (
    SELECT * FROM orders
)
SELECT count(*) FROM cte;

-- 执行计划：单线程
```

**解决方法**：
```sql
-- 改写为子查询（可能支持并行）
SELECT count(*) FROM (SELECT * FROM orders) t;
```

##### 7.2 并行开销

**并行开销**：
```yaml
进程启动：
  - 启动Worker进程
  - 分配数据
  - 汇总结果

通信开销：
  - Worker间通信
  - 数据传输
```

**权衡**：
```yaml
小查询：
  - 并行开销 > 并行收益
  - 不适合并行

大查询：
  - 并行收益 > 并行开销
  - 适合并行
```

##### 7.3 资源竞争

**问题**：
```yaml
太多并行查询：
  - 竞争CPU资源
  - 竞争内存资源
  - 系统负载高
```

**配置限制**：
```sql
-- 限制全局并行Worker数
SET max_parallel_workers = 8;

-- 限制每个查询的并行Worker数
SET max_parallel_workers_per_gather = 4;
```

#### 八、常见误区

**误区一：并行度越高越好**

- **说明**：并行度不是越高越好，有并行开销
- **后果**：并行度过高，性能反而下降
- **正确理解**：
  - 根据CPU核数设置并行度
  - 通常2-8个Worker足够
  - 测试不同并行度的性能

**误区二：所有查询都应该并行**

- **说明**：并行查询只适合大表、复杂查询
- **后果**：小查询也并行，性能下降
- **正确理解**：
  - 大表查询：并行
  - 小表查询：单线程
  - 根据表大小和查询复杂度决定

**误区三：并行查询总是比单线程快**

- **说明**：并行有开销，小查询可能更慢
- **后果**：以为并行总是快的，不验证
- **正确理解**：
  - 大查询：并行快
  - 小查询：单线程快
  - 用EXPLAIN ANALYZE验证

**误区四：并行查询不需要配置**

- **说明**：并行查询需要配置参数
- **后果**：默认配置可能不启用并行
- **正确理解**：
  - 配置max_parallel_workers_per_gather
  - 配置max_parallel_workers
  - 配置min_parallel_table_scan_size

**误区五：并行查询和分区表冲突**

- **说明**：并行查询和分区表可以配合使用
- **后果**：以为只能选一个
- **正确理解**：
  - 分区表 + 并行查询：最佳组合
  - 每个Worker扫描不同分区
  - 性能提升最明显

#### 九、实战任务

**任务1：测试并行查询性能**

测试不同并行度的性能：

```sql
-- 1. 单线程查询
SET max_parallel_workers_per_gather = 0;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 2. 2核并行
SET max_parallel_workers_per_gather = 2;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 3. 4核并行
SET max_parallel_workers_per_gather = 4;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 4. 8核并行
SET max_parallel_workers_per_gather = 8;
EXPLAIN ANALYZE SELECT count(*) FROM orders;

-- 5. 对比性能
-- 单线程：30秒
-- 2核：18秒
-- 4核：10秒
-- 8核：8秒
```

**任务2：优化并行度**

找到最优并行度：

```sql
-- 测试不同并行度
SELECT parallel度, 执行时间
FROM (
    SELECT
        CASE
            WHEN max_parallel_workers_per_gather = 0 THEN '单线程'
            WHEN max_parallel_workers_per_gather = 2 THEN '2核'
            WHEN max_parallel_workers_per_gather = 4 THEN '4核'
            WHEN max_parallel_workers_per_gather = 8 THEN '8核'
        END as 并行度,
       (EXPLAIN ANALYZE SELECT count(*) FROM orders)).* as 执行时间
) t
-- 对比结果，选择最优并行度
```

**任务3：分区表 + 并行查询**

测试分区表的并行查询：

```sql
-- 1. 单线程查询分区表
SET max_parallel_workers_per_gather = 0;
EXPLAIN ANALYZE SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';

-- 2. 4核并行查询分区表
SET max_parallel_workers_per_gather = 4;
EXPLAIN ANALYZE SELECT count(*) FROM orders WHERE created_at >= '2026-01-01';

-- 3. 对比性能
-- 单线程：30秒
-- 4核并行：6秒
-- 性能提升：5倍
```

#### 十、小结

并行查询通过利用多核CPU，加速大表扫描和聚合计算。

核心要点：
- 并行查询适合大表、复杂聚合、大表JOIN
- 不适合小表、简单查询、I/O瓶颈
- 核心参数：max_parallel_workers_per_gather
- 并行有开销，需要权衡
- 分区表 + 并行查询：最佳组合
- 根据CPU核数设置并行度
- 用EXPLAIN ANALYZE验证性能

下一节将进入批量操作与数据链路接入：如何高效地导入导出大量数据。

### 3.10 批量操作与数据链路接入：高效导入导出大量数据

前面学习了多种大表优化手段：
- 分区表、索引、查询优化、物化视图、并行查询

这些都是针对"已经存储在数据库中的数据"的优化。

但还有一个重要的问题：**如何高效地将大量数据导入导出？**

**场景**：
```yaml
数据导入：
  - 从外部系统导入1亿行数据
  - 每天导入1000万行新数据
  - 如何快速导入？

数据导出：
  - 导出1亿行数据到文件
  - 导出最近一个月的数据到分析系统
  - 如何快速导出？
```

**如果使用普通的INSERT和SELECT**：
```sql
-- 导入：逐行插入（慢）
INSERT INTO orders VALUES (...);
INSERT INTO orders VALUES (...);
...（重复1亿次）

-- 导出：逐行查询（慢）
SELECT * FROM orders WHERE created_at >= '2026-04-01';
...（逐行返回1亿行）
```

**问题**：
- 导入1亿行：可能需要几天
- 导出1亿行：可能需要几小时
- 性能太差

**解决方案**：**批量操作**

- **COPY**：PostgreSQL的批量导入导出命令
- **批量INSERT**：一次插入多行
- **\copy**：psql的批量导入导出命令

性能差异：
- 逐行INSERT：1亿行需要几天
- COPY：1亿行只需30分钟

这就是批量操作的价值。

#### 一、为什么需要批量操作

**第一，逐行操作成本高**

**INSERT一行**：
```sql
INSERT INTO orders (order_id, user_id, total_amount, created_at)
VALUES (1, 123, 100.00, '2026-04-01 10:00:00');
```

**成本分解**：
1. 解析SQL语句
2. 检查约束
3. 更新索引
4. 写入WAL日志
5. 刷新到磁盘

**单行时间**：约0.1ms

**1亿行时间**：0.1ms × 1亿 = 10,000秒 ≈ 2.8小时

**实际时间**：可能更长（网络、锁、其他开销）

**第二，批量操作大幅减少开销**

**COPY 1亿行**：
```sql
COPY orders FROM '/data/orders.csv';
```

**成本分解**：
1. 读取文件（批量）
2. 批量解析
3. 批量写入
4. 批量更新索引
5. 批量写WAL日志

**1亿行时间**：约30分钟

**性能差异**：5.6倍！

**第三，数据链路需要批量接入**

**场景**：从外部系统导入数据

**数据源**：
```yaml
文件系统：
  - CSV文件
  - JSON文件
  - 日志文件

其他数据库：
  - MySQL
  - MongoDB
  - Oracle

数据仓库：
  - Hive
  - MaxCompute
  - ClickHouse
```

**问题**：
- 如何批量导入？
- 如何保证数据一致性？
- 如何处理错误？

**结论**：
> 批量操作通过减少网络往返、减少SQL解析开销、减少锁竞争，大幅提升数据导入导出的性能。

#### 二、核心判断：批量操作的关键是"减少往返次数"

> 批量操作的核心判断是：通过一次操作处理大量数据，减少网络往返、减少SQL解析开销、减少锁竞争，从而大幅提升数据导入导出的性能。

这个判断说明：
- **批量**：一次处理多行
- **减少往返**：减少客户端和数据库的交互
- **减少开销**：SQL解析、约束检查、索引更新
- **性能提升**：从几天降到几十分钟

#### 三、COPY命令

##### 3.1 COPY基础

**作用**：在文件和表之间批量复制数据

**语法**：
```sql
-- 从文件导入到表
COPY table_name FROM '/path/to/file.csv';

-- 从表导出到文件
COPY table_name TO '/path/to/file.csv';

-- 从STDIN导入
COPY table_name FROM STDIN;
```

**示例**：
```sql
-- 导入CSV文件
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ',',
    QUOTE '"'
);

-- 导出为CSV文件
COPY orders TO '/data/orders_backup.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ',',
    QUOTE '"'
);
```

##### 3.2 COPY的格式选项

**CSV格式**：
```sql
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,           -- CSV格式
    HEADER,               -- 文件包含标题行
    DELIMITER ',',        -- 分隔符
    QUOTE '"',            -- 引号符
    ESCAPE '\',           -- 转义符
    NULL ''               -- NULL表示（空字符串）
);
```

**文本格式**：
```sql
COPY orders FROM '/data/orders.txt' WITH (
    FORMAT TEXT,           -- 文本格式
    DELIMITER '\t',       -- TAB分隔
    NULL 'NULL'            -- NULL表示为'NULL'
);
```

**二进制格式**：
```sql
COPY orders FROM '/data/orders.dat' WITH (BINARY);
```

##### 3.3 COPY的列选择

**选择特定列**：
```sql
COPY orders(order_id, user_id, total_amount)
FROM '/data/orders_partial.csv' WITH (FORMAT CSV);
```

**调整列顺序**：
```sql
COPY orders(order_id, user_id, total_amount, created_at)
FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    DELIMITER ','
);
```

#### 四、批量INSERT

##### 4.1 多值INSERT

**语法**：
```sql
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1, 123, 100.00, '2026-04-01 10:00:00'),
    (2, 124, 200.00, '2026-04-01 11:00:00'),
    (3, 125, 300.00, '2026-04-01 12:00:00');
```

**优势**：
- 一次插入多行
- 减少SQL解析开销
- 减少网络往返

**性能**：
- 单行INSERT：1万行需要30秒
- 多值INSERT：1万行只需要5秒

##### 4.2 批量INSERT脚本

**脚本**：
```sql
-- 每次插入1000行
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1, 123, 100.00, '2026-04-01 10:00:00'),
    (2, 124, 200.00, '2026-04-01 11:00:00'),
    ...
    (1000, 1234, 1000.00, '2026-04-01 20:00:00');

-- 再插入1000行
INSERT INTO orders (order_id, user_id, total_amount, created_at) VALUES
    (1001, 1235, 100.00, '2026-04-01 21:00:00'),
    ...
```

**优化**：
```sql
-- 开始事务
BEGIN;

-- 批量插入（减少提交次数）
INSERT INTO orders VALUES (...);
INSERT INTO orders VALUES (...);
...（重复1万次）

-- 提交事务
COMMIT;
```

#### 五、\copy命令

##### 5.1 \copy基础

**作用**：psql的批量导入导出命令（客户端）

**语法**：
```sql
-- 导入
\copy table_name FROM '/path/to/file.csv'

-- 导出
\copy table_name TO '/path/to/file.csv'

-- 查询结果导出
\copy (SELECT * FROM orders WHERE created_at >= '2026-04-01') TO '/data/orders_recent.csv'
```

**示例**：
```sql
-- 导入CSV文件
\copy orders FROM '/data/orders.csv' WITH CSV HEADER

-- 导出为CSV文件
\copy orders TO '/data/orders_backup.csv' WITH CSV HEADER

-- 导出查询结果
\copy (SELECT * FROM orders WHERE user_id = 123) TO '/data/user_orders.csv' WITH CSV HEADER
```

##### 5.2 \copy vs COPY

| 维度 | COPY | \copy |
|------|-----|-------|
| 执行位置 | 服务器端 | 客户端 |
| 文件路径 | 服务器路径 | 客户端路径 |
| 权限 | 需要superuser | 普通用户 |
| 网络 | 不经过客户端 | 经过客户端 |

**使用场景**：
```yaml
COPY：
  - 服务器文件导入导出
  - DBA操作
  - 大批量数据

\copy：
  - 客户端文件导入导出
  - 普通用户操作
  - 中小批量数据
```

#### 六、批量操作的性能优化

##### 6.1 禁用索引和约束

**导入前禁用**：
```sql
-- 1. 禁用触发器
ALTER TABLE orders DISABLE TRIGGER ALL;

-- 2. 删除索引（可选）
DROP INDEX idx_orders_user_id;

-- 3. 导入数据
COPY orders FROM '/data/orders.csv';

-- 4. 重建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);

-- 5. 启用触发器
ALTER TABLE orders ENABLE TRIGGER ALL;
```

**优势**：
- 导入速度提升5-10倍
- 索引不需要逐行更新

**注意**：
- 确保数据质量（没有错误数据）
- 准备时间较长

##### 6.2 调整WAL日志

**导入时禁用WAL**（PostgreSQL 12+）：
```sql
-- 开始事务
BEGIN;

-- 设置WAL级别
SET LOCAL wal_level = 'minimal';

-- 导入数据
COPY orders FROM '/data/orders.csv';

-- 提交事务
COMMIT;
```

**优势**：
- 减少WAL日志写入
- 提升导入速度

**风险**：
- 如果导入失败，可能无法恢复
- 只在可控环境下使用

##### 6.3 调整maintenance_work_mem

**增加维护工作内存**：
```sql
-- 设置为1GB
SET maintenance_work_mem = '1GB';

-- 创建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
```

**优势**：
- 创建索引时使用更多内存
- 索引创建速度提升2-3倍

#### 七、数据链路接入

##### 7.1 从MySQL导入数据

**方法1：使用COPY + 文件**

```bash
# 1. 从MySQL导出为CSV
mysql -u root -p -e "SELECT * FROM orders" db > orders.csv

# 2. 导入到PostgreSQL
psql -d postgres -c "\copy orders FROM 'orders.csv' WITH CSV HEADER"
```

**方法2：使用pgloader**

```bash
# 安装pgloader
pip install pgloader

# 从MySQL导入
pgloader mysql://user:pass@mysql_host/dbname postgresql://user:pass@pg_host/dbname
```

##### 7.2 从Hive导入数据

**方法1：使用COPY + 文件**

```bash
# 1. 从Hive导出为CSV
hive -e "SELECT * FROM orders" > orders.csv

# 2. 导入到PostgreSQL
psql -d postgres -c "\copy orders FROM 'orders.csv' WITH CSV HEADER"
```

**方法2：使用外部表**

```sql
-- 创建外部表（指向Hive HDFS）
CREATE FOREIGN TABLE hive_orders ()
SERVER hive_server
OPTIONS (dbname 'hive_db', table_name 'orders');

-- 导入到PostgreSQL表
INSERT INTO orders SELECT * FROM hive_orders;
```

##### 7.3 从Kafka导入数据

**方法1：使用kafka connector**

```yaml
# 使用Debezium Kafka Connector
# 自动同步MySQL数据到PostgreSQL
```

**方法2：使用自定义程序**

```python
# Python示例
from kafka import KafkaConsumer
import psycopg2

# 连接Kafka
consumer = KafkaConsumer('orders-topic')

# 连接PostgreSQL
conn = psycopg2.connect("dbname=postgres user=postgres")
cur = conn.cursor()

# 批量插入
batch = []
for message in consumer:
    batch.append(message.value)
    if len(batch) >= 1000:
        cur.executemany("INSERT INTO orders VALUES (%s, %s, %s)", batch)
        conn.commit()
        batch = []
```

#### 八、批量操作的常见问题

##### 8.1 编码问题

**问题**：导入时中文乱码

**解决**：
```bash
# 确保文件编码是UTF-8
file -I orders.csv

# 指定编码
\copy orders FROM 'orders.csv' WITH CSV HEADER ENCODING 'UTF8'
```

##### 8.2 数据类型不匹配

**问题**：数据类型错误

**示例**：
```sql
-- CSV文件：total_amount是字符串"100.00"
-- 表定义：total_amount是NUMERIC(10, 2)

-- 导入错误：ERROR: invalid input syntax for type numeric
```

**解决**：
```sql
-- 方法1：预处理CSV文件（转换数据类型）

-- 方法2：创建临时表，导入后再转换
CREATE TEMP TABLE orders_temp (
    total_amount TEXT  -- 先用TEXT接收
);

COPY orders_temp FROM '/data/orders.csv';

-- 再转换到正式表
INSERT INTO orders
SELECT
    order_id,
    user_id,
    total_amount::NUMERIC(10, 2),
    created_at
FROM orders_temp;
```

##### 8.3 错误处理

**问题**：部分行导入失败

**解决**：
```sql
-- 方法1：使用ON ERROR
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    ON_ERROR 'ignore'  -- 忽略错误行
);

-- 方法2：指定日志文件
COPY orders FROM '/data/orders.csv' WITH (
    FORMAT CSV,
    LOG ERRORS INTO orders_error_log
);

-- 查看错误日志
SELECT * FROM orders_error_log;
```

#### 九、常见误区

**误区一：批量操作总是比逐行操作快**

- **说明**：批量操作通常更快，但小批量可能不如逐行操作
- **后果**：所有场景都用批量操作
- **正确理解**：
  - 大批量：COPY（快）
  - 小批量：多值INSERT（较快）
  - 实时写入：单行INSERT（合适）

**误区二：COPY不需要优化**

- **说明**：COPY可以优化，禁用索引、调整内存能进一步提升性能
- **后果**：COPY还是很慢
- **正确理解**：
  - 禁用触发器和索引
  - 调整maintenance_work_mem
  - 调整WAL级别

**误区三：批量操作不需要事务**

- **说明**：批量操作应该使用事务，保证一致性
- **后果**：中途失败，数据不一致
- **正确理解**：
  - 用事务包裹批量操作
  - 成功提交，失败回滚
  - 保证数据一致性

**误区四：导入后不需要验证**

- **说明**：导入后需要验证数据完整性和正确性
- **后果**：数据错误不知道
- **正确理解**：
  - 验证行数
  - 验证数据质量
  - 对比源数据

**误区五：导出总是很快**

- **说明**：导出大量数据也可能很慢
- **后果**：导出任务耗时太长
- **正确理解**：
  - 大数据量导出：使用COPY
  - 分批导出
  - 压缩导出文件

#### 十、实战任务

**任务1：批量导入数据**

使用COPY批量导入1000万行数据：

```sql
-- 1. 创建测试数据文件（假设已准备好）
-- 数据文件：/data/orders_10m.csv（1000万行）

-- 2. 创建表
CREATE TABLE orders (
    order_id BIGINT,
    user_id BIGINT,
    order_status VARCHAR(50),
    total_amount NUMERIC(10, 2),
    created_at TIMESTAMP,
    paid_at TIMESTAMP
);

-- 3. 批量导入
COPY orders FROM '/data/orders_10m.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ','
);

-- 4. 验证导入
SELECT count(*) FROM orders;

-- 5. 查看导入时间
-- 记录开始时间和结束时间
```

**任务2：批量导出数据**

使用COPY批量导出最近1个月的数据：

```sql
-- 1. 导出为CSV文件
COPY (
    SELECT * FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
) TO '/data/orders_recent.csv' WITH (
    FORMAT CSV,
    HEADER,
    DELIMITER ','
);

-- 2. 查看导出的文件大小
-- $ ls -lh /data/orders_recent.csv

-- 3. 验证导出
-- 导入到测试表验证数据
CREATE TABLE orders_verify AS SELECT * FROM orders;
\copy orders_verify FROM '/data/orders_recent.csv' WITH CSV HEADER
SELECT count(*) FROM orders_verify;
```

**任务3：优化批量导入性能**

优化导入性能：

```sql
-- 1. 禁用触发器
ALTER TABLE orders DISABLE TRIGGER ALL;

-- 2. 准备数据（删除索引）
DROP INDEX IF EXISTS idx_orders_user_id;
DROP INDEX IF EXISTS idx_orders_status;

-- 3. 调整配置
SET maintenance_work_mem = '1GB';
SET wal_level = 'minimal';

-- 4. 导入数据
BEGIN;
COPY orders FROM '/data/orders_10m.csv' WITH (FORMAT CSV, HEADER);
COMMIT;

-- 5. 重建索引
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(order_status);

-- 6. 启用触发器
ALTER TABLE orders ENABLE TRIGGER ALL;

-- 7. 分析表
ANALYZE orders;
```

#### 十、小结

批量操作通过减少网络往返和解析开销，大幅提升数据导入导出性能。

核心要点：
- COPY：服务器端批量导入导出
- \copy：客户端批量导入导出
- 多值INSERT：一次插入多行
- 优化：禁用索引、调整WAL、调整内存
- 数据链路：从MySQL、Hive、Kafka等系统导入
- 错误处理：编码问题、类型转换、错误日志
- 验证：导入后验证数据完整性

**第3章（PostgreSQL大表能力）小结**：
1. ✅ 大表为什么慢：磁盘I/O瓶颈
2. ✅ PostgreSQL的能力边界：数据量、并发、场景边界
3. ✅ 分区表：物理边界优化查询
4. ✅ 表空间与存储策略：分层存储
5. ✅ 索引基础：B-tree加速查询
6. ✅ 索引进阶：BRIN、GIN、GiST特殊场景
7. ✅ 查询优化：执行计划分析与优化
8. ✅ 物化视图：预计算加速查询
9. ✅ 并行查询：多核CPU加速查询
10. ✅ 批量操作：高效导入导出数据

第3章现在是一个完整的PostgreSQL大表能力章节，可作为后续章节的参考标准！

## 系统位置

第 2 章解决的是“如何用 SQL 表达分析问题”。第 3 章解决的是“当这些 SQL 进入真实业务数据规模后，数据库如何执行，以及边界在哪里”。

PostgreSQL 大表能力处在 OLTP 到 OLAP 的过渡地带：

```text
业务库仍在 PostgreSQL 中
  -> 分析 SQL 开始变重
  -> 索引、分区、物化视图、执行计划还能缓解一部分问题
  -> 历史分析、跨主题建模、复杂报表和多团队复用继续增长
  -> 需要把交易负载和分析负载拆开
```

所以本章不是为了证明 PostgreSQL 不适合大数据，也不是为了把所有问题都推给分布式系统。更准确的判断是：先把单机数据库内部机制用到合理边界，再识别什么时候应该进入 OLAP、数仓、湖仓或批处理系统。

## 场景案例

假设 `events` 表记录用户行为，每天新增 500 万行：

```text
events
├── event_id
├── user_id
├── event_name
├── product_id
└── event_time
```

一开始运营只查当天 DAU：

```sql
SELECT
    date(event_time) AS dt,
    COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_time >= current_date
GROUP BY date(event_time);
```

当表只有几十万行时，全表扫描也能接受。数据增长后，同一条 SQL 可能开始扫描大量历史数据。此时可以按顺序做三类判断：

1. **是否有时间过滤**：没有时间过滤的行为分析，会天然变成大范围扫描。
2. **是否有合适索引**：如果只是最近几天查询，`event_time` 上的 B-tree 或 BRIN 可能有帮助。
3. **是否适合分区**：如果事件表按月或按日增长，按 `event_time` 做 range partition 可以让查询裁剪无关分区。
4. **是否适合预计算**：如果每天都查 DAU、购买用户数、浏览商品数，可以把每日指标做成物化视图或汇总表。
5. **是否应该迁出业务库**：如果分析开始覆盖一年历史、多个维度、多个团队和高并发报表，就应该考虑 OLAP 数据库或数仓。

这个场景体现了本章的核心：优化不是盲目加索引，而是先判断访问模式，再选择合适机制，最后识别系统边界。

## 常见误区

**误区一：表大就一定要换分布式系统。**

表变大后首先要看访问模式、索引、分区、统计信息和执行计划。很多查询问题可以在 PostgreSQL 内部改善。但如果问题是长期历史分析、多主题建模、跨团队复用和高并发报表，单机优化就不是根本解法。

**误区二：索引越多越好。**

索引只服务特定访问路径。每增加一个索引，写入、更新、删除和存储都会变重。无差别加索引会让业务写入更慢，也会让优化器选择变复杂。

**误区三：分区一定能让查询更快。**

只有查询条件能命中分区键时，分区裁剪才有明显收益。如果按时间分区，却经常按 `user_id` 跨所有历史查询，分区并不能自动减少扫描。

**误区四：物化视图就是实时指标。**

物化视图保存的是刷新后的结果。它适合重复计算和允许延迟的报表，不适合强实时、强一致或每次都必须反映最新写入的场景。

**误区五：`EXPLAIN` 看到了索引就说明查询没问题。**

是否使用索引只是一个信号。还要看实际扫描行数、估算行数是否偏差、JOIN 策略、排序和聚合成本，以及 `EXPLAIN ANALYZE` 的真实耗时。

## 实战任务

本章实战任务是用同一个分析问题观察“SQL 逻辑”和“执行代价”的差异。

### 数据准备

使用 `site/public/examples/ecommerce-postgres.sql` 导入基础数据后，可以继续插入更多模拟事件数据。小数据集也能练习语法和执行计划阅读，大数据集能更明显看到索引和扫描差异。

### 操作步骤

1. 对 `events` 写一条最近 7 天 DAU 查询。
2. 使用 `EXPLAIN` 查看是否出现 `Seq Scan`、`Index Scan`、`Aggregate` 和 `Sort`。
3. 在 `event_time` 上创建索引，再次查看执行计划。
4. 写一条按用户查询最近行为的 SQL，判断现有 `event_time` 索引是否适合。
5. 建一个每日事件数的物化视图，对比直接从明细聚合和查询物化视图的差异。

示例：

```sql
EXPLAIN ANALYZE
SELECT
    date(event_time) AS dt,
    COUNT(DISTINCT user_id) AS dau
FROM events
WHERE event_time >= current_date - interval '7 days'
GROUP BY date(event_time)
ORDER BY dt;
```

### 观察指标

- 扫描方式是 `Seq Scan` 还是 `Index Scan`。
- 估算行数和实际行数是否接近。
- 查询时间主要消耗在扫描、排序、连接还是聚合。
- 加索引后读取是否减少，写入和维护成本是否增加。
- 物化视图是否带来数据延迟。

### 对比实验

对比三种做法：

1. 明细表直接聚合。
2. 明细表加索引后聚合。
3. 查询每日汇总物化视图。

复盘它们分别解决什么问题：索引减少特定访问路径的读取，物化视图减少重复聚合，分区减少无关物理范围扫描，但都不能替代 OLAP 系统承担长期、多维、高并发分析。

## 小结引出下一章

完成本章后，读者应该能：

- 理解大表为什么慢。
- 选择基本分区策略。
- 使用物化视图做预聚合。
- 使用 `EXPLAIN` 分析查询。
- 判断 PostgreSQL 的分析边界。
- 理解为什么需要 OLAP 系统。

下一章进入 OLTP vs OLAP。

因为当业务查询和分析查询长期争抢同一套数据库资源时，系统就会出现第一条真正的分水岭。
