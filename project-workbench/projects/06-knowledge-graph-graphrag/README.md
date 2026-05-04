# 项目 6：知识图谱与 GraphRAG

## 目标

理解实体、关系、路径查询、图算法和 GraphRAG 如何补足纯向量检索对关系结构的表达不足。

## 系统位置

```text
PostgreSQL / Document
  -> Entity Extraction
  -> Relation Extraction
  -> Neo4j / NebulaGraph
  -> Path Query
  -> GraphRAG Context
```

## 数据模型

- `entities`：实体、类型、别名和来源。
- `relations`：关系类型、方向和置信度。
- `triples`：主语、谓语、宾语。
- `ontology`：实体类型和关系约束。
- `graph_queries`：路径查询和结果记录。
- 实体与关系类型见 `ontology/entity-relation-types.md`。
- 三元组样例见 `data/triples-sample.jsonl`。
- Neo4j 路径查询见 `queries/neo4j-paths.cypher`。
- NebulaGraph 路径查询见 `queries/nebulagraph-paths.ngql`。
- GraphRAG 上下文模板见 `graphrag/context-template.md`。
- 运行记录模板见 `reports/run-record-template.md`。

## 核心链路

- 定义实体类型和关系类型。
- 从结构化表或文档抽取实体关系。
- 写出一跳、两跳、多跳查询。
- 将图路径结果拼接进 RAG 上下文。
- 用 `run.sh` 做 ontology、三元组、路径查询、GraphRAG 模板和日志模板的本地静态检查。

## 验收指标

- [ ] 有实体和关系类型清单。
- [ ] 有三元组样例。
- [ ] 有路径查询样例。
- [ ] 有图与向量结合策略。
- [ ] 有图谱版本和查询日志。
- [x] 有本地静态检查入口和运行记录模板。

## 运行命令

```bash
project-workbench/projects/06-knowledge-graph-graphrag/run.sh
pnpm projects:verify
```

如果本机有 Neo4j 或 NebulaGraph，可将 `data/triples-sample.jsonl` 转成对应导入语句，再执行 `queries/` 下的路径查询。本项目当前先提供可检查产物，不声称本仓库环境已端到端运行。

## 质量检查

- 关系必须写明方向、来源和置信度。
- GraphRAG 上下文必须能追溯到图路径和原始证据。
- 图路径进入 RAG 上下文前必须经过权限过滤和来源校验。

## 复盘问题

- 哪些问题用 SQL 更合适？
- 哪些问题用向量更合适？
- 哪些问题必须依赖图关系？
