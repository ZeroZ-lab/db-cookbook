# Content Depth Upgrade

将 db-cookbook 课程 Ch 2-13 从当前深度升级到 Ch 1 水平（机制充实、实战任务闭环、边界句明确、对比表+故障清单表达工程层），并嵌入 5 条纵向主线为"回溯+推进"桥段。

## 状态

- **P1 批次 (Ch10-13)**: ✅ 完成 — 全A=48, Q1-Q10 10/10, Review PASS
- **P2 批次 (Ch2-9)**: ⏳ 待执行
- **Gate 4 收尾**: ⏳ 待P2完成后执行

## 文档结构

| 文件 | 作用 | 状态 |
|------|------|------|
| `01-spec.md` | 需求规格（最终版） | ✅ final |
| `02-design.md` | 设计决策（最终版） | ✅ final |
| `03-plan.md` | 执行计划（最终版） | ✅ final |
| `04-review.md` | P1 Review 报告 | ✅ PASS (4.4/5) |
| `quality-grading.md` | 每节质量分级（活文档） | ✅ P1已更新 |
| `quality-rubric.md` | Q1-Q10 审校标准 | ✅ |
| `rubric-results.md` | Q1-Q10 审校记录 | ✅ P1=10/10 |
| `theme-tracking-matrix.md` | 5主线×12章追踪矩阵 | ✅ P1已更新 |
| `CHANGELOG.md` | 变更记录 | ✅ |

## 执行顺序

原始 spec 定义 P1=Ch2-5, P2=Ch6-9, P3=Ch10-13。基于 Eng Review 和 CEO Review 建议，调整为：
- **P1=Ch10-13** (AI最高差异化，升级难度较低)
- **P2=Ch2-9** (基础+工程核心，包含C级重写)

## P1 批次关键数据

- 48 个 section-complete 文件全部升级到 A 级
- 4 个 main file 添加工程层（对比表+故障清单+主线桥段）
- 20 个事实错误修正
- 5 条纵向主线桥段 × 4 章（Ch12=4条，检索线不覆盖）

## 验证

```bash
# Site build
node scripts/generate-site.mjs

# Section quality verification
node scripts/verify-section-quality.mjs
```

## 下一步

P2 批次（Ch2-9）待 P1 Gate 通过后启动。