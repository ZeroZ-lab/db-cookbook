import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const matrixPath = path.join(root, 'docs', 'fact-check-matrix.md');
const evidencePath = path.join(root, 'docs', 'fact-check-evidence.md');
const registerPath = path.join(root, 'docs', 'fact-check-register.json');
const recordsDir = path.join(root, 'docs', 'fact-check-records');

const register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
const matrix = fs.readFileSync(matrixPath, 'utf8');
const evidence = fs.readFileSync(evidencePath, 'utf8');

const scanFiles = [
  'README.md',
  'manuscript/README.md',
  'docs/completion-audit.md',
  'docs/objective-coverage-map.md',
  'docs/fact-check-matrix.md',
  'docs/fact-check-evidence.md',
  'site/projects.md'
];

const forbiddenClaims = [
  '事实核查已全部完成',
  '事实核查已最终关闭',
  '全部条目与官方文档一致',
  '无需修正文字',
  'all-officially-checked',
  'no-change-needed'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stripForbiddenExamples(text) {
  return text
    .replace(/### 不允许说[\s\S]*?(?=^## |\Z)/m, '')
    .replace(/不能说：[\s\S]*$/m, '');
}

for (const item of register.items) {
  const recordPath = path.join(recordsDir, `${item.id}.md`);
  const record = fs.readFileSync(recordPath, 'utf8');

  assert(record.includes('完成判断：未完成'), `${item.id} record must remain explicitly open`);
  assert(matrix.includes(item.id), `Matrix missing item id ${item.id}`);
  assert(evidence.includes(`## ${item.id}`), `Evidence missing section ${item.id}`);

  if (item.status === 'initial-checked-needs-chapter-record') {
    assert(
      !record.includes('完成判断：已完成') && !record.includes('最终关闭'),
      `${item.id} cannot claim final completion while register status is initial-checked-needs-chapter-record`
    );
  }
}

for (const relativePath of scanFiles) {
  const text = stripForbiddenExamples(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  assert(
    text.includes('事实核查为初核，不是出版最终关闭。') || relativePath === 'docs/fact-check-matrix.md' || relativePath === 'docs/fact-check-evidence.md',
    `${relativePath} must preserve the initial-check boundary`
  );
  for (const claim of forbiddenClaims) {
    assert(!text.includes(claim), `${relativePath} contains forbidden fact-check closure claim: ${claim}`);
  }
}

console.log('Fact-check closure boundaries: ok');
