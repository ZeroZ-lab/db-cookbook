import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const contractPath = path.join(root, 'docs', 'status-language-contract.json');
const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));

const requiredBoundaryFiles = [
  'README.md',
  'manuscript/README.md',
  'site/projects.md'
];

const claimScanFiles = [
  'README.md',
  'manuscript/README.md',
  'manuscript/PROGRESS_TRACKER.md',
  'docs/completion-audit.md',
  'docs/objective-coverage-map.md',
  'docs/project-runbook.md',
  'site/projects.md'
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

for (const [key, relativePath] of Object.entries(contract.sourcesOfTruth)) {
  assert(fs.existsSync(path.join(root, relativePath)), `Missing source-of-truth file for ${key}: ${relativePath}`);
}

for (const relativePath of requiredBoundaryFiles) {
  const text = fs.readFileSync(path.join(root, relativePath), 'utf8');
  for (const claim of contract.requiredBoundaryClaims) {
    assert(text.includes(claim), `${relativePath} missing required boundary claim: ${claim}`);
  }
}

const progressTracker = fs.readFileSync(path.join(root, 'manuscript/PROGRESS_TRACKER.md'), 'utf8');
assert(progressTracker.includes('本文件不再承担 `db-cookbook` 的完成度声明职责。'), 'PROGRESS_TRACKER must be downgraded from completion source');
assert(progressTracker.includes('唯一状态源'), 'PROGRESS_TRACKER must point to source-of-truth files');

for (const relativePath of claimScanFiles) {
  const text = stripForbiddenExamples(fs.readFileSync(path.join(root, relativePath), 'utf8'));
  for (const claim of contract.forbiddenGlobalClaims) {
    assert(!text.includes(claim), `${relativePath} contains forbidden global claim: ${claim}`);
  }
}

const completionAudit = fs.readFileSync(path.join(root, 'docs/completion-audit.md'), 'utf8');
assert(completionAudit.includes('### 允许说'), 'completion-audit must include allowed claims block');
assert(completionAudit.includes('### 不允许说'), 'completion-audit must include forbidden claims block');

const objectiveCoverage = fs.readFileSync(path.join(root, 'docs/objective-coverage-map.md'), 'utf8');
assert(objectiveCoverage.includes('状态口径源'), 'objective-coverage-map must declare source-of-truth mapping');

console.log('Status language and source-of-truth boundaries: ok');
