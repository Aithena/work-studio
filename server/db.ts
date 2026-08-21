import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'

const DATA_DIR = path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'note.db')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

export { DATA_DIR, DB_PATH, BACKUP_DIR }

export type TodoPriority = 'P0' | 'P1' | 'P2' | 'P3'

export type TodoRow = {
  id: number
  content: string
  completed: number
  deleted: number
  hidden: number
  priority: TodoPriority | null
  sort_order: number
  created_at: string
  updated_at: string
  completed_at: string | null
  deleted_at: string | null
  hidden_at: string | null
}

export type NoteRow = {
  id: number
  content: string
  updated_at: string
}

export type TodoCounts = {
  active: number
  completed: number
  deleted: number
}

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      deleted INTEGER NOT NULL DEFAULT 0,
      hidden INTEGER NOT NULL DEFAULT 0,
      priority TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT,
      deleted_at TEXT,
      hidden_at TEXT
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      content TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity (
      day TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      summary TEXT NOT NULL DEFAULT '',
      weight INTEGER NOT NULL DEFAULT 1,
      chars INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_operation_logs_day ON operation_logs(day);
  `)

  // 兼容旧库：补列
  const cols = db.prepare(`PRAGMA table_info(operation_logs)`).all() as { name: string }[]
  if (cols.length > 0 && !cols.some((col) => col.name === 'weight')) {
    db.exec(`ALTER TABLE operation_logs ADD COLUMN weight INTEGER NOT NULL DEFAULT 1`)
  }
  if (cols.length > 0 && !cols.some((col) => col.name === 'chars')) {
    db.exec(`ALTER TABLE operation_logs ADD COLUMN chars INTEGER NOT NULL DEFAULT 0`)
  }

  const todoCols = db.prepare(`PRAGMA table_info(todos)`).all() as { name: string }[]
  if (todoCols.length > 0 && !todoCols.some((col) => col.name === 'priority')) {
    db.exec(`ALTER TABLE todos ADD COLUMN priority TEXT`)
  }
  if (todoCols.length > 0 && !todoCols.some((col) => col.name === 'hidden')) {
    db.exec(`ALTER TABLE todos ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0`)
  }
  if (todoCols.length > 0 && !todoCols.some((col) => col.name === 'deleted_at')) {
    db.exec(`ALTER TABLE todos ADD COLUMN deleted_at TEXT`)
  }
  if (todoCols.length > 0 && !todoCols.some((col) => col.name === 'hidden_at')) {
    db.exec(`ALTER TABLE todos ADD COLUMN hidden_at TEXT`)
  }

  const note = db.prepare('SELECT id FROM notes WHERE id = 1').get()
  if (!note) {
    db.prepare('INSERT INTO notes (id, content, updated_at) VALUES (1, ?, ?)').run(
      '',
      new Date().toISOString(),
    )
  }

  return db
}

export function nowIso(): string {
  return new Date().toISOString()
}
