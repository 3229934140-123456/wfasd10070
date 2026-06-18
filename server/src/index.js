require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 5000;

async function startServer() {
  await initDatabase();

  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: '学术论文同行评审系统 API 服务运行正常' });
  });

  const authRoutes = require('./routes/auth');
  const paperRoutes = require('./routes/papers');
  const reviewRoutes = require('./routes/reviews');
  const statsRoutes = require('./routes/statistics');
  const fieldRoutes = require('./routes/fields');
  const notificationRoutes = require('./routes/notifications');
  const userRoutes = require('./routes/users');

  app.use('/api/auth', authRoutes);
  app.use('/api/papers', paperRoutes);
  app.use('/api/reviews', reviewRoutes);
  app.use('/api/statistics', statsRoutes);
  app.use('/api/fields', fieldRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/users', userRoutes);

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: '服务器内部错误', message: err.message });
  });

  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
    console.log(`API 健康检查: http://localhost:${PORT}/api/health`);
  });
}

startServer().catch(err => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});
