# 目标覆盖映射

本文档把 `/goal` 的要求拆成可追踪产物，避免只用“写了很多内容”或“测试通过”替代完成判断。

## 目标拆解

| 目标要求 | 产物 | 自动验证 | 当前判断 |
| --- | --- | --- | --- |
| 由浅入深 | `manuscript/README.md`、`docs/course-outline.md`、第 0-17 章 | `verify-book-structure`、`verify-writing-contract` | 已形成路线，仍需出版编辑 |
| 以 PostgreSQL 建立基础直觉 | 第 0、1、2、3 章，SQL Lab，项目 1 | `verify-book-structure`、`verify-sql-examples`、`projects:verify` | 已覆盖；项目 1 提供本地 PostgreSQL 和 Docker Compose 运行路径，真实执行待补 |
| 扩展 SQL 分析能力 | 第 2 章、`site/public/examples/chapter-02-queries.sql` | `verify-sql-examples` | 已静态验证 |
| 解释 OLTP / OLAP 分化 | 第 4 章、项目 2 | `verify-writing-contract`、`projects:verify` | 已覆盖；项目 2 已有 ClickHouse 字段映射、MergeTree DDL、GMV 查询和对账模板，真实 ClickHouse 执行待补 |
| 覆盖大数据架构 | 第 5-9、12 章，项目 3-4 | `verify-writing-contract`、`projects:verify` | 已覆盖；项目 3 已有 CDC / Kafka / Flink / Sink 关键产物；项目 4 已有对象存储布局、Iceberg DDL、Trino 查询、Spark 转换和演化记录；真实引擎执行待补 |
| 覆盖 AI 数据基础设施 | 第 10、11、13 章，项目 5-7 | `verify-writing-contract`、`projects:verify` | 已覆盖；项目 5 已有 RAG 关键产物；项目 6 已有 GraphRAG 关键产物；项目 7 已有治理 schema、指标字典、血缘、质量规则、权限策略和审计模板；高风险事实已初核 |
| 每章八段结构 | 18 个正式章节 | `verify-book-structure` | 已验证 |
| 概念不是词典定义 | 写作规范、章节正文、写作契约验证 | `verify-writing-contract` | 已做文本覆盖验证，仍需人工编辑审校 |
| 内容由浅入深且细节充分 | 18 个正式章节、正文深度校验 | `depth:verify` | 已建立最低深度门槛，仍需出版级事实核查和精修 |
| 术语一致性 | `site/glossary.md`、第 0-17 章 | `terms:verify` | 已验证核心术语覆盖，仍需全文编辑审校 |
| 基础编辑质量 | 正式章节 Markdown 和扩写残留 | `editorial:verify` | 已阻止已知自动扩写残留和明显表格损坏，仍需出版级精修 |
| 实战任务和项目闭环 | 每章“实战任务”、`project-workbench/`、`project-workbench/project-manifest.json` | `verify-book-structure`、`projects:verify` | 已有任务、清单和机器可读状态表，完整可运行项目待补 |
| 事实准确性 | `docs/fact-check-matrix.md`、`docs/fact-check-register.json`、`docs/fact-check-records/`、`docs/fact-check-evidence.md` | `facts:verify` | 18 个高风险条目均已完成官方来源或安全资料初核，仍需出版级复核 |
| 在线阅读 | `site/`、VitePress 构建产物 | `pnpm docs:build` | 已验证 |

## 命令覆盖

| 命令 | 覆盖内容 | 不覆盖内容 |
| --- | --- | --- |
| `pnpm verify` | 章节结构、写作契约文本信号、正文深度、核心术语覆盖、基础编辑质量残留、SQL 静态一致性、项目骨架、事实核查状态 | 不证明 SQL 在 PostgreSQL 中真实执行，不证明事实已出版级关闭 |
| `pnpm docs:build` | 站点生成和 VitePress 构建 | 不证明内容质量和事实准确 |
| `pnpm sql:run` | PostgreSQL 样例真实执行 | 当前环境缺少 `createdb` / `psql`，尚未跑通 |
| `pnpm projects:verify` | `project-manifest.json`、项目目录、README、交付清单、项目 1 运行入口、项目 2 ClickHouse 关键产物、项目 3 CDC / Kafka / Flink / Sink 关键产物、项目 4 湖仓关键产物、项目 5 RAG 关键产物、项目 6 GraphRAG 关键产物、项目 7 治理关键产物 | 不证明七个项目端到端可运行 |
| `pnpm facts:verify` | 事实矩阵、结构化 register、逐条处理记录和证据台账入口完整，且没有无证据完成声明 | 不证明每条事实已出版级关闭 |
| `pnpm audit:verify` | 完成审计和目标覆盖映射保留未完成边界，避免误报完成 | 不证明目标已经完成 |

## 当前完成边界

可以说：

- 全书 18 章已经形成从 PostgreSQL 到 AI 数据基础设施的系统路线。
- 每章固定八段结构已自动验证。
- 每章已具备“问题、边界、演化、平台位置、验证任务”的文本覆盖。
- 第 2 章 SQL 样例已做静态一致性检查。
- 第 14 章项目实战已有七个项目目录、交付清单、机器可读状态表和验证入口。
- 18 个高风险事实核查项已经完成官方来源或安全资料初核。
- 在线阅读站点可以构建。

不能说：

- PostgreSQL 样例已在当前环境真实执行通过。
- 事实核查已全部完成并达到出版最终关闭。
- 七个项目已经是完整可运行工程。
- 全书已经达到出版最终定稿。
