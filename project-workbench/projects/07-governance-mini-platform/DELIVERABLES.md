# 项目 7 交付物：数据治理 Mini Platform

## 架构产物

- [x] 画出元数据目录、指标字典、血缘、质量规则、权限策略和 AI 评测的关系：`docs/architecture.md`。
- [x] 标出治理规则进入开发、调度、查询和 AI 应用的位置：`docs/architecture.md`。
- [x] 标出负责人和版本管理位置：`docs/architecture.md`。

## 数据模型产物

- [x] 表目录 schema：`schema/governance.sql`。
- [x] 字段目录 schema：`schema/governance.sql`。
- [x] 指标字典 schema：`schema/governance.sql` 和 `catalog/metric-dictionary.md`。
- [x] 血缘边 schema：`schema/governance.sql` 和 `lineage/lineage-sample.json`。
- [x] 质量规则和权限策略 schema：`schema/governance.sql`、`quality/rules.sql`、`policies/access-policies.md`。

## 核心任务产物

- [x] 记录表、字段和负责人：`schema/governance.sql`。
- [x] 记录指标口径和版本：`catalog/metric-dictionary.md`。
- [x] 表达任务依赖和血缘：`lineage/lineage-sample.json`。
- [x] 运行基础质量规则：`quality/rules.sql`。
- [x] 描述 SQL、向量、图的权限边界：`policies/access-policies.md`。

## 验证证据

- [x] 指标口径冲突案例：`catalog/metric-dictionary.md`。
- [x] 血缘追溯案例：`lineage/lineage-sample.json`。
- [x] 本地静态运行入口：`run.sh`。
- [x] 运行记录模板：`reports/run-record-template.md`。
- [x] 质量规则运行结果模板：`reports/quality-rule-result-template.md`。
- [x] 权限策略测试记录模板：`reports/policy-test-record-template.md`。

## 复盘记录

- 治理解决的信任问题：
- 治理没有解决的执行问题：
- AI 应用为什么必须纳入治理：
