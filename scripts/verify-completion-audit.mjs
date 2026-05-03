import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const completionAudit = fs.readFileSync(path.join(root, 'docs/completion-audit.md'), 'utf8');
const coverageMap = fs.readFileSync(path.join(root, 'docs/objective-coverage-map.md'), 'utf8');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const requiredAuditPhrases = [
  'SQL 真实数据库执行尚未在当前环境完成',
  '项目实战仍是可检查骨架、状态表和交付清单，不是完整可运行系统',
  '事实核查仍需可复核证据闭环',
  '出版级编辑',
  '当前环境未发现 `psql` / `createdb` / `docker`',
  '真实执行需要本机具备相应数据库环境'
];

for (const phrase of requiredAuditPhrases) {
  assert(completionAudit.includes(phrase), `Completion audit missing required boundary: ${phrase}`);
}

const requiredCoveragePhrases = [
  '不能说',
  'PostgreSQL 样例已在当前环境真实执行通过',
  '事实核查已全部完成',
  '七个项目已经是完整可运行工程',
  '全书已经达到出版最终定稿'
];

for (const phrase of requiredCoveragePhrases) {
  assert(coverageMap.includes(phrase), `Objective coverage map missing required boundary: ${phrase}`);
}

const forbiddenClaims = [
  'SQL 已真实执行',
  '事实核查已完成',
  '出版最终定稿已完成',
  '七个项目已经完整可运行'
];

for (const claim of forbiddenClaims) {
  assert(!completionAudit.includes(claim), `Completion audit contains unsupported completion claim: ${claim}`);
  assert(!coverageMap.includes(claim), `Objective coverage map contains unsupported completion claim: ${claim}`);
}

console.log('Completion audit boundaries: ok');
