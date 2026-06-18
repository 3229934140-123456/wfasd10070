const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db, transaction } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.post('/register', (req, res) => {
  const { email, password, name, role, affiliation } = req.body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existingUser) {
    return res.status(400).json({ error: '该邮箱已被注册' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const userId = uuidv4();
  const userRole = role && ['author', 'reviewer'].includes(role) ? role : 'author';

  db.prepare(`
    INSERT INTO users (id, email, password, name, role, affiliation)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(userId, email, hashedPassword, name, userRole, affiliation || null);

  const token = jwt.sign({ userId, role: userRole }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.status(201).json({
    token,
    user: {
      id: userId,
      email,
      name,
      role: userRole,
      affiliation: affiliation || null
    }
  });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '请填写邮箱和密码' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  const isValid = bcrypt.compareSync(password, user.password);
  if (!isValid) {
    return res.status(401).json({ error: '邮箱或密码错误' });
  }

  const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      affiliation: user.affiliation,
      bio: user.bio
    }
  });
});

router.get('/me', authMiddleware, (req, res) => {
  const user = db.prepare(`
    SELECT id, email, name, role, affiliation, bio, created_at 
    FROM users WHERE id = ?
  `).get(req.user.id);

  if (user.role === 'reviewer') {
    const fields = db.prepare(`
      SELECT f.id, f.name, f.category 
      FROM fields f
      JOIN reviewer_fields rf ON f.id = rf.field_id
      WHERE rf.reviewer_id = ?
    `).all(req.user.id);
    user.fields = fields;
  }

  res.json({ user });
});

router.put('/profile', authMiddleware, (req, res) => {
  const { name, affiliation, bio, fields } = req.body;

  db.prepare(`
    UPDATE users 
    SET name = COALESCE(?, name),
        affiliation = COALESCE(?, affiliation),
        bio = COALESCE(?, bio)
    WHERE id = ?
  `).run(name || null, affiliation || null, bio || null, req.user.id);

  if (req.user.role === 'reviewer' && Array.isArray(fields)) {
    transaction(() => {
      db.prepare('DELETE FROM reviewer_fields WHERE reviewer_id = ?').run(req.user.id);
      
      const insertField = db.prepare(`
        INSERT OR IGNORE INTO reviewer_fields (reviewer_id, field_id)
        VALUES (?, ?)
      `);
      
      fields.forEach(fieldId => {
        insertField.run(req.user.id, fieldId);
      });
    });
  }

  const user = db.prepare(`
    SELECT id, email, name, role, affiliation, bio 
    FROM users WHERE id = ?
  `).get(req.user.id);

  res.json({ user });
});

module.exports = router;
