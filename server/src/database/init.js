const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

let db = null;
let dbPath = null;

class Database {
  constructor(sqlDb) {
    this._db = sqlDb;
  }

  prepare(sql) {
    return new Statement(this._db, sql);
  }

  exec(sql) {
    this._db.run(sql);
    saveDatabase();
  }

  pragma(sql) {
    return this._db.exec(`PRAGMA ${sql}`);
  }
}

class Statement {
  constructor(sqlDb, sql) {
    this._db = sqlDb;
    this._sql = sql;
  }

  run(...params) {
    try {
      const stmt = this._db.prepare(this._sql);
      stmt.bind(params);
      stmt.step();
      stmt.free();
      
      const result = this._db.exec('SELECT last_insert_rowid() as id, changes() as changes');
      saveDatabase();
      
      return {
        lastInsertRowid: result[0]?.values[0]?.[0] || null,
        changes: result[0]?.values[0]?.[1] || 0,
      };
    } catch (err) {
      console.error('SQL error:', this._sql, err.message);
      throw err;
    }
  }

  get(...params) {
    try {
      const stmt = this._db.prepare(this._sql);
      stmt.bind(params);
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      
      return results[0] || undefined;
    } catch (err) {
      console.error('SQL error:', this._sql, err.message);
      throw err;
    }
  }

  all(...params) {
    try {
      const stmt = this._db.prepare(this._sql);
      stmt.bind(params);
      
      const results = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      
      return results;
    } catch (err) {
      console.error('SQL error:', this._sql, err.message);
      throw err;
    }
  }
}

let saveTimeout = null;
function saveDatabase() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    if (db && dbPath) {
      try {
        const data = db._db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(dbPath, buffer);
      } catch (err) {
        console.error('保存数据库失败:', err.message);
      }
    }
  }, 100);
}

function transaction(fn) {
  db.exec('BEGIN TRANSACTION');
  try {
    fn();
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();
  
  dbPath = path.join(__dirname, '..', '..', 'data.db');
  
  let sqlDb;
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(buffer);
  } else {
    sqlDb = new SQL.Database();
  }
  
  db = new Database(sqlDb);

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'author',
      affiliation TEXT,
      bio TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fields (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      category TEXT
    );

    CREATE TABLE IF NOT EXISTS reviewer_fields (
      reviewer_id TEXT NOT NULL,
      field_id INTEGER NOT NULL,
      PRIMARY KEY (reviewer_id, field_id)
    );

    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      abstract TEXT,
      corresponding_author_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'submitted',
      current_version INTEGER NOT NULL DEFAULT 1,
      file_path TEXT,
      file_name TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      decision TEXT,
      decision_date DATETIME,
      editor_id TEXT,
      required_reviews INTEGER DEFAULT 3
    );

    CREATE TABLE IF NOT EXISTS paper_authors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      affiliation TEXT,
      is_corresponding INTEGER DEFAULT 0,
      author_order INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS paper_keywords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      keyword TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paper_fields (
      paper_id TEXT NOT NULL,
      field_id INTEGER NOT NULL,
      PRIMARY KEY (paper_id, field_id)
    );

    CREATE TABLE IF NOT EXISTS paper_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      title TEXT,
      abstract TEXT,
      file_path TEXT,
      file_name TEXT,
      version_notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'invited',
      invitation_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      accepted_date DATETIME,
      completed_date DATETIME,
      due_date DATETIME,
      recommendation TEXT,
      comments_to_author TEXT,
      comments_to_editor TEXT,
      is_double_blind INTEGER DEFAULT 1,
      reminder_sent INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(paper_id, reviewer_id)
    );

    CREATE TABLE IF NOT EXISTS review_backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      reviewer_id TEXT NOT NULL,
      reviewer_order INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      invited_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS author_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id TEXT NOT NULL,
      paper_version INTEGER NOT NULL,
      response_text TEXT,
      point_by_point TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      related_id TEXT,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS paper_decisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT NOT NULL,
      decision TEXT NOT NULL,
      editor_id TEXT NOT NULL,
      decision_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      comments TEXT,
      paper_version INTEGER NOT NULL
    );
  `);

  const fields = [
    { name: '人工智能', category: '计算机科学' },
    { name: '机器学习', category: '计算机科学' },
    { name: '自然语言处理', category: '计算机科学' },
    { name: '计算机视觉', category: '计算机科学' },
    { name: '数据挖掘', category: '计算机科学' },
    { name: '软件工程', category: '计算机科学' },
    { name: '数据库系统', category: '计算机科学' },
    { name: '计算机网络', category: '计算机科学' },
    { name: '信息安全', category: '计算机科学' },
    { name: '云计算', category: '计算机科学' },
    { name: '量子计算', category: '物理学' },
    { name: '凝聚态物理', category: '物理学' },
    { name: '生物信息学', category: '生物学' },
    { name: '计算生物学', category: '生物学' },
    { name: '经济学', category: '社会科学' },
    { name: '金融学', category: '社会科学' },
  ];

  const insertField = db.prepare('INSERT OR IGNORE INTO fields (name, category) VALUES (?, ?)');
  fields.forEach(f => insertField.run(f.name, f.category));

  const adminEmail = 'admin@journal.com';
  const existingAdmin = db.prepare('SELECT id FROM users WHERE email = ?').get(adminEmail);
  
  if (!existingAdmin) {
    const { v4: uuidv4 } = require('uuid');
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const adminId = uuidv4();
    
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation, bio)
      VALUES (?, ?, ?, ?, 'editor', '学术期刊编辑部', '系统管理员，负责稿件管理和分配')
    `).run(adminId, adminEmail, hashedPassword, '张编辑');

    const allFields = db.prepare('SELECT id FROM fields').all();
    const insertReviewerField = db.prepare('INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id) VALUES (?, ?)');
    allFields.forEach(f => insertReviewerField.run(adminId, f.id));

    const reviewer1Id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation, bio)
      VALUES (?, ?, ?, ?, 'reviewer', '清华大学计算机系', '人工智能领域专家')
    `).run(reviewer1Id, 'reviewer1@journal.com', bcrypt.hashSync('reviewer123', 10), '李教授');
    
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '人工智能'))
    `).run(reviewer1Id);
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '机器学习'))
    `).run(reviewer1Id);
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '自然语言处理'))
    `).run(reviewer1Id);

    const reviewer2Id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation, bio)
      VALUES (?, ?, ?, ?, 'reviewer', '北京大学信息学院', '计算机视觉专家')
    `).run(reviewer2Id, 'reviewer2@journal.com', bcrypt.hashSync('reviewer123', 10), '王教授');
    
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '计算机视觉'))
    `).run(reviewer2Id);
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '机器学习'))
    `).run(reviewer2Id);

    const reviewer3Id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation, bio)
      VALUES (?, ?, ?, ?, 'reviewer', '上海交通大学', '数据科学专家')
    `).run(reviewer3Id, 'reviewer3@journal.com', bcrypt.hashSync('reviewer123', 10), '赵教授');
    
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '数据挖掘'))
    `).run(reviewer3Id);
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '机器学习'))
    `).run(reviewer3Id);
    db.prepare(`
      INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
      VALUES (?, (SELECT id FROM fields WHERE name = '数据库系统'))
    `).run(reviewer3Id);

    const author1Id = uuidv4();
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation, bio)
      VALUES (?, ?, ?, ?, 'author', '浙江大学', '博士研究生')
    `).run(author1Id, 'author1@journal.com', bcrypt.hashSync('author123', 10), '陈同学');
  }

  // 数据库迁移：添加 required_reviews 字段（如果不存在）
  try {
    db.prepare(`ALTER TABLE papers ADD COLUMN required_reviews INTEGER DEFAULT 3`).run();
  } catch (e) {
    // 字段已存在，忽略错误
  }

  saveDatabase();

  console.log('数据库初始化完成');
  console.log('测试账号:');
  console.log('  编辑: admin@journal.com / admin123');
  console.log('  审稿人1: reviewer1@journal.com / reviewer123');
  console.log('  审稿人2: reviewer2@journal.com / reviewer123');
  console.log('  审稿人3: reviewer3@journal.com / reviewer123');
  console.log('  作者: author1@journal.com / author123');
}

module.exports = { 
  get db() { return db; },
  initDatabase,
  transaction
};
