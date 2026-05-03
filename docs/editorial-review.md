# 技术编辑审核记录

## 审核对象

- `manuscript/`：全书 Markdown 初稿。
- `site/`：VitePress 在线阅读版本。

## 当前结论

当前版本已经达到“可在线阅读初版”：

- 0-17 章都有正文。
- VitePress 站点已生成。
- 首页、路线图、术语表、项目页已建立。
- 每章都有导读和至少一张 Mermaid 语义图。
- 章节侧边栏、上一章/下一章导航、搜索入口已可用。

当前版本尚未达到“出版最终定稿”：

- 第 0-17 章已经显式补齐八段结构，但仍需要出版级事实核查和全文编辑。
- 部分产品定位和技术判断还需要补官方来源或降级为作者判断。
- SQL 示例还没有统一做可运行验证。
- 配图以 Mermaid 机制图为主，还没有生成章节级视觉插图。
- 术语表是基础版，还需要和全文术语做双向校验。

## 主要编辑问题

### 1. 章节体例不完全统一

第 1 章最完整，后续章节总体结构成立，但部分章节的“问题切入、场景案例、常见误区、实战任务”力度不一致。

修订方向：

- 每章开头固定补“上一章解决了什么，本章接住什么问题”。
- 每章中部至少保留一个贯穿案例。
- 每章结尾固定回到系统演化路径。

### 2. 后半部分内容密度偏纲要化

向量、图、湖仓、治理章节覆盖面完整，但仍有“概念解释多、落地案例少”的问题。

修订方向：

- 向量章节增加 RAG 数据表设计和检索日志案例。
- 图章节增加实体、关系、路径查询的完整示例。
- 湖仓章节增加 Iceberg 表从写入到查询的链路案例。
- 治理章节增加指标冲突和权限泄露风险案例。

### 3. 事实核查还不充分

涉及系统能力边界时，部分判断应补官方文档或明确为经验性判断。

重点核查：

- PostgreSQL 分区、物化视图、逻辑复制、WAL。
- VitePress 站点能力。
- Kafka / Flink Exactly Once 表述。
- ClickHouse MergeTree、Doris 表模型、DuckDB Parquet 查询。
- Iceberg / Delta / Hudi 表格式能力。
- pgvector、Milvus、Qdrant、Neo4j、NebulaGraph 定位。

### 4. 配图还需要从“可理解”走向“可传播”

当前每章已有 Mermaid 语义图，适合在线阅读和维护。

后续可以增加：

- 章节封面型 SVG/AI 插图。
- 总路线长图。
- OLTP vs OLAP 对比视觉图。
- RAG 链路视觉图。
- 数据治理能力地图视觉图。

## 当前验收证据

历史验证记录显示曾完成过 `pnpm install`、`pnpm docs:build` 和本地预览抽查，但当前环境的可执行状态需要按本轮重新确认。

本轮验证记录：

- `node scripts/generate-site.mjs` 成功，已从 `manuscript/` 生成 18 个 `site/chapters/` 页面。
- `node scripts/verify-book-structure.mjs` 成功，已确认 0-17 章全部包含八段结构。
- `node scripts/verify-writing-contract.mjs` 成功，已确认 0-17 章都覆盖“解决什么、不解决什么、为什么出现、前后关系、真实平台落地、可验证任务”的写作契约信号。
- `node scripts/verify-manuscript-depth.mjs` 成功，已确认 0-17 章达到最低正文字符量、三级结构和表格化检查/对比内容门槛。
- `node scripts/verify-terminology.mjs` 成功，已确认核心术语在术语表中定义，并在对应章节中出现。
- `node scripts/verify-editorial-quality.mjs` 成功，已确认正式章节没有自动扩写标记、已知泛化残留句或孤立 `|` 表格残留。
- `node scripts/verify-sql-examples.mjs` 成功，已确认第 2 章 SQL 样例引用的表、字段和章节段落与样例 schema 一致。
- `node scripts/verify-project-workbench.mjs` 成功，已确认 `project-workbench/project-manifest.json` 记录七个项目的阶段、必需产物、运行状态和阻塞项，且第 14 章七个项目都有固定项目骨架、验收字段和 `DELIVERABLES.md` 交付清单；项目 1 已有独立运行入口、PostgreSQL 17 Docker Compose 和运行记录模板；项目 2 已有 ClickHouse 字段映射、MergeTree DDL、GMV 查询和对账模板；项目 3 已有 CDC 事件、Kafka Topic、Flink SQL、Sink DDL 和 Exactly Once 边界说明；项目 4 已有对象存储布局、Iceberg DDL、Trino 查询、Spark 转换和演化记录；项目 5 已有 pgvector schema、权限过滤检索、RAG 评测集、Chunk 策略和检索日志模板；项目 6 已有 ontology、三元组、Neo4j/NebulaGraph 查询、GraphRAG 上下文和图查询日志；项目 7 已有治理 schema、指标字典、血缘、质量规则、权限策略和审计模板。
- `pnpm facts:generate-records` 成功，已从结构化 register 生成 18 个逐条事实核查记录文件。
- `node scripts/verify-fact-check-matrix.mjs` 成功，已确认事实核查矩阵包含 18 条 FC 项，结构化 register 包含 18 个来源和章节映射，`docs/fact-check-records/` 包含 18 个逐条处理记录文件，证据台账包含 18 个对应入口，且没有无证据完成声明。
- `node scripts/verify-completion-audit.mjs` 成功，已确认完成审计和目标覆盖映射没有把真实运行、事实核查、完整可运行项目或出版定稿误标为完成。
- `pnpm docs:build` 成功，`site/.vitepress/dist/` 已生成。此前 Rollup 原生 darwin arm64 包被当前 macOS / Node 进程代码签名校验拦截，已通过项目内 `@rollup/wasm-node` 替换解决。
- `bash -n scripts/run-postgres-examples.sh` 成功，PostgreSQL 样例运行脚本语法有效；项目 1 运行入口实际探测时 `sql:verify` 成功，但当前环境缺少 PostgreSQL 客户端，因此尚未完成真实数据库执行；项目 1 已提供 PostgreSQL 17 Docker Compose 运行路径。
- 第 0-17 章已显式补齐“问题切入、核心判断、机制解释、系统位置、场景案例、常见误区、实战任务、小结引出下一章”八段结构。

## 下一轮建议

下一轮不要继续扩目录，而是按“出版级精修”逐章处理：

1. 先精修第 0-5 章，作为全书样章标准。
2. 为第 0-5 章补 5 张高质量 SVG/AI 视觉图。
3. 为 SQL 示例补真实 PostgreSQL 运行记录。
4. 再按同样标准推进第 6-13 章。
5. 最后统一术语、引用、图表编号和上线部署。
