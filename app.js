/**
 * SQL Terminal — app.js
 * Full-featured browser SQL terminal powered by sql.js (SQLite WASM)
 * Data persists in localStorage across page refreshes
 */

// ============================================
// Constants & State
// ============================================
const DB_STORAGE_KEY = 'sql_terminal_db';
const HISTORY_STORAGE_KEY = 'sql_terminal_history';
const MAX_HISTORY = 50;

let db = null;
let queryHistory = [];

// ============================================
// DOM References
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const els = {
  loading: $('#loadingOverlay'),
  sidebar: $('#sidebar'),
  sidebarToggle: $('#sidebarToggle'),
  sidebarOverlay: $('#sidebarOverlay'),
  tablesList: $('#tablesList'),
  tableCount: $('#tableCount'),
  historyList: $('#historyList'),
  historyCount: $('#historyCount'),
  editor: $('#sqlEditor'),
  runBtn: $('#runBtn'),
  formatBtn: $('#formatBtn'),
  clearEditorBtn: $('#clearEditorBtn'),
  clearOutputBtn: $('#clearOutputBtn'),
  clearHistoryBtn: $('#clearHistoryBtn'),
  exportBtn: $('#exportBtn'),
  importBtn: $('#importBtn'),
  importFileInput: $('#importFileInput'),
  resultsSection: $('#resultsSection'),
  welcomeCard: $('#welcomeCard'),
  statusTables: $('#statusTables'),
  statusSize: $('#statusSize'),
  statusTime: $('#statusTime'),
  schemaModal: $('#schemaModal'),
  schemaModalTitle: $('#schemaModalTitle'),
  schemaModalBody: $('#schemaModalBody'),
  schemaModalClose: $('#schemaModalClose'),
  connectionStatus: $('#connectionStatus'),
};

// ============================================
// Database Initialization
// ============================================
async function initDatabase() {
  try {
    const SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });

    // Try loading from localStorage
    const savedData = localStorage.getItem(DB_STORAGE_KEY);
    if (savedData) {
      try {
        const binaryArray = base64ToUint8Array(savedData);
        db = new SQL.Database(binaryArray);
        console.log('✅ Database loaded from localStorage');
      } catch (e) {
        console.warn('⚠️ Failed to load saved database, creating new one:', e);
        db = new SQL.Database();
        createSampleData();
      }
    } else {
      db = new SQL.Database();
      createSampleData();
      console.log('✅ New database created with sample data');
    }

    // Hide loading, refresh UI
    els.loading.style.display = 'none';
    refreshTables();
    loadHistory();
    updateStatus();

  } catch (error) {
    console.error('❌ Failed to initialize SQL engine:', error);
    els.loading.querySelector('.loading-text').textContent = 'Failed to initialize. Please refresh.';
    els.loading.querySelector('.spinner').style.display = 'none';
  }
}

// ============================================
// Sample Data
// ============================================
function createSampleData() {
  const statements = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE,
      age INTEGER,
      city TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `INSERT INTO users (name, email, age, city) VALUES ('Aarav Sharma', 'aarav@email.com', 25, 'Mumbai')`,
    `INSERT INTO users (name, email, age, city) VALUES ('Priya Patel', 'priya@email.com', 30, 'Delhi')`,
    `INSERT INTO users (name, email, age, city) VALUES ('Rahul Singh', 'rahul@email.com', 28, 'Bangalore')`,
    `INSERT INTO users (name, email, age, city) VALUES ('Sneha Gupta', 'sneha@email.com', 22, 'Pune')`,
    `INSERT INTO users (name, email, age, city) VALUES ('Vikram Reddy', 'vikram@email.com', 35, 'Hyderabad')`,

    // Products table
    `CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL,
      category TEXT,
      stock INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `INSERT INTO products (name, price, category, stock) VALUES ('Laptop Pro', 89999.99, 'Electronics', 50)`,
    `INSERT INTO products (name, price, category, stock) VALUES ('Wireless Mouse', 1499.00, 'Accessories', 200)`,
    `INSERT INTO products (name, price, category, stock) VALUES ('USB-C Hub', 2999.50, 'Accessories', 150)`,
    `INSERT INTO products (name, price, category, stock) VALUES ('Monitor 27"', 34999.00, 'Electronics', 30)`,
    `INSERT INTO products (name, price, category, stock) VALUES ('Keyboard Mech', 6999.00, 'Accessories', 100)`,

    // Orders table
    `CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      product_id INTEGER,
      quantity INTEGER,
      total REAL,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(product_id) REFERENCES products(id)
    )`,
    `INSERT INTO orders (user_id, product_id, quantity, total) VALUES (1, 1, 1, 89999.99)`,
    `INSERT INTO orders (user_id, product_id, quantity, total) VALUES (2, 2, 2, 2998.00)`,
    `INSERT INTO orders (user_id, product_id, quantity, total) VALUES (3, 4, 1, 34999.00)`,
  ];

  statements.forEach((stmt) => {
    try { db.run(stmt); } catch (e) { console.warn('Sample data error:', e.message); }
  });

  saveDatabase();
}

// ============================================
// Database Persistence (localStorage)
// ============================================
function saveDatabase() {
  try {
    const data = db.export();
    const base64 = uint8ArrayToBase64(data);
    localStorage.setItem(DB_STORAGE_KEY, base64);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

function uint8ArrayToBase64(uint8Array) {
  let binary = '';
  const len = uint8Array.byteLength;
  const chunkSize = 8192;
  for (let i = 0; i < len; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, len));
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

// ============================================
// Query Execution
// ============================================
function executeQuery(sql) {
  if (!db) return;

  const trimmedSql = sql.trim();
  if (!trimmedSql) return;

  // Hide welcome card
  if (els.welcomeCard) {
    els.welcomeCard.style.display = 'none';
  }

  const startTime = performance.now();

  // Split into individual statements
  const statements = trimmedSql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  statements.forEach((stmt) => {
    try {
      const results = db.exec(stmt);
      const execTime = (performance.now() - startTime).toFixed(2);

      // Check if this is a data-modifying statement
      const isModifying = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/i.test(stmt);

      if (results.length > 0) {
        // SELECT-like query with results
        results.forEach((result) => {
          renderTableResult(stmt, result.columns, result.values, execTime);
        });
      } else {
        // Non-SELECT or no results
        const changes = db.getRowsModified();
        renderMessageResult(stmt, isModifying
          ? `✅ Query executed successfully. ${changes} row(s) affected.`
          : '✅ Query executed successfully.',
          'success', execTime
        );
      }

      // Save to history
      addToHistory(stmt, true);

      // Save database if modifying
      if (isModifying) {
        saveDatabase();
      }

    } catch (error) {
      const execTime = (performance.now() - startTime).toFixed(2);
      renderMessageResult(stmt, `Error: ${error.message}`, 'error', execTime);
      addToHistory(stmt, false);
    }
  });

  // Refresh sidebar and status
  refreshTables();
  updateStatus();
  updateStatusTime(performance.now() - startTime);
}

// ============================================
// Result Rendering
// ============================================
function renderTableResult(query, columns, values, execTime) {
  const card = document.createElement('div');
  card.className = 'result-card result-success';

  const rowCount = values.length;

  card.innerHTML = `
    <div class="result-header">
      <div class="result-header-left">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>
        Result
      </div>
      <span class="result-badge">${rowCount} row${rowCount !== 1 ? 's' : ''} · ${execTime}ms</span>
    </div>
    <div class="result-table-wrapper">
      <table class="result-table">
        <thead>
          <tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${values.map((row, i) => `
            <tr style="animation-delay:${Math.min(i * 0.02, 0.5)}s">
              ${row.map(cell => `<td>${cell === null ? '<span class="null-value">NULL</span>' : escapeHtml(String(cell))}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="result-query-display">${escapeHtml(query)}</div>
  `;

  els.resultsSection.insertBefore(card, els.resultsSection.firstChild);
}

function renderMessageResult(query, message, type, execTime) {
  const card = document.createElement('div');
  card.className = `result-card result-${type}`;

  const iconMap = {
    success: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    info: '<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  };

  card.innerHTML = `
    <div class="result-header">
      <div class="result-header-left">
        ${iconMap[type] || iconMap.info}
        ${type === 'error' ? 'Error' : 'Success'}
      </div>
      <span class="result-badge">${execTime}ms</span>
    </div>
    <div class="result-message">${escapeHtml(message)}</div>
    <div class="result-query-display">${escapeHtml(query)}</div>
  `;

  els.resultsSection.insertBefore(card, els.resultsSection.firstChild);
}

// ============================================
// Tables Panel
// ============================================
function refreshTables() {
  if (!db) return;

  try {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = result.length > 0 ? result[0].values.map(r => r[0]) : [];

    els.tableCount.textContent = tables.length;
    els.statusTables.querySelector('span').textContent = `${tables.length} table${tables.length !== 1 ? 's' : ''}`;

    els.tablesList.innerHTML = tables.length === 0
      ? '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary)">No tables yet</div>'
      : tables.map(name => `
        <div class="table-item" data-table="${escapeHtml(name)}">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
            <line x1="3" y1="9" x2="21" y2="9"/>
            <line x1="3" y1="15" x2="21" y2="15"/>
            <line x1="9" y1="9" x2="9" y2="21"/>
          </svg>
          <span class="table-item-name">${escapeHtml(name)}</span>
        </div>
      `).join('');

    // Add click handlers
    els.tablesList.querySelectorAll('.table-item').forEach(item => {
      item.addEventListener('click', () => showTableSchema(item.dataset.table));
    });

  } catch (e) {
    console.error('Failed to refresh tables:', e);
  }
}

// ============================================
// Schema Modal
// ============================================
function showTableSchema(tableName) {
  if (!db) return;

  try {
    const result = db.exec(`PRAGMA table_info("${tableName}")`);
    if (result.length === 0) return;

    els.schemaModalTitle.textContent = tableName;

    const columns = result[0].columns; // cid, name, type, notnull, dflt_value, pk
    const values = result[0].values;

    els.schemaModalBody.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Column</th>
            <th>Type</th>
            <th>Not Null</th>
            <th>Default</th>
            <th>PK</th>
          </tr>
        </thead>
        <tbody>
          ${values.map(row => `
            <tr>
              <td style="color:var(--accent-blue);font-weight:500">${escapeHtml(String(row[1]))}</td>
              <td>${escapeHtml(String(row[2] || 'ANY'))}</td>
              <td>${row[3] ? '✓' : ''}</td>
              <td>${row[4] !== null ? escapeHtml(String(row[4])) : '<span class="null-value">NULL</span>'}</td>
              <td>${row[5] ? '🔑' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    els.schemaModal.classList.add('visible');

    // Close sidebar on mobile
    closeSidebar();

  } catch (e) {
    console.error('Failed to show schema:', e);
  }
}

function closeSchemaModal() {
  els.schemaModal.classList.remove('visible');
}

// ============================================
// Query History
// ============================================
function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    queryHistory = saved ? JSON.parse(saved) : [];
  } catch (e) {
    queryHistory = [];
  }
  renderHistory();
}

function addToHistory(query, success) {
  const entry = {
    query: query.trim(),
    timestamp: new Date().toISOString(),
    success,
  };

  queryHistory.unshift(entry);
  if (queryHistory.length > MAX_HISTORY) {
    queryHistory = queryHistory.slice(0, MAX_HISTORY);
  }

  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(queryHistory));
  renderHistory();
}

function renderHistory() {
  els.historyCount.textContent = queryHistory.length;

  if (queryHistory.length === 0) {
    els.historyList.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary)">No queries yet</div>';
    return;
  }

  els.historyList.innerHTML = queryHistory.slice(0, 20).map((entry, i) => `
    <div class="history-item" data-index="${i}">
      <div class="history-query">
        <span class="history-status ${entry.success ? 'success' : 'error'}"></span>
        ${escapeHtml(entry.query.substring(0, 60))}
      </div>
      <div class="history-time">${formatTimestamp(entry.timestamp)}</div>
    </div>
  `).join('');

  // Click handlers
  els.historyList.querySelectorAll('.history-item').forEach(item => {
    item.addEventListener('click', () => {
      const index = parseInt(item.dataset.index);
      els.editor.value = queryHistory[index].query;
      els.editor.focus();
      closeSidebar();
    });
  });
}

function clearHistory() {
  if (!confirm('Clear all query history?')) return;
  queryHistory = [];
  localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
}

// ============================================
// SQL Formatting
// ============================================
function formatSQL(sql) {
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'INSERT INTO', 'VALUES',
    'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'ALTER TABLE',
    'DROP TABLE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN',
    'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN', 'ON', 'GROUP BY',
    'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION', 'UNION ALL',
    'AS', 'IN', 'NOT', 'IS', 'NULL', 'LIKE', 'BETWEEN', 'EXISTS',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'AUTOINCREMENT',
    'IF NOT EXISTS', 'IF EXISTS', 'DEFAULT', 'UNIQUE', 'NOT NULL',
    'INTEGER', 'TEXT', 'REAL', 'BLOB', 'DATETIME', 'BOOLEAN',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'PRAGMA',
    'BEGIN', 'COMMIT', 'ROLLBACK', 'REPLACE', 'INTO',
  ];

  // Uppercase keywords
  let formatted = sql;
  keywords.sort((a, b) => b.length - a.length); // Longest first
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    formatted = formatted.replace(regex, kw);
  });

  // Add newlines before major clauses
  const newlineKeywords = [
    'SELECT', 'FROM', 'WHERE', 'AND', 'OR', 'JOIN', 'LEFT JOIN',
    'RIGHT JOIN', 'INNER JOIN', 'GROUP BY', 'ORDER BY', 'HAVING',
    'LIMIT', 'UNION', 'SET', 'VALUES', 'ON',
  ];

  newlineKeywords.forEach(kw => {
    const regex = new RegExp(`\\s+${kw}\\b`, 'g');
    formatted = formatted.replace(regex, `\n${kw}`);
  });

  return formatted.trim();
}

// ============================================
// Export & Import
// ============================================
function exportDatabase() {
  if (!db) return;

  try {
    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sql_terminal_backup_${Date.now()}.db`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    alert('Export failed: ' + e.message);
  }
}

function importDatabase(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const SQL = db.constructor;
      const uint8Array = new Uint8Array(reader.result);
      
      // Re-init with initSqlJs since we need the SQL constructor
      initSqlJs({
        locateFile: (f) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${f}`,
      }).then((SQL) => {
        db = new SQL.Database(uint8Array);
        saveDatabase();
        refreshTables();
        updateStatus();

        renderMessageResult(
          'IMPORT DATABASE',
          '✅ Database imported successfully!',
          'success',
          '0'
        );
      });
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
  };
  reader.readAsArrayBuffer(file);
}

// ============================================
// Status Bar
// ============================================
function updateStatus() {
  if (!db) return;

  // Database size
  try {
    const data = db.export();
    const sizeKB = (data.byteLength / 1024).toFixed(1);
    els.statusSize.querySelector('span').textContent = `${sizeKB} KB`;
  } catch (e) {
    // ignore
  }
}

function updateStatusTime(ms) {
  els.statusTime.querySelector('span').textContent = `${ms.toFixed(2)}ms`;
}

// ============================================
// Utility Functions
// ============================================
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTimestamp(iso) {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

// ============================================
// Sidebar Toggle (Mobile)
// ============================================
function openSidebar() {
  els.sidebar.classList.add('open');
  els.sidebarOverlay.style.display = 'block';
  requestAnimationFrame(() => els.sidebarOverlay.classList.add('visible'));
}

function closeSidebar() {
  els.sidebar.classList.remove('open');
  els.sidebarOverlay.classList.remove('visible');
  setTimeout(() => { els.sidebarOverlay.style.display = 'none'; }, 200);
}

// ============================================
// Event Listeners
// ============================================
function initEventListeners() {
  // Run Query
  els.runBtn.addEventListener('click', () => executeQuery(els.editor.value));

  // Keyboard shortcuts
  els.editor.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to run
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery(els.editor.value);
    }

    // Tab inserts spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      e.target.value = e.target.value.substring(0, start) + '  ' + e.target.value.substring(end);
      e.target.selectionStart = e.target.selectionEnd = start + 2;
    }
  });

  // Format SQL
  els.formatBtn.addEventListener('click', () => {
    if (els.editor.value.trim()) {
      els.editor.value = formatSQL(els.editor.value);
    }
  });

  // Clear Editor
  els.clearEditorBtn.addEventListener('click', () => {
    els.editor.value = '';
    els.editor.focus();
  });

  // Clear Output
  els.clearOutputBtn.addEventListener('click', () => {
    els.resultsSection.innerHTML = '';
    if (els.welcomeCard) {
      els.resultsSection.appendChild(els.welcomeCard);
      els.welcomeCard.style.display = 'block';
    }
  });

  // Clear History
  els.clearHistoryBtn.addEventListener('click', clearHistory);

  // Export
  els.exportBtn.addEventListener('click', exportDatabase);

  // Import
  els.importBtn.addEventListener('click', () => els.importFileInput.click());
  els.importFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importDatabase(e.target.files[0]);
      e.target.value = ''; // Reset
    }
  });

  // Schema Modal
  els.schemaModalClose.addEventListener('click', closeSchemaModal);
  els.schemaModal.addEventListener('click', (e) => {
    if (e.target === els.schemaModal) closeSchemaModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSchemaModal();
  });

  // Sidebar toggle (mobile)
  els.sidebarToggle.addEventListener('click', () => {
    if (els.sidebar.classList.contains('open')) {
      closeSidebar();
    } else {
      openSidebar();
    }
  });
  els.sidebarOverlay.addEventListener('click', closeSidebar);

  // Quick queries
  document.querySelectorAll('.quick-query').forEach(btn => {
    btn.addEventListener('click', () => {
      els.editor.value = btn.dataset.query;
      executeQuery(btn.dataset.query);
    });
  });
}

// ============================================
// Initialize Application
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  initDatabase();
});
