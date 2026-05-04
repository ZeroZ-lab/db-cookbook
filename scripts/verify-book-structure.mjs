import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const chapters = [
  'manuscript/chapter-00-positioning.md',
  'manuscript/part-01-postgresql-foundations/chapter-01.md',
  'manuscript/chapter-02-sql-analysis.md',
  'manuscript/chapter-03-postgresql-large-tables.md',
  'manuscript/chapter-04-oltp-olap.md',
  'manuscript/chapter-05-data-warehouse-modeling.md',
  'manuscript/chapter-06-etl-elt.md',
  'manuscript/chapter-07-batch-processing.md',
  'manuscript/chapter-08-stream-processing.md',
  'manuscript/chapter-09-olap-databases.md',
  'manuscript/chapter-10-vector-databases.md',
  'manuscript/chapter-11-graph-databases.md',
  'manuscript/chapter-12-lakehouse.md',
  'manuscript/chapter-13-data-governance.md',
  'manuscript/chapter-14-projects.md',
  'manuscript/chapter-15-learning-order.md',
  'manuscript/chapter-16-capability-map.md',
  'manuscript/chapter-17-final-goals.md'
];

const requiredHeadings = [
  '问题切入',
  '核心判断',
  '机制解释',
  '系统位置',
  '场景案例',
  '常见误区',
  '实战任务',
  '小结引出下一章'
];

const minimumSectionLengths = new Map([
  ['核心判断', 60],
  ['小结引出下一章', 20]
]);

function getSection(text, heading) {
  const marker = `## ${heading}`;
  const start = text.indexOf(marker);
  if (start === -1) return '';
  const contentStart = start + marker.length;
  const rest = text.slice(contentStart);
  const nextMarkerOffset = rest.search(/\n## /);
  if (nextMarkerOffset === -1) {
    return rest.trim();
  }
  return rest.slice(0, nextMarkerOffset).trim();
}

function countListItems(text) {
  return text
    .split('\n')
    .filter((line) => /^(\d+\. |- |\* )/.test(line.trim()))
    .length;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

for (const chapter of chapters) {
  const file = path.join(root, chapter);
  const markdown = fs.readFileSync(file, 'utf8');

  for (const heading of requiredHeadings) {
    assert(new RegExp(`^## ${heading}$`, 'm').test(markdown), `${chapter}: missing heading ${heading}`);
    const section = getSection(markdown, heading);
    const minLength = minimumSectionLengths.get(heading) ?? 80;
    assert(section.length >= minLength, `${chapter}: section ${heading} is too short to be meaningful`);
  }

  assert(/\| .+ \|/.test(markdown), `${chapter}: missing markdown table`);
  assert(markdown.includes('```'), `${chapter}: missing code block`);

  const scenarioSection = getSection(markdown, '场景案例');
  assert(
    (/```/.test(scenarioSection) || /\| .+ \|/.test(scenarioSection) || countListItems(scenarioSection) >= 1),
    `${chapter}: 场景案例 section must include structural evidence such as code, table, or steps`
  );

  const misconceptionSection = getSection(markdown, '常见误区');
  const misconceptionCount = (misconceptionSection.match(/误区[一二三四五六七八九十]|\*\*误区/g) ?? []).length;
  assert(misconceptionCount >= 3, `${chapter}: 常见误区 section must include at least 3 misconceptions`);

  const taskSection = getSection(markdown, '实战任务');
  assert(
    countListItems(taskSection) >= 2 && /(观察|复盘|对比|验证|运行|设计|回答|画|检查|判断|定位|说明)/.test(taskSection),
    `${chapter}: 实战任务 section must include steps plus validation signals`
  );

  const systemSection = getSection(markdown, '系统位置');
  assert(
    /(上一章|下一章|承接|引出|迁移|平台|链路|系统)/.test(systemSection) || /(上一章|下一章|承接|引出|迁移|平台|链路|系统)/.test(markdown),
    `${chapter}: 系统位置 section must explain placement in the larger system`
  );

  console.log(`${chapter}: ok`);
}
