# 项目 4 运行记录模板

## 环境

- 对象存储 / 本地 warehouse：
- Iceberg Catalog：
- Spark 版本：
- Trino 版本：
- 表格式版本：

## 静态检查

```bash
project-workbench/projects/04-mini-lakehouse/run.sh
```

- 检查结果：
- 未验证运行时：

## Iceberg 注册

- DDL 文件：`iceberg/orders.sql`
- Catalog 名称：
- Warehouse 路径：
- 表创建结果：
- 当前快照 ID：

## Spark 转换

- SQL 文件：`spark/build-order-items-wide.sql`
- 输入表：
- 输出表：
- 写入模式：
- 转换行数：

## Trino 查询

- SQL 文件：`trino/orders-analysis.sql`
- 查询耗时：
- 扫描分区：
- 返回行数：

## 演化记录

| 变更 | 是否执行 | 影响 | 回滚方式 |
| --- | --- | --- | --- |
| Schema 演化 |  |  |  |
| 分区演化 |  |  |  |

## 结论

- 本次是否只是静态检查：
- 本次是否真实运行 Spark/Trino/Iceberg：
- 仍需治理或调度系统补齐的边界：
