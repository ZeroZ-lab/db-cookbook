# 项目实战总览

7 个项目按系统演化顺序推进。

```mermaid
flowchart TB
  P1["PostgreSQL 电商数据分析库"] --> P2["PostgreSQL -> ClickHouse 分析链路"]
  P2 --> P3["PostgreSQL CDC 实时数仓 Demo"]
  P3 --> P4["Mini Lakehouse"]
  P4 --> P5["RAG 向量知识库"]
  P5 --> P6["知识图谱与 GraphRAG"]
  P6 --> P7["数据治理 Mini Platform"]
```

详见 [第 14 章：大数据方向项目实战](/chapters/14-projects)。

## 当前边界

- 书稿已形成完整路线。
- 自动验证已通过。
- 项目实战大多仍是可检查骨架，不是端到端可运行工程。
- 事实核查为初核，不是出版最终关闭。

## 执行状态

| 项目 | 系统位置 | manifest 状态 | 阅读分级 | 校验分级 | 运行分级 | 记录分级 |
| --- | --- | --- | --- | --- | --- | --- |
| PostgreSQL 电商数据分析库 | PostgreSQL 基础与 SQL 分析 | `runtime-entry-present` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| PostgreSQL 到 ClickHouse 分析链路 | OLTP 到 OLAP 分化 | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| CDC 实时数仓 Demo | CDC 与实时计算 | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| Mini Lakehouse | Lakehouse 架构 | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| RAG 向量知识库 | AI 时代数据基础设施 | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| 知识图谱与 GraphRAG | 图数据库与 GraphRAG | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |
| 数据治理 Mini Platform | 治理、血缘、质量与信任 | `static-artifacts-verified` | 可直接读 | 可静态检查 | 需外部运行环境 | 尚无端到端运行记录 |

完整执行总表由 `node scripts/generate-project-runbook.mjs` 从 `project-workbench/project-manifest.json` 生成，维护在 `docs/project-runbook.md`。

`pnpm projects:verify` 只证明项目目录、交付清单、关键 SQL / JSON / 文档和 manifest 状态一致；不证明数据库、消息队列、计算引擎或 AI 检索链路已经真实运行。
