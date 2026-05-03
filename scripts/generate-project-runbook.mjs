import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'project-workbench', 'project-manifest.json');
const outputPath = path.join(root, 'docs', 'project-runbook.md');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function mdLink(label, target) {
  return `[${label}](${target})`;
}

assert(fs.existsSync(manifestPath), 'Missing project manifest');
const manifest = readJson(manifestPath);
assert(Array.isArray(manifest.projects), 'Manifest must include projects array');

const lines = [];
lines.push('# 项目实战执行总表');
lines.push('');
lines.push('本文档由 `node scripts/generate-project-runbook.mjs` 从 `project-workbench/project-manifest.json` 生成，用来把第 14 章七个项目的运行状态、必需产物、阻塞项和验收证据放到一个可检查入口。');
lines.push('');
lines.push('它不是端到端运行成功声明。`runtimeStatus` 只能使用 manifest 中允许的状态，所有阻塞项必须显式保留，直到对应项目真正跑通并留下运行记录。');
lines.push('');
lines.push('## 状态约束');
lines.push('');
lines.push('| 类型 | 值 |');
lines.push('| --- | --- |');
lines.push(`| 允许状态 | ${(manifest.runtimeStatusContract?.allowedStatuses ?? []).map((item) => `\`${item}\``).join(', ')} |`);
lines.push(`| 禁止状态 | ${(manifest.runtimeStatusContract?.forbiddenStatuses ?? []).map((item) => `\`${item}\``).join(', ')} |`);
lines.push('');
lines.push('## 项目总览');
lines.push('');
lines.push('| 项目 | 阶段 | 当前状态 | 阻塞数量 | 交付物数量 |');
lines.push('| --- | --- | --- | --- | --- |');

for (const project of manifest.projects) {
  const projectPath = `../project-workbench/${project.directory}/README.md`;
  lines.push(`| ${mdLink(project.title, projectPath)} | ${project.stage} | \`${project.runtimeStatus}\` | ${project.blockedBy.length} | ${project.requiredArtifacts.length} |`);
}

lines.push('');
lines.push('## 逐项目执行卡');
lines.push('');

for (const project of manifest.projects) {
  const projectBase = `../project-workbench/${project.directory}`;
  lines.push(`### ${project.id} ${project.title}`);
  lines.push('');
  lines.push(`- 阶段：${project.stage}`);
  lines.push(`- 当前状态：\`${project.runtimeStatus}\``);
  lines.push(`- 项目说明：${mdLink('README.md', `${projectBase}/README.md`)}`);
  lines.push(`- 交付清单：${mdLink('DELIVERABLES.md', `${projectBase}/DELIVERABLES.md`)}`);
  lines.push('');
  lines.push('阻塞项：');
  lines.push('');
  for (const blocker of project.blockedBy) {
    lines.push(`- ${blocker}`);
  }
  lines.push('');
  lines.push('必需产物：');
  lines.push('');
  for (const artifact of project.requiredArtifacts) {
    lines.push(`- ${mdLink(artifact, `${projectBase}/${artifact}`)}`);
  }
  lines.push('');
}

lines.push('## 验证命令');
lines.push('');
lines.push('```bash');
lines.push('pnpm projects:verify');
lines.push('pnpm verify');
lines.push('```');
lines.push('');
lines.push('`pnpm projects:verify` 只证明项目目录、交付清单、关键 SQL / JSON / 文档和 manifest 状态一致；不证明数据库、消息队列、计算引擎或 AI 检索链路已经真实运行。');
lines.push('');

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join('\n')}\n`);
console.log(`Generated ${path.relative(root, outputPath)}`);
