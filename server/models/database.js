/**
 * إعداد قاعدة البيانات SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './data/complaints.db';
const dbDir = path.dirname(DB_PATH);

// إنشاء مجلد البيانات إذا لم يكن موجوداً
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// إنشاء الجداول
const initDatabase = () => {
  // جدول المستخدمين (المسؤولين)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'super_admin', 'viewer')),
      email TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  // جدول الشكاوى
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tracking_id TEXT UNIQUE NOT NULL,
      category TEXT NOT NULL,
      department TEXT,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      is_anonymous INTEGER DEFAULT 0,
      complainant_name TEXT,
      complainant_email TEXT,
      complainant_employee_id TEXT,
      incident_date DATE,
      confidentiality TEXT DEFAULT 'confidential' CHECK(confidentiality IN ('confidential', 'disclosed')),
      status TEXT DEFAULT 'new' CHECK(status IN ('new', 'pending', 'progress', 'resolved', 'closed')),
      priority TEXT DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
      assigned_to INTEGER REFERENCES users(id),
      resolution_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME
    )
  `);

  // جدول المرفقات
  db.exec(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // جدول سجل التحديثات (Timeline)
  db.exec(`
    CREATE TABLE IF NOT EXISTS complaint_timeline (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      complaint_id INTEGER NOT NULL REFERENCES complaints(id) ON DELETE CASCADE,
      status TEXT,
      note TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // جدول جلسات تسجيل الدخول
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL
    )
  `);

  // إنشاء الفهارس لتحسين الأداء
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_complaints_tracking ON complaints(tracking_id);
    CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
    CREATE INDEX IF NOT EXISTS idx_complaints_category ON complaints(category);
    CREATE INDEX IF NOT EXISTS idx_complaints_created ON complaints(created_at);
    CREATE INDEX IF NOT EXISTS idx_timeline_complaint ON complaint_timeline(complaint_id);
    CREATE INDEX IF NOT EXISTS idx_attachments_complaint ON attachments(complaint_id);
  `);

  console.log('✅ تم إعداد قاعدة البيانات بنجاح');
};

// تهيئة قاعدة البيانات عند التشغيل
initDatabase();

module.exports = db;
