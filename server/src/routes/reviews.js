const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db, transaction } = require('../database/init');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

function addNotification(userId, type, title, content, relatedId) {
  db.prepare(`
    INSERT INTO notifications (user_id, type, title, content, related_id)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, type, title, content, relatedId || null);
}

function getNextBackupReviewer(paperId) {
  return db.prepare(`
    SELECT r.reviewer_id, r.reviewer_order
    FROM review_backups r
    WHERE r.paper_id = ? AND r.status = 'pending'
    ORDER BY r.reviewer_order ASC
    LIMIT 1
  `).get(paperId);
}

function inviteNextReviewer(paperId) {
  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) return null;

  const requiredReviews = paper.required_reviews || 3;
  const currentValid = db.prepare(`
    SELECT COUNT(*) as count FROM reviews 
    WHERE paper_id = ? AND status IN ('completed', 'accepted')
  `).get(paperId).count;

  if (currentValid >= requiredReviews) {
    console.log(`[inviteNextReviewer] 已达到所需审稿数 ${currentValid}/${requiredReviews}，不再邀请下一位`);
    return null;
  }

  const remainingNeeded = requiredReviews - currentValid;
  console.log(`[inviteNextReviewer] 已有 ${currentValid}/${requiredReviews} 份有效意见，还需 ${remainingNeeded} 份`);

  const next = getNextBackupReviewer(paperId);
  if (!next) return null;

  const reviewId = uuidv4();
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  db.prepare(`
    INSERT INTO reviews (id, paper_id, reviewer_id, status, invitation_date, due_date)
    VALUES (?, ?, ?, 'invited', CURRENT_TIMESTAMP, ?)
  `).run(reviewId, paperId, next.reviewer_id, dueDate.toISOString());

  db.prepare(`
    UPDATE review_backups 
    SET status = 'invited', invited_at = CURRENT_TIMESTAMP
    WHERE paper_id = ? AND reviewer_id = ?
  `).run(paperId, next.reviewer_id);

  const reviewer = db.prepare('SELECT name, email FROM users WHERE id = ?').get(next.reviewer_id);
  addNotification(next.reviewer_id, 'review_invite', '审稿邀请', '您有一篇新的审稿邀请', paperId);

  return { reviewId, reviewerId: next.reviewer_id };
}

router.get('/my', authMiddleware, requireRole('reviewer'), (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const offset = (page - 1) * limit;

  let whereClause = '';
  let params = [req.user.id];

  if (status && status !== 'all') {
    whereClause = 'AND r.status = ?';
    params.push(status);
  }

  const reviews = db.prepare(`
    SELECT r.*, p.title, p.abstract, p.status as paper_status,
           p.current_version, p.submitted_at
    FROM reviews r
    JOIN papers p ON r.paper_id = p.id
    WHERE r.reviewer_id = ? ${whereClause ? 'AND ' + whereClause.slice(4) : ''}
    ORDER BY r.invitation_date DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(limit), offset);

  const total = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE reviewer_id = ? ${whereClause ? 'AND ' + whereClause.slice(4) : ''}
  `).get(...params).count;

  reviews.forEach(review => {
    const keywords = db.prepare(`
      SELECT keyword FROM paper_keywords WHERE paper_id = ?
    `).all(review.paper_id).map(k => k.keyword);
    review.keywords = keywords;
  });

  res.json({
    reviews,
    total,
    page: parseInt(page),
    limit: parseInt(limit),
    totalPages: Math.ceil(total / limit)
  });
});

router.get('/:id', authMiddleware, (req, res) => {
  const { id } = req.params;

  const review = db.prepare(`
    SELECT r.*, p.title, p.abstract, p.status as paper_status,
           p.current_version, p.file_path, p.file_name, p.submitted_at
    FROM reviews r
    JOIN papers p ON r.paper_id = p.id
    WHERE r.id = ?
  `).get(id);

  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  if (req.user.role === 'reviewer' && review.reviewer_id !== req.user.id) {
    return res.status(403).json({ error: '无权查看此审稿' });
  }

  if (req.user.role === 'author') {
    const paper = db.prepare('SELECT corresponding_author_id FROM papers WHERE id = ?').get(review.paper_id);
    if (paper.corresponding_author_id !== req.user.id) {
      return res.status(403).json({ error: '无权查看此审稿' });
    }
  }

  const responses = db.prepare(`
    SELECT * FROM author_responses WHERE review_id = ? ORDER BY submitted_at DESC
  `).all(id);

  res.json({ review, responses });
});

router.post('/:id/accept', authMiddleware, requireRole('reviewer'), (req, res) => {
  const { id } = req.params;

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  if (review.reviewer_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此审稿' });
  }

  if (review.status !== 'invited') {
    return res.status(400).json({ error: '此审稿状态不允许接受' });
  }

  db.prepare(`
    UPDATE reviews 
    SET status = 'accepted', accepted_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  db.prepare(`
    UPDATE review_backups 
    SET status = 'invited'
    WHERE paper_id = ? AND reviewer_id = ?
  `).run(review.paper_id, review.reviewer_id);

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(review.paper_id);
  addNotification(paper.corresponding_author_id, 'review_accepted', '审稿人接受邀请', 
    '一位审稿人已接受您的论文审稿邀请', review.paper_id);

  const updatedReview = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  res.json({ review: updatedReview });
});

router.post('/:id/decline', authMiddleware, requireRole('reviewer'), (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  if (review.reviewer_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此审稿' });
  }

  if (review.status !== 'invited') {
    return res.status(400).json({ error: '此审稿状态不允许拒绝' });
  }

  transaction(() => {
    db.prepare(`
      UPDATE reviews 
      SET status = 'declined', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(id);

    db.prepare(`
      UPDATE review_backups 
      SET status = 'declined'
      WHERE paper_id = ? AND reviewer_id = ?
    `).run(review.paper_id, review.reviewer_id);

    const nextReviewer = inviteNextReviewer(review.paper_id);

    const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(review.paper_id);
    addNotification(paper.corresponding_author_id, 'review_declined', '审稿人拒绝邀请',
      '一位审稿人拒绝了审稿邀请，系统已自动邀请下一位备选审稿人', review.paper_id);
  });

  res.json({ success: true, message: '已拒绝审稿邀请，系统将自动邀请下一位审稿人' });
});

router.post('/:id/submit', authMiddleware, requireRole('reviewer'), (req, res) => {
  const { id } = req.params;
  const { recommendation, comments_to_author, comments_to_editor } = req.body;

  if (!recommendation) {
    return res.status(400).json({ error: '请选择审稿建议' });
  }

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  if (review.reviewer_id !== req.user.id) {
    return res.status(403).json({ error: '无权操作此审稿' });
  }

  if (review.status !== 'accepted' && review.status !== 'revision_submitted') {
    return res.status(400).json({ error: '此审稿状态不允许提交意见' });
  }

  db.prepare(`
    UPDATE reviews 
    SET status = 'completed', 
        recommendation = ?,
        comments_to_author = ?,
        comments_to_editor = ?,
        completed_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(recommendation, comments_to_author || '', comments_to_editor || '', id);

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(review.paper_id);
  
  const completedCount = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE paper_id = ? AND status = 'completed'
  `).get(review.paper_id).count;

  addNotification(paper.corresponding_author_id, 'review_completed', '审稿意见已提交',
    `一位审稿人已完成审稿（第 ${completedCount} 位审稿人完成）`, review.paper_id);

  if (paper.editor_id) {
    addNotification(paper.editor_id, 'review_completed', '审稿意见已提交',
      `论文"${paper.title}"的一位审稿人已完成审稿`, review.paper_id);
  }

  // 检查是否还需要邀请更多审稿人以达到 required_reviews
  const requiredReviews = paper.required_reviews || 3;
  const acceptedCount = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE paper_id = ? AND status = 'accepted'
  `).get(review.paper_id).count;
  const totalActive = completedCount + acceptedCount;
  
  if (totalActive < requiredReviews) {
    console.log(`[review/submit] 当前有效意见 ${totalActive}/${requiredReviews}，尝试邀请下一位`);
    const nextInvited = inviteNextReviewer(review.paper_id);
    if (nextInvited) {
      console.log(`[review/submit] 已自动邀请下一位审稿人补足意见数量`);
    }
  } else {
    console.log(`[review/submit] 已达到所需意见数 ${totalActive}/${requiredReviews}，停止邀请`);
  }

  const updatedReview = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  res.json({ review: updatedReview });
});

router.post('/:id/response', authMiddleware, requireRole('author'), (req, res) => {
  const { id } = req.params;
  const { response_text, point_by_point } = req.body;

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(review.paper_id);
  if (paper.corresponding_author_id !== req.user.id) {
    return res.status(403).json({ error: '无权回复此审稿' });
  }

  db.prepare(`
    INSERT INTO author_responses (review_id, paper_version, response_text, point_by_point)
    VALUES (?, ?, ?, ?)
  `).run(id, paper.current_version, response_text || '', point_by_point || '');

  db.prepare(`
    UPDATE reviews 
    SET status = 'accepted', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  addNotification(review.reviewer_id, 'author_response', '作者已回复审稿意见',
    `论文"${paper.title}"的作者已回复您的审稿意见`, review.paper_id);

  res.json({ success: true });
});

router.get('/paper/:paperId/available-reviewers', authMiddleware, requireRole('editor'), (req, res) => {
  const { paperId } = req.params;

  const paperFields = db.prepare(`
    SELECT f.id, f.name FROM paper_fields pf
    JOIN fields f ON pf.field_id = f.id
    WHERE pf.paper_id = ?
    ORDER BY f.category, f.name
  `).all(paperId);
  const paperFieldIds = paperFields.map(f => f.id);

  let reviewers;
  if (paperFieldIds.length > 0) {
    const placeholders = paperFieldIds.map(() => '?').join(',');
    reviewers = db.prepare(`
      SELECT u.id, u.name, u.email, u.affiliation,
             (SELECT COUNT(*) FROM reviewer_fields rf WHERE rf.reviewer_id = u.id AND rf.field_id IN (${placeholders})) as match_count
      FROM users u
      WHERE u.role = 'reviewer'
      AND u.id NOT IN (
        SELECT reviewer_id FROM reviews WHERE paper_id = ?)
      AND u.id NOT IN (
        SELECT reviewer_id FROM review_backups WHERE paper_id = ? AND status != 'declined')
      ORDER BY match_count DESC
    `).all(...paperFieldIds, paperId, paperId);
  } else {
    reviewers = db.prepare(`
      SELECT u.id, u.name, u.email, u.affiliation, 0 as match_count
      FROM users u
      WHERE u.role = 'reviewer'
      AND u.id NOT IN (
        SELECT reviewer_id FROM reviews WHERE paper_id = ?)
      AND u.id NOT IN (
        SELECT reviewer_id FROM review_backups WHERE paper_id = ? AND status != 'declined')
    `).all(paperId, paperId);
  }

  reviewers.forEach(reviewer => {
    const allFields = db.prepare(`
      SELECT f.name FROM fields f
      JOIN reviewer_fields rf ON f.id = rf.field_id
      WHERE rf.reviewer_id = ?
    `).all(reviewer.id).map(f => f.name);
    reviewer.fields = allFields;

    const matchedFields = db.prepare(`
      SELECT f.name FROM fields f
      JOIN reviewer_fields rf ON f.id = rf.field_id
      WHERE rf.reviewer_id = ? AND rf.field_id IN (${paperFieldIds.map(() => '?').join(',') || '0'})
    `).all(reviewer.id, ...paperFieldIds).map(f => f.name);
    reviewer.matched_fields = matchedFields;
  });

  res.json({ reviewers, paper_fields: paperFields });
});

router.post('/paper/:paperId/assign', authMiddleware, requireRole('editor'), (req, res) => {
  const { paperId } = req.params;
  const { reviewerIds, due_days = 14, required_reviews = 3 } = req.body;

  if (!Array.isArray(reviewerIds) || reviewerIds.length === 0) {
    return res.status(400).json({ error: '请选择至少一位审稿人' });
  }

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }
  if (paper.status !== 'pending_assignment') {
    return res.status(400).json({ error: '当前状态不允许分配审稿人，请先通过初审' });
  }

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + due_days);

  transaction(() => {
    const firstReviewer = reviewerIds[0];
    const reviewId = uuidv4();

    db.prepare(`
      INSERT INTO reviews (id, paper_id, reviewer_id, status, invitation_date, due_date)
      VALUES (?, ?, ?, 'invited', CURRENT_TIMESTAMP, ?)
    `).run(reviewId, paperId, firstReviewer, dueDate.toISOString());

    const insertBackup = db.prepare(`
      INSERT INTO review_backups (paper_id, reviewer_id, reviewer_order, status)
      VALUES (?, ?, ?, ?)
    `);

    reviewerIds.forEach((reviewerId, index) => {
      const status = index === 0 ? 'invited' : 'pending';
      insertBackup.run(paperId, reviewerId, index + 1, status);
    });

    db.prepare(`
      UPDATE papers 
      SET status = 'under_review', editor_id = ?, required_reviews = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.user.id, required_reviews, paperId);

    addNotification(firstReviewer, 'review_invite', '审稿邀请',
      `您被邀请为论文"${paper.title}"审稿`, paperId);

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO paper_decisions (paper_id, editor_id, decision, comments, paper_version, decision_date)
      VALUES (?, ?, 'reviewers_assigned', '已分配审稿人，正式进入审稿', ?, ?)
    `).run(paperId, req.user.id, paper.current_version, now);

    const editor = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);
    const editorName = editor?.name || '编辑';
    const content = `【分配审稿人】处理人：${editorName}，处理时间：${new Date(now).toLocaleString('zh-CN')}，已分配 ${reviewerIds.length} 位审稿人候选，需要 ${required_reviews} 份有效意见`;
    
    addNotification(paper.corresponding_author_id, 'editor_decision',
      `稿件"${paper.title}" 正式进入审稿`, content, paperId);
    addNotification(req.user.id, 'editor_decision',
      `已为稿件"${paper.title}"分配审稿人`, content, paperId);
  });

  res.json({ success: true, message: '审稿人已分配' });
});

router.post('/:id/remind', authMiddleware, requireRole('editor'), (req, res) => {
  const { id } = req.params;

  const review = db.prepare('SELECT * FROM reviews WHERE id = ?').get(id);
  if (!review) {
    return res.status(404).json({ error: '审稿不存在' });
  }

  if (review.status !== 'accepted') {
    return res.status(400).json({ error: '只能催审已接受的审稿' });
  }

  db.prepare(`
    UPDATE reviews SET reminder_sent = reminder_sent + 1, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(id);

  addNotification(review.reviewer_id, 'review_reminder', '审稿催审提醒',
    '请尽快完成审稿，感谢您的支持！', review.paper_id);

  res.json({ success: true, message: '催审提醒已发送' });
});

router.get('/paper/:paperId/decision', authMiddleware, requireRole('editor'), (req, res) => {
  const { paperId } = req.params;

  const decisions = db.prepare(`
    SELECT pd.*, u.name as editor_name
    FROM paper_decisions pd
    LEFT JOIN users u ON pd.editor_id = u.id
    WHERE pd.paper_id = ?
    ORDER BY pd.decision_date DESC
  `).all(paperId);

  res.json({ decisions });
});

router.get('/paper/:paperId/reviewer-pool', authMiddleware, requireRole('editor'), (req, res) => {
  const { paperId } = req.params;

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }

  const requiredReviews = paper.required_reviews || 3;

  const completedCount = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE paper_id = ? AND status = 'completed'
  `).get(paperId).count;

  const acceptedCount = db.prepare(`
    SELECT COUNT(*) as count FROM reviews WHERE paper_id = ? AND status = 'accepted'
  `).get(paperId).count;

  const validCount = completedCount + acceptedCount;
  const remainingNeeded = Math.max(0, requiredReviews - validCount);

  const pool = db.prepare(`
    SELECT 
      rb.reviewer_order,
      rb.status as pool_status,
      rb.invited_at,
      u.id as reviewer_id,
      u.name as reviewer_name,
      u.email as reviewer_email,
      u.affiliation as reviewer_affiliation,
      r.status as review_status,
      r.id as review_id,
      r.recommendation,
      r.invitation_date,
      r.accepted_date,
      r.completed_date,
      r.due_date
    FROM review_backups rb
    LEFT JOIN users u ON rb.reviewer_id = u.id
    LEFT JOIN reviews r ON rb.paper_id = r.paper_id AND rb.reviewer_id = r.reviewer_id
    WHERE rb.paper_id = ?
    ORDER BY rb.reviewer_order ASC
  `).all(paperId);

  const currentInvitedIndex = pool.findIndex(p => p.pool_status === 'invited' && (p.review_status === 'invited' || p.review_status === 'accepted'));
  const declinedCount = pool.filter(p => p.pool_status === 'declined').length;
  const pendingCount = pool.filter(p => p.pool_status === 'pending').length;

  res.json({
    pool,
    requiredReviews,
    validCount,
    completedCount,
    acceptedCount,
    remainingNeeded,
    currentInvitedIndex,
    declinedCount,
    pendingCount,
    totalCandidates: pool.length,
  });
});

router.post('/paper/:paperId/decision', authMiddleware, requireRole('editor'), (req, res) => {
  const { paperId } = req.params;
  const { decision, comments } = req.body;

  if (!decision) {
    return res.status(400).json({ error: '请选择决定' });
  }

  const paper = db.prepare('SELECT * FROM papers WHERE id = ?').get(paperId);
  if (!paper) {
    return res.status(404).json({ error: '论文不存在' });
  }

  const validDecisions = ['accept', 'minor_revision', 'major_revision', 'reject'];
  if (!validDecisions.includes(decision)) {
    return res.status(400).json({ error: '无效的决定' });
  }

  transaction(() => {
    db.prepare(`
      INSERT INTO paper_decisions (paper_id, decision, editor_id, comments, paper_version)
      VALUES (?, ?, ?, ?, ?)
    `).run(paperId, decision, req.user.id, comments || '', paper.current_version);

    let paperStatus;
    switch (decision) {
      case 'accept':
        paperStatus = 'accepted';
        break;
      case 'reject':
        paperStatus = 'rejected';
        break;
      case 'minor_revision':
      case 'major_revision':
        paperStatus = 'revise';
        break;
      default:
        paperStatus = decision;
    }

    db.prepare(`
      UPDATE papers 
      SET status = ?, decision = ?, decision_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(paperStatus, decision, paperId);

    const decisionLabels = {
      accept: '已录用',
      minor_revision: '需要小修',
      major_revision: '需要大修',
      reject: '已拒绝',
    };
    const decisionLabel = decisionLabels[decision] || decision;
    const commentPreview = comments && comments.length > 50 ? comments.substring(0, 50) + '...' : (comments || '');
    
    addNotification(paper.corresponding_author_id, 'paper_decision', 
      `论文"${paper.title}" ${decisionLabel}`,
      commentPreview || `您的论文已做出最终决定：${decisionLabel}`, 
      paperId);
  });

  res.json({ success: true, message: '决定已发布' });
});

router.get('/overdue/list', authMiddleware, requireRole('editor'), (req, res) => {
  const overdueReviews = db.prepare(`
    SELECT r.*, p.title, p.status as paper_status,
           u.name as reviewer_name, u.email as reviewer_email,
           julianday('now') - julianday(r.due_date) as days_overdue
    FROM reviews r
    JOIN papers p ON r.paper_id = p.id
    JOIN users u ON r.reviewer_id = u.id
    WHERE r.status = 'accepted' 
      AND r.due_date < CURRENT_TIMESTAMP
    ORDER BY r.due_date ASC
  `).all();

  res.json({ reviews: overdueReviews });
});

module.exports = router;
