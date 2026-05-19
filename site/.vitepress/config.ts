import { defineConfig } from 'vitepress'

const sidebarItems = [
  {
    "text": "第一部分：PostgreSQL 建立数据库直觉",
    "collapsed": false,
    "items": [
      {
        "text": "0. 核心定位",
        "link": "/chapters/00-positioning"
      },
      {
        "text": "1. 数据库基础：用 PostgreSQL 建立数据系统直觉",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/01/"
          },
          {
            "text": "01.1 为什么要从 PostgreSQL 开始理解数据系统？",
            "link": "/chapters/01/01-1"
          },
          {
            "text": "01.2 PostgreSQL 核心结构：数据系统是如何被组织起来的",
            "link": "/chapters/01/01-2"
          },
          {
            "text": "01.3 必学概念：从主键、外键、约束到事务、索引和分区",
            "link": "/chapters/01/01-3"
          },
          {
            "text": "01.4 关键问题：从业务库走向分析系统的边界",
            "link": "/chapters/01/01-4"
          }
        ]
      },
      {
        "text": "2. SQL 分析能力：大数据方向第一硬技能",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/02/"
          },
          {
            "text": "02.1 SQL不是语法题，而是分析表达能力",
            "link": "/chapters/02/02-1"
          },
          {
            "text": "02.2 基础查询：从表中准确取出你需要的数据",
            "link": "/chapters/02/02-2"
          },
          {
            "text": "02.3 聚合分析：从明细记录到统计指标",
            "link": "/chapters/02/02-3"
          },
          {
            "text": "02.4 多表关联：从分散数据中恢复完整业务事实",
            "link": "/chapters/02/02-4"
          },
          {
            "text": "02.5 复杂分析SQL：把中间过程表达清楚",
            "link": "/chapters/02/02-5"
          },
          {
            "text": "02.6 窗口函数：在保留明细的同时做组内分析",
            "link": "/chapters/02/02-6"
          },
          {
            "text": "02.7 指标计算：从SQL到指标",
            "link": "/chapters/02/02-7"
          },
          {
            "text": "02.8 常见指标SQL实战",
            "link": "/chapters/02/02-8"
          },
          {
            "text": "02.9 SQL性能基础：写出高效的SQL查询",
            "link": "/chapters/02/02-9"
          },
          {
            "text": "02.10 SQL在不同系统中的迁移：理解差异，保持能力",
            "link": "/chapters/02/02-10"
          }
        ]
      },
      {
        "text": "3. PostgreSQL 大表能力：理解单机数据库边界",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/03/"
          },
          {
            "text": "03.1 大表为什么慢：从现象到本质",
            "link": "/chapters/03/03-1"
          },
          {
            "text": "03.2 PostgreSQL的单机边界：能做什么，不能做什么",
            "link": "/chapters/03/03-2"
          },
          {
            "text": "03.3 分区表：让大表具有物理边界",
            "link": "/chapters/03/03-3"
          },
          {
            "text": "03.4 表空间与存储策略：让数据存储更高效",
            "link": "/chapters/03/03-4"
          },
          {
            "text": "03.5 索引基础：B-tree与查询加速",
            "link": "/chapters/03/03-5"
          },
          {
            "text": "03.6 索引进阶：BRIN、GIN、GiST与特殊场景",
            "link": "/chapters/03/03-6"
          },
          {
            "text": "03.7 查询优化基础：执行计划分析与优化",
            "link": "/chapters/03/03-7"
          },
          {
            "text": "03.8 物化视图：把重复计算提前做掉",
            "link": "/chapters/03/03-8"
          },
          {
            "text": "03.9 并行查询：利用多核CPU加速大表查询",
            "link": "/chapters/03/03-9"
          },
          {
            "text": "03.10 批量操作与数据链路接入：高效导入导出大量数据",
            "link": "/chapters/03/03-10"
          }
        ]
      }
    ]
  },
  {
    "text": "第二部分：从业务库走向分析系统",
    "collapsed": false,
    "items": [
      {
        "text": "4. OLTP vs OLAP：大数据系统的第一分水岭",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/04/"
          },
          {
            "text": "04.1 为什么一个数据库很难同时做好交易和分析",
            "link": "/chapters/04/04-1"
          },
          {
            "text": "04.2 从单机到分工：系统的自然演化",
            "link": "/chapters/04/04-2"
          },
          {
            "text": "04.3 OLTP的本质：面向业务事务",
            "link": "/chapters/04/04-3"
          },
          {
            "text": "04.4 OLTP的数据模型：规范化与关系设计",
            "link": "/chapters/04/04-4"
          },
          {
            "text": "04.5 OLTP的优化策略",
            "link": "/chapters/04/04-5"
          },
          {
            "text": "04.6 OLAP的本质：面向分析查询",
            "link": "/chapters/04/04-6"
          },
          {
            "text": "04.7 OLAP的数据模型：维度建模与宽表",
            "link": "/chapters/04/04-7"
          },
          {
            "text": "04.8 OLAP的优化策略",
            "link": "/chapters/04/04-8"
          },
          {
            "text": "04.9 OLTP与OLAP的系统分工",
            "link": "/chapters/04/04-9"
          },
          {
            "text": "04.10 如何判断应该用OLTP还是OLAP",
            "link": "/chapters/04/04-10"
          }
        ]
      },
      {
        "text": "5. 数据仓库建模：从表设计到分析建模",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/05/"
          },
          {
            "text": "05.1 为什么业务库不能直接做分析",
            "link": "/chapters/05/05-1"
          },
          {
            "text": "05.2 数据仓库的核心概念",
            "link": "/chapters/05/05-2"
          },
          {
            "text": "05.3 数仓的基本术语",
            "link": "/chapters/05/05-3"
          },
          {
            "text": "05.4 数仓分层的必要性",
            "link": "/chapters/05/05-4"
          },
          {
            "text": "05.5 常见分层模型详解",
            "link": "/chapters/05/05-5"
          },
          {
            "text": "05.6 分层的实施策略",
            "link": "/chapters/05/05-6"
          },
          {
            "text": "05.7 维度建模基础",
            "link": "/chapters/05/05-7"
          },
          {
            "text": "05.8 事实表设计",
            "link": "/chapters/05/05-8"
          },
          {
            "text": "05.9 维度表设计",
            "link": "/chapters/05/05-9"
          },
          {
            "text": "05.10 常见建模模式",
            "link": "/chapters/05/05-10"
          },
          {
            "text": "05.11 指标体系设计",
            "link": "/chapters/05/05-11"
          },
          {
            "text": "05.12 指标管理实战",
            "link": "/chapters/05/05-12"
          }
        ]
      },
      {
        "text": "6. ETL / ELT：数据如何进入大数据系统",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/06/"
          },
          {
            "text": "06.1 ETL vs ELT",
            "link": "/chapters/06/06-1"
          },
          {
            "text": "06.2 数据抽取",
            "link": "/chapters/06/06-2"
          },
          {
            "text": "06.3 数据转换",
            "link": "/chapters/06/06-3"
          },
          {
            "text": "06.4 数据加载",
            "link": "/chapters/06/06-4"
          },
          {
            "text": "06.5 常见ETL工具",
            "link": "/chapters/06/06-5"
          },
          {
            "text": "06.6 工作流调度",
            "link": "/chapters/06/06-6"
          },
          {
            "text": "06.7 数据质量监控",
            "link": "/chapters/06/06-7"
          },
          {
            "text": "06.8 错误处理和重试",
            "link": "/chapters/06/06-8"
          },
          {
            "text": "06.9 性能优化",
            "link": "/chapters/06/06-9"
          },
          {
            "text": "06.10 ETL最佳实践",
            "link": "/chapters/06/06-10"
          },
          {
            "text": "06.11 ELT最佳实践",
            "link": "/chapters/06/06-11"
          },
          {
            "text": "06.12 ETL/ELT实战案例",
            "link": "/chapters/06/06-12"
          }
        ]
      }
    ]
  },
  {
    "text": "第三部分：大数据计算与湖仓底座",
    "collapsed": false,
    "items": [
      {
        "text": "7. 批处理系统：Hive / Spark / Trino",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/07/"
          },
          {
            "text": "07.1 什么是批处理",
            "link": "/chapters/07/07-1"
          },
          {
            "text": "07.2 批处理的应用场景",
            "link": "/chapters/07/07-2"
          },
          {
            "text": "07.3 批处理核心技术",
            "link": "/chapters/07/07-3"
          },
          {
            "text": "07.4 批处理调度与编排",
            "link": "/chapters/07/07-4"
          },
          {
            "text": "07.5 批处理性能优化",
            "link": "/chapters/07/07-5"
          },
          {
            "text": "07.6 批处理监控与运维",
            "link": "/chapters/07/07-6"
          },
          {
            "text": "07.7 批处理实战案例",
            "link": "/chapters/07/07-7"
          },
          {
            "text": "07.8 批处理系统设计",
            "link": "/chapters/07/07-8"
          },
          {
            "text": "07.9 批处理与流处理的融合",
            "link": "/chapters/07/07-9"
          },
          {
            "text": "07.10 批处理最佳实践总结",
            "link": "/chapters/07/07-10"
          },
          {
            "text": "07.11 批处理常见问题与解决方案",
            "link": "/chapters/07/07-11"
          },
          {
            "text": "07.12 批处理实战任务",
            "link": "/chapters/07/07-12"
          }
        ]
      },
      {
        "text": "8. 实时数据处理：Kafka / Flink",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/08/"
          },
          {
            "text": "08.1 什么是实时数据处理",
            "link": "/chapters/08/08-1"
          },
          {
            "text": "08.2 实时数据处理的应用场景",
            "link": "/chapters/08/08-2"
          },
          {
            "text": "08.3 流处理核心技术",
            "link": "/chapters/08/08-3"
          },
          {
            "text": "08.4 流处理架构设计",
            "link": "/chapters/08/08-4"
          }
        ]
      },
      {
        "text": "9. OLAP 数据库：ClickHouse / Doris / DuckDB",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/09/"
          },
          {
            "text": "09.1 OLAP数据库概述",
            "link": "/chapters/09/09-1"
          },
          {
            "text": "09.2 OLAP数据模型与存储",
            "link": "/chapters/09/09-2"
          },
          {
            "text": "09.3 OLAP查询优化",
            "link": "/chapters/09/09-3"
          },
          {
            "text": "09.4 OLAP数据摄入与更新",
            "link": "/chapters/09/09-4"
          },
          {
            "text": "09.5 OLAP监控与运维",
            "link": "/chapters/09/09-5"
          },
          {
            "text": "09.6 OLAP高可用架构",
            "link": "/chapters/09/09-6"
          },
          {
            "text": "09.7 OLAP性能调优",
            "link": "/chapters/09/09-7"
          },
          {
            "text": "09.8 OLAP最佳实践",
            "link": "/chapters/09/09-8"
          },
          {
            "text": "09.9 OLAP与BI集成",
            "link": "/chapters/09/09-9"
          },
          {
            "text": "09.10 OLAP实战案例",
            "link": "/chapters/09/09-10"
          },
          {
            "text": "09.11 OLAP常见问题",
            "link": "/chapters/09/09-11"
          },
          {
            "text": "09.12 OLAP实战任务",
            "link": "/chapters/09/09-12"
          }
        ]
      }
    ]
  },
  {
    "text": "第四部分：AI 时代的数据基础设施",
    "collapsed": false,
    "items": [
      {
        "text": "10. 向量数据库：面向 AI / RAG / 语义检索的数据系统",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/10/"
          },
          {
            "text": "10.1 向量数据库概述",
            "link": "/chapters/10/10-1"
          },
          {
            "text": "10.2 向量表示与嵌入",
            "link": "/chapters/10/10-2"
          },
          {
            "text": "10.3 向量索引算法",
            "link": "/chapters/10/10-3"
          },
          {
            "text": "10.4 向量检索与相似度计算",
            "link": "/chapters/10/10-4"
          },
          {
            "text": "10.5 向量数据库性能优化",
            "link": "/chapters/10/10-5"
          },
          {
            "text": "10.6 向量数据库运维管理",
            "link": "/chapters/10/10-6"
          },
          {
            "text": "10.7 向量数据库应用实践",
            "link": "/chapters/10/10-7"
          },
          {
            "text": "10.8 向量数据库选型与架构",
            "link": "/chapters/10/10-8"
          },
          {
            "text": "10.9 向量数据库最佳实践",
            "link": "/chapters/10/10-9"
          },
          {
            "text": "10.10 向量数据库常见问题",
            "link": "/chapters/10/10-10"
          },
          {
            "text": "10.11 向量数据库实战案例",
            "link": "/chapters/10/10-11"
          },
          {
            "text": "10.12 向量数据库实战任务",
            "link": "/chapters/10/10-12"
          }
        ]
      },
      {
        "text": "11. 图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/11/"
          },
          {
            "text": "11.1 图数据库概述",
            "link": "/chapters/11/11-1"
          },
          {
            "text": "11.2 图数据模型",
            "link": "/chapters/11/11-2"
          },
          {
            "text": "11.3 图查询语言",
            "link": "/chapters/11/11-3"
          },
          {
            "text": "11.4 Neo4j 实战",
            "link": "/chapters/11/11-4"
          },
          {
            "text": "11.5 图数据库架构",
            "link": "/chapters/11/11-5"
          },
          {
            "text": "11.6 图索引与优化",
            "link": "/chapters/11/11-6"
          },
          {
            "text": "11.7 图查询优化",
            "link": "/chapters/11/11-7"
          },
          {
            "text": "11.8 GraphRAG",
            "link": "/chapters/11/11-8"
          },
          {
            "text": "11.9 图分析应用",
            "link": "/chapters/11/11-9"
          },
          {
            "text": "11.10 图数据库选型",
            "link": "/chapters/11/11-10"
          },
          {
            "text": "11.11 知识图谱与本体建模",
            "link": "/chapters/11/11-11"
          },
          {
            "text": "11.12 图数据库常见问题",
            "link": "/chapters/11/11-12"
          }
        ]
      },
      {
        "text": "12. 数据湖与湖仓架构",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/12/"
          },
          {
            "text": "12.1 湖仓概述",
            "link": "/chapters/12/12-1"
          },
          {
            "text": "12.2 数据湖到湖仓演化",
            "link": "/chapters/12/12-2"
          },
          {
            "text": "12.3 对象存储与 Parquet",
            "link": "/chapters/12/12-3"
          },
          {
            "text": "12.4 表格式（Iceberg / Delta Lake / Hudi）",
            "link": "/chapters/12/12-4"
          },
          {
            "text": "12.5 Catalog 与元数据管理",
            "link": "/chapters/12/12-5"
          },
          {
            "text": "12.6 多引擎查询",
            "link": "/chapters/12/12-6"
          },
          {
            "text": "12.7 湖仓事务与快照",
            "link": "/chapters/12/12-7"
          },
          {
            "text": "12.8 湖仓数据组织",
            "link": "/chapters/12/12-8"
          },
          {
            "text": "12.9 湖仓运维",
            "link": "/chapters/12/12-9"
          },
          {
            "text": "12.10 湖仓选型",
            "link": "/chapters/12/12-10"
          },
          {
            "text": "12.11 湖仓实战案例",
            "link": "/chapters/12/12-11"
          },
          {
            "text": "12.12 湖仓常见问题",
            "link": "/chapters/12/12-12"
          }
        ]
      },
      {
        "text": "13. 数据治理与工程化",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/13/"
          },
          {
            "text": "13.1 数据治理概述",
            "link": "/chapters/13/13-1"
          },
          {
            "text": "13.2 数据质量管理",
            "link": "/chapters/13/13-2"
          },
          {
            "text": "13.3 数据标准与规范",
            "link": "/chapters/13/13-3"
          },
          {
            "text": "13.4 数据安全与合规",
            "link": "/chapters/13/13-4"
          },
          {
            "text": "13.5 元数据管理",
            "link": "/chapters/13/13-5"
          },
          {
            "text": "13.6 数据生命周期管理",
            "link": "/chapters/13/13-6"
          },
          {
            "text": "13.7 数据治理组织与流程",
            "link": "/chapters/13/13-7"
          },
          {
            "text": "13.8 数据治理工具与平台",
            "link": "/chapters/13/13-8"
          },
          {
            "text": "13.9 数据治理最佳实践",
            "link": "/chapters/13/13-9"
          },
          {
            "text": "13.10 数据治理常见问题",
            "link": "/chapters/13/13-10"
          },
          {
            "text": "13.11 数据治理实战案例",
            "link": "/chapters/13/13-11"
          },
          {
            "text": "13.12 数据治理实战任务",
            "link": "/chapters/13/13-12"
          }
        ]
      }
    ]
  },
  {
    "text": "第五部分：项目、路线和能力闭环",
    "collapsed": false,
    "items": [
      {
        "text": "14. 大数据方向项目实战",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/14/"
          },
          {
            "text": "14.8 项目实战指南",
            "link": "/chapters/14/14-8"
          }
        ]
      },
      {
        "text": "15. 推荐学习顺序",
        "link": "/chapters/15-learning-order"
      },
      {
        "text": "16. 能力地图",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/16/"
          },
          {
            "text": "16.2 核心能力体系",
            "link": "/chapters/16/16-2"
          },
          {
            "text": "16.3 能力评估矩阵",
            "link": "/chapters/16/16-3"
          },
          {
            "text": "16.4 初级能力要求",
            "link": "/chapters/16/16-4"
          },
          {
            "text": "16.5 中级能力要求",
            "link": "/chapters/16/16-5"
          },
          {
            "text": "16.6 高级能力要求",
            "link": "/chapters/16/16-6"
          },
          {
            "text": "16.7 专家能力要求",
            "link": "/chapters/16/16-7"
          },
          {
            "text": "16.8 能力提升路径",
            "link": "/chapters/16/16-8"
          }
        ]
      },
      {
        "text": "17. 最终学习目标",
        "collapsed": false,
        "items": [
          {
            "text": "章节概览",
            "link": "/chapters/17/"
          },
          {
            "text": "17.1 最终目标概述",
            "link": "/chapters/17/17-1"
          },
          {
            "text": "17.2 职业发展路径",
            "link": "/chapters/17/17-2"
          },
          {
            "text": "17.3 持续学习规划",
            "link": "/chapters/17/17-3"
          },
          {
            "text": "17.4 实践与创新",
            "link": "/chapters/17/17-4"
          },
          {
            "text": "17.5 社区与影响力",
            "link": "/chapters/17/17-5"
          },
          {
            "text": "17.6 总结与展望",
            "link": "/chapters/17/17-6"
          }
        ]
      }
    ]
  }
]

export default defineConfig({
  title: '数据库全书',
  description: '从 PostgreSQL 到智能数据系统',
  lang: 'zh-CN',
  cleanUrls: true,
  head: [
    ['link', { rel: 'icon', href: '/images/logo.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    logo: '/images/logo.svg',
    nav: [
      { text: '开始阅读', link: '/chapters/00-positioning' }
    ],
    sidebar: sidebarItems,
    outline: {
      level: [2, 3],
      label: '本页目录'
    },
    search: {
      provider: 'local'
    },
    docFooter: {
      prev: '上一章',
      next: '下一章'
    },
    footer: {
      message: '从 PostgreSQL 到智能数据系统',
      copyright: 'Copyright © 2026'
    }
  },
  markdown: {
    lineNumbers: true,
    config(md) {
      const defaultFence = md.renderer.rules.fence
      md.renderer.rules.fence = (tokens, idx, options, env, self) => {
        const token = tokens[idx]
        const info = token.info.trim()
        if (info === 'mermaid') {
          const code = encodeURIComponent(token.content)
          return `<Mermaid code="${code}" />`
        }
        return defaultFence ? defaultFence(tokens, idx, options, env, self) : self.renderToken(tokens, idx, options)
      }
    }
  }
})
