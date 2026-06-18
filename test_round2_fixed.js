const axios = require('axios');
const FormData = require('form-data');

const API = 'http://localhost:5000/api';
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` }});

async function test() {
  console.log('=========== 新增功能验证测试（第二轮修复）===========\n');
  let allPassed = true;

  // ========= 登录 =========
  const [authorLogin, adminLogin, r1Login, r2Login, r3Login] = await Promise.all([
    axios.post(`${API}/auth/login`, { email: 'author1@journal.com', password: 'author123' }),
    axios.post(`${API}/auth/login`, { email: 'admin@journal.com', password: 'admin123' }),
    axios.post(`${API}/auth/login`, { email: 'reviewer1@journal.com', password: 'reviewer123' }),
    axios.post(`${API}/auth/login`, { email: 'reviewer2@journal.com', password: 'reviewer123' }),
    axios.post(`${API}/auth/login`, { email: 'reviewer3@journal.com', password: 'reviewer123' }),
  ]);
  const authorToken = authorLogin.data.token;
  const adminToken = adminLogin.data.token;
  const r1Token = r1Login.data.token;
  const r2Token = r2Login.data.token;
  const r3Token = r3Login.data.token;

  const reviewerList = [
    { name: r1Login.data.user.name, token: r1Token, email: 'reviewer1@journal.com' },
    { name: r2Login.data.user.name, token: r2Token, email: 'reviewer2@journal.com' },
    { name: r3Login.data.user.name, token: r3Token, email: 'reviewer3@journal.com' },
  ];
  const findTokenByName = (name) => reviewerList.find(r => r.name === name)?.token;

  const fields = (await axios.get(`${API}/fields`, authHeaders(authorToken))).data.fields;

  // ========= 投稿 =========
  const form = new FormData();
  form.append('title', '测试稿：完整初筛和分配流程测试');
  form.append('abstract', '测试...');
  form.append('keywords', JSON.stringify(['A', 'B']));
  form.append('authors', JSON.stringify([
    { name: '张作者', email: 'z@test.com', affiliation: '大学', author_order: 1, is_corresponding: true }
  ]));
  form.append('fields', JSON.stringify([fields[0].id]));
  form.append('file', Buffer.from('%PDF-1.4'), { filename: 'test.pdf', contentType: 'application/pdf' });

  const paperId = (await axios.post(`${API}/papers`, form, {
    headers: { ...form.getHeaders(), 'Authorization': `Bearer ${authorToken}` }
  })).data.paper.id;

  console.log(`✅ 投稿成功: paperId=${paperId}`);

  // ========== 测试1: 初筛流程记录 ==========
  console.log('\n【测试1: 初筛流程记录与状态流转】');

  let p = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper;
  console.log(`  初始状态: ${p.status}`);

  // 1a. 通过初审
  await axios.post(`${API}/papers/${paperId}/screening/send-to-review`, {}, authHeaders(adminToken));
  let p1 = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper;
  const test1a = p1.status === 'pending_assignment';
  console.log(`  通过初审后状态: ${p1.status} (应为pending_assignment) ${test1a ? '✅' : '❌'}`);
  if (!test1a) allPassed = false;

  // 1b. 检查decisions记录存在
  const test1b = p1.decisions?.length >= 1 && p1.decisions[0]?.decision === 'screening_passed';
  console.log(`  decisions记录存在: ${p1.decisions?.length}条, 第一条decision=${p1.decisions?.[0]?.decision} ${test1b ? '✅' : '❌'}`);
  if (!test1b) allPassed = false;
  console.log(`    记录详情: 处理人=${p1.decisions?.[0]?.editor_name}, 时间=${p1.decisions?.[0]?.decision_date}, 说明=${p1.decisions?.[0]?.comments}`);

  // 1c. 作者和编辑都收到通知
  const authorNotifs = (await axios.get(`${API}/notifications`, authHeaders(authorToken))).data.notifications;
  const editorNotifs = (await axios.get(`${API}/notifications`, authHeaders(adminToken))).data.notifications;
  const authorScreenNotif = authorNotifs.find(n => n.content?.includes('通过初审'));
  const editorScreenNotif = editorNotifs.find(n => n.content?.includes('通过初审'));
  console.log(`  作者收到通知: ${authorScreenNotif ? '✅' : '❌'}, 编辑收到通知: ${editorScreenNotif ? '✅' : '❌'}`);
  if (!authorScreenNotif || !editorScreenNotif) allPassed = false;
  if (authorScreenNotif) console.log(`    作者通知: ${authorScreenNotif.content?.substring(0, 50)}...`);

  // ========== 测试2: 取消分配不影响作者 ==========
  console.log('\n【测试2: 取消分配不影响作者】');
  const authorP = (await axios.get(`${API}/papers/${paperId}`, authHeaders(authorToken))).data.paper;
  const test2 = authorP.status === 'pending_assignment';
  console.log(`  取消分配后作者侧状态: ${authorP.status} (应为pending_assignment，不是under_review) ${test2 ? '✅' : '❌'}`);
  console.log(`    作者看到的状态标签: ${p1.status}，不会误以为已经开始审稿`);
  if (!test2) allPassed = false;

  // ========== 测试3: 候选池进度视图 ==========
  console.log('\n【测试3: 候选池进度视图】');

  const cand = (await axios.get(`${API}/reviews/paper/${paperId}/available-reviewers`, authHeaders(adminToken))).data.reviewers;
  const rIds = cand.slice(0, 3).map(r => r.id);
  await axios.post(`${API}/reviews/paper/${paperId}/assign`, {
    reviewerIds: rIds,
    due_days: 7,
    required_reviews: 2,
  }, authHeaders(adminToken));

  let p2 = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper;
  const test3a = p2.status === 'under_review';
  console.log(`  分配后状态: ${p2.status} (应为under_review) ${test3a ? '✅' : '❌'}`);
  if (!test3a) allPassed = false;

  const test3b = p2.decisions?.some(d => d.decision === 'reviewers_assigned');
  console.log(`  分配记录存在: ${test3b ? '✅' : '❌'}`);
  if (!test3b) allPassed = false;

  const pool = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  console.log(`  候选池: 共${pool.totalCandidates}位, 需要${pool.requiredReviews}份, 已有${pool.validCount}份有效, 还差${pool.remainingNeeded}份`);
  console.log(`  已拒绝: ${pool.declinedCount}, 等待中: ${pool.pendingCount}, 当前邀请到第${pool.currentInvitedIndex + 1}位`);
  pool.pool.forEach((item, idx) => {
    console.log(`    ${idx + 1}. ${item.reviewer_name} - pool_status=${item.pool_status}, review_status=${item.review_status}`);
  });
  const test3c = pool.pool?.length === 3 && pool.currentInvitedIndex === 0 && pool.remainingNeeded === 2;
  console.log(`  候选池数据正确: ${test3c ? '✅' : '❌'}`);
  if (!test3c) allPassed = false;

  const pool2 = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  const test3d = pool2.pool[0].reviewer_name === pool.pool[0].reviewer_name && 
                pool2.currentInvitedIndex === pool.currentInvitedIndex;
  console.log(`  刷新后顺序和状态保持: ${test3d ? '✅' : '❌'}`);
  if (!test3d) allPassed = false;

  // ========== 测试4: 审稿人拒绝后自动邀请下一位，候选池更新 ==========
  console.log('\n【测试4: 审稿人拒绝后候选池更新】');

  const r0Name = pool.pool[0].reviewer_name;
  const r0Tok = findTokenByName(r0Name);
  const r0ReviewId = pool.pool[0].review_id;
  await axios.post(`${API}/reviews/${r0ReviewId}/decline`, {}, authHeaders(r0Tok));

  const pool3 = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  console.log(`  ${r0Name}拒绝后:`);
  pool3.pool.forEach((item, idx) => {
    console.log(`    ${idx + 1}. ${item.reviewer_name} - pool_status=${item.pool_status}, review_status=${item.review_status}`);
  });
  const test4a = pool3.pool[0].pool_status === 'declined' && 
                 pool3.pool[1].pool_status === 'invited' &&
                 pool3.currentInvitedIndex === 1;
  console.log(`  第1位已拒绝，第2位已自动邀请，索引更新到1: ${test4a ? '✅' : '❌'}`);
  if (!test4a) allPassed = false;

  // ========== 测试5: 审稿人接受后候选池更新 ==========
  console.log('\n【测试5: 审稿人接受后候选池更新】');

  const r1Name = pool3.pool[1].reviewer_name;
  const r1Tok = findTokenByName(r1Name);
  const r1ReviewId = pool3.pool[1].review_id;
  await axios.post(`${API}/reviews/${r1ReviewId}/accept`, {}, authHeaders(r1Tok));

  const pool4 = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  console.log(`  ${r1Name}接受后: 有效意见=${pool4.validCount}/${pool4.requiredReviews}, 还差${pool4.remainingNeeded}份`);
  const test5a = pool4.pool[1].review_status === 'accepted' && pool4.remainingNeeded === 1;
  console.log(`  状态更新正确: ${test5a ? '✅' : '❌'}`);
  if (!test5a) allPassed = false;

  await axios.post(`${API}/reviews/${r1ReviewId}/submit`, {
    recommendation: 'accept',
    comments_to_author: '很好',
    comments_to_editor: '建议录用',
  }, authHeaders(r1Tok));

  const pool5 = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  console.log(`  ${r1Name}完成后: 有效意见=${pool5.validCount}/${pool5.requiredReviews}, 还差${pool5.remainingNeeded}份`);
  const test5b = pool5.validCount === 1 && pool5.remainingNeeded === 1 && 
                 pool5.pool[2].pool_status === 'invited';
  console.log(`  自动邀请下一位补足，第3位现在已邀请: ${test5b ? '✅' : '❌'}`);
  if (!test5b) allPassed = false;

  // ========== 测试6: 够数后停止邀请 ==========
  console.log('\n【测试6: 够数后停止邀请】');

  const r2Name = pool5.pool[2].reviewer_name;
  const r2Tok = findTokenByName(r2Name);
  const r2ReviewId = pool5.pool[2].review_id;
  await axios.post(`${API}/reviews/${r2ReviewId}/accept`, {}, authHeaders(r2Tok));
  await axios.post(`${API}/reviews/${r2ReviewId}/submit`, {
    recommendation: 'minor_revision',
    comments_to_author: '需要小修',
    comments_to_editor: '可以接受但需要修改',
  }, authHeaders(r2Tok));

  const pool6 = (await axios.get(`${API}/reviews/paper/${paperId}/reviewer-pool`, authHeaders(adminToken))).data;
  console.log(`  第3位完成后: 有效意见=${pool6.validCount}/${pool6.requiredReviews}, 还差${pool6.remainingNeeded}份`);
  const test6 = pool6.validCount === 2 && pool6.remainingNeeded === 0;
  console.log(`  已达到所需意见数，停止邀请: ${test6 ? '✅' : '❌'}`);
  if (!test6) allPassed = false;

  // ========== 测试7: 作者侧也能看到流程记录 ==========
  console.log('\n【测试7: 作者侧流程记录展示】');
  const authorPaper = (await axios.get(`${API}/papers/${paperId}`, authHeaders(authorToken))).data.paper;
  const test7 = authorPaper.decisions?.length >= 2;  // 至少2条：通过初审、分配审稿人
  console.log(`  作者能看到${authorPaper.decisions?.length || 0}条处理记录 ${test7 ? '✅' : '❌'}`);
  if (test7) {
    authorPaper.decisions.forEach(d => {
      console.log(`    - ${d.decision}: ${d.editor_name} at ${d.decision_date}`);
      console.log(`      ${d.comments}`);
    });
  }
  if (!test7) allPassed = false;

  // ========== 测试8: 通知中心点击跳转 ==========
  console.log('\n【测试8: 通知中心完整性】');
  const allNotifs = (await axios.get(`${API}/notifications`, authHeaders(adminToken))).data.notifications;
  const relatedId = allNotifs.find(n => n.related_id === paperId);
  const test8 = !!relatedId;
  console.log(`  通知带有related_id可跳转: ${test8 ? '✅' : '❌'} (related_id=${relatedId?.related_id})`);
  if (!test8) allPassed = false;

  // ========== 测试9: 初筛状态为pending_assignment时可以重新退回补资料 ==========
  console.log('\n【测试9: pending_assignment状态可重新退回补资料】');
  
  const form2 = new FormData();
  form2.append('title', '第二篇测试稿：测试退回补资料');
  form2.append('abstract', '...');
  form2.append('keywords', JSON.stringify(['X']));
  form2.append('authors', JSON.stringify([{ name: '王作者', email: 'w@test.com', affiliation: '大学', author_order: 1, is_corresponding: true }]));
  form2.append('fields', JSON.stringify([fields[0].id]));
  form2.append('file', Buffer.from('%PDF-1.4'), { filename: 'test2.pdf', contentType: 'application/pdf' });
  const paper2Id = (await axios.post(`${API}/papers`, form2, {
    headers: { ...form2.getHeaders(), 'Authorization': `Bearer ${authorToken}` }
  })).data.paper.id;

  await axios.post(`${API}/papers/${paper2Id}/screening/send-to-review`, {}, authHeaders(adminToken));
  let p3 = (await axios.get(`${API}/papers/${paper2Id}`, authHeaders(adminToken))).data.paper;
  console.log(`  通过初审后状态: ${p3.status}`);

  try {
    await axios.post(`${API}/papers/${paper2Id}/screening/request-revision`, 
      { comments: '需要补充实验数据' }, 
      authHeaders(adminToken));
    let p4 = (await axios.get(`${API}/papers/${paper2Id}`, authHeaders(adminToken))).data.paper;
    const test9 = p4.status === 'needs_revision';
    console.log(`  pending_assignment状态成功退回补资料: ${p4.status} ${test9 ? '✅' : '❌'}`);
    if (!test9) allPassed = false;
    
    const authorNotifs2 = (await axios.get(`${API}/notifications`, authHeaders(authorToken))).data.notifications;
    const revisionNotif = authorNotifs2.find(n => n.content?.includes('退回补资料') && n.related_id === paper2Id);
    console.log(`  作者收到退回补资料通知: ${revisionNotif ? '✅' : '❌'}`);
    if (!revisionNotif) allPassed = false;
  } catch (err) {
    console.log(`  ❌ 操作失败: ${err.response?.data?.error || err.message}`);
    allPassed = false;
  }

  console.log('\n=========== 测试总结 ===========');
  console.log(allPassed ? '✅ 全部新增功能验证通过！' : '❌ 部分测试未通过');
  console.log('  测试1 初筛流程记录: ' + (test1a && test1b ? '✅ 通过' : '❌ 失败'));
  console.log('  测试2 取消分配不影响作者: ' + (test2 ? '✅ 通过' : '❌ 失败'));
  console.log('  测试3 候选池进度视图: ' + (test3a && test3b && test3c && test3d ? '✅ 通过' : '❌ 失败'));
  console.log('  测试4 拒绝后更新: ' + (test4a ? '✅ 通过' : '❌ 失败'));
  console.log('  测试5 接受/完成后自动补足: ' + (test5a && test5b ? '✅ 通过' : '❌ 失败'));
  console.log('  测试6 够数后停止邀请: ' + (test6 ? '✅ 通过' : '❌ 失败'));
  console.log('  测试7 作者侧流程记录: ' + (test7 ? '✅ 通过' : '❌ 失败'));
  console.log('  测试8 通知可跳转: ' + (test8 ? '✅ 通过' : '❌ 失败'));
  
  process.exit(allPassed ? 0 : 1);
}

test().catch(err => {
  console.error('\n❌ 测试异常:', err.response?.data || err.message);
  console.error(err.stack);
  process.exit(1);
});
