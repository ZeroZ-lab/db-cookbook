<template>
  <div class="sql-sandbox">
    <div class="sql-header">
      <span class="sql-badge">SQL 沙盒</span>
      <select v-model="selectedQuery" class="sql-select" @change="loadQuery">
        <option value="">-- 选择示例查询 --</option>
        <option v-for="(q, i) in queries" :key="i" :value="i">{{ q.label }}</option>
      </select>
      <button class="sql-run-btn" @click="runSql" :disabled="loading">
        {{ loading ? '加载中...' : '▶ 运行' }}
      </button>
    </div>
    <textarea
      v-model="sql"
      class="sql-editor"
      rows="6"
      spellcheck="false"
      placeholder="输入 SQL 查询..."
    />
    <div v-if="error" class="sql-error">{{ error }}</div>
    <div v-if="results.length" class="sql-results">
      <div class="sql-result-info">{{ resultInfo }}</div>
      <div class="sql-table-wrap">
        <table>
          <thead>
            <tr>
              <th v-for="col in columns" :key="col">{{ col }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in displayRows" :key="i">
              <td v-for="col in columns" :key="col">{{ row[col] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="results.length > 50" class="sql-truncated">显示前 50 行（共 {{ results.length }} 行）</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const sql = ref('')
const results = ref([])
const columns = ref([])
const error = ref('')
const loading = ref(true)
const selectedQuery = ref('')
const resultInfo = ref('')

const queries = [
  { label: '2.1 基础查询：最近已支付订单', sql: `-- 查询最近 10 笔已支付订单\nSELECT order_id, user_id, total_amount, paid_at\nFROM orders\nWHERE order_status = 'paid'\nORDER BY paid_at DESC\nLIMIT 10;` },
  { label: '2.2 聚合分析：每日 GMV', sql: `-- 按天统计 GMV 和订单数\nSELECT\n  DATE(paid_at) AS day,\n  COUNT(*) AS order_count,\n  SUM(total_amount) AS gmv\nFROM orders\nWHERE order_status = 'paid'\nGROUP BY DATE(paid_at)\nORDER BY day;` },
  { label: '2.3 多表关联：订单明细报表', sql: `-- 订单 + 用户 + 商品 多表关联\nSELECT\n  o.order_id,\n  u.name AS user_name,\n  p.product_name,\n  oi.quantity,\n  oi.item_amount\nFROM order_items oi\nJOIN orders o ON o.order_id = oi.order_id\nJOIN users u ON u.user_id = o.user_id\nJOIN products p ON p.product_id = oi.product_id\nORDER BY o.order_id, oi.order_item_id;` },
  { label: '2.4 CTE：用户消费排名', sql: `-- 用 CTE 计算每位用户的总消费额\nWITH user_gmv AS (\n  SELECT\n    u.user_id,\n    u.name,\n    COALESCE(SUM(o.total_amount), 0) AS total_gmv\n  FROM users u\n  LEFT JOIN orders o ON o.user_id = u.user_id\n    AND o.order_status = 'paid'\n  GROUP BY u.user_id, u.name\n)\nSELECT * FROM user_gmv ORDER BY total_gmv DESC;` },
  { label: '2.5 窗口函数：每笔订单是用户的第几单', sql: `-- ROW_NUMBER 标记每笔订单在用户内的序号\nSELECT\n  o.order_id,\n  u.name,\n  o.total_amount,\n  ROW_NUMBER() OVER (\n    PARTITION BY o.user_id\n    ORDER BY o.created_at\n  ) AS user_order_seq\nFROM orders o\nJOIN users u ON u.user_id = o.user_id\nORDER BY u.name, user_order_seq;` },
  { label: '2.6 指标 SQL：DAU', sql: `-- 统计每日活跃用户数（打开 APP 为活跃）\nSELECT\n  DATE(event_time) AS day,\n  COUNT(DISTINCT user_id) AS dau\nFROM events\nWHERE event_name = 'app_open'\nGROUP BY DATE(event_time)\nORDER BY day;` },
  { label: '自由练习：试试看', sql: `-- 试试查询所有商品\nSELECT * FROM products;\n\n-- 或者：哪些用户还没下过单？\n-- SELECT u.name FROM users u\n-- LEFT JOIN orders o ON o.user_id = u.user_id\n-- WHERE o.order_id IS NULL;` }
]

const displayRows = ref([])

let db = null

onMounted(async () => {
  try {
    const initSqlJs = (await import('sql.js')).default
    const SQL = await initSqlJs({
      locateFile: f => `https://sql.js.org/dist/${f}`
    })
    db = new SQL.Database()

    // Load ecommerce schema
    const schema = `
      CREATE TABLE users (user_id INT PRIMARY KEY, name TEXT, email TEXT, channel TEXT, user_level TEXT, registered_at TIMESTAMP);
      INSERT INTO users VALUES (1,'Alice','alice@example.com','organic','gold','2026-01-15');
      INSERT INTO users VALUES (2,'Bob','bob@example.com','paid','silver','2026-02-20');
      INSERT INTO users VALUES (3,'Carol','carol@example.com','organic','bronze','2026-03-01');
      INSERT INTO users VALUES (4,'David','david@example.com','referral','gold','2026-03-10');

      CREATE TABLE products (product_id INT PRIMARY KEY, product_name TEXT, category TEXT, list_price DECIMAL(10,2));
      INSERT INTO products VALUES (1,'MacBook Pro 14','electronics',14999.00);
      INSERT INTO products VALUES (2,'AirPods Pro','electronics',1899.00);
      INSERT INTO products VALUES (3,'数据密集型应用系统设计','books',119.00);
      INSERT INTO products VALUES (4,'设计数据密集型应用','books',89.00);

      CREATE TABLE orders (order_id INT PRIMARY KEY, user_id INT, order_status TEXT, total_amount DECIMAL(10,2), created_at TIMESTAMP, paid_at TIMESTAMP);
      INSERT INTO orders VALUES (1001,1,'paid',16898.00,'2026-04-01 10:30:00','2026-04-01 10:31:00');
      INSERT INTO orders VALUES (1002,2,'paid',1899.00,'2026-04-02 14:20:00','2026-04-02 14:21:00');
      INSERT INTO orders VALUES (1003,1,'paid',119.00,'2026-04-03 09:15:00','2026-04-03 09:16:00');
      INSERT INTO orders VALUES (1004,3,'paid',14999.00,'2026-04-04 16:45:00','2026-04-04 16:46:00');
      INSERT INTO orders VALUES (1005,4,'created',208.00,'2026-04-05 11:00:00',NULL);

      CREATE TABLE order_items (order_item_id INT PRIMARY KEY, order_id INT, product_id INT, quantity INT, item_amount DECIMAL(10,2));
      INSERT INTO order_items VALUES (1,1001,1,1,14999.00);
      INSERT INTO order_items VALUES (2,1001,4,1,89.00);
      INSERT INTO order_items VALUES (3,1001,2,1,1899.00);
      INSERT INTO order_items VALUES (4,1002,2,1,1899.00);
      INSERT INTO order_items VALUES (5,1003,3,1,119.00);
      INSERT INTO order_items VALUES (6,1004,1,1,14999.00);
      INSERT INTO order_items VALUES (7,1005,3,1,119.00);
      INSERT INTO order_items VALUES (8,1005,4,1,89.00);

      CREATE TABLE payments (payment_id INT PRIMARY KEY, order_id INT, payment_status TEXT, payment_method TEXT, paid_amount DECIMAL(10,2), paid_at TIMESTAMP);
      INSERT INTO payments VALUES (1,1001,'completed','credit_card',16898.00,'2026-04-01 10:31:00');
      INSERT INTO payments VALUES (2,1002,'completed','wechat',1899.00,'2026-04-02 14:21:00');
      INSERT INTO payments VALUES (3,1003,'completed','credit_card',119.00,'2026-04-03 09:16:00');
      INSERT INTO payments VALUES (4,1004,'completed','alipay',14999.00,'2026-04-04 16:46:00');

      CREATE TABLE events (event_id INT PRIMARY KEY, user_id INT, event_name TEXT, product_id INT, event_time TIMESTAMP);
      INSERT INTO events VALUES (1,1,'app_open',NULL,'2026-04-01 10:25:00');
      INSERT INTO events VALUES (2,1,'view_product',1,'2026-04-01 10:27:00');
      INSERT INTO events VALUES (3,1,'purchase',1,'2026-04-01 10:30:00');
      INSERT INTO events VALUES (4,2,'app_open',NULL,'2026-04-02 14:10:00');
      INSERT INTO events VALUES (5,2,'view_product',2,'2026-04-02 14:15:00');
      INSERT INTO events VALUES (6,2,'purchase',2,'2026-04-02 14:20:00');
      INSERT INTO events VALUES (7,1,'app_open',NULL,'2026-04-03 09:10:00');
      INSERT INTO events VALUES (8,3,'app_open',NULL,'2026-04-04 16:30:00');
      INSERT INTO events VALUES (9,4,'app_open',NULL,'2026-04-05 10:50:00');
    `
    db.run(schema)
    loading.value = false
  } catch (e) {
    error.value = '数据库加载失败: ' + e.message
    loading.value = false
  }
})

function loadQuery() {
  if (selectedQuery.value === '') return
  sql.value = queries[Number(selectedQuery.value)].sql
}

function runSql() {
  if (!db) { error.value = '数据库未加载'; return }
  error.value = ''
  results.value = []
  columns.value = []

  try {
    const stmt = db.prepare(sql.value)
    const cols = stmt.getColumnNames()
    const rows = []
    while (stmt.step()) {
      rows.push(stmt.getAsObject())
    }
    stmt.free()

    if (cols.length === 0 && rows.length === 0) {
      // Non-SELECT statement
      resultInfo.value = `执行成功，影响 ${db.getRowsModified()} 行`
      return
    }

    columns.value = cols
    results.value = rows
    displayRows.value = rows.slice(0, 50)
    resultInfo.value = `${rows.length} 行`
  } catch (e) {
    error.value = e.message
  }
}
</script>

<style scoped>
.sql-sandbox {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 20px 0;
  font-size: 14px;
}
.sql-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.sql-badge {
  background: var(--vp-c-brand-1);
  color: #fff;
  padding: 2px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}
.sql-select {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
}
.sql-run-btn {
  padding: 5px 16px;
  background: var(--vp-c-brand-1);
  color: #fff;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}
.sql-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.sql-run-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.sql-editor {
  width: 100%;
  padding: 12px 14px;
  border: none;
  resize: vertical;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  outline: none;
}
.sql-error {
  padding: 8px 14px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 13px;
}
:root.dark .sql-error { background: #2d1215; }
.sql-results { border-top: 1px solid var(--vp-c-divider); }
.sql-result-info {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
}
.sql-table-wrap { overflow-x: auto; }
.sql-results table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.sql-results th {
  padding: 6px 12px;
  text-align: left;
  background: var(--vp-c-bg-soft);
  border-bottom: 2px solid var(--vp-c-divider);
  font-weight: 600;
  white-space: nowrap;
}
.sql-results td {
  padding: 5px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}
.sql-truncated {
  padding: 6px 14px;
  font-size: 12px;
  color: var(--vp-c-text-3);
  text-align: center;
}
</style>
