import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const markerStart = '<!-- depth-expansion:start -->';
const markerEnd = '<!-- depth-expansion:end -->';

const chapters = [
  {
    file: 'manuscript/chapter-00-positioning.md',
    title: '全书定位',
    problem: '很多数据库学习路径把知识拆成孤立工具，导致读者会写 SQL、听过大数据组件，却无法解释系统为什么从业务库演化到数仓、湖仓、向量、图和治理。',
    input: '输入是读者已有的零散经验：查过表、写过 SQL、听过 PostgreSQL、Spark、Flink、ClickHouse、Milvus 或 Neo4j，但缺少把它们放进同一条数据系统演化链路的框架。',
    path: '处理路径是先用 PostgreSQL 建立数据组织和一致性直觉，再用 SQL 建立分析表达能力，随后沿着大表边界、OLTP / OLAP 分化、数仓建模、数据链路、批流计算、OLAP、湖仓、向量、图和治理逐步展开。',
    platform: '在真实平台里，这条路径对应一条端到端数据链路：业务库记录事实，分析系统重构事实，计算系统加工事实，检索和图系统扩展事实，治理系统保证事实可信。',
    boundary: '本书不是某个数据库的参数手册，也不是大数据工具百科。它不会追求覆盖所有产品细节，而是训练读者理解问题、机制、边界和迁移关系。',
    signals: ['只会背工具名但说不清上下游', '能写 SQL 但解释不了指标口径', '能跑 RAG Demo 但没有数据治理', '能画架构图但说不清每层责任'],
    practice: '在正式阅读前，画出自己理解的数据链路：业务库、SQL、数仓、同步、批处理、实时、OLAP、湖仓、向量、图、治理分别在哪里，哪些还说不清。'
  },
  {
    file: 'manuscript/chapter-02-sql-analysis.md',
    title: 'SQL 分析能力',
    problem: '业务问题不能直接进入数据库执行，必须先被转换成取数边界、业务粒度、过滤规则和指标口径。',
    input: '输入通常是业务表、事件表、维度表、口径说明和一个看似简单但边界不清的问题，例如 GMV、留存、复购、转化率或活跃用户。',
    path: '处理路径是先确认一行数据代表什么，再确认统计对象、时间字段、状态过滤、去重方式和异常数据处理，最后把这些判断写成可复查的 SQL。',
    platform: '在真实平台里，这一层会沉淀成指标 SQL、数仓任务、BI 数据集、数据质量检查和临时分析查询。PostgreSQL 用它训练基本表达，Spark SQL、Trino、ClickHouse 和 Doris 用它承接更大规模的分析。',
    boundary: 'SQL 不会自动替你定义业务口径，也不会自动修复脏数据。SQL 写得再复杂，如果粒度错、JOIN 放大、时间字段错或口径不一致，结果仍然不可信。',
    signals: ['同一指标在两个报表里不一致', 'JOIN 后行数突然变多', 'COUNT(*) 和 COUNT(DISTINCT user_id) 被混用', 'WHERE 条件没有说明状态、时间和测试数据边界'],
    practice: '拿订单、支付、用户、行为事件四类表，分别写出 GMV、支付成功率、新用户 7 日留存、复购率，并为每个指标写出口径说明和反例。'
  },
  {
    file: 'manuscript/chapter-03-postgresql-large-tables.md',
    title: 'PostgreSQL 大表能力',
    problem: '当数据持续增长，慢查询不再只是 SQL 写法问题，而是访问路径、物理组织、预计算和资源竞争共同作用的结果。',
    input: '输入是持续增长的订单表、事件表、日志表和分析查询，以及它们对应的过滤字段、排序字段、JOIN 字段和聚合字段。',
    path: '处理路径是先用执行计划确认瓶颈，再决定是否用索引缩短访问路径、用分区建立物理边界、用物化视图提前计算、用 COPY 做批量流转，或把分析压力迁出业务库。',
    platform: '在真实平台里，PostgreSQL 大表优化是 OLTP 和 OLAP 分化前的最后一层缓冲。它能延长业务库的可用阶段，也能训练读者理解后续 OLAP、数仓和湖仓为什么出现。',
    boundary: '索引、分区和物化视图都不是免费能力。索引增加写入成本，分区增加维护复杂度，物化视图引入刷新延迟。它们不能替代历史数据平台、统一建模和跨系统分析。',
    signals: ['EXPLAIN 中估算行数和实际行数差距很大', '报表查询影响在线接口延迟', '索引越来越多但查询仍不稳定', '删除历史数据和备份变成高风险操作'],
    practice: '用同一张订单大表分别测试无索引、单列索引、联合索引、时间分区和物化视图，记录扫描行数、执行时间、写入成本和维护复杂度。'
  },
  {
    file: 'manuscript/chapter-04-oltp-olap.md',
    title: 'OLTP / OLAP 分化',
    problem: '业务交易和历史分析都重要，但它们对延迟、一致性、读写模式、数据模型和资源使用的要求不同。',
    input: '输入是一套业务事实源，例如用户、订单、支付、库存、行为事件，以及来自运营、财务、增长和产品团队的分析需求。',
    path: '处理路径是把业务写入保留在 OLTP 系统，把历史扫描、宽表建模、多维聚合和指标生产迁移到 OLAP 或数仓系统，再通过 ETL 或 CDC 连接两边。',
    platform: '真实平台通常让 PostgreSQL 或 MySQL 承担强一致业务事实，让 ClickHouse、Doris、Hive、Spark、Trino 或湖仓承担分析事实。二者之间用调度、日志或变更流传递数据。',
    boundary: 'OLAP 分离不是把所有查询都迁走。订单详情、用户资料、支付状态仍属于业务库；跨月趋势、渠道拆解、用户分群和指标口径才更适合分析系统。',
    signals: ['运营查询拖慢下单接口', '业务库里出现大量宽表和报表临时表', '历史数据保留周期和业务库备份冲突', '多个团队直接连业务库取数'],
    practice: '把一个订单系统拆成 OLTP 查询清单和 OLAP 查询清单，说明每个查询为什么留在业务库或迁到分析库。'
  },
  {
    file: 'manuscript/chapter-05-data-warehouse-modeling.md',
    title: '数据仓库建模',
    problem: '业务库表结构服务写入正确性，不天然服务分析复用。分析系统需要把业务事实重构成可理解、可复用、可治理的模型。',
    input: '输入是业务源表、事件流、维度属性、指标定义、组织口径和历史变更规则。',
    path: '处理路径是从 ODS 保留原始数据开始，在 DWD 建立明细事实和维度，在 DWS 沉淀主题汇总，在 ADS 面向报表、运营和应用输出数据集。',
    platform: '在真实平台里，数仓建模连接业务库和分析消费层。它让 Spark、Hive、Trino、ClickHouse、Doris、BI 和 AI 应用读到同一套语义，而不是各自重新解释业务表。',
    boundary: '数仓建模不等于复制业务库，也不等于把所有表做成宽表。模型过细会难以使用，模型过宽会难以维护；没有指标治理的建模仍会产生口径漂移。',
    signals: ['报表都在重复 JOIN 源表', '每个团队维护自己的 GMV 口径', '维度属性变化导致历史结果不可解释', '明细表、汇总表和应用表边界混乱'],
    practice: '把订单、订单明细、商品、用户、支付表设计成事实表、维度表和每日指标汇总表，并写出粒度、主键、更新方式和质量检查。'
  },
  {
    file: 'manuscript/chapter-06-etl-elt.md',
    title: 'ETL / ELT',
    problem: '分析系统不能凭空得到数据。数据必须从业务系统被抽取、同步、转换、校验和装载。',
    input: '输入包括全量表、增量时间戳、数据库日志、文件、消息流、接口数据和调度上下文。',
    path: '处理路径是先决定全量还是增量，再决定批量抽取还是 CDC，接着处理 schema 变化、幂等写入、失败重跑、质量校验和血缘记录。',
    platform: '真实平台会使用 Airflow、Dagster、Flink CDC、Debezium、Kafka Connect、Spark、dbt 或自研任务，把 PostgreSQL 数据稳定送入数仓、OLAP 或湖仓。',
    boundary: 'ETL / ELT 解决数据流转，不自动解决业务语义。同步成功不代表指标正确；链路实时不代表结果可信；CDC 捕获变更也不代表消费端一定幂等。',
    signals: ['源表字段变化导致下游任务失败', '重跑后数据重复', '增量条件漏数', '源系统和数仓对账不一致'],
    practice: '为订单表设计全量初始化、每日增量、CDC 同步、失败重跑和对账 SQL，明确每一步的输入、输出和校验指标。'
  },
  {
    file: 'manuscript/chapter-07-batch-processing.md',
    title: '批处理系统',
    problem: '当历史数据超过单机数据库舒适区，分析计算需要分布式存储、任务调度和批量计算引擎。',
    input: '输入通常是分区文件、Hive 表、Parquet / ORC 数据、数仓分层表和需要周期性计算的指标任务。',
    path: '处理路径是把数据按分区组织，使用 Spark 或 Hive 扫描、过滤、JOIN、Shuffle、聚合，再把结果写回表或交给 Trino 做交互式查询。',
    platform: '真实平台中 Hive 提供表和元数据组织，Spark 负责重计算和复杂转换，Trino 负责跨源查询和交互分析，调度系统负责依赖、重试和 SLA。',
    boundary: '批处理适合历史计算和可延迟任务，不适合毫秒级接口和强实时监控。Shuffle、数据倾斜、小文件和资源队列会成为主要工程问题。',
    signals: ['单机数据库跑不动月级或年级历史任务', '任务需要跨大量分区和多张事实表', '计算可接受分钟到小时延迟', '失败后需要可重跑和可对账'],
    practice: '设计一个每日订单主题宽表批处理任务，说明输入分区、JOIN 策略、Shuffle 风险、输出表、重跑规则和质量校验。'
  },
  {
    file: 'manuscript/chapter-08-stream-processing.md',
    title: '实时数据处理',
    problem: '有些业务问题不是“昨天发生了什么”，而是“现在正在发生什么”，这要求持续处理事件流。',
    input: '输入是订单状态变更、支付事件、用户行为、库存变化、CDC 日志和 Kafka Topic。',
    path: '处理路径是从 Source 读取事件，用事件时间、水位线、窗口和状态管理进行计算，通过 checkpoint 保证恢复，再写入 OLAP、缓存、告警或实时看板。',
    platform: '真实平台中 Kafka 承接事件流，Flink 负责有状态计算，ClickHouse、Doris、Redis 或 Elasticsearch 承接实时结果，监控系统跟踪延迟和积压。',
    boundary: '实时系统降低延迟，但增加乱序、重复、状态膨胀、回放和一致性复杂度。不是所有报表都需要实时，能接受 T+1 的任务通常优先批处理。',
    signals: ['运营需要分钟级监控', '事件到达顺序和发生顺序不一致', 'Kafka Lag 持续升高', '窗口结果需要修正迟到数据'],
    practice: '为支付成功事件设计 5 分钟 GMV 实时统计，写清事件时间字段、窗口长度、水位线、迟到处理、状态 TTL 和输出表。'
  },
  {
    file: 'manuscript/chapter-09-olap-databases.md',
    title: 'OLAP 数据库',
    problem: '分析查询经常只读少数列、扫描大量行、做高并发聚合，传统行存业务库不是为这种负载优化的。',
    input: '输入是事实表、宽表、聚合表、实时明细流和 BI 查询请求。',
    path: '处理路径是通过列式存储、压缩、排序键、分区、稀疏索引、向量化执行、预聚合或 MPP 并行执行，加速扫描、过滤、GROUP BY 和排序。',
    platform: '真实平台中 ClickHouse 适合高性能列式分析，Doris 常用于实时数仓和 BI 服务，DuckDB 适合本地文件分析和嵌入式 OLAP。它们经常接在数仓、CDC 或湖仓之后。',
    boundary: 'OLAP 数据库不是业务交易库。它通常不适合高频小事务、复杂跨行更新、强一致写入链路，也不能替代指标建模和数据治理。',
    signals: ['BI 查询扫描大量历史数据', '查询只用少数列但业务库仍要读整行', '并发看板影响业务库', '宽表和聚合表需要低延迟查询'],
    practice: '把订单明细同步到一个列式模型，设计排序键、分区键、常用查询和预聚合表，并解释为什么这些设计服务 BI 查询。'
  },
  {
    file: 'manuscript/chapter-10-vector-databases.md',
    title: '向量数据库',
    problem: '结构化 SQL 擅长精确匹配和聚合，但文档、图片、代码和问答需要语义相似度检索。',
    input: '输入是原始文档、切分后的 Chunk、Embedding 模型版本、向量、元数据、权限字段和用户查询。',
    path: '处理路径是解析文档、切分 Chunk、生成 Embedding、写入向量索引，查询时生成 Query Embedding，做向量召回、过滤、重排和上下文拼装。',
    platform: '真实平台中 pgvector 适合和 PostgreSQL 元数据一起做中小规模检索，Milvus、Qdrant 等专门系统适合更大规模和更复杂索引策略，RAG 服务负责把召回结果交给模型。',
    boundary: '向量检索解决语义相似，不解决事实正确性、权限隔离、结构化统计、数据血缘和答案评测。RAG 质量还取决于解析、切分、元数据和重排。',
    signals: ['关键词搜不到同义表达', '召回结果语义相关但权限不正确', 'Chunk 太大导致上下文噪声', 'Embedding 模型升级后结果漂移'],
    practice: '为一组产品文档设计 RAG 数据表：document、chunk、embedding、metadata、permission、retrieval_log，并写出召回和评测流程。'
  },
  {
    file: 'manuscript/chapter-11-graph-databases.md',
    title: '图数据库',
    problem: '有些问题关注的不是单行记录或聚合指标，而是实体之间的多跳关系、路径、网络结构和影响传播。',
    input: '输入是实体、关系、关系类型、属性、来源、时间范围和置信度，例如用户、商品、账号、设备、文档实体和知识概念。',
    path: '处理路径是抽取节点和边，建立属性图或 RDF 模型，使用路径匹配、邻居扩展、社区发现或图算法回答多跳问题。',
    platform: '真实平台中 Neo4j、NebulaGraph 或图计算框架常与关系库、数仓和向量检索共存。GraphRAG 会把图上的实体关系和文档证据一起交给模型。',
    boundary: '图数据库不替代关系数据库和数仓。它适合关系网络和路径问题，不适合所有高频交易写入、常规指标聚合和宽表 BI。',
    signals: ['问题需要沿关系多跳追踪', 'JOIN 层数越来越深且语义难读', '需要解释实体之间为什么相关', '需要把文档中的实体关系用于推理'],
    practice: '从订单、用户、商品和文档实体中构建一个小型图谱，写出“用户购买过的商品所属类目影响了哪些相似用户”的路径查询。'
  },
  {
    file: 'manuscript/chapter-12-lakehouse.md',
    title: '数据湖与湖仓',
    problem: '数仓提供模型和治理，数据湖提供低成本开放存储。现代平台希望同时获得开放文件、多引擎访问和表级事务管理。',
    input: '输入是对象存储中的 Parquet / ORC 文件、表元数据、快照、分区、schema、提交日志和 Catalog。',
    path: '处理路径是把文件组织成表格式，通过 Iceberg、Delta 或 Hudi 管理快照、schema 演化、分区演化、增量读取和时间旅行，再让 Spark、Trino、Flink 等引擎访问。',
    platform: '真实平台中湖仓位于存储和计算之间，承接批处理、实时入湖、交互查询、机器学习和 AI 数据集构建，Catalog 负责让多引擎看到一致表定义。',
    boundary: '湖仓不是简单把文件丢进对象存储。没有表格式、Catalog、权限、质量和 compaction，数据湖会变成不可治理的数据沼泽。',
    signals: ['同一份数据要被多个引擎访问', '历史版本需要回溯', 'schema 经常演化', '文件数量过多导致查询变慢'],
    practice: '为订单明细设计一张 Iceberg 表，说明分区策略、schema 演化、快照回滚、增量读取和小文件治理方案。'
  },
  {
    file: 'manuscript/chapter-13-data-governance.md',
    title: '数据治理',
    problem: '数据平台能跑不等于可信。长期可用的数据系统需要质量、元数据、血缘、权限、指标和知识治理。',
    input: '输入是表结构、任务依赖、指标定义、数据质量规则、权限策略、文档 Chunk、向量版本、图谱版本和使用日志。',
    path: '处理路径是采集元数据，建立血缘，定义质量规则和告警，统一指标口径，管理权限和敏感字段，并把治理信息接入 BI、RAG 和平台运维。',
    platform: '真实平台中治理通常由 Data Catalog、Lineage、质量平台、指标平台、权限系统和审计系统组成。AI 场景还需要文档来源、向量版本、召回日志和答案评测。',
    boundary: '治理不是写几个字段说明，也不是最后补文档。没有治理，数仓会出现口径漂移，湖仓会失控，RAG 会无法解释来源和权限。',
    signals: ['表没人敢删也没人知道谁用', '指标同名不同义', '下游任务失败找不到上游变更', 'AI 答案无法追溯到来源'],
    practice: '为订单 GMV 指标建立治理卡片：定义、来源表、计算 SQL、负责人、刷新频率、质量规则、血缘、权限和变更记录。'
  },
  {
    file: 'manuscript/chapter-14-projects.md',
    title: '项目实战',
    problem: '学习数据系统不能只停留在概念理解，必须能把 PostgreSQL、数仓、批流、OLAP、湖仓、向量、图和治理组合成可运行闭环。',
    input: '输入是一套连续业务场景、样例数据、项目目标、验收指标和运行环境。',
    path: '处理路径是先构建 PostgreSQL 分析库，再同步到 OLAP，接入 CDC 和实时计算，扩展到湖仓、RAG、知识图谱和治理平台。',
    platform: '真实作品集应该展示目录结构、运行命令、数据流图、核心 SQL、质量检查、失败恢复和验收结果，而不是只展示工具截图。',
    boundary: '项目实战不是把每个工具都装一遍。每个项目都必须说明为什么需要这个组件、它替代不了什么、上下游如何验证。',
    signals: ['项目只能跑 Demo 但没有验收标准', '没有对账和质量检查', '没有说明组件边界', '无法从项目看出能力递进'],
    practice: '为 7 个项目逐一补 README、数据准备、运行命令、核心任务、验收 SQL 和复盘问题，形成可检查的学习路线。'
  },
  {
    file: 'manuscript/chapter-15-learning-order.md',
    title: '学习顺序',
    problem: '错误学习顺序会让人先背工具名，却不知道系统为什么演化、能力之间如何迁移。',
    input: '输入是学习者现有能力、目标岗位、项目经验、薄弱环节和正在面对的真实问题。',
    path: '处理路径是从 PostgreSQL 和 SQL 开始，进入大表和 OLTP / OLAP 分化，再学习数仓、链路、批流、OLAP、湖仓、向量、图和治理。',
    platform: '真实学习计划应该把每个阶段绑定到可运行任务、可复述判断和可交付项目，而不是绑定到课程清单。',
    boundary: '学习顺序不是绝对线性。工作中可以按问题跳转，但补能力时仍要回到基础路径，避免只会调用工具不会判断边界。',
    signals: ['学了 Spark 但不会解释数据建模', '会写 RAG Demo 但没有权限和来源治理', '会 SQL 题但不会指标口径', '项目里工具很多但链路不可解释'],
    practice: '根据自己的目标画一张 12 周学习路线，每周包含一个核心判断、一个实操任务和一个验收问题。'
  },
  {
    file: 'manuscript/chapter-16-capability-map.md',
    title: '能力地图',
    problem: '读完整本书后，需要把知识点转成能力结构，否则很容易仍然停留在工具记忆。',
    input: '输入是已完成的 SQL、建模、链路、OLAP、湖仓、AI 检索、图分析和治理练习。',
    path: '处理路径是把能力拆成查询表达、数据建模、链路工程、系统选型、治理可信和 AI 数据应用六类，再为每类定义可验证表现。',
    platform: '真实团队会用能力地图做培养、面试、项目分工和技术评审。它把“会不会某个工具”改成“能否解释问题、设计边界、验证结果”。',
    boundary: '能力地图不是证书目录。一个人可以不会所有工具，但必须能判断工具为什么出现、什么时候不该用、如何验证效果。',
    signals: ['简历堆满工具但项目说不清边界', '只会写任务不会做质量检查', '只会搭 RAG 不会治理数据来源', '系统选型只看流行度'],
    practice: '用能力地图给自己的项目打分：每类能力列出证据、缺口、下一步补强任务和验收方式。'
  },
  {
    file: 'manuscript/chapter-17-final-goals.md',
    title: '最终学习目标',
    problem: '学习终点不是知道更多数据库名字，而是能理解和构建可信、可计算、可检索、可治理的数据系统。',
    input: '输入是一个真实业务目标，例如经营分析、实时监控、RAG、GraphRAG、推荐、风控或数据治理。',
    path: '处理路径是把业务事实建模进 PostgreSQL，经由 SQL、数仓、ETL / CDC、批流、OLAP、湖仓、向量、图和治理，形成可解释的数据应用链路。',
    platform: '真实系统的最终形态不是单个数据库，而是一组有边界、有血缘、有质量检查、有权限、有评测的数据基础设施。',
    boundary: '最终目标不是做最大架构。小系统也需要清楚边界，大系统也要避免过度设计。能力成熟的标志是能解释取舍，而不是堆组件。',
    signals: ['能画出端到端链路并说明每层责任', '能为每个指标和召回结果追溯来源', '能判断实时、批处理、OLAP 和向量检索的边界', '能设计质量和权限检查'],
    practice: '完成毕业设计：为一个电商公司设计从 PostgreSQL 到 BI、RAG、GraphRAG 的数据系统，并给出架构图、表设计、链路、验收指标和风险清单。'
  }
];

function renderBlock(chapter) {
  const signalRows = chapter.signals.map((signal) => `| ${signal} | 回到本章机制，检查输入、处理路径、系统边界或治理规则。 |`).join('\n');
  return `${markerStart}

### 深度展开：${chapter.title}如何落到真实系统

本节补齐本章的工程细节。阅读时不要只记住概念名称，而要把它放回“输入是什么、处理路径是什么、输出给谁、边界在哪里、如何验证”的链路中。

#### 一、它从什么问题开始

${chapter.problem}

这个问题通常不会以技术名词出现，而是以业务现象出现：报表变慢、指标不一致、实时看板延迟、RAG 召回不稳定、数据无法追溯、项目 Demo 无法验收。能不能把现象还原成系统问题，是本书要训练的第一层能力。

#### 二、输入数据和前置判断

${chapter.input}

在动手之前，至少要确认四件事：

| 判断项 | 要回答的问题 |
| --- | --- |
| 数据粒度 | 一行代表什么事实，是用户、订单、订单明细、事件、文件、Chunk，还是一条关系？ |
| 时间边界 | 使用创建时间、更新时间、支付时间、事件时间，还是处理时间？ |
| 状态边界 | 哪些状态算有效，哪些测试、取消、退款、重复或迟到数据要排除？ |
| 责任边界 | 这个环节负责记录事实、生产指标、加速查询、治理质量，还是服务 AI 应用？ |

#### 三、处理路径

${chapter.path}

这条路径应该能被写成可执行流程，而不是停留在术语解释。一个合格的设计至少要说明：数据从哪里来、经过哪些转换、写到哪里、谁消费、失败后如何重跑、结果如何校验。

#### 四、在真实平台中的位置

${chapter.platform}

平台位置决定了它和前后系统的关系。不要孤立地问“这个技术好不好”，而要问：

- 它继承了上一层什么问题？
- 它把什么复杂度转移给了下一层？
- 它的输出是否能被复用、追溯和治理？
- 它是否改变了数据粒度、延迟、一致性或权限边界？

#### 五、边界和失败模式

${chapter.boundary}

常见失败信号可以这样检查：

| 失败信号 | 应该追问什么 |
| --- | --- |
${signalRows}

#### 六、可操作练习

${chapter.practice}

练习完成后不要只看“有没有跑通”，还要补一份复盘：

- 输入数据是否足以支撑问题？
- 口径和边界是否写清楚？
- 结果能否被重复计算和对账？
- 如果数据量扩大 10 倍，瓶颈会出现在哪里？
- 如果接入下游 BI、RAG 或治理系统，还缺哪些元数据？

${markerEnd}`;
}

for (const chapter of chapters) {
  const absolute = path.join(root, chapter.file);
  let content = fs.readFileSync(absolute, 'utf8');
  const block = renderBlock(chapter);

  if (content.includes(markerStart)) {
    content = content.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), block);
  } else {
    const target = '\n## 系统位置';
    if (!content.includes(target)) {
      throw new Error(`${chapter.file}: missing ## 系统位置`);
    }
    content = content.replace(target, `\n${block}\n${target}`);
  }

  fs.writeFileSync(absolute, content);
  console.log(`enriched ${chapter.file}`);
}
