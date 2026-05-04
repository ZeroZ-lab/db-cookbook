# 全书进度追踪说明

本文件不再承担 `db-cookbook` 的完成度声明职责。

之前这里混入了互相冲突的完成口径，例如：

- 把“章节文件存在”和“出版级完成”混写在一起。
- 把“自动验证通过”和“内容最终定稿”混写在一起。
- 把“章节已覆盖”和“项目已跑通”混写在一起。

为避免后续继续基于失真状态做判断，本文件从现在起只保留状态路由，不再记录百分比、总字数估算或“全书已完成”式结论。

## 唯一状态源

- 内容完成度：见 [docs/completion-audit.md](../docs/completion-audit.md)
- 目标拆解与覆盖映射：见 [docs/objective-coverage-map.md](../docs/objective-coverage-map.md)
- 项目实战运行状态：见 [project-workbench/project-manifest.json](../project-workbench/project-manifest.json)
- 事实核查状态：见 [docs/fact-check-matrix.md](../docs/fact-check-matrix.md)

## 当前边界

- 书稿已形成完整路线。
- 自动验证已通过。
- 项目实战大多仍是可检查骨架，不是端到端可运行工程。
- 事实核查为初核，不是出版最终关闭。

## 中间素材说明

`manuscript/chapter-xx-section-yy-complete.md` 属于扩写中间素材，不再作为完成度依据，也不作为对外阅读入口。

正式正文以 `manuscript/` 下的 0-17 章正式文件为准，阅读入口见 [manuscript/README.md](README.md)。
