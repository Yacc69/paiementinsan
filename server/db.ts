import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';

const dbPath = path.resolve(process.cwd(), 'database.sqlite');
const db = new Database(dbPath);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'requester',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
  );

  CREATE TABLE IF NOT EXISTS employees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    salary REAL NOT NULL,
    start_date DATE NOT NULL,
    added_by INTEGER,
    added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(added_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    sub_category_id INTEGER,
    amount REAL NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by INTEGER,
    attachment TEXT,
    date DATE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(category_id) REFERENCES categories(id),
    FOREIGN KEY(sub_category_id) REFERENCES sub_categories(id),
    FOREIGN KEY(approved_by) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS sub_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    FOREIGN KEY(category_id) REFERENCES categories(id),
    UNIQUE(category_id, name)
  );
`);

// Migration: Add columns if they don't exist
try {
  db.exec('ALTER TABLE expenses ADD COLUMN approved_by INTEGER REFERENCES users(id)');
} catch (e) {}

try {
  db.exec('ALTER TABLE expenses ADD COLUMN sub_category_id INTEGER REFERENCES sub_categories(id)');
} catch (e) {}

try {
  db.exec('ALTER TABLE expenses ADD COLUMN attachment TEXT');
} catch (e) {}

// Seed initial admin user if not exists
const adminEmail = 'admin@example.com';
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);

if (!adminExists) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)').run(adminEmail, hash, 'admin');
}

// Seed categories if empty
const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
if (categoriesCount.count === 0) {
  const categories = ['Matériel', 'Logiciel', 'Déplacement', 'Fournitures', 'Services', 'Autre'];
  const insertCategory = db.prepare('INSERT INTO categories (name) VALUES (?)');
  const insertMany = db.transaction((cats) => {
    for (const cat of cats) insertCategory.run(cat);
  });
  insertMany(categories);
}

export default db;
