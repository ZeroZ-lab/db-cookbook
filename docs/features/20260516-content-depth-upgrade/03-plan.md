# 内容深度升级执行计划 (final)

## 元信息

- feature: content-depth-upgrade
- artifact_type: content (curriculum_upgrade)
- created: 2026-05-16
- status: final
- plan_topology: 2-batch-gated-parallel
- batch_order: P1=Ch10-13 (AI最高差异化), P2=Ch2-9 (基础+工程核心)

## 假设

- A1: Ch 7/9 的 C 级 section 需全量重写（YAML模板→论证式），C级初次验证标准为 P1-P6 ≥ 4/6，二次验证达到 5/6
- A2: 每章升级需要 2-3 轮生成+审校
- A3: 自动验证脚本需要扩展到 section-complete 文件级别（或明确 Q1-Q6 为人工检查）
- A4: 主题追踪矩阵是活文档，每章升级后更新
- A5: Ch 11 section 极薄（~937 chars/section），升级接近从零编写，标注高风险

## 修正数据（基于 Eng Review F1）

实际 section-complete 文件数量（不是 spec 中的错误数据）：

| 章节 | Main file chars | Section files 数 | Section total chars | 状态 |
|------|----------------|-----------------|--------------------|------|
| Ch 2 | 11,223 | **10** (not 2) | 80,134 | 机制有量但质量需审校 |
| Ch 3 | 10,032 | 10 | 104,855 | 机制有量但质量需审校 |
| Ch 4 | 8,732 | 10 | 125,126 | 机制有量但质量不均 |
| Ch 5 | 6,836 | 12 | 67,212 | 机制有量但质量不均 |
| Ch 6 | 7,246 | 12 | 138,687 | 机制有量但质量不均 |
| Ch 7 | 7,115 | 12 | 176,360 | 机制有量但部分公式化 |
| Ch 8 | 7,680 | 12 | 72,667 | 机制有量但质量需审校 |
| Ch 9 | 7,731 | 12 | 133,300 | 机制有量但部分公式化 |
| Ch 10 | 8,868 | 12 | 31,539 | 机制量偏薄 |
| Ch 11 | 9,007 | 12 | **11,242** | ⚠️ 极薄，近从零编写 |
| Ch 12 | 7,782 | 11-12 | 11,842 | 机制量偏薄 |
| Ch 13 | 10,433 | 12 | 22,320 | 机制偏概念列举 |

## 文件结构映射

### 会修改的文件

| 文件 | 范围 | 修改内容 |
|------|------|----------|
| `manuscript/chapter-XX-section-Y-complete.md` | Ch 2-13 所有 section | 机制层质量升级 |
| `manuscript/chapter-XX-*.md` (main file) | Ch 2-13 每章 1 个 | 工程层增量 + 场景 + 桥段 |

### 会创建的文件

| 文件 | 内容 |
|------|------|
| `docs/features/.../theme-tracking-matrix.md` | 5主线×12章追踪矩阵（活文档） |
| `docs/features/.../quality-rubric.md` | Q1-Q10 详细标准 + regex 检测 |
| `docs/features/.../rubric-results.md` | 12章×10条审校记录表 |
| `scripts/verify-section-quality.mjs` | section 级别验证脚本（YAML对话检测、核心判断信号） |

### 不修改的文件

Ch 0, Ch 1, Ch 14-17, 验证脚本阈值（升级后单独处理）

---

## 任务分解

### Gate 0: 前置准备（串行）

---

**T0.1: 创建规划工具包**

产物：theme-tracking-matrix.md + quality-rubric.md + rubric-results.md（空模板，12章×10条 checklist 表格）
内容：矩阵初始填充（基于 spec 6 表）；Q1-Q10 详细标准（基于 design KD6）；审校记录模板
验收标准：3 个文件全部创建，矩阵 5×12 格有初始内容，Q1-Q10 每条有 regex 检测方法和人工要点
验证：文件存在 + 内容完整

**T0.2: 全 12 章 section 质量分级**

产物：`docs/features/20260516-content-depth-upgrade/quality-grading.md`
内容：每个 section-complete 文件的 A/B/C 分级 + P1-P6 评分 + 缺陷清单
验收标准：12 章所有 section 文件都有分级结果；Ch 7 s1/s5 和 Ch 9 s1 确认 C级；Ch 11 标注"高风险：近从零编写"
验证：抽样 3 个 section 读内容确认分级准确

**T0.3: 创建 section 级别验证脚本**

产物：`scripts/verify-section-quality.mjs`
内容：检查所有 section-complete 文件是否有 YAML 对话开头标记（Q4）、核心判断文本信号（Q2/Q5）、场景关键词（Q1/Q3/Q6）
验收标准：脚本可运行，输出每章每 section 的检测结果
验证：`node scripts/verify-section-quality.mjs` 输出完整

---

### P1 批次: Ch 10-13（AI 与治理，最高差异化）

**Gate 条件：** T0.1-T0.3 全部完成

---

**T1.1: Ch 10 机制层升级**

范围：12 个 section-complete 文件
动作：按 T0.2 分级结果，补写 ANN 计算路径 + Embedding 版本边界；补"向量库 ≠ AI 数据系统"边界句
验收标准：所有 section P1-P6 ≥ 4/6（初次）；重点确认 s1/s2 保持 B级叙事风格
验证：section 验证脚本 + 人工确认 Q1-Q6

**T1.2: Ch 10 工程层增量**

范围：main file
动作：添加 pgvector/Milvus/Qdrant 选型对比表 + 召回噪声故障清单 + RAG 权限/来源边界
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T1.3: Ch 11 机制层升级（⚠️高风险：近从零编写）**

范围：12 个 section-complete 文件（当前平均 ~937 chars/section）
动作：每个 section 需大幅补写——图遍历计算路径、多跳查询代价、GraphRAG 上下文组装。补"图库 ≠ 关系库替代品"边界句。按分级结果执行，但大部分 section 可能是 B/C 级需重点补写
验收标准：所有 section P1-P6 ≥ 4/6（初次），允许 2-3 轮返工
验证：section 验证脚本 + 人工确认 Q1-Q6；重点确认场景引用

**T1.4: Ch 11 工程层增量**

范围：main file
动作：添加 Neo4j/NebulaGraph 选型对比表 + 图幻觉故障清单 + 多跳查询边界
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T1.5: Ch 12 机制层升级**

范围：11-12 个 section-complete 文件
动作：补写表格式演化路径 + Catalog 责任边界；补"湖仓 ≠ 格式枚举"边界句
验收标准：所有 section P1-P6 ≥ 4/6（初次）
验证：section 验证脚本 + 人工确认 Q1-Q6

**T1.6: Ch 12 工程层增量**

范围：main file
动作：添加 Iceberg/Delta/Hudi 选型对比表 + 湖仓一致性问题清单 + 多引擎冲突边界
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T1.7: Ch 13 机制层升级**

范围：12 个 section-complete 文件（当前偏概念列举）
动作：补写治理对象模型 + 控制面闭环（防泛化）；补"治理 ≠ 管理制度"边界句
验收标准：所有 section P1-P6 ≥ 4/6（初次）
验证：section 验证脚本 + 人工确认 Q1-Q6

**T1.8: Ch 13 工程层增量**

范围：main file
动作：添加治理工具对比表 + 治理失效清单 + AI 场景权限链路
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T1.9: P1 批次叙事桥段 + 主线桥段 + 事实准确性审查**

范围：Ch 10-13 4 个 main file
动作：
- (a) 每章"问题切入"段末尾添加系统位置+场景位置桥段
- (b) 每章"小结引出下一章"段添加 T1-T5 五步过渡 + 2-3条主线回溯+推进桥段
- (c) Ch 10-13 工程层内容做事实准确性审查（确认 pgvector/Milvus/Qdrant/Neo4j/Iceberg 等描述符合 2025-2026 实际）
验收标准：每章有系统位置+场景位置桥段、T1-T5 过渡、≥ 2 条主线桥段；事实准确性审查记录存在
验证：Q10 人工确认；审查记录存在

**T1.10: P1 批次验证**

范围：Ch 10-13
动作：
- (a) 运行 `pnpm verify`（验证 main file 结构）
- (b) 运行 `node scripts/verify-section-quality.mjs`（验证 section 级别）
- (c) 人工确认 Q1-Q10，填写 rubric-results.md P1 部分
- (d) 更新 theme-tracking-matrix.md P1 部分
验收标准：pnpm verify 通过；section 验证脚本通过；Q1-Q10 ≥ 9/10 yes；矩阵 P1 无重复
失败协议：如果 Q ≤ 8/10，识别失败项→创建针对性返工任务→最多 3 轴返工→超过则升级处理
验证：脚本输出 + rubric-results.md + 矩阵

---

### P2 批次: Ch 2-9（基础 + 工程核心）

**Gate 条件：** T1.10 通过

---

**T2.1: Ch 2 机制层升级**

范围：10 个 section-complete 文件（不是 2！修正数据）
动作：按分级结果增量修改/补写
验收标准：所有 section P1-P6 ≥ 4/6（初次）
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.2: Ch 2 工程层增量**

范围：main file
动作：添加 SQL 性能边界判断表 + 聚合口径错误清单
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.3: Ch 3 机制层升级**

范围：10 个 section-complete 文件
动作：按分级结果增量修改
验收标准：所有 section P1-P6 ≥ 4/6
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.4: Ch 3 工程层增量**

范围：main file
动作：添加大表诊断判断表 + 索引类型选型对比表 + 分区策略故障清单
验收标准：≥ 1 对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.5: Ch 4 机制层升级**

范围：10 个 section-complete 文件
验收标准：所有 section P1-P6 ≥ 4/6
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.6: Ch 4 工程层增量**

范围：main file
动作：添加 OLTP/OLAP 场景判断表 + 业务库分析边界清单 + 读写模式对比
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.7: Ch 5 机制层升级**

范围：12 个 section-complete 文件
验收标准：所有 section P1-P6 ≥ 4/6
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.8: Ch 5 工程层增量**

范围：main file
动作：添加建模选型判断表（星/雪花/宽表） + 分层退化故障清单 + 口径冲突案例
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.9: Ch 6 机制层升级**

范围：12 个 section-complete 文件
验收标准：所有 section P1-P6 ≥ 4/6
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.10: Ch 6 工程层增量**

范围：main file
动作：添加抽取方式对比表 + CDC 延迟/断点故障清单 + 对账口径
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.11: Ch 7 机制层升级（C级重写重点）**

范围：12 个 section-complete 文件
动作：**子任务拆分**
- (a) s1/s5 C级全量重写：从 YAML 模板→论证式（问题先行→核心判断→机制路径→边界确认），2-3轮生成+审校
- (b)其余 section 按分级增量修改
验收标准：s1/s5 无 YAML 对话开头、P1-P6 ≥ 4/6；其余 section P1-P6 ≥ 4/6
验证：section 验证脚本（重点确认 s1/s5 无公式化标记） + 人工确认 Q1-Q6

**T2.12: Ch 7 工程层增量**

范围：main file
动作：添加 Hive/Spark/Trino 角色对比表 + Shuffle 故障清单 + 批处理选型判断
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.13: Ch 8 机制层升级**

范围：12 个 section-complete 文件
验收标准：所有 section P1-P6 ≥ 4/6
验证：section 验证脚本 + 人工确认 Q1-Q6

**T2.14: Ch 8 工程层增量**

范围：main file
动作：添加 Kafka/Flink 角色对比表 + Watermark 延迟故障清单 + Exactly Once 边界判断
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.15: Ch 9 机制层升级（C级重写重点）**

范围：12 个 section-complete 文件
动作：**子任务拆分**
- (a) s1 C级全量重写：去掉重复 OLTP/OLAP 表→改为 OLAP 机制路径，2-3轮
- (b)其余 section 按分级增量修改
验收标准：s1 无 YAML 模板、无重复 OLTP/OLAP 表、P1-P6 ≥ 4/6；其余 ≥ 4/6
验证：section 验证脚本（重点确认 s1） + 人工确认 Q1-Q6

**T2.16: Ch 9 工程层增量**

范围：main file
动作：添加 ClickHouse/Doris/DuckDB 选型对比表 + MergeTree 失效清单 + OLAP 查询边界
验收标准：对比表含推荐场景行+注意事项列；故障清单 ≥ 3 项满足三要素
验证：Q7-Q9 人工确认

**T2.17: P2 批次叙事桥段 + 主线桥段**

范围：Ch 2-9 8 个 main file
动作：同 T1.9 格式（系统位置+场景位置桥段、T1-T5 过渡、主线桥段）
验收标准：每章有系统位置+场景位置桥段、T1-T5 过渡、≥ 2 条主线桥段
验证：Q10 人工确认

**T2.18: P2 批次验证**

范围：Ch 2-9
动作：同 T1.10（pnpm verify + section 验证脚本 + Q1-Q10 rubric + 矩阵更新）
验收标准：pnpm verify 通过；section 验证通过；Q1-Q10 ≥ 9/10；矩阵 P2 无重复
失败协议：最多 3 轮返工
验证：脚本输出 + rubric-results.md + 矩阵

---

### Gate 4: 收尾

---

**T3.1: 二次验证冲刺（P1-P6 从 4/6 提升到 5/6）**

范围：所有 12 章的 section-complete 文件
动作：对初次验证仅达到 4/6 的 section 补写缺失的 P 模式段落，目标 P1-P6 ≥ 5/6
验收标准：所有 section P1-P6 ≥ 5/6
验证：section 验证脚本 + 人工确认

**T3.2: 全书验证 + completion-audit 更新**

动作：`pnpm verify` 全部脚本 + 最终 Q1-Q10 审校 + 更新 completion-audit.md + 矩阵最终确认
验收标准：pnpm verify 通过；Q1-Q10 ≥ 9/10 全章；矩阵完整无重复；completion-audit 有升级记录
验证：脚本输出 + rubric-results.md + 矩阵

---

## 任务总览

| 批次 | 任务数 | 关键风险 |
|------|--------|----------|
| Gate 0 | 3 | 分级准确性、section 验证脚本 |
| P1 | 10 | Ch 11 近从零编写（高风险）；事实准确性审查 |
| P2 | 18 | Ch 7/9 C级重写（高工作量）；叙事桥段串行瓶颈 |
| Gate 4 | 2 | 二次验证冲刺可能发现新缺陷 |
| **总计** | **33→精简后** | |

实际精简效果：
- 合并了原 Gate 0 的 3 个独立任务为 1 个工具包创建任务（但保留了 section 验证脚本为独立任务）
- 每章仍然拆分机制层+工程层（采纳 Eng Review F5）
- 叙事桥段合并到验证步骤中（但保留为独立任务以便清晰追踪）
- 添加了事实准确性审查（CEO S4）
- 添加了二次验证冲刺（C级 4/6→5/6）

最终任务数：3 + 10 + 18 + 2 = **33 任务**。看起来比预估的 22 多，但这是因为保留了每章机制+工程拆分（Eng F5 要求），且每章是独立切片。如果合并机制+工程为单任务则可到 22，但采纳了 Eng 建议保持拆分以更好追踪进度和质量。

## 并行安全标记

| 任务组 | parallel_safe | 原因 |
|--------|--------------|------|
| T0.1-T0.3（Gate 0） | T0.1 ✅ T0.2 ❌ T0.3 ✅ | T0.2 需要读所有 section 文件（大量 IO） |
| P1 各章升级（T1.1-T1.8） | ✅ | 各章独立文件 |
| P2 各章升级（T2.1-T2.16） | ✅ | 各章独立文件 |
| 叙事桥段（T1.9/T2.17） | ❌ | 需要本批次所有章节完成 |
| 验证（T1.10/T2.18） | ❌ | 需要所有升级+桥段完成 |

## Spec 覆盖映射

全覆盖——每章有机制层升级 + 工程层增量 + 场景桥段 + 主线桥段 + 验证，与 spec 和 design 的所有需求对应。