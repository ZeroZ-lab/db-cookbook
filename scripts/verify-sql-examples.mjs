import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const schemaFile = path.join(root, 'site/public/examples/ecommerce-postgres.sql');
const queryFile = path.join(root, 'site/public/examples/chapter-02-queries.sql');

const schemaSql = fs.readFileSync(schemaFile, 'utf8');
const querySql = fs.readFileSync(queryFile, 'utf8');

const expectedSchema = {
  users: ['user_id', 'name', 'email', 'channel', 'user_level', 'registered_at'],
  products: ['product_id', 'product_name', 'category', 'list_price'],
  orders: ['order_id', 'user_id', 'order_status', 'total_amount', 'created_at', 'paid_at'],
  order_items: ['order_item_id', 'order_id', 'product_id', 'quantity', 'item_amount'],
  payments: ['payment_id', 'order_id', 'payment_status', 'payment_method', 'paid_amount', 'paid_at'],
  events: ['event_id', 'user_id', 'event_name', 'product_id', 'event_time']
};

const expectedQueryReferences = {
  users: ['user_id', 'name'],
  products: ['product_id', 'product_name'],
  orders: ['order_id', 'user_id', 'total_amount', 'order_status', 'created_at'],
  order_items: ['order_item_id', 'order_id', 'product_id', 'quantity', 'item_amount'],
  events: ['user_id', 'event_name', 'event_time']
};

function extractCreateTables(sql) {
  const tables = new Map();
  const createTablePattern = /CREATE TABLE\s+([a-z_]+)\s*\(([\s\S]*?)\n\);/g;
  let match;

  while ((match = createTablePattern.exec(sql)) !== null) {
    const [, table, body] = match;
    const columns = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('CONSTRAINT'))
      .map((line) => line.replace(/,$/, '').split(/\s+/)[0])
      .filter((name) => /^[a-z_][a-z0-9_]*$/.test(name));

    tables.set(table, new Set(columns));
  }

  return tables;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const schema = extractCreateTables(schemaSql);

for (const [table, columns] of Object.entries(expectedSchema)) {
  assert(schema.has(table), `Missing table in schema: ${table}`);
  for (const column of columns) {
    assert(schema.get(table).has(column), `Missing column in ${table}: ${column}`);
  }
}

for (const [table, columns] of Object.entries(expectedQueryReferences)) {
  assert(
    new RegExp(`\\bFROM\\s+${table}\\b|\\bJOIN\\s+${table}\\b`, 'i').test(querySql),
    `Query file does not reference table: ${table}`
  );
  for (const column of columns) {
    assert(
      new RegExp(`\\b${column}\\b`, 'i').test(querySql),
      `Query file does not reference expected column ${table}.${column}`
    );
    assert(schema.get(table).has(column), `Query expectation references missing schema column ${table}.${column}`);
  }
}

const requiredSections = [
  '2.1 基础查询',
  '2.2 聚合分析',
  '2.3 多表关联',
  '2.4 CTE',
  '2.5 窗口函数',
  '2.6 指标 SQL'
];

for (const section of requiredSections) {
  assert(querySql.includes(section), `Missing query section: ${section}`);
}

console.log('SQL example schema and query references: ok');

