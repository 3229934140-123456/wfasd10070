const express = require('express');
const bcrypt = require('bcryptjs');
const { db, transaction } = require('../database/init');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, requireRole('editor'), (req, res) => {
  const { role, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = '';
  let params = [];

  if (role && role !== 'all') {
    whereClause = 'WHERE role = ?';
    params.push(role);
  }

  const users = db.prepare(`
    SELECT id, email, name, role, affiliation, bio, created_at
    FROM users
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM users ${whereClause}
  `).get(...params).count;

  users.forEach(user => {
    if (user.role === 'reviewer') {
      const fields = db.prepare(`
        SELECT f.id, f.name FROM fields f
        JOIN reviewer_fields rf ON f.id = rf.field_id
        WHERE rf.reviewer_id = ?
      `).all(user.id);
      user.fields = fields;
    }
  });

  res.json({
    users,
    total,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

router.get('/reviewers', authMiddleware, requireRole('editor'), (req, res) => {
  const { field_id } = req.query;

  let query = `
    SELECT u.id, u.name, u.email, u.affiliation
    FROM users u
    WHERE u.role = 'reviewer'
  `;
  let params = [];

  if (field_id) {
    query += `
      AND u.id IN (
        SELECT reviewer_id FROM reviewer_fields WHERE field_id = ?)
    `;
    params.push(field_id);
  }

  query += ' ORDER BY u.name';

  const reviewers = db.prepare(query).all(...params);

  reviewers.forEach(reviewer => {
    const fields = db.prepare(`
      SELECT f.name FROM fields f
      JOIN reviewer_fields rf ON f.id = rf.field_id
      WHERE rf.reviewer_id = ?
    `).all(reviewer.id).map(f => f.name);
    reviewer.fields = fields;
  });

  res.json({ reviewers });
});

router.post('/', authMiddleware, requireRole('editor'), (req, res) => {
  const { email, password, name, role, affiliation, fields } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: '请填写必要信息' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: '该邮箱已被注册' });
  }

  const { v4: uuidv4 } = require('uuid');
  const hashedPassword = bcrypt.hashSync(password, 10);
  const userId = uuidv4();
  const userRole = role && ['author', 'reviewer', 'editor'].includes(role) ? role : 'author';

  transaction(() => {
    db.prepare(`
      INSERT INTO users (id, email, password, name, role, affiliation)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email, hashedPassword, name, userRole, affiliation || null);

    if (userRole === 'reviewer' && Array.isArray(fields)) {
      const insertField = db.prepare('INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id) VALUES (?, ?)');
      fields.forEach(fieldId => insertField.run(userId, fieldId));
    }
  });

  const user = db.prepare('SELECT id, email, name, role, affiliation, created_at FROM users WHERE id = ?').get(userId);
  
  res.status(201).json({ user });
});

router.put('/:id', authMiddleware, requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const { name, role, affiliation, bio, fields } = req.body;

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  transaction(() => {
    db.prepare(`
      UPDATE users 
      SET name = COALESCE(?, name),
          role = COALESCE(?, role),
          affiliation = COALESCE(?, affiliation),
          bio = COALESCE(?, bio)
      WHERE id = ?
    `).run(name || null, role || null, affiliation || null, bio || null, id);

    if (role === 'reviewer' || user.role === 'reviewer') {
      db.prepare('DELETE FROM reviewer_fields WHERE reviewer_id = ?').run(id);
      if (Array.isArray(fields)) {
        const insertField = db.prepare('INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id) VALUES (?, ?)');
        fields.forEach(fieldId => insertField.run(id, fieldId));
      }
    }
  });

  const updatedUser = db.prepare('SELECT id, email, name, role, affiliation, bio, created_at FROM users WHERE id = ?').get(id);
  
  res.json({ user: updatedUser });
});

module.exports = router;
