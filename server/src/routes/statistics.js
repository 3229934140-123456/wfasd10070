const express = require('express');
const { db } = require('../database/init');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/overview', authMiddleware, requireRole('editor'), (req, res) => {
  const totalPapers = db.prepare('SELECT COUNT(*) as count FROM papers').get().count;
  
  const statusCounts = db.prepare(`
    SELECT status, COUNT(*) as count FROM papers GROUP BY status
  `).all();

  const totalReviews = db.prepare('SELECT COUNT(*) as count FROM reviews').get().count;
  const completedReviews = db.prepare("SELECT COUNT(*) as count FROM reviews WHERE status = 'completed'").get().count;
  
  const totalReviewers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'reviewer'").get().count;
  const totalAuthors = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'author'").get().count;

  const avgReviewTime = db.prepare(`
    SELECT AVG(julianday(completed_date) - julianday(accepted_date)) as avg_days
    FROM reviews 
    WHERE status = 'completed' 
      AND accepted_date IS NOT NULL 
      AND completed_date IS NOT NULL
  `).get().avg_days || 0;

  const acceptanceRate = totalPapers > 0 
    ? (statusCounts.find(s => s.status === 'accepted')?.count || 0) / totalPapers * 100 
    : 0;

  const decisions = db.prepare(`
    SELECT decision, COUNT(*) as count 
    FROM paper_decisions 
    GROUP BY decision
  `).all();

  res.json({
    totalPapers,
    statusCounts,
    totalReviews,
    completedReviews,
    totalReviewers,
    totalAuthors,
    avgReviewTime: Math.round(avgReviewTime * 10) / 10,
    acceptanceRate: Math.round(acceptanceRate * 10) / 10,
    decisions
  });
});

router.get('/papers-by-month', authMiddleware, requireRole('editor'), (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  const papersByMonth = db.prepare(`
    SELECT 
      CAST(strftime('%m', submitted_at) AS INTEGER) as month,
      COUNT(*) as count
    FROM papers
    WHERE strftime('%Y', submitted_at) = ?
    GROUP BY strftime('%Y-%m', submitted_at)
    ORDER BY month
  `).all(targetYear.toString());

  const result = [];
  for (let i = 1; i <= 12; i++) {
    const found = papersByMonth.find(p => p.month === i);
    result.push({ month: i, count: found ? found.count : 0 });
  }

  res.json({ monthlyData: result, year: targetYear });
});

router.get('/decisions-by-month', authMiddleware, requireRole('editor'), (req, res) => {
  const { year } = req.query;
  const targetYear = year || new Date().getFullYear();

  const decisions = db.prepare(`
    SELECT 
      CAST(strftime('%m', decision_date) AS INTEGER) as month,
      decision,
      COUNT(*) as count
    FROM paper_decisions
    WHERE strftime('%Y', decision_date) = ?
    GROUP BY strftime('%Y-%m', decision_date), decision
    ORDER BY month
  `).all(targetYear.toString());

  const result = [];
  for (let i = 1; i <= 12; i++) {
    const monthData = { month: i, accept: 0, reject: 0, minor_revision: 0, major_revision: 0 };
    decisions.filter(d => d.month === i).forEach(d => {
      if (d.decision === 'accept') monthData.accept = d.count;
      else if (d.decision === 'reject') monthData.reject = d.count;
      else if (d.decision === 'minor_revision') monthData.minor_revision = d.count;
      else if (d.decision === 'major_revision') monthData.major_revision = d.count;
    });
    result.push(monthData);
  }

  res.json({ monthlyData: result, year: targetYear });
});

router.get('/reviewer-workload', authMiddleware, requireRole('editor'), (req, res) => {
  const workload = db.prepare(`
    SELECT 
      u.id,
      u.name,
      u.affiliation,
      COUNT(r.id) as total_reviews,
      SUM(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) as completed_reviews,
      SUM(CASE WHEN r.status = 'accepted' THEN 1 ELSE 0 END) as active_reviews,
      AVG(CASE WHEN r.status = 'completed' AND r.accepted_date IS NOT NULL 
          THEN julianday(r.completed_date) - julianday(r.accepted_date) 
          ELSE NULL END) as avg_review_days
    FROM users u
    LEFT JOIN reviews r ON u.id = r.reviewer_id
    WHERE u.role = 'reviewer'
    GROUP BY u.id
    ORDER BY total_reviews DESC
  `).all();

  workload.forEach(w => {
    w.avg_review_days = w.avg_review_days ? Math.round(w.avg_review_days * 10) / 10 : 0;
  });

  res.json({ reviewers: workload });
});

router.get('/fields-distribution', authMiddleware, requireRole('editor'), (req, res) => {
  const distribution = db.prepare(`
    SELECT 
      f.id,
      f.name,
      f.category,
      COUNT(pf.paper_id) as paper_count
    FROM fields f
    LEFT JOIN paper_fields pf ON f.id = pf.field_id
    GROUP BY f.id
    ORDER BY paper_count DESC
  `).all();

  res.json({ fields: distribution });
});

router.get('/export/csv', authMiddleware, requireRole('editor'), (req, res) => {
  const { type } = req.query;

  let csvContent = '';
  let filename = '';

  if (type === 'papers') {
    filename = 'papers_report.csv';
    const papers = db.prepare(`
      SELECT 
        p.id,
        p.title,
        p.status,
        p.submitted_at,
        p.updated_at,
        p.decision,
        p.decision_date,
        u.name as author_name,
        u.email as author_email,
        (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id) as review_count,
        (SELECT COUNT(*) FROM reviews r WHERE r.paper_id = p.id AND r.status = 'completed') as completed_reviews
      FROM papers p
      LEFT JOIN users u ON p.corresponding_author_id = u.id
      ORDER BY p.submitted_at DESC
    `).all();

    const headers = ['论文ID', '标题', '状态', '投稿时间', '更新时间', '决定', '决定日期', '通讯作者', '作者邮箱', '审稿人数', '已完成审稿数'];
    csvContent = headers.join(',') + '\n';
    
    papers.forEach(p => {
      csvContent += [
        p.id,
        `"${p.title.replace(/"/g, '""')}"`,
        p.status,
        p.submitted_at,
        p.updated_at,
        p.decision || '',
        p.decision_date || '',
        p.author_name || '',
        p.author_email || '',
        p.review_count,
        p.completed_reviews
      ].join(',') + '\n';
    });
  } else if (type === 'reviews') {
    filename = 'reviews_report.csv';
    const reviews = db.prepare(`
      SELECT 
        r.id,
        p.title as paper_title,
        u.name as reviewer_name,
        u.email as reviewer_email,
        r.status,
        r.recommendation,
        r.invitation_date,
        r.accepted_date,
        r.completed_date,
        r.due_date,
        r.reminder_sent
      FROM reviews r
      JOIN papers p ON r.paper_id = p.id
      JOIN users u ON r.reviewer_id = u.id
      ORDER BY r.invitation_date DESC
    `).all();

    const headers = ['审稿ID', '论文标题', '审稿人', '审稿人邮箱', '状态', '建议', '邀请日期', '接受日期', '完成日期', '截止日期', '催审次数'];
    csvContent = headers.join(',') + '\n';
    
    reviews.forEach(r => {
      csvContent += [
        r.id,
        `"${r.paper_title.replace(/"/g, '""')}"`,
        r.reviewer_name,
        r.reviewer_email,
        r.status,
        r.recommendation || '',
        r.invitation_date || '',
        r.accepted_date || '',
        r.completed_date || '',
        r.due_date || '',
        r.reminder_sent || 0
      ].join(',') + '\n';
    });
  } else {
    return res.status(400).json({ error: '无效的导出类型' });
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csvContent);
});

module.exports = router;
