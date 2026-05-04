# 项目 6 交付物：知识图谱与 GraphRAG

## 架构产物

- [x] 画出结构化数据或文档、实体抽取、关系抽取、图数据库、GraphRAG 的链路：`docs/architecture.md`。
- [x] 标出实体、关系、路径和证据来源：`docs/architecture.md`。
- [x] 标出图查询如何进入 RAG 上下文：`docs/architecture.md`。

## 数据模型产物

- [x] 实体类型清单：`ontology/entity-relation-types.md`。
- [x] 关系类型清单：`ontology/entity-relation-types.md`。
- [x] 三元组样例：`data/triples-sample.jsonl`。
- [x] 图谱版本和来源字段：`data/triples-sample.jsonl`。

## 核心任务产物

- [x] 实体抽取样例：`data/triples-sample.jsonl`。
- [x] 关系抽取样例：`data/triples-sample.jsonl`。
- [x] 一跳、两跳、多跳查询：`queries/neo4j-paths.cypher` 和 `queries/nebulagraph-paths.ngql`。
- [x] GraphRAG 上下文拼接样例：`graphrag/context-template.md`。

## 验证证据

- [x] 路径查询结果模板：`reports/path-query-result-template.md`。
- [x] 原始证据追溯记录：`data/triples-sample.jsonl` 和 `reports/graph-query-log-template.md`。
- [x] 图谱版本记录：`data/triples-sample.jsonl`。
- [x] 图与向量联合检索案例：`graphrag/context-template.md`。
- [x] 本地静态运行入口：`run.sh`。
- [x] 运行记录模板：`reports/run-record-template.md`。
- [x] GraphRAG 证据拼接检查项：`docs/graphrag-evidence-checklist.md`。

## 复盘记录

- SQL 更适合的问题：
- 向量更适合的问题：
- 图关系必须参与的问题：
