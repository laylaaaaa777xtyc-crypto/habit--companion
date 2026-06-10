const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'habit.db');
const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role_id INTEGER DEFAULT NULL,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS habits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    habit_name TEXT NOT NULL,
    frequency_type TEXT NOT NULL CHECK(frequency_type IN ('daily','weekly')),
    frequency_count INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS habit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    habit_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    checkin_date TEXT NOT NULL,
    xp_earned INTEGER NOT NULL DEFAULT 10,
    FOREIGN KEY (habit_id) REFERENCES habits(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_habit_log_unique
    ON habit_logs(habit_id, checkin_date);

  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user','assistant')),
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const LEVEL_THRESHOLDS = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200];

function calcLevel(totalXp) {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (totalXp >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return Math.min(level, 10);
}

function xpToNextLevel(totalXp, level) {
  if (level >= 10) return 0;
  return LEVEL_THRESHOLDS[level] - totalXp;
}

function xpPercent(totalXp, level) {
  const min = LEVEL_THRESHOLDS[level - 1];
  const max = level >= 10 ? LEVEL_THRESHOLDS[9] + 1000 : LEVEL_THRESHOLDS[level];
  return Math.min(100, Math.round(((totalXp - min) / (max - min)) * 100));
}

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function yesterdayStr() {
  return new Date(Date.now() - 86400000).toISOString().split('T')[0];
}

function weekStartStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const monday = new Date(d.getTime() + diff * 86400000);
  return monday.toISOString().split('T')[0];
}

// node:sqlite returns BigInt for lastInsertRowid — helper to normalize row IDs
function normalizeRow(row) {
  if (!row) return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'bigint' ? Number(v) : v;
  }
  return out;
}

function normalizeRows(rows) {
  return rows.map(normalizeRow);
}

// Wrap db.prepare to auto-normalize BigInt results
const _prepare = db.prepare.bind(db);
const prepare = (sql) => {
  const stmt = _prepare(sql);
  return {
    run: (...args) => {
      const r = stmt.run(...args);
      return { lastInsertRowid: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    get: (...args) => normalizeRow(stmt.get(...args)),
    all: (...args) => normalizeRows(stmt.all(...args)),
  };
};

module.exports = { db: { prepare, exec: db.exec.bind(db) }, calcLevel, xpToNextLevel, xpPercent, todayStr, yesterdayStr, weekStartStr, LEVEL_THRESHOLDS };
