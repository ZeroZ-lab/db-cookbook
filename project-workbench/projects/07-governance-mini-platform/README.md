# 项目 7：数据治理 Mini Platform

## 目标

把表、字段、指标、任务、血缘、质量、权限和 AI 评测统一到一个可解释的治理工作台。

## 系统位置

```text
Data Assets
  -> Metadata Catalog
  -> Lineage
  -> Quality Rules
  -> Permission Policies
  -> Metric Dictionary
  -> AI Retrieval Evaluation
```

## 数据模型

- `tables`：表目录、负责人和生命周期。
- `columns`：字段目录、类型、敏感级别。
- `metrics`：指标口径、版本和负责人。
- `lineage_edges`：任务、表、字段之间的依赖。
- `quality_rules`：质量规则和运行结果。
- `policies`：SQL、对象存储、向量和图的权限策略。
- 治理 schema 见 `schema/governance.sql`。
- 指标字典样例见 `catalog/metric-dictionary.md`。
- 血缘边样例见 `lineage/lineage-sample.json`。
- 质量规则样例见 `quality/rules.sql`。
- 权限策略见 `policies/access-policies.md`。
- 审计模板见 `reports/governance-audit-template.md`。

## 核心链路

- 建立表和字段目录。
- 记录指标版本。
- 表达任务依赖和血缘。
- 运行基础质量规则。
- 将权限策略扩展到 SQL、向量检索和图查询。

## 验收指标

- [ ] 有元数据 schema。
- [ ] 有指标字典样例。
- [ ] 有血缘边样例。
- [ ] 有质量规则样例。
- [ ] 有跨 SQL、向量、图的权限边界说明。

## 运行命令

```bash
pnpm projects:verify
```

如果本机有 PostgreSQL，可先执行 `schema/governance.sql`，再导入 `quality/rules.sql`。本项目当前先提供可检查产物，不声称本仓库环境已端到端运行。

## 质量检查

- 指标必须记录口径、版本、负责人和生效时间。
- 血缘必须能回答一个指标依赖哪些表和任务。
- 权限策略必须说明执行位置和漏检风险。
- AI 评测数据必须作为治理对象登记和审计。

## 复盘问题

- 治理平台解决的是工具问题还是信任问题？
- 治理规则如何进入开发、调度、查询和 AI 应用链路？
