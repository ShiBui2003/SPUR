import { DatabaseSync } from 'node:sqlite';
import path from 'path';

// Resolves to server/chat.db whether running via tsx (src/) or compiled (dist/)
const DB_PATH = path.resolve(__dirname, '..', 'chat.db');

const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    createdAt TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversationId TEXT NOT NULL,
    sender TEXT NOT NULL CHECK(sender IN ('user', 'ai')),
    text TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    FOREIGN KEY (conversationId) REFERENCES conversations(id)
  )
`);

export default db;
