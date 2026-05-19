### 1.2 PostgreSQL 核心结构：数据系统是如何被组织起来的

很多人第一次接触数据库时，会自然地把它理解成“一堆表”。

这个理解有一定道理，但不够准确。

如果数据库只是几张表，那么它和 Excel 的区别并不明显。真正让数据库成为系统的，不只是它能存储表格，而是它有一套清晰的组织结构：数据放在哪里、如何命名、如何隔离、如何访问、如何被约束，以及不同数据之间如何建立关系。

PostgreSQL 的核心结构，正是在回答这个问题。

> 数据库学习的第一步，不是学会写 `SELECT`，而是理解数据进入系统之后，被安放在哪些层级里。

这一节要解决的，就是 PostgreSQL 最基础、但也最重要的结构感。

### 一、为什么数据库不能只是“一堆表”？

假设我们正在做一个电商系统。

系统里有用户、商品、订单、支付、浏览行为、优惠券、库存、物流等数据。表面上看，我们只要建很多表就可以了：

```text
users
products
orders
payments
events
inventory
coupons
shipments
```

但问题很快会出现。

这些表属于哪个业务系统？哪些表是交易系统的？哪些表是运营分析用的？测试环境和生产环境的数据如何隔离？不同团队能不能使用同一个表名？用户表和订单表之间的关系如何保持清晰？一张表里的字段，哪些是业务字段，哪些是系统字段？当数据越来越多，如何管理命名、权限、查询和维护？

如果没有层级结构，数据库很快就会变成一个混乱的数据仓库：表名冲突、字段含义不清、权限边界模糊、业务关系难以追踪。

所以，数据库不能只是“一堆表”。

它必须先有组织结构。

PostgreSQL 的结构可以简单理解为：

```text
PostgreSQL Server
  ↓
Database
  ↓
Schema
  ↓
Table
  ↓
Row / Column
```

这不是为了增加复杂度，而是为了让数据在系统中拥有明确的位置。

一个成熟的数据系统，首先要解决的不是“能不能查”，而是“数据在哪里”。

### 二、核心判断：数据库结构，本质上是在给数据安排位置

PostgreSQL 的结构，可以类比成一座城市。

PostgreSQL Server 像整座城市的运行系统。

Database 像城市中的不同园区。

Schema 像园区里的不同街区。

Table 像街区里的不同建筑。

Row 像建筑里的一条记录。

Column 像记录中的具体属性。

当然，类比只是帮助理解。回到数据系统本身，PostgreSQL 的层级结构真正解决的是五类问题。

第一，隔离问题。

不同业务、不同环境、不同应用的数据，不应该随便混在一起。Database 和 Schema 提供了隔离边界。

第二，命名问题。

真实系统中，很多业务都会有 `users`、`orders`、`logs` 这样的表名。如果没有命名空间，不同团队、不同模块之间很容易冲突。

第三，组织问题。

数据不是越多越好，而是要按照业务关系、访问方式和管理边界组织起来。

第四，权限问题。

谁能访问哪些数据？谁能修改哪些表？谁只能读取部分 Schema？这些都依赖清晰的结构边界。

第五，演化问题。

业务会变化，表会增加，字段会调整，数据规模会扩大。没有结构，系统越发展越混乱；有结构，系统才有演化空间。

所以，PostgreSQL 的核心结构不是一组死概念，而是一套数据管理秩序。

### 三、PostgreSQL Server：数据库系统的运行入口

最外层是 PostgreSQL Server。

它可以理解为一个正在运行的 PostgreSQL 数据库服务实例。

当你启动 PostgreSQL 时，本质上是启动了一个数据库服务。这个服务负责接收客户端连接、处理 SQL 请求、管理数据库文件、维护事务、执行查询、控制权限、写入日志，并保证数据在系统中的一致性。

你平时通过命令行、图形化工具、后端程序连接 PostgreSQL，连接的并不是某一张表，而是这个正在运行的数据库服务。

比如一个后端服务连接数据库时，通常需要这些信息：

```text
host
port
database
user
password
```

其中 `host` 和 `port` 指向的是 PostgreSQL Server；`database` 指向这个服务里的某个 Database；`user` 和 `password` 决定你以什么身份进入这个数据世界。

PostgreSQL Server 解决的是运行入口问题：

> 谁在提供数据库服务，客户端连接到哪里，SQL 请求由谁接收和执行。

它不直接表达业务对象。用户、订单、商品这些对象不会直接放在 Server 层。Server 是运行环境，不是业务建模单位。

这也是它不解决的问题：Server 不负责告诉你业务表应该怎么设计，也不负责定义指标口径。它提供数据库系统运行所需的外层基础。

### 四、Database：一个相对独立的数据世界

在 PostgreSQL Server 里面，可以有多个 Database。

Database 可以理解为一个相对独立的数据世界。

例如：

```text
shop_prod
shop_test
analytics_dev
metadata
```

这些 Database 可以运行在同一个 PostgreSQL Server 中，但它们之间有明确边界。一般情况下，你连接到一个 Database 之后，主要操作的就是这个 Database 内部的对象。

Database 解决的是大边界问题。

它适合隔离不同应用、不同环境或不同用途的数据。

例如：

- `shop_prod` 保存生产环境电商业务数据。
- `shop_test` 保存测试环境数据。
- `analytics_dev` 保存分析开发数据。
- `metadata` 保存平台元数据。

但 Database 不是万能隔离层。

如果只是同一个业务系统里的不同模块，比如用户、商品、订单、支付，不一定要拆成多个 Database。过度拆分会增加连接、权限、迁移和查询管理成本。

在大数据系统里，Database 这个概念会继续演化成更大的组织边界，例如数据域、项目空间、工作空间或 Catalog。它回答的仍然是同一个问题：

> 这一组数据属于哪个相对独立的世界？

### 五、Schema：数据库内部的命名空间

进入一个 Database 后，下一层是 Schema。

Schema 是 Database 内部的命名空间。

它最容易被误解。很多初学者会把 Schema 理解成“表结构”，比如字段名和字段类型。但在 PostgreSQL 中，Schema 更接近“命名空间”。

一个 Database 里可以有多个 Schema：

```text
shop
├── user_center
├── catalog
├── sales
├── payment
└── tracking
```

然后不同 Schema 下可以有自己的表：

```text
user_center.users
catalog.products
sales.orders
sales.order_items
payment.payments
tracking.events
```

这样做的价值是非常直接的。

第一，它让表名更清楚。

`sales.orders` 明确表示这是销售域的订单表，而不是某个临时分析表或测试表。

第二，它降低命名冲突。

不同 Schema 中可以出现同名对象。比如 `raw.events` 和 `tracking.events` 可以表达不同阶段、不同来源或不同用途的数据。

第三，它帮助权限管理。

你可以让某个用户只访问 `sales` Schema，让另一个用户只访问 `analytics` Schema。

第四，它为后面的数仓分层建立直觉。

在数仓里，我们会经常看到 ODS、DWD、DWS、ADS 这样的层次。它们和 PostgreSQL Schema 不完全等同，但都在解决数据组织、命名和边界问题。

Schema 解决的是命名空间和组织边界问题。

它不解决业务建模本身。把表放进不同 Schema，并不会自动让表结构正确，也不会自动让指标口径一致。

### 六、Table：业务对象、事件和关系的数据化表达

Table 是初学者最熟悉的一层。

但 Table 不能简单理解成“表格”。

在数据库系统里，Table 是业务对象、业务事件和业务关系的数据化表达。

例如：

```text
users         用户对象
products      商品对象
orders        下单事件 / 订单对象
order_items   订单与商品之间的关系明细
payments      支付事件
events        用户行为事件
```

这几个表看起来都是表，但含义不一样。

`users` 更像对象表，一行代表一个用户。

`products` 更像对象表，一行代表一个商品。

`orders` 既可以看成订单对象，也可以看成用户下单这个业务事件的结果。

`order_items` 是典型关系明细表，因为一笔订单可以包含多个商品，一个商品也可以出现在多笔订单中。

`payments` 更像事件表，因为它记录支付动作是否发生、何时发生、以什么方式发生、结果如何。

`events` 是行为日志表，一行通常代表一次浏览、点击、加购、搜索或曝光。

所以，建表时真正重要的问题不是“要有哪些字段”，而是：

> 这张表的一行代表什么？

如果一行代表一个用户，那么它就是用户粒度。

如果一行代表一笔订单，那么它就是订单粒度。

如果一行代表一件订单商品明细，那么它就是订单商品粒度。

如果一行代表一次点击，那么它就是事件粒度。

粒度一旦混乱，后面的 JOIN、聚合、指标计算都会混乱。

这也是为什么 PostgreSQL 表结构学习，会自然连接到后面的数仓事实表、维度表、宽表和指标口径。

### 七、Row 与 Column：记录事实与描述属性

Table 里面是 Row 和 Column。

Row 是一条记录，也是一条具体事实。

Column 是字段，用来描述这条事实的属性。

以 `orders` 表为例：

```text
orders
├── order_id
├── user_id
├── order_status
├── total_amount
├── created_at
└── paid_at
```

如果 `orders` 表一行代表一笔订单，那么每一行就是一条订单事实。

例如：

```text
order_id: 10001
user_id: 501
order_status: paid
total_amount: 299.00
created_at: 2026-04-01 10:30:00
paid_at: 2026-04-01 10:31:20
```

这条 Row 表达的是：

> 用户 501 在 2026 年 4 月 1 日创建并支付了一笔金额为 299 元的订单。

Column 则回答这条事实有哪些属性。

`order_id` 描述订单身份。

`user_id` 描述订单属于哪个用户。

`order_status` 描述订单状态。

`total_amount` 描述订单金额。

`created_at` 描述创建时间。

`paid_at` 描述支付时间。

Row 和 Column 看起来简单，但它们是后面所有数据分析的基础。

聚合分析本质上是在多条 Row 上计算统计结果。

JOIN 本质上是通过某些 Column 把不同 Table 的 Row 连接起来。

索引本质上是为某些 Column 建立更高效的访问路径。

数仓建模本质上是在重新定义不同 Table 的 Row 粒度和 Column 含义。

向量数据库和图数据库虽然数据模型不同，但仍然绕不开“一个数据单元代表什么、它有哪些属性、它和其他数据如何关联”这些问题。

### 八、从电商业务看数据如何进入表结构

现在把这些层级放到一个电商系统里。

我们可以设计一个 Database：

```text
shop
```

在这个 Database 中，按业务域划分 Schema：

```text
user_center
catalog
sales
payment
tracking
```

再在不同 Schema 下放表：

```text
user_center.users
catalog.products
sales.orders
sales.order_items
payment.payments
tracking.events
```

这时，业务对象就有了清晰的位置：

```text
用户        -> user_center.users
商品        -> catalog.products
订单        -> sales.orders
订单商品明细 -> sales.order_items
支付        -> payment.payments
用户行为     -> tracking.events
```

这套结构带来的好处不是“看起来更整齐”，而是让后续系统能力有了基础。

你可以为 `users` 定义主键。

你可以让 `orders.user_id` 指向 `users.user_id`。

你可以让 `order_items.order_id` 指向 `orders.order_id`。

你可以用索引加速按用户查订单。

你可以用分区管理按时间增长的 `events` 表。

你可以把 `orders`、`order_items`、`payments` 同步到数仓，重新建模为订单事实表和支付事实表。

也就是说，结构不是静态目录，而是后续约束、查询、事务、分析和同步链路的基础。

### 九、这些结构在大数据系统中的延伸

PostgreSQL 的结构不是只在 PostgreSQL 内部有意义。

它会自然延伸到后面的大数据系统。

| PostgreSQL 结构 | 解决的问题 | 大数据系统中的延伸 |
| --- | --- | --- |
| Database | 大边界、环境、应用空间 | 数据域、项目空间、Catalog |
| Schema | 命名空间、业务组织 | 主题域、数仓分层、命名规范 |
| Table | 数据对象、事件、关系 | 事实表、维度表、明细表、宽表 |
| Row | 一条事实记录 | 一条业务事件、一条日志、一条明细 |
| Column | 事实属性 | 字段、维度、指标、特征 |

比如数仓里的事实表，本质上仍然要回答：

> 一行代表什么事实？

维度表仍然要回答：

> 这些字段描述哪个业务对象？

指标体系仍然要回答：

> 哪些字段可以被计算成稳定指标？

湖仓里的表格式仍然要回答：

> 数据文件如何被组织成可查询、可演化、可管理的表？

向量数据库仍然要回答：

> 一个向量对应哪个文档、哪个 Chunk、哪个权限范围和哪个版本？

图数据库仍然要回答：

> 节点代表什么实体，边代表什么关系？

所以，PostgreSQL 的结构感，是后面所有数据系统学习的底层语言。

### 十、常见误区

**误区一：把 Database 理解成一个文件。**

Database 不是一个简单文件，而是 PostgreSQL Server 内部的相对独立数据世界。它包含 Schema、Table、权限、函数等数据库对象。

**误区二：把 Schema 理解成字段结构。**

在 PostgreSQL 中，Schema 主要是命名空间，不是“这张表有哪些字段”的意思。表字段结构应该看 Table Definition，而不是把它和 Schema 混为一谈。

**误区三：把 Table 当成 Excel 表。**

Table 不只是行列集合。它表达业务对象、事件或关系，并且要配合主键、外键、约束、索引和事务工作。

**误区四：只关心字段，不关心一行代表什么。**

字段设计之前，必须先明确表的粒度。一行代表一个用户、一笔订单、一次支付，还是一次点击？如果粒度不清，后面所有分析都会不稳定。

**误区五：只会建表，不会建模。**

建表是写出结构，建模是解释结构。真正的数据系统需要知道每张表为什么存在、和其他表有什么关系、服务什么业务问题、未来如何演化。

### 十一、实战任务

为一个电商系统设计 PostgreSQL 的基础组织结构。

要求：

1. 创建一个 Database 名称设计，例如 `shop`。
2. 规划至少 5 个 Schema：用户、商品、销售、支付、行为。
3. 为每个 Schema 设计 1 到 2 张表。
4. 写清楚每张表的一行代表什么。
5. 标出至少 3 组表之间的关系。

参考输出：

```text
Database: shop

Schema: user_center
  Table: users
  Row grain: one row per user

Schema: catalog
  Table: products
  Row grain: one row per product

Schema: sales
  Table: orders
  Row grain: one row per order

  Table: order_items
  Row grain: one row per product item in an order

Schema: payment
  Table: payments
  Row grain: one row per payment attempt

Schema: tracking
  Table: events
  Row grain: one row per user behavior event
```

复盘时回答：

- 哪些表是对象表？
- 哪些表是事件表？
- 哪些表是关系明细表？
- 哪些字段适合成为主键？
- 哪些字段会成为后续 JOIN 的关联键？
- 哪些表未来可能同步到数仓或 OLAP 数据库？

### 十二、小结

这一节解决的是数据库学习的空间问题。

PostgreSQL Server 提供运行入口。

Database 提供相对独立的数据世界。

Schema 提供数据库内部的命名空间。

Table 表达业务对象、事件和关系。

Row 记录一条事实。

Column 描述事实的属性。

理解这些结构之后，数据库就不再是“一堆表”，而是一套有层级、有边界、有归属的数据组织系统。

下一节将进入这些结构内部最重要的控制机制：主键、外键、约束、事务、索引、视图、物化视图和分区。

这些机制会继续回答一个更关键的问题：

> 数据放进数据库之后，系统如何让它长期保持可靠、可查、可分析、可演化？

