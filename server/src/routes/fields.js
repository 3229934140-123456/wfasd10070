const express = require('express');
const { db } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const fields = db.prepare(`
    SELECT f.*, 
           (SELECT COUNT(*) FROM reviewer_fields rf WHERE rf.field_id = f.id) as reviewer_count,
           (SELECT COUNT(*) FROM paper_fields pf WHERE pf.field_id = f.id) as paper_count
    FROM fields f
    ORDER BY f.category, f.name
  `).all();

  const grouped = {};
  fields.forEach(f => {
    if (!grouped[f.category]) {
      grouped[f.category] = [];
    }
    grouped[f.category].push(f);
  });

  res.json({ fields, grouped });
});

router.post('/', authMiddleware, (req, res) => {
  const { name, category } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: '请填写领域名称和分类' });
  }

  const existing = db.prepare('SELECT id FROM fields WHERE name = ?').get(name);
  if (existing) {
    return res.status(400).json({ error: '该领域已存在' });
  }

  const result = db.prepare('INSERT INTO fields (name, category) VALUES (?, ?)').run(name, category);

  const field = db.prepare('SELECT * FROM fields WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ field });
});

module.exports = router;
