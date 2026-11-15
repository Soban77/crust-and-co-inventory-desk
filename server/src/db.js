import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const configuredPath = process.env.DATABASE_PATH || path.resolve(here, "../data/inventory.sqlite");
const databasePath = path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
fs.mkdirSync(path.dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('manager', 'staff')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    quantity_available REAL NOT NULL DEFAULT 0 CHECK (quantity_available >= 0),
    minimum_stock_level REAL NOT NULL DEFAULT 0 CHECK (minimum_stock_level >= 0),
    supplier TEXT,
    notes TEXT,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS stock_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL REFERENCES inventory_items(id),
    type TEXT NOT NULL CHECK (type IN ('STOCK_IN', 'STOCK_OUT', 'ADJUSTMENT')),
    quantity_changed REAL NOT NULL CHECK (quantity_changed != 0),
    recorded_by INTEGER NOT NULL REFERENCES users(id),
    remarks TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE INDEX IF NOT EXISTS idx_items_active_name ON inventory_items(active, name);
  CREATE INDEX IF NOT EXISTS idx_transactions_item_created ON stock_transactions(item_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_transactions_created ON stock_transactions(created_at DESC);
`);
