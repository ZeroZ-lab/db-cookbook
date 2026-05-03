import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const file = path.join(root, 'docs/fact-check-matrix.md');
const evidenceFile = path.join(root, 'docs/fact-check-evidence.md');
const registerFile = path.join(root, 'docs/fact-check-register.json');
const recordsDir = path.join(root, 'docs/fact-check-records');
const text = fs.readFileSync(file, 'utf8');
const evidence = fs.readFileSync(evidenceFile, 'utf8');
const register = JSON.parse(fs.readFileSync(registerFile, 'utf8'));

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const rows = text
  .split('\n')
  .filter((line) => /^\| FC-\d{3} \|/.test(line));

assert(rows.length === 18, `Expected 18 fact-check rows, found ${rows.length}`);
assert(register.schemaVersion === 1, 'Fact-check register schemaVersion must be 1');
assert(Array.isArray(register.items), 'Fact-check register must include items array');
assert(register.items.length === 18, `Expected 18 fact-check register items, found ${register.items.length}`);
assert(fs.existsSync(recordsDir), 'Missing fact-check records directory');

const allowedRegisterStatuses = new Set(register.statusContract?.allowedStatuses ?? []);
assert(allowedRegisterStatuses.size > 0, 'Fact-check register must define allowed statuses');

for (let i = 1; i <= 18; i += 1) {
  const id = `FC-${String(i).padStart(3, '0')}`;
  assert(rows.some((row) => row.startsWith(`| ${id} |`)), `Missing fact-check row: ${id}`);
  assert(evidence.includes(`## ${id}`), `Missing fact-check evidence entry: ${id}`);
  assert(register.items.some((item) => item.id === id), `Missing fact-check register item: ${id}`);
  assert(fs.existsSync(path.join(recordsDir, `${id}.md`)), `Missing fact-check record file: ${id}.md`);
}

const forbiddenClaims = [
  '✅ 已验证',
  '全部 18 条逐条核查',
  '全部条目与官方文档一致',
  '无需修正文字',
  '事实核查已完成'
];

for (const claim of forbiddenClaims) {
  assert(!text.includes(claim), `Fact-check matrix contains unsupported completion claim: ${claim}`);
}

const allowedStatuses = [
  '已初核，需逐章留存处理记录',
  '待逐章核查',
  '部分初核，其他待逐章核查'
];

for (const row of rows) {
  const columns = row.split('|').map((value) => value.trim());
  const id = columns[1];
  const status = columns[6];
  assert(allowedStatuses.includes(status), `Unexpected status for ${id}: ${status}`);
}

const statusMap = new Map([
  ['已初核，需逐章留存处理记录', 'initial-checked-needs-chapter-record'],
  ['待逐章核查', 'pending-chapter-check'],
  ['部分初核，其他待逐章核查', 'partial-initial-check']
]);

for (const item of register.items) {
  assert(/^FC-\d{3}$/.test(item.id), `Invalid fact-check id: ${item.id}`);
  assert(item.topic, `Fact-check register item ${item.id} missing topic`);
  assert(Array.isArray(item.chapters) && item.chapters.length > 0, `Fact-check register item ${item.id} missing chapters`);
  assert(Array.isArray(item.chapterFiles) && item.chapterFiles.length > 0, `Fact-check register item ${item.id} missing chapterFiles`);
  assert(Array.isArray(item.sourceUrls) && item.sourceUrls.length > 0, `Fact-check register item ${item.id} missing sourceUrls`);
  assert(allowedRegisterStatuses.has(item.status), `Fact-check register item ${item.id} has unsupported status`);
  assert(item.requiresChapterRecord === true, `Fact-check register item ${item.id} must require chapter record`);

  for (const chapterFile of item.chapterFiles) {
    assert(fs.existsSync(path.join(root, chapterFile)), `Fact-check register item ${item.id} references missing chapter file: ${chapterFile}`);
  }
  for (const url of item.sourceUrls) {
    assert(/^https:\/\/.+/.test(url), `Fact-check register item ${item.id} source must be an https URL: ${url}`);
  }

  const matrixRow = rows.find((row) => row.startsWith(`| ${item.id} |`));
  const matrixColumns = matrixRow.split('|').map((value) => value.trim());
  assert(statusMap.get(matrixColumns[6]) === item.status, `Fact-check register item ${item.id} status does not match matrix`);

  const recordPath = path.join(recordsDir, `${item.id}.md`);
  const record = fs.readFileSync(recordPath, 'utf8');
  assert(record.includes(`# ${item.id} ${item.topic}`), `Fact-check record ${item.id} missing title`);
  assert(record.includes('完成判断：未完成'), `Fact-check record ${item.id} must not claim completion`);
  assert(record.includes('## 官方来源'), `Fact-check record ${item.id} missing source section`);
  assert(record.includes('## 章节文件'), `Fact-check record ${item.id} missing chapter file section`);
  assert(record.includes('## 章节处理记录'), `Fact-check record ${item.id} missing chapter processing section`);
  for (const url of item.sourceUrls) {
    assert(record.includes(url), `Fact-check record ${item.id} missing source URL: ${url}`);
  }
  for (const chapterFile of item.chapterFiles) {
    assert(record.includes(chapterFile), `Fact-check record ${item.id} missing chapter file: ${chapterFile}`);
  }
}

console.log('Fact-check matrix structure and status claims: ok');
