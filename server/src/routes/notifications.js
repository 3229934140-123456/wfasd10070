const express = require('express');
const { db } = require('../database/init');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, (req, res) => {
  const { page = 1, limit = 20, unread_only } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE user_id = ?';
  let params = [req.user.id];

  if (unread_only === 'true') {
    whereClause += ' AND is_read = 0';
  }

  const notifications = db.prepare(`
    SELECT * FROM notifications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM notifications ${whereClause}
  `).get(...params).count;

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).count;

  res.json({
    notifications,
    total,
    unreadCount,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

router.put('/:id/read', authMiddleware, (req, res) => {
  const { id } = req.params;

  const notification = db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
  if (!notification) {
    return res.status(404).json({ error: '通知不存在' });
  }

  if (notification.user_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此通知' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(id);

  res.json({ success: true });
});

router.put('/read-all', authMiddleware, (req, res) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  res.json({ success: true });
});

module.exports = router;
