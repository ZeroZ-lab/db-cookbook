import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const registerPath = path.join(root, 'docs/fact-check-register.json');
const outputDir = path.join(root, 'docs/fact-check-records');
const register = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
const force = process.argv.includes('--force');

const statusLabels = new Map([
  ['initial-checked-needs-chapter-record', '已初核，需逐章留存处理记录'],
  ['pending-chapter-check', '待逐章核查'],
  ['partial-initial-check', '部分初核，其他待逐章核查']
]);

fs.mkdirSync(outputDir, { recursive: true });

for (const item of register.items) {
  const file = path.join(outputDir, `${item.id}.md`);
  if (fs.existsSync(file) && !force) {
    continue;
  }

  const sourceList = item.sourceUrls.map((url) => `- ${url}`).join('\n');
  const chapterList = item.chapterFiles.map((chapterFile) => `- ${chapterFile}`).join('\n');
  const status = statusLabels.get(item.status) ?? item.status;

  const text = `# ${item.id} ${item.topic}

## 核查状态

- 当前状态：${status}
- 完成判断：未完成。需要逐章打开来源、定位章节表述、记录处理动作后才能关闭。
- 对应章节：${item.chapters.join('、')}

## 官方来源

${sourceList}

## 章节文件

${chapterList}

## 待核查判断

- 章节中的术语和机制描述是否与官方来源一致。
- 章节中的边界表述是否过度概括。
- 如果官方来源只支持局部能力，章节是否需要降级为作者经验判断。

## 章节处理记录

| 章节文件 | 段落或关键词 | 处理动作 | 处理说明 |
| --- | --- | --- | --- |
${item.chapterFiles.map((chapterFile) => `| ${chapterFile} | 待定位 | 待核查 | 尚未完成逐章处理记录 |`).join('\n')}

## 剩余风险

- 版本差异：来源版本和章节写作时的产品版本可能不同。
- 实现差异：不同部署、引擎、连接器或索引参数可能改变实际行为。
- 表述风险：章节需要避免把经验判断写成官方保证。
`;

  fs.writeFileSync(file, text);
}

console.log(`Generated fact-check records into docs/fact-check-records/${force ? ' with --force' : ' without overwriting existing records'}`);
