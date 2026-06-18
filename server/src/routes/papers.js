const express = require('express');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { db, transaction } = require('../database/init');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

const uploadDir = path.join(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const paperDir = path.join(uploadDir, req.params.paperId || 'temp');
    if (!fs.existsSync(paperDir)) {
      fs.mkdirSync(paperDir, { recursive: true });
    }
    cb(null, paperDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('只允许上传PDF文件'), false);
    }
  },
  limits: { fileSize: 50 * 1024 * 1024 }
});

function addNotification(userId, type, title, content, relatedId) {
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, title, content, relatedId || null);
}

router.get('/', authMiddleware, (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  let query, countQuery, params = [];

  if (req.user.role === 'author') {
    query = `
      SELECT p.*, 
             (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id) as review_count,
             (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id AND r.status = 'completed') as completed_reviews
      FROM papers p
      WHERE p.corresponding_author_id = ?
    `;
    countQuery = 'SELECT COUNT(*) as count FROM papers WHERE corresponding_author_id = ?';
    params = [req.user.id];
  } else if (req.user.role === 'reviewer') {
    query = `
      SELECT p.*, r.status as review_status, r.id as review_id,
             r.invitation_date, r.due_date, r.completed_date
      FROM papers p
      JOIN reviews r ON p.id = r.paper_id
      WHERE r.reviewer_id = ?
    `;
    countQuery = `
      SELECT COUNT(*) as count FROM reviews r WHERE r.reviewer_id = ?
    `;
    params = [req.user.id];
  } else {
    query = `
      SELECT p.*,
             (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id) as review_count,
             (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id AND r.status = 'completed') as completed_reviews,
             u.name as author_name
      FROM papers p
      LEFT JOIN users u ON p.corresponding_author_id = u.id
    `;
    countQuery = 'SELECT COUNT(*) as count FROM papers';
  }

  if (status && status !== 'all') {
    query += ' WHERE p.status = ?';
    countQuery += ' WHERE status = ?';
    params = [...params, status];
  }

  query += ' ORDER BY p.submitted_at DESC LIMIT ? OFFSET ?';
  params = [...params, parseInt(limit), offset];

  const papers = db.prepare(query).all(...params);
  const total = db.prepare(countQuery).get(...params.slice(0, params.length - 2))?.count || 0;

  papers.forEach(paper => {
    const keywords = db.prepare(`
      SELECT keyword FROM paper_keywords WHERE paper_id = ?
    `).all(paper.id).map(k => k.keyword);
    paper.keywords = keywords;

    let authors = db.prepare(`
      SELECT * FROM paper_authors WHERE paper_id = ? ORDER BY author_order
    `).all(paper.id);
    if (req.user.role === 'reviewer') {
      authors = authors.map(a => ({
        id: a.id, paper_id: a.paper_id, author_order: a.author_order,
        name: '[作者信息已隐藏]', email: null, affiliation: null, is_corresponding: a.is_corresponding,
      }));
    }
    paper.authors = authors;

    const fields = db.prepare(`
      SELECT f.id, f.name, f.category
      FROM paper_fields pf
      JOIN fields f ON pf.field_id = f.id
      WHERE pf.paper_id = ?
      ORDER BY f.category, f.name
    `).all(paper.id);
    paper.fields = fields;
  });

  res.json({
    papers,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit)
  });
});

router.post('/', authMiddleware, requireRole('author'), upload.single('file'), (req, res) => {
  const { title, abstract } = req.body;
  
  let keywords = [];
  let authors = [];
  let fields = [];
  
  try {
    if (req.body.keywords) {
      keywords = typeof req.body.keywords === 'string' ? JSON.parse(req.body.keywords) : req.body.keywords;
    }
    if (req.body.authors) {
      authors = typeof req.body.authors === 'string' ? JSON.parse(req.body.authors) : req.body.authors;
    }
    if (req.body.fields) {
      fields = typeof req.body.fields === 'string' ? JSON.parse(req.body.fields) : req.body.fields;
    }
  } catch (parseErr) {
    console.error('解析表单数据失败:', parseErr);
  }

  if (!title || !abstract) {
    return res.status(400).json({ error: '请填写标题和摘要' });
  }

  const paperId = uuidv4();
  const fileName = req.file ? req.file.filename : null;
  const originalName = req.file ? req.file.originalname : null;
  const filePath = req.file ? path.join('uploads', paperId, fileName) : null;

  if (req.file) {
    const oldPath = req.file.path;
    const newDir = path.join(uploadDir, paperId);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    const newPath = path.join(newDir, fileName);
    fs.renameSync(oldPath, newPath);
  }

  transaction(() => {
    db.prepare(`
      INSERT INTO papers (id, title, abstract, corresponding_author_id, file_path, file_name, status)
      VALUES (?, ?, ?, ?, ?, ?, 'submitted')
    `).run(paperId, title, abstract, req.user.id, filePath, originalName);

    db.prepare(`
      INSERT INTO paper_versions (paper_id, version_number, title, abstract, file_path, file_name, version_notes)
      VALUES (?, 1, ?, ?, ?, ?, '初始投稿')
    `).run(paperId, title, abstract, filePath, originalName);

    if (keywords && Array.isArray(keywords)) {
      const insertKeyword = db.prepare('INSERT INTO paper_keywords (paper_id, keyword) VALUES (?, ?)');
      keywords.forEach(kw => insertKeyword.run(paperId, kw));
    }

    if (authors && Array.isArray(authors)) {
      const insertAuthor = db.prepare(`
        INSERT INTO paper_authors (paper_id, name, email, affiliation, is_corresponding, author_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      authors.forEach((author, index) => {
        insertAuthor.run(
          paperId,
          author.name,
          author.email || null,
          author.affiliation || null,
          author.is_corresponding ? 1 : 0,
          index
        );
      });
    }

    if (fields && Array.isArray(fields)) {
      const insertField = db.prepare('INSERT OR IGNORE INTO paper_fields (paper_id, field_id) VALUES (?, ?)');
      fields.forEach(fieldId => insertField.run(paperId, fieldId));
    }
  });

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  
  res.status(201).json({ paper });
});

router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  const paper = db.prepare(`
    SELECT p.*, u.name as corresponding_author_name, u.email as corresponding_author_email
    FROM papers p
    LEFT JOIN users u ON p.corresponding_author_id = u.id
    WHERE p.id = ?
  `).get(id);

  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }

  if (req.user.role === 'author' && paper.corresponding_author_id !== req.user.id) {
    return res.status(403).json({ error: '无权查看此论文' });
  }

  if (req.user.role === 'reviewer') {
    const review = db.prepare('SELECT * FROM reviews WHERE paper_id = ? AND reviewer_id = ?').get(id, req.user.id);
    if (!review) {
      return res.status(403).json({ error: '无权查看此论文' });
    }
  }

  let authors = db.prepare(`
    SELECT * FROM paper_authors WHERE paper_id = ? ORDER BY author_order
  `).all(id);
  
  if (req.user.role === 'reviewer') {
    authors = authors.map(a => ({
      id: a.id,
      paper_id: a.paper_id,
      author_order: a.author_order,
      name: '[作者信息已隐藏]',
      email: null,
      affiliation: null,
      is_corresponding: a.is_corresponding,
    }));
    delete paper.corresponding_author_name;
    delete paper.corresponding_author_email;
  }

  const keywords = db.prepare(`
    SELECT keyword FROM paper_keywords WHERE paper_id = ?
  `).all(id).map(k => k.keyword);

  const fields = db.prepare(`
    SELECT f.id, f.name, f.category
    FROM paper_fields pf
    JOIN fields f ON pf.field_id = f.id
    WHERE pf.paper_id = ?
    ORDER BY f.category, f.name
  `).all(id);

  const versions = db.prepare(`
    SELECT * FROM paper_versions WHERE paper_id = ? ORDER BY version_number DESC
  `).all(id);

  let reviews = [];
  if (req.user.role === 'editor') {
    reviews = db.prepare(`
      SELECT r.*, u.name as reviewer_name, u.affiliation as reviewer_affiliation, u.email as reviewer_email
      FROM reviews r
      LEFT JOIN users u ON r.reviewer_id = u.id
      WHERE r.paper_id = ?
      ORDER BY r.invitation_date
    `).all(id);
  } else if (req.user.role === 'author') {
    reviews = db.prepare(`
      SELECT r.id, r.paper_id, r.reviewer_id, r.status, r.invitation_date, r.accepted_date,
             r.completed_date, r.due_date, r.recommendation, r.comments_to_author,
             r.reminder_sent
      FROM reviews r
      WHERE r.paper_id = ? AND r.status = 'completed'
      ORDER BY r.completed_date
    `).all(id);
    
    reviews = reviews.map(r => ({
      ...r,
      reviewer_name: '审稿人',
      reviewer_affiliation: null,
    }));
  } else if (req.user.role === 'reviewer') {
    reviews = db.prepare(`
      SELECT * FROM reviews WHERE paper_id = ? AND reviewer_id = ?
    `).all(id, req.user.id);
  }

  if (req.user.role === 'author' || req.user.role === 'reviewer') {
    reviews.forEach(review => {
      const responses = db.prepare(`
        SELECT * FROM author_responses WHERE review_id = ? ORDER BY submitted_at DESC
      `).all(review.id);
      review.responses = responses;
    });
  }

  const decisions = db.prepare(`
    SELECT pd.*, u.name as editor_name
    FROM paper_decisions pd
    LEFT JOIN users u ON pd.editor_id = u.id
    WHERE pd.paper_id = ?
    ORDER BY pd.decision_date DESC
  `).all(id);

  res.json({
    paper: {
      ...paper,
      authors,
      keywords,
      fields,
      versions,
      reviews,
      decisions
    }
  });
});

router.put('/:id', authMiddleware, requireRole('author'), upload.single('file'), (req, res) => {
  const { id } = req.params;
  const { title, abstract, version_notes } = req.body;
  
  let keywords = [];
  let authors = [];
  
  try {
    if (req.body.keywords) {
      keywords = typeof req.body.keywords === 'string' ? JSON.parse(req.body.keywords) : req.body.keywords;
    }
    if (req.body.authors) {
      authors = typeof req.body.authors === 'string' ? JSON.parse(req.body.authors) : req.body.authors;
    }
  } catch (parseErr) {
    console.error('解析表单数据失败:', parseErr);
  }

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(id);
  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }

  if (paper.corresponding_author_id !== req.user.id) {
    return res.status(403).json({ error: '无权修改此论文' });
  }

  const newVersion = paper.current_version + 1;
  let filePath = paper.file_path;
  let fileName = paper.file_name;

  if (req.file) {
    const newDir = path.join(uploadDir, id);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    const newFileName = req.file.filename;
    const newPath = path.join(newDir, newFileName);
    fs.renameSync(req.file.path, newPath);
    filePath = path.join('uploads', id, newFileName);
    fileName = req.file.originalname;
  }

  transaction(() => {
    db.prepare(`
      UPDATE papers 
      SET title = ?, abstract = ?, file_path = ?, file_name = ?, 
          current_version = ?, updated_at = CURRENT_TIMESTAMP,
          status = CASE WHEN status = 'revise' THEN 'revision_submitted' ELSE status END
      WHERE id = ?
    `).run(title, abstract, filePath, fileName, newVersion, id);

    db.prepare(`
      INSERT INTO paper_versions (paper_id, version_number, title, abstract, file_path, file_name, version_notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, newVersion, title, abstract, filePath, fileName, version_notes || '修改稿');

    if (keywords && Array.isArray(keywords)) {
      db.prepare('DELETE FROM paper_keywords WHERE paper_id = ?').run(id);
      const insertKeyword = db.prepare('INSERT INTO paper_keywords (paper_id, keyword) VALUES (?, ?)');
      keywords.forEach(kw => insertKeyword.run(id, kw));
    }

    if (authors && Array.isArray(authors)) {
      db.prepare('DELETE FROM paper_authors WHERE paper_id = ?').run(id);
      const insertAuthor = db.prepare(`
        INSERT INTO paper_authors (paper_id, name, email, affiliation, is_corresponding, author_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      authors.forEach((author, index) => {
        insertAuthor.run(
          id,
          author.name,
          author.email || null,
          author.affiliation || null,
          author.is_corresponding ? 1 : 0,
          index
        );
      });
    }

    const reviews = db.prepare("SELECT * FROM reviews WHERE paper_id = ? AND status IN ('completed', 'accepted')").all(id);
    reviews.forEach(review => {
      db.prepare(`
        UPDATE reviews 
        SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(review.id);
    });
  });

  const updatedPaper = db.prepare('SELECT * FROM papers WHERE id = ?').get(id);
  res.json({ paper: updatedPaper });
});

router.get('/:id/download', authMiddleware, (req, res) => {
  const { id } = req.params;
  const { version } = req.query;

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(id);
  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }

  if (req.user.role === 'author' && paper.corresponding_author_id !== req.user.id) {
    return res.status(403).json({ error: '无权下载此论文' });
  }

  if (req.user.role === 'reviewer') {
    const review = db.prepare('SELECT * FROM reviews WHERE paper_id = ? AND reviewer_id = ?').get(id, req.user.id);
    if (!review || review.status === 'invited') {
      return res.status(403).json({ error: '无权下载此论文' });
    }
  }

  let filePath, fileName;
  if (version) {
    const paperVersion = db.prepare('SELECT * FROM paper_versions WHERE paper_id = ? AND version_number = ?').get(id, version);
    if (!paperVersion) {
      return res.status(404).json({ error: '该版本不存在' });
    }
    filePath = paperVersion.file_path;
    fileName = paperVersion.file_name;
  } else {
    filePath = paper.file_path;
    fileName = paper.file_name;
  }

  if (!filePath) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const fullPath = path.join(__dirname, '..', '..', filePath);
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ error: '文件不存在' });
  }

  res.download(fullPath, fileName);
});

router.get('/:id/authors', authMiddleware, (req, res) => {
  const { id } = req.params;
  
  const authors = db.prepare(`
    SELECT * FROM paper_authors WHERE paper_id = ? ORDER BY author_order
  `).all(id);

  res.json({ authors });
});

module.exports = router;
