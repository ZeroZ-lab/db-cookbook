# 项目 1 运行记录

## 环境

- 日期：
- 操作系统：
- PostgreSQL 版本：
- `psql` 路径：
- Docker / PostgreSQL 容器版本（如使用 Docker）：
- 数据库名：

## 执行命令

```bash
bash project-workbench/projects/01-postgresql-analytics/run.sh
```

或：

```bash
docker compose -f project-workbench/projects/01-postgresql-analytics/docker-compose.yml up -d
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=db_cookbook PGPASSWORD=db_cookbook DB_NAME=db_cookbook_lab \
  bash project-workbench/projects/01-postgresql-analytics/run.sh
```

## 结果记录

- [ ] schema 创建成功。
- [ ] 样例数据写入成功。
- [ ] 第 2 章查询全部执行成功。
- [ ] 无 SQL 报错。
- [ ] 至少保存 3 条 `EXPLAIN` 结果。

## 异常

记录失败 SQL、错误信息、修复方式和重跑结果。

## 复盘

- 哪些查询说明 PostgreSQL 足够胜任？
- 哪些查询开始需要索引、分区或物化视图？
- 哪些分析需求应该迁移到 OLAP 系统？
