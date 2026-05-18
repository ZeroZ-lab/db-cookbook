# 数据库全书

> 从 PostgreSQL 到智能数据系统——一份面向开发者的系统化学习指南

**[在线阅读](https://db-cookbook.vercel.app)** | [完整大文档](https://db-cookbook.vercel.app/book) | [学习路线图](https://db-cookbook.vercel.app/roadmap) | [术语表](https://db-cookbook.vercel.app/glossary)

---

## 这本书讲什么

它不把数据库知识写成 SQL 语法手册，也不把大数据生态写成工具清单。它的目标是让读者先用 PostgreSQL 建立可靠的数据库直觉，再逐步理解单机数据库的边界、OLTP 与 OLAP 的分化、现代数据平台的工程结构，以及 AI 时代的数据基础设施。

## 章节概览

| 部分 | 章节 | 覆盖范围 |
|------|------|----------|
| 第一部分：PostgreSQL 基立数据直觉 | 第 0-3 章 | 核心定位、数据库基础、SQL 分析、大表能力 |
| 第二部分：从业务库走向分析系统 | 第 4-6 章 | OLTP vs OLAP、数仓建模、ETL / ELT |
| 第三部分：大数据计算与湖仓底座 | 第 7-9 章 | 批处理（Hive/Spark/Trino）、实时处理（Kafka/Flink）、OLAP 数据库（ClickHouse/Doris/DuckDB） |
| 第四部分：AI 时代的数据基础设施 | 第 10-13 章 | 向量数据库、图数据库、湖仓架构、数据治理 |
| 第五部分：路线与能力闭环 | 第 14-17 章 | 项目实战、学习顺序、能力地图、最终目标 |

## 学习路线

```text
PostgreSQL 业务数据
  → SQL 分析
  → 数仓建模
  → ETL / CDC
  → ClickHouse / Spark / Flink
  → 向量检索 / 图关系分析
  → 指标与数据应用
```

## 快速开始

```bash
# 克隆仓库
git clone https://github.com/ZeroZ-lab/db-cookbook.git
cd db-cookbook

# 安装依赖
pnpm install

# 启动本地阅读
pnpm docs:dev
```

## 项目结构

```
db-cookbook/
├── manuscript/          # 18 章正文（Markdown）
├── site/                # VitePress 在线阅读站点
├── scripts/             # 自动化验证脚本（结构、术语、SQL、事实核查等）
├── project-workbench/   # 7 个实战项目骨架（Docker + SQL + 架构文档）
└── docs/                # 写作规范、课程大纲、事实核查记录
```

## 当前边界

- 书稿已形成完整路线。
- 自动验证已通过。
- 项目实战大多仍是可检查骨架，不是端到端可运行工程。
- 事实核查为初核，不是出版最终关闭。

## 反馈与贡献

- 发现错误或有建议？[提交 Issue](https://github.com/ZeroZ-lab/db-cookbook/issues)
- 内容讨论请参考 [写作规范](docs/writing-guide.md)
