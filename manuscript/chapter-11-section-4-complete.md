### 11.4 Neo4j 实战

上一节讨论了图查询语言的机制差异。现在用 Neo4j 和 Cypher 把这些机制落到具体的电商反欺诈场景中——不是展示语法糖，而是验证"图遍历解决什么、不解决什么"的判断。

Neo4j 是原生属性图数据库，从存储引擎到查询语言全部为图模型设计。它的存储机制是：每个节点的邻接边直接存储在该节点记录的附近（邻接表结构），查询"客户A有哪些关联边"是读取A节点记录附带的边指针列表，开销O(邻接边数)而非O(全表扫描)。这个存储设计让多跳遍历的每一步都是本地操作，不需要中间结果的物化和重分布。

以电商反欺诈为例，构建图模型：

```cypher
// 创建客户节点
CREATE (u1:客户 {user_id: 'U001', name: '张三', phone: '138xxxx', device: 'D001'})
CREATE (u2:客户 {user_id: 'U002', name: '李四', phone: '138xxxx', device: 'D001'})
CREATE (u3:客户 {user_id: 'U003', name: '王五', phone: '159xxxx', device: 'D002'})

// 创建商品和供应商节点
CREATE (p1:商品 {product_id: 'P001', name: '高端手机', price: 5999, category: '数码'})
CREATE (p2:商品 {product_id: 'P002', name: '平板电脑', price: 3999, category: '数码'})
CREATE (s1:供应商 {supplier_id: 'S001', name: '数码供应链', region: '华南', risk_level: 'low'})

// 创建关系边
CREATE (u1)-[:PURCHASED {order_id: 'O001', amount: 5999, time: '2025-03-01'}]->(p1)
CREATE (u2)-[:PURCHASED {order_id: 'O002', amount: 5999, time: '2025-03-02'}]->(p1)
CREATE (u3)-[:PURCHASED {order_id: 'O003', amount: 3999, time: '2025-03-03'}]->(p2)
CREATE (u1)-[:SHARED_DEVICE {device: 'D001', period: '2025-02-01~03-01'}]->(u2)
CREATE (u2)-[:SHARED_PHONE]->(u3)
CREATE (p1)-[:SUPPLIED_BY]->(s1)
CREATE (p2)-[:SUPPLIED_BY]->(s1)
```

**反欺诈路径查询**——找出通过共享设备和手机号间接关联的客户群：

```cypher
// 2跳：共享设备的客户还买了什么
MATCH (u:客户 {user_id: 'U001'})
      -[:SHARED_DEVICE]->(u2:客户)
      -[:PURCHASED]->(p:商品)
RETURN u2.name, p.name, p.price;

// 3跳：共享设备 -> 共享手机号 -> 购买商品，识别团伙购买模式
MATCH (u:客户 {user_id: 'U001'})
      -[:SHARED_DEVICE]->(u2:客户)
      -[:SHARED_PHONE]->(u3:客户)
      -[:PURCHASED]->(p:商品)
RETURN u2.name, u3.name, p.name, p.category;

// 不定长路径：客户U001通过任意关系链到达的供应商及其风险等级
MATCH path = (u:客户 {user_id: 'U001'})
      -[*1..4]->(s:供应商)
RETURN nodes(path) AS 路径节点, s.name, s.risk_level;
```

这些查询在关系型数据库中需要4-5次递归JOIN，路径长度不确定时SQL的递归CTE语法和性能都不友好。在Neo4j中，引擎从起点U001出发逐步遍历邻接边，每一步只扩展符合条件的节点，不需要物化中间结果集。

**Neo4j 实战不能替代的环节：** 图查询找到的是"实体之间如何关联"，但关联不等于欺诈判定。U001和U002共享设备可能有合理原因（家人共用），路径查询只能提供线索，最终判断需要业务规则和人工审核。Neo4j也不替代数据入图前的准备工作——实体消歧（同一用户多设备多手机号如何合并）、关系置信度标注、时间窗口过滤，这些是图查询的前提条件而非图数据库的内置能力。

**Neo4j 的代价和边界：** Neo4j Community Edition 是单机架构，数据量和并发受单机内存限制。企业版支持集群但写入仍需路由到主节点，写入吞吐不如分布式图数据库。Neo4j适合知识图谱、路径查询和中小规模反欺诈场景，不适合万亿级边的大规模社交网络分析——那需要NebulaGraph的分布式架构。Neo4j的另一个限制是：Cypher查询在密度极高的节点（超级节点，如一个热门商品被10万客户购买）上遍历时，中间结果集膨胀导致查询超时，需要索引和查询优化配合（下一节展开）。

数据入图的真实链路不是"直接导入"，而是：

```text
PostgreSQL 业务表（客户、订单、商品、供应商）
  -> ETL 抽取实体和关系
  -> 实体消歧（同一手机号多客户合并为SAME_PHONE边）
  -> 写入 Neo4j
  -> Cypher 路径查询 / 图算法
  -> 结果输出给风控规则引擎或 GraphRAG 上下文组装
```

Neo4j 实战的核心收获不是"学会Cypher语法"，而是理解图遍历的机制优势和多跳路径的表达简洁度，以及它的边界——图提供关系线索，不替代业务判断。下一节讨论图数据库架构，对比Neo4j原生架构和NebulaGraph分布式架构的机制差异。