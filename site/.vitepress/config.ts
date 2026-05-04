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
        "link": "/chapters/01-postgresql-foundations"
      },
      {
        "text": "2. SQL 分析能力：大数据方向第一硬技能",
        "link": "/chapters/02-sql-analysis"
      },
      {
        "text": "3. PostgreSQL 大表能力：理解单机数据库边界",
        "link": "/chapters/03-postgresql-large-tables"
      }
    ]
  },
  {
    "text": "第二部分：从业务库走向分析系统",
    "collapsed": false,
    "items": [
      {
        "text": "4. OLTP vs OLAP：大数据系统的第一分水岭",
        "link": "/chapters/04-oltp-olap"
      },
      {
        "text": "5. 数据仓库建模：从表设计到分析建模",
        "link": "/chapters/05-data-warehouse-modeling"
      },
      {
        "text": "6. ETL / ELT：数据如何进入大数据系统",
        "link": "/chapters/06-etl-elt"
      }
    ]
  },
  {
    "text": "第三部分：大数据计算与湖仓底座",
    "collapsed": false,
    "items": [
      {
        "text": "7. 批处理系统：Hive / Spark / Trino",
        "link": "/chapters/07-batch-processing"
      },
      {
        "text": "8. 实时数据处理：Kafka / Flink",
        "link": "/chapters/08-stream-processing"
      },
      {
        "text": "9. OLAP 数据库：ClickHouse / Doris / DuckDB",
        "link": "/chapters/09-olap-databases"
      }
    ]
  },
  {
    "text": "第四部分：AI 时代的数据基础设施",
    "collapsed": false,
    "items": [
      {
        "text": "10. 向量数据库：面向 AI / RAG / 语义检索的数据系统",
        "link": "/chapters/10-vector-databases"
      },
      {
        "text": "11. 图数据库：面向关系网络 / 知识图谱 / 路径分析的数据系统",
        "link": "/chapters/11-graph-databases"
      },
      {
        "text": "12. 数据湖与湖仓架构",
        "link": "/chapters/12-lakehouse"
      },
      {
        "text": "13. 数据治理与工程化",
        "link": "/chapters/13-data-governance"
      }
    ]
  },
  {
    "text": "第五部分：项目、路线和能力闭环",
    "collapsed": false,
    "items": [
      {
        "text": "14. 大数据方向项目实战",
        "link": "/chapters/14-projects"
      },
      {
        "text": "15. 推荐学习顺序",
        "link": "/chapters/15-learning-order"
      },
      {
        "text": "16. 能力地图",
        "link": "/chapters/16-capability-map"
      },
      {
        "text": "17. 最终学习目标",
        "link": "/chapters/17-final-goals"
      }
    ]
  }
]

export default defineConfig({
  title: '数据库全书',
  description: '从 PostgreSQL 到智能数据系统',
  lang: 'zh-CN',
  cleanUrls: true,
  ignoreDeadLinks: [
    /^\/examples\//
  ],
  head: [
    ['link', { rel: 'icon', href: '/images/logo.svg', type: 'image/svg+xml' }]
  ],
  themeConfig: {
    logo: '/images/logo.svg',
    nav: [
      { text: '开始阅读', link: '/chapters/00-positioning' },
      { text: '完整大文档', link: '/book' },
      { text: '全书目录', link: '/catalog' },
      { text: '路线图', link: '/roadmap' },
      { text: '术语表', link: '/glossary' },
      { text: 'SQL 实验室', link: '/sql-lab' },
      { text: '项目实战', link: '/projects' }
    ],
    sidebar: [
      ...sidebarItems,
      {
        text: '辅助阅读',
        items: [
          { text: '学习路线图', link: '/roadmap' },
          { text: '完整大文档', link: '/book' },
          { text: '全书目录', link: '/catalog' },
          { text: '术语表', link: '/glossary' },
          { text: 'SQL 实验室', link: '/sql-lab' },
          { text: '项目实战总览', link: '/projects' },
          { text: '事实核查与来源', link: '/sources' }
        ]
      }
    ],
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
