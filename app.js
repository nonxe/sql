/**
 * MySQL Terminal — app.js
 * Full-featured browser SQL terminal with MySQL syntax compatibility
 * Powered by sql.js (SQLite WASM) with a MySQL command translation layer
 * Supports: CREATE DATABASE, USE, SHOW DATABASES/TABLES, DESCRIBE, DROP DATABASE,
 *           SHOW CREATE TABLE, TRUNCATE, SHOW COLUMNS, SHOW INDEX, and all standard SQL
 * Data persists in localStorage across page refreshes
 */

// ============================================
// Constants & State
// ============================================
const DB_LIST_KEY = 'mysql_terminal_databases';      // List of database names
const DB_PREFIX = 'mysql_terminal_db_';              // localStorage key prefix per db
const HISTORY_STORAGE_KEY = 'mysql_terminal_history';
const CURRENT_DB_KEY = 'mysql_terminal_current_db';
const MAX_HISTORY = 50;
const DEFAULT_DB = 'mydb';

let SQL = null;           // sql.js module reference
let db = null;            // Current active sql.js Database instance
let currentDbName = '';   // Currently selected database name
let databases = [];       // List of all database names
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
  databasesList: $('#databasesList'),
  dbCount: $('#dbCount'),
  tablesList: $('#tablesList'),
  tableCount: $('#tableCount'),
  historyList: $('#historyList'),
  historyCount: $('#historyCount'),
  currentDbName: $('#currentDbName'),
  topbarDbName: $('#topbarDbName'),
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
  statusDb: $('#statusDb'),
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
    SQL = await initSqlJs({
      locateFile: (file) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });

    // Load database list
    loadDatabaseList();

    // Determine which database to open
    const savedCurrent = localStorage.getItem(CURRENT_DB_KEY);
    if (savedCurrent && databases.includes(savedCurrent)) {
      switchToDatabase(savedCurrent);
    } else if (databases.length > 0) {
      switchToDatabase(databases[0]);
    } else {
      // First launch — create default database with sample data
      createNewDatabase(DEFAULT_DB);
      switchToDatabase(DEFAULT_DB);
      createSampleData();
      saveCurrentDatabase();
    }

    // Hide loading, refresh UI
    els.loading.style.display = 'none';
    refreshAll();

  } catch (error) {
    console.error('❌ Failed to initialize SQL engine:', error);
    els.loading.querySelector('.loading-text').textContent = 'Failed to initialize. Please refresh.';
    els.loading.querySelector('.spinner').style.display = 'none';
  }
}

// ============================================
// Multi-Database Management
// ============================================
function loadDatabaseList() {
  try {
    const saved = localStorage.getItem(DB_LIST_KEY);
    databases = saved ? JSON.parse(saved) : [];
  } catch (e) {
    databases = [];
  }
}

function saveDatabaseList() {
  localStorage.setItem(DB_LIST_KEY, JSON.stringify(databases));
}

function createNewDatabase(name) {
  const lowerName = name.toLowerCase();
  if (!databases.includes(lowerName)) {
    databases.push(lowerName);
    saveDatabaseList();
  }
  // Create empty database in storage if it doesn't exist
  const key = DB_PREFIX + lowerName;
  if (!localStorage.getItem(key)) {
    const newDb = new SQL.Database();
    const data = newDb.export();
    localStorage.setItem(key, uint8ArrayToBase64(data));
    newDb.close();
  }
}

function switchToDatabase(name) {
  const lowerName = name.toLowerCase();
  if (!databases.includes(lowerName)) {
    throw new Error(`Unknown database '${name}'`);
  }

  // Save current database before switching
  if (db && currentDbName) {
    saveCurrentDatabase();
  }

  // Load the target database
  const key = DB_PREFIX + lowerName;
  const savedData = localStorage.getItem(key);

  if (savedData) {
    try {
      const binaryArray = base64ToUint8Array(savedData);
      if (db) db.close();
      db = new SQL.Database(binaryArray);
    } catch (e) {
      console.warn(`Failed to load database '${name}', creating fresh:`, e);
      if (db) db.close();
      db = new SQL.Database();
    }
  } else {
    if (db) db.close();
    db = new SQL.Database();
  }

  currentDbName = lowerName;
  localStorage.setItem(CURRENT_DB_KEY, lowerName);
  updateDbIndicators();
}

function dropDatabase(name) {
  const lowerName = name.toLowerCase();
  if (lowerName === currentDbName) {
    throw new Error("Cannot drop the currently active database. Switch to another database first.");
  }
  databases = databases.filter(d => d !== lowerName);
  saveDatabaseList();
  localStorage.removeItem(DB_PREFIX + lowerName);
}

function saveCurrentDatabase() {
  if (!db || !currentDbName) return;
  try {
    const data = db.export();
    const base64 = uint8ArrayToBase64(data);
    localStorage.setItem(DB_PREFIX + currentDbName, base64);
  } catch (e) {
    console.error('Failed to save database:', e);
  }
}

function updateDbIndicators() {
  if (els.currentDbName) els.currentDbName.textContent = currentDbName;
  if (els.topbarDbName) els.topbarDbName.textContent = currentDbName;
  if (els.statusDb) els.statusDb.querySelector('span').textContent = currentDbName;
}

// ============================================
// Sample Data (for default database)
// ============================================
function createSampleData() {
  const statements = [
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
}

// ============================================
// MySQL Command Parser — Intercepts MySQL-specific commands
// ============================================
function parseMySQLCommand(sql) {
  const trimmed = sql.trim().replace(/;$/, '').trim();
  const upper = trimmed.toUpperCase();

  // ---- SHOW DATABASES ----
  if (/^SHOW\s+DATABASES$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['Database'],
      values: databases.map(d => [d]),
      message: null,
    };
  }

  // ---- SHOW SCHEMAS (MySQL alias) ----
  if (/^SHOW\s+SCHEMAS$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['Database'],
      values: databases.map(d => [d]),
      message: null,
    };
  }

  // ---- CREATE DATABASE ----
  const createDbMatch = trimmed.match(/^CREATE\s+DATABASE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?$/i);
  if (createDbMatch) {
    const name = createDbMatch[1].toLowerCase();
    const ifNotExists = /IF\s+NOT\s+EXISTS/i.test(trimmed);
    if (databases.includes(name)) {
      if (ifNotExists) {
        return { type: 'message', message: `Database '${name}' already exists (IF NOT EXISTS).`, kind: 'info' };
      }
      throw new Error(`Can't create database '${name}'; database exists`);
    }
    createNewDatabase(name);
    return { type: 'message', message: `Query OK, 1 row affected`, kind: 'success' };
  }

  // ---- DROP DATABASE ----
  const dropDbMatch = trimmed.match(/^DROP\s+DATABASE\s+(?:IF\s+EXISTS\s+)?[`"']?(\w+)[`"']?$/i);
  if (dropDbMatch) {
    const name = dropDbMatch[1].toLowerCase();
    const ifExists = /IF\s+EXISTS/i.test(trimmed);
    if (!databases.includes(name)) {
      if (ifExists) {
        return { type: 'message', message: `Database '${name}' doesn't exist (IF EXISTS, no error).`, kind: 'info' };
      }
      throw new Error(`Can't drop database '${name}'; database doesn't exist`);
    }
    if (name === currentDbName) {
      throw new Error(`Cannot drop the currently active database '${name}'. USE another database first.`);
    }
    dropDatabase(name);
    return { type: 'message', message: `Query OK, database '${name}' dropped`, kind: 'success' };
  }

  // ---- USE database ----
  const useMatch = trimmed.match(/^USE\s+[`"']?(\w+)[`"']?$/i);
  if (useMatch) {
    const name = useMatch[1].toLowerCase();
    if (!databases.includes(name)) {
      throw new Error(`Unknown database '${name}'`);
    }
    switchToDatabase(name);
    refreshAll();
    return { type: 'message', message: `Database changed to '${name}'`, kind: 'success' };
  }

  // ---- SHOW TABLES ----
  if (/^SHOW\s+TABLES$/i.test(trimmed) || /^SHOW\s+TABLES\s+FROM\s+/i.test(trimmed)) {
    // Check if SHOW TABLES FROM another_db
    const fromMatch = trimmed.match(/^SHOW\s+TABLES\s+FROM\s+[`"']?(\w+)[`"']?$/i);
    if (fromMatch) {
      const targetDb = fromMatch[1].toLowerCase();
      if (!databases.includes(targetDb)) {
        throw new Error(`Unknown database '${targetDb}'`);
      }
      // Temporarily load that DB to get its tables
      const tables = getTablesFromDb(targetDb);
      return {
        type: 'result',
        columns: [`Tables_in_${targetDb}`],
        values: tables.map(t => [t]),
        message: null,
      };
    }
    // Show tables for current database
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = result.length > 0 ? result[0].values : [];
    return {
      type: 'result',
      columns: [`Tables_in_${currentDbName}`],
      values: tables,
      message: null,
    };
  }

  // ---- SHOW FULL TABLES ----
  if (/^SHOW\s+FULL\s+TABLES$/i.test(trimmed)) {
    const result = db.exec("SELECT name, type FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = result.length > 0 ? result[0].values.map(r => [r[0], 'BASE TABLE']) : [];
    return {
      type: 'result',
      columns: [`Tables_in_${currentDbName}`, 'Table_type'],
      values: tables,
      message: null,
    };
  }

  // ---- DESCRIBE / DESC table ----
  const descMatch = trimmed.match(/^(?:DESCRIBE|DESC)\s+[`"']?(\w+)[`"']?$/i);
  if (descMatch) {
    const tableName = descMatch[1];
    return describeTable(tableName);
  }

  // ---- SHOW COLUMNS FROM table ----
  const showColsMatch = trimmed.match(/^SHOW\s+(?:FULL\s+)?COLUMNS\s+FROM\s+[`"']?(\w+)[`"']?$/i);
  if (showColsMatch) {
    const tableName = showColsMatch[1];
    return describeTable(tableName);
  }

  // ---- SHOW CREATE TABLE ----
  const showCreateMatch = trimmed.match(/^SHOW\s+CREATE\s+TABLE\s+[`"']?(\w+)[`"']?$/i);
  if (showCreateMatch) {
    const tableName = showCreateMatch[1];
    const result = db.exec(`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    if (result.length === 0 || result[0].values.length === 0) {
      throw new Error(`Table '${tableName}' doesn't exist`);
    }
    return {
      type: 'result',
      columns: ['Table', 'Create Table'],
      values: [[tableName, result[0].values[0][0]]],
      message: null,
    };
  }

  // ---- SHOW INDEX FROM / SHOW INDEXES FROM / SHOW KEYS FROM ----
  const showIndexMatch = trimmed.match(/^SHOW\s+(?:INDEX|INDEXES|KEYS)\s+FROM\s+[`"']?(\w+)[`"']?$/i);
  if (showIndexMatch) {
    const tableName = showIndexMatch[1];
    const result = db.exec(`PRAGMA index_list("${tableName}")`);
    if (result.length === 0) {
      return {
        type: 'result',
        columns: ['Table', 'Non_unique', 'Key_name', 'Column_name'],
        values: [],
        message: null,
      };
    }
    const indexes = [];
    result[0].values.forEach(idx => {
      const indexName = idx[1];
      const nonUnique = idx[2] === 0 ? 0 : 1;
      const infoResult = db.exec(`PRAGMA index_info("${indexName}")`);
      if (infoResult.length > 0) {
        infoResult[0].values.forEach(col => {
          indexes.push([tableName, nonUnique, indexName, col[2]]);
        });
      }
    });
    return {
      type: 'result',
      columns: ['Table', 'Non_unique', 'Key_name', 'Column_name'],
      values: indexes,
      message: null,
    };
  }

  // ---- SHOW TABLE STATUS ----
  if (/^SHOW\s+TABLE\s+STATUS$/i.test(trimmed)) {
    const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = result.length > 0 ? result[0].values.map(r => r[0]) : [];
    const rows = tables.map(t => {
      let rowCount = 0;
      try {
        const countResult = db.exec(`SELECT COUNT(*) FROM "${t}"`);
        if (countResult.length > 0) rowCount = countResult[0].values[0][0];
      } catch (e) { /* ignore */ }
      return [t, 'SQLite', rowCount, 'dynamic', 0, 0, null];
    });
    return {
      type: 'result',
      columns: ['Name', 'Engine', 'Rows', 'Row_format', 'Data_length', 'Index_length', 'Comment'],
      values: rows,
      message: null,
    };
  }

  // ---- TRUNCATE TABLE ----
  const truncateMatch = trimmed.match(/^TRUNCATE\s+(?:TABLE\s+)?[`"']?(\w+)[`"']?$/i);
  if (truncateMatch) {
    const tableName = truncateMatch[1];
    // Check table exists
    const exists = db.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`);
    if (exists.length === 0 || exists[0].values.length === 0) {
      throw new Error(`Table '${currentDbName}.${tableName}' doesn't exist`);
    }
    db.run(`DELETE FROM "${tableName}"`);
    // Reset autoincrement
    try { db.run(`DELETE FROM sqlite_sequence WHERE name='${tableName}'`); } catch (e) { /* ok */ }
    saveCurrentDatabase();
    return { type: 'message', message: `Query OK, table '${tableName}' truncated`, kind: 'success' };
  }

  // ---- SHOW WARNINGS ----
  if (/^SHOW\s+WARNINGS$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['Level', 'Code', 'Message'],
      values: [],
      message: null,
    };
  }

  // ---- SHOW ERRORS ----
  if (/^SHOW\s+ERRORS$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['Level', 'Code', 'Message'],
      values: [],
      message: null,
    };
  }

  // ---- SHOW PROCESSLIST ----
  if (/^SHOW\s+(?:FULL\s+)?PROCESSLIST$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['Id', 'User', 'Host', 'db', 'Command', 'Time', 'State', 'Info'],
      values: [[1, 'browser', 'localhost', currentDbName, 'Query', 0, 'executing', null]],
      message: null,
    };
  }

  // ---- SHOW VARIABLES (limited) ----
  if (/^SHOW\s+(?:GLOBAL\s+|SESSION\s+)?VARIABLES/i.test(trimmed)) {
    const likeMatch = trimmed.match(/LIKE\s+['"](.+)['"]/i);
    const vars = [
      ['version', '8.0.36-browser'],
      ['version_comment', 'MySQL Terminal (sql.js)'],
      ['character_set_client', 'utf8mb4'],
      ['character_set_connection', 'utf8mb4'],
      ['character_set_database', 'utf8mb4'],
      ['character_set_results', 'utf8mb4'],
      ['collation_connection', 'utf8mb4_unicode_ci'],
      ['max_connections', '1'],
      ['port', '0'],
      ['storage_engine', 'SQLite/WASM'],
      ['datadir', 'localStorage'],
      ['hostname', 'browser'],
      ['sql_mode', 'STRICT_TRANS_TABLES'],
    ];
    let filtered = vars;
    if (likeMatch) {
      const pattern = likeMatch[1].replace(/%/g, '.*');
      const regex = new RegExp(`^${pattern}$`, 'i');
      filtered = vars.filter(v => regex.test(v[0]));
    }
    return {
      type: 'result',
      columns: ['Variable_name', 'Value'],
      values: filtered,
      message: null,
    };
  }

  // ---- SHOW STATUS ----
  if (/^SHOW\s+(?:GLOBAL\s+|SESSION\s+)?STATUS/i.test(trimmed)) {
    const statusVars = [
      ['Uptime', Math.floor((Date.now() - window._startTime) / 1000).toString()],
      ['Threads_connected', '1'],
      ['Questions', queryHistory.length.toString()],
      ['Com_select', queryHistory.filter(h => /^SELECT/i.test(h.query)).length.toString()],
      ['Com_insert', queryHistory.filter(h => /^INSERT/i.test(h.query)).length.toString()],
      ['Com_update', queryHistory.filter(h => /^UPDATE/i.test(h.query)).length.toString()],
      ['Com_delete', queryHistory.filter(h => /^DELETE/i.test(h.query)).length.toString()],
    ];
    return {
      type: 'result',
      columns: ['Variable_name', 'Value'],
      values: statusVars,
      message: null,
    };
  }

  // ---- SELECT DATABASE() ----
  if (/^SELECT\s+DATABASE\s*\(\s*\)$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['DATABASE()'],
      values: [[currentDbName]],
      message: null,
    };
  }

  // ---- SELECT VERSION() ----
  if (/^SELECT\s+VERSION\s*\(\s*\)$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['VERSION()'],
      values: [['8.0.36-browser (sql.js)']],
      message: null,
    };
  }

  // ---- SELECT CURRENT_USER() ----
  if (/^SELECT\s+(?:CURRENT_USER|USER)\s*\(\s*\)$/i.test(trimmed)) {
    return {
      type: 'result',
      columns: ['CURRENT_USER()'],
      values: [['root@localhost']],
      message: null,
    };
  }

  // ---- STATUS (plain) ----
  if (/^STATUS$/i.test(trimmed)) {
    const uptime = Math.floor((Date.now() - window._startTime) / 1000);
    return {
      type: 'result',
      columns: ['Property', 'Value'],
      values: [
        ['Connection', 'localhost via browser'],
        ['Current database', currentDbName],
        ['Current user', 'root@localhost'],
        ['Server version', '8.0.36-browser (sql.js)'],
        ['Protocol version', '10'],
        ['Uptime', `${uptime} sec`],
        ['Threads', '1'],
        ['Questions', queryHistory.length.toString()],
        ['Storage', 'localStorage'],
      ],
      message: null,
    };
  }

  // ---- Not a MySQL-specific command, pass through ----
  return null;
}

// ============================================
// Helper: DESCRIBE table
// ============================================
function describeTable(tableName) {
  const result = db.exec(`PRAGMA table_info("${tableName}")`);
  if (result.length === 0 || result[0].values.length === 0) {
    throw new Error(`Table '${currentDbName}.${tableName}' doesn't exist`);
  }

  // Map to MySQL DESCRIBE output: Field, Type, Null, Key, Default, Extra
  const values = result[0].values.map(row => {
    const field = row[1];
    const type = row[2] || 'ANY';
    const notNull = row[3];
    const defaultVal = row[4];
    const isPk = row[5];

    return [
      field,
      type.toUpperCase(),
      notNull ? 'NO' : 'YES',
      isPk ? 'PRI' : '',
      defaultVal !== null ? String(defaultVal) : 'NULL',
      isPk ? 'auto_increment' : '',
    ];
  });

  return {
    type: 'result',
    columns: ['Field', 'Type', 'Null', 'Key', 'Default', 'Extra'],
    values: values,
    message: null,
  };
}

// ============================================
// Helper: Get tables from a specific database
// ============================================
function getTablesFromDb(dbName) {
  const key = DB_PREFIX + dbName;
  const savedData = localStorage.getItem(key);
  if (!savedData) return [];

  try {
    const binaryArray = base64ToUint8Array(savedData);
    const tempDb = new SQL.Database(binaryArray);
    const result = tempDb.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    tempDb.close();
    return result.length > 0 ? result[0].values.map(r => r[0]) : [];
  } catch (e) {
    return [];
  }
}

// ============================================
// Base64 Encoding/Decoding
// ============================================
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
// Query Execution (with MySQL command interception)
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
    const stmtStart = performance.now();
    try {
      // First, try MySQL command parser
      const mysqlResult = parseMySQLCommand(stmt);

      if (mysqlResult) {
        const execTime = (performance.now() - stmtStart).toFixed(2);
        if (mysqlResult.type === 'result') {
          if (mysqlResult.values.length > 0 || mysqlResult.columns) {
            renderTableResult(stmt, mysqlResult.columns, mysqlResult.values, execTime);
          } else {
            renderMessageResult(stmt, 'Empty set', 'info', execTime);
          }
        } else {
          renderMessageResult(stmt, mysqlResult.message, mysqlResult.kind, execTime);
        }
        addToHistory(stmt, true);
      } else {
        // Standard SQL — pass to sql.js
        const results = db.exec(stmt);
        const execTime = (performance.now() - stmtStart).toFixed(2);

        const isModifying = /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER|REPLACE)/i.test(stmt);

        if (results.length > 0) {
          results.forEach((result) => {
            renderTableResult(stmt, result.columns, result.values, execTime);
          });
        } else {
          const changes = db.getRowsModified();
          renderMessageResult(stmt, isModifying
            ? `Query OK, ${changes} row(s) affected`
            : 'Query OK',
            'success', execTime
          );
        }

        addToHistory(stmt, true);

        if (isModifying) {
          saveCurrentDatabase();
        }
      }

    } catch (error) {
      const execTime = (performance.now() - stmtStart).toFixed(2);
      renderMessageResult(stmt, `ERROR: ${error.message}`, 'error', execTime);
      addToHistory(stmt, false);
    }
  });

  // Refresh sidebar and status
  refreshAll();
  updateStatusTime(performance.now() - startTime);
}

// ============================================
// Refresh All UI Elements
// ============================================
function refreshAll() {
  refreshDatabases();
  refreshTables();
  updateStatus();
  updateDbIndicators();
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
      <span class="result-badge">${rowCount} row${rowCount !== 1 ? 's' : ''} in set (${execTime}ms)</span>
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
    <div class="result-query-display">mysql> ${escapeHtml(query)}</div>
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
        ${type === 'error' ? 'Error' : type === 'info' ? 'Info' : 'Success'}
      </div>
      <span class="result-badge">${execTime}ms</span>
    </div>
    <div class="result-message">${escapeHtml(message)}</div>
    <div class="result-query-display">mysql> ${escapeHtml(query)}</div>
  `;

  els.resultsSection.insertBefore(card, els.resultsSection.firstChild);
}

// ============================================
// Databases Panel (Sidebar)
// ============================================
function refreshDatabases() {
  if (els.dbCount) els.dbCount.textContent = databases.length;

  if (!els.databasesList) return;

  els.databasesList.innerHTML = databases.length === 0
    ? '<div style="padding:8px 12px;font-size:12px;color:var(--text-tertiary)">No databases</div>'
    : databases.map(name => `
      <div class="db-item ${name === currentDbName ? 'active' : ''}" data-db="${escapeHtml(name)}">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <ellipse cx="12" cy="6" rx="8" ry="3"/>
          <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6"/>
          <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6"/>
        </svg>
        <span class="db-item-name">${escapeHtml(name)}</span>
        ${name === currentDbName ? '<span class="db-item-badge">active</span>' : ''}
      </div>
    `).join('');

  // Click to USE database
  els.databasesList.querySelectorAll('.db-item').forEach(item => {
    item.addEventListener('click', () => {
      const dbName = item.dataset.db;
      if (dbName !== currentDbName) {
        try {
          switchToDatabase(dbName);
          refreshAll();
          renderMessageResult(`USE ${dbName}`, `Database changed to '${dbName}'`, 'success', '0');
        } catch (e) {
          renderMessageResult(`USE ${dbName}`, `ERROR: ${e.message}`, 'error', '0');
        }
      }
      closeSidebar();
    });
  });
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

    els.schemaModalTitle.textContent = `${currentDbName}.${tableName}`;

    const values = result[0].values;

    els.schemaModalBody.innerHTML = `
      <table class="result-table">
        <thead>
          <tr>
            <th>Field</th>
            <th>Type</th>
            <th>Null</th>
            <th>Key</th>
            <th>Default</th>
            <th>Extra</th>
          </tr>
        </thead>
        <tbody>
          ${values.map(row => `
            <tr>
              <td style="color:var(--accent-blue);font-weight:500">${escapeHtml(String(row[1]))}</td>
              <td>${escapeHtml(String(row[2] || 'ANY').toUpperCase())}</td>
              <td>${row[3] ? 'NO' : 'YES'}</td>
              <td>${row[5] ? '🔑 PRI' : ''}</td>
              <td>${row[4] !== null ? escapeHtml(String(row[4])) : '<span class="null-value">NULL</span>'}</td>
              <td>${row[5] ? 'auto_increment' : ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    els.schemaModal.classList.add('visible');
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
    database: currentDbName,
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
      <div class="history-time">${entry.database ? `[${entry.database}] ` : ''}${formatTimestamp(entry.timestamp)}</div>
    </div>
  `).join('');

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
    'UPDATE', 'SET', 'DELETE FROM', 'CREATE TABLE', 'CREATE DATABASE',
    'ALTER TABLE', 'DROP TABLE', 'DROP DATABASE', 'JOIN', 'LEFT JOIN',
    'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN', 'FULL JOIN', 'CROSS JOIN',
    'ON', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT', 'OFFSET', 'UNION',
    'UNION ALL', 'AS', 'IN', 'NOT', 'IS', 'NULL', 'LIKE', 'BETWEEN',
    'EXISTS', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'ASC', 'DESC',
    'PRIMARY KEY', 'FOREIGN KEY', 'REFERENCES', 'AUTOINCREMENT',
    'AUTO_INCREMENT', 'IF NOT EXISTS', 'IF EXISTS', 'DEFAULT', 'UNIQUE',
    'NOT NULL', 'INTEGER', 'INT', 'VARCHAR', 'TEXT', 'REAL', 'FLOAT',
    'DOUBLE', 'DECIMAL', 'BLOB', 'DATETIME', 'TIMESTAMP', 'DATE',
    'BOOLEAN', 'CHAR', 'BIGINT', 'SMALLINT', 'TINYINT',
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'DISTINCT', 'SHOW', 'USE',
    'DESCRIBE', 'TRUNCATE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'REPLACE',
    'INTO', 'DATABASE', 'DATABASES', 'TABLES', 'COLUMNS', 'INDEX',
    'CREATE', 'ENGINE', 'CHARSET', 'COLLATE',
  ];

  let formatted = sql;
  keywords.sort((a, b) => b.length - a.length);
  keywords.forEach(kw => {
    const regex = new RegExp(`\\b${kw.replace(/\s+/g, '\\s+')}\\b`, 'gi');
    formatted = formatted.replace(regex, kw);
  });

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
    a.download = `${currentDbName}_backup_${Date.now()}.db`;
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
      const uint8Array = new Uint8Array(reader.result);
      if (db) db.close();
      db = new SQL.Database(uint8Array);
      saveCurrentDatabase();
      refreshAll();
      renderMessageResult(
        'IMPORT DATABASE',
        `Database '${currentDbName}' imported successfully!`,
        'success',
        '0'
      );
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

  try {
    const data = db.export();
    const sizeKB = (data.byteLength / 1024).toFixed(1);
    els.statusSize.querySelector('span').textContent = `${sizeKB} KB`;
  } catch (e) { /* ignore */ }
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
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery(els.editor.value);
    }

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
      e.target.value = '';
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
window._startTime = Date.now();

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  loadHistory();
  initDatabase();
});
