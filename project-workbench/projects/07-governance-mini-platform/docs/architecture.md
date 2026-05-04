# 项目 7 架构链路图

## 系统架构

```text
元数据目录
  |
  |-- governance.tables (表清单、负责人、描述)
  |-- governance.columns (字段清单、类型、含义)
  |
  v
指标字典
  |
  |-- governance.metrics (指标名称、口径、版本)
  |-- 口径冲突案例记录
  |-- 指标负责人和审批流程
  |
  v
血缘
  |
  |-- governance.lineage_edges (血缘边)
  |-- source_type / source_id -> target_type / target_id
  |-- relation_type: produces / consumes / derives
  |
  v
质量规则
  |
  |-- governance.quality_rules (规则定义)
  |-- NOT NULL、唯一性、范围检查、一致性
  |-- AI 评测来源命中规则 (source_hit)
  |
  v
权限策略
  |
  |-- governance.policies (策略定义)
  |-- SQL 查询权限
  |-- 向量检索权限
  |-- 图查询权限
  |-- 执行位置约束
  |
  v
AI 评测
  |
  |-- governance.ai_evaluations (评测记录)
  |-- 检索质量、回答准确性、来源覆盖
  |-- 漏检风险评估
```

## 治理规则进入的位置

### 开发阶段

- 新建表必须先在目录注册
- 新建指标必须先在字典定义口径
- 血缘关系在 ETL 脚本中声明

### 调度阶段

- 调度任务执行前检查血缘依赖
- 质量规则在数据写入后自动执行
- 质量不达标时阻断下游任务

### 查询阶段

- 查询前检查权限策略
- 向量检索前检查文档可见性
- 图查询前检查节点访问权限

### AI 应用阶段

- RAG 检索结果必须标注来源
- GraphRAG 上下文必须包含证据链
- AI 评测结果写入治理库

## 负责人和版本管理

- 每张表有 `owner` 字段
- 每个指标有 `owner` 和 `version` 字段
- 每条血缘边有 `created_at` 和 `updated_at`
- 质量规则和权限策略都有版本记录
