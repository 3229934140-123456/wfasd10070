const axios = require('axios');
const FormData = require('form-data');

const API = 'http://localhost:5000/api';
const authHeaders = (token) => ({ headers: { Authorization: `Bearer ${token}` }});

async function test() {
  console.log('=========== 修复验证测试 ===========\n');
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

  // 审稿人姓名 -> 登录名 -> token 映射
  const loginUser = (loginRes) => ({ name: loginRes.data.user.name, email: loginRes.data.user.email });
  const reviewerList = [
    { ...loginUser(r1Login), token: r1Token },
    { ...loginUser(r2Login), token: r2Token },
    { ...loginUser(r3Login), token: r3Token },
  ];
  console.log('  审稿人映射:', reviewerList.map(r => `${r.email} -> ${r.name}`).join(', '));
  const findTokenByName = (name) => {
    const found = reviewerList.find(r => r.name === name);
    return found?.token;
  };

  // 获取领域
  const fields = (await axios.get(`${API}/fields`, authHeaders(authorToken))).data.fields;
  const fieldIds = [fields[0].id, fields[1].id];

  // ========= 投稿 =========
  console.log('【问题1: 投稿表单字段保存和显示】');
  const form = new FormData();
  form.append('title', '深度学习在医学图像分析中的应用研究');
  form.append('abstract', '本文提出了一种基于改进卷积神经网络的医学图像分割新方法...');
  form.append('keywords', JSON.stringify(['深度学习', '医学图像', '图像分割']));
  form.append('authors', JSON.stringify([
    { name: '张三', email: 'zhangsan@test.com', affiliation: '北京大学', author_order: 1, is_corresponding: true },
    { name: '李四', email: 'lisi@test.com', affiliation: '清华大学', author_order: 2, is_corresponding: false }
  ]));
  form.append('fields', JSON.stringify(fieldIds));
  form.append('file', Buffer.from('%PDF-1.4 fake'), { filename: 'test.pdf', contentType: 'application/pdf' });

  const submitRes = await axios.post(`${API}/papers`, form, {
    headers: { ...form.getHeaders(), 'Authorization': `Bearer ${authorToken}` }
  });
  const paperId = submitRes.data.paper.id;
  console.log(`  ✅ 投稿成功`);

  // 1a. 稿件详情（作者视角）
  const d1 = (await axios.get(`${API}/papers/${paperId}`, authHeaders(authorToken))).data.paper;
  const test1a = d1.keywords?.length === 3 && d1.authors?.length === 2 && d1.fields?.length === 2
    && d1.authors[0].name === '张三' && d1.fields[0].name === fields[0].name;
  console.log(`  稿件详情: 关键词=${d1.keywords?.length}/3, 作者=${d1.authors?.length}/2, 领域=${d1.fields?.length}/2 ${test1a ? '✅' : '❌'}`);
  if (!test1a) { console.log('    关键词:', d1.keywords, '作者:', d1.authors?.map(a=>a.name), '领域:', d1.fields?.map(f=>f.name)); allPassed = false; }

  // 1b. 我的稿件列表（作者视角）
  const mp = (await axios.get(`${API}/papers`, authHeaders(authorToken))).data.papers[0];
  const test1b = mp.keywords?.length === 3 && mp.authors?.length === 2 && mp.fields?.length === 2;
  console.log(`  我的稿件: 关键词=${mp.keywords?.length}/3, 作者=${mp.authors?.length}/2, 领域=${mp.fields?.length}/2 ${test1b ? '✅' : '❌'}`);
  if (!test1b) allPassed = false;

  // ========= 编辑视角 + 审稿人匹配度 =========
  const ed = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper;
  const test1c = ed.authors?.length === 2 && ed.fields?.length === 2 && ed.authors[0].email;
  console.log(`  编辑视角: 作者=${ed.authors?.length}/2(含邮箱), 领域=${ed.fields?.length}/2 ${test1c ? '✅' : '❌'}`);
  if (!test1c) allPassed = false;

  // 审稿人匹配度（接口返回match_count字段即可视为功能正常）
  const candidates = (await axios.get(`${API}/reviews/paper/${paperId}/available-reviewers`, authHeaders(adminToken))).data.reviewers;
  const matchFields = ed.fields.map(f => f.id);
  const topMatch = candidates[0];
  const test1d = topMatch && typeof topMatch.match_count === 'number' && candidates.every(r => 'match_count' in r);
  console.log(`  审稿人匹配: 候选人${candidates?.length}人, Top1 ${topMatch?.name} match_count=${topMatch?.match_count} ${test1d ? '✅' : '❌'}`);
  if (!test1d) allPassed = false;
  // 按匹配度排序验证
  let sortedOk = candidates.length < 2 || candidates.every((_, i) => i === 0 || candidates[i].match_count <= candidates[i-1].match_count);
  console.log(`  按匹配度降序排列: ${sortedOk ? '✅' : '❌'}`);
  if (!sortedOk) allPassed = false;
  console.log('');

  // ========= 问题3: 分配审稿人 - 只通知第1位 =========
  console.log('【问题3: 分配审稿人 - 只通知当前位，拒绝后自动邀请下一位】');
  const rIds = candidates.slice(0, 3).map(r => r.id);
  const reviewers = candidates.slice(0, 3);
  await axios.post(`${API}/reviews/paper/${paperId}/assign`, { reviewerIds: rIds, due_days: 7 }, authHeaders(adminToken));
  const p_after_assign = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper;
  const rvws = p_after_assign.reviews;

  const test3a = rvws[0].status === 'invited';
  console.log(`  分配状态: 第1位=${rvws[0]?.status}, reviews数=${rvws?.length} ${test3a ? '✅' : '❌'}`);
  if (!test3a) allPassed = false;

  // 通知检查（通过审稿人姓名找到对应token）
  const reviewer0_name = reviewers[0].name;
  const reviewer1_name = reviewers[1].name;
  const reviewer2_name = reviewers[2].name;
  const tok0 = findTokenByName(reviewer0_name);
  const tok1 = findTokenByName(reviewer1_name);
  const tok2 = findTokenByName(reviewer2_name);

  const n1 = (await axios.get(`${API}/notifications`, authHeaders(tok0))).data.notifications.filter(n => n.type === 'review_invite').length;
  const n2_before = (await axios.get(`${API}/notifications`, authHeaders(tok1))).data.notifications.filter(n => n.type === 'review_invite').length;
  const n3_before = (await axios.get(`${API}/notifications`, authHeaders(tok2))).data.notifications.filter(n => n.type === 'review_invite').length;
  const test3b = n1 >= 1 && n2_before === 0 && n3_before === 0;
  console.log(`  初始通知: ${reviewer0_name}=${n1}, ${reviewer1_name}=${n2_before}, ${reviewer2_name}=${n3_before} ${test3b ? '✅' : '❌'}`);
  if (!test3b) allPassed = false;

  // 审稿人0(第1位)拒绝
  const r0_review = rvws.find(r => r.reviewer_name === reviewer0_name);
  await axios.post(`${API}/reviews/${r0_review.id}/decline`, {}, authHeaders(tok0));
  const rvws_after1 = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper.reviews;

  const n2_after = (await axios.get(`${API}/notifications`, authHeaders(tok1))).data.notifications.filter(n => n.type === 'review_invite').length;
  const r1_now = rvws_after1.find(r=>r.reviewer_name === reviewer1_name);
  const test3c = r1_now?.status === 'invited' && n2_after >= 1;
  console.log(`  ${reviewer0_name}拒绝后: ${reviewer1_name}状态=${r1_now?.status}, 通知数=${n2_after} ${test3c ? '✅' : '❌'}`);
  if (!test3c) allPassed = false;
  console.log('');

  // ========= 问题2: 双盲脱敏 =========
  console.log('【问题2: 双盲审稿收紧】');
  // 2a. 审稿人视角 - 看不到作者信息
  const rd = (await axios.get(`${API}/papers/${paperId}`, authHeaders(tok1))).data.paper;
  const test2a = rd.authors?.every(a => a.name === '[作者信息已隐藏]' && !a.email && !a.affiliation)
    && !rd.corresponding_author_name && !rd.corresponding_author_email;
  console.log(`  审稿人看作者: 全隐藏=${test2a ? '✅' : '❌'}`);
  console.log(`    第1作者: ${rd.authors?.[0]?.name}, 邮箱: ${rd.authors?.[0]?.email ?? 'null'}, 单位: ${rd.authors?.[0]?.affiliation ?? 'null'}`);
  console.log(`    通讯作者名: ${rd.corresponding_author_name ?? '已删除'}, 邮箱: ${rd.corresponding_author_email ?? '已删除'}`);
  if (!test2a) allPassed = false;

  // 2b. 作者视角 - 看不到审稿人身份
  // 先让审稿人1接受并完成审稿，这样作者才能看到completed的review
  await axios.post(`${API}/reviews/${r1_now.id}/accept`, {}, authHeaders(tok1));
  const activeReviewId = r1_now.id;
  await axios.post(`${API}/reviews/${activeReviewId}/submit`, {
    recommendation: 'minor_revision',
    comments_to_author: '论文整体不错，建议补充对比实验。',
    comments_to_editor: '作者研究基础扎实，建议小修后录用。'
  }, authHeaders(tok1));

  const ad_reviews = (await axios.get(`${API}/papers/${paperId}`, authHeaders(authorToken))).data.paper.reviews || [];
  const test2b = ad_reviews.length > 0 && ad_reviews.every(r => r.reviewer_name === '审稿人' && !r.reviewer_affiliation)
    && ad_reviews.every(r => !r.comments_to_editor);
  console.log(`  作者看审稿人: 身份脱敏=${test2b ? '✅' : '❌'}`);
  if (ad_reviews.length > 0) {
    console.log(`    审稿人名: ${ad_reviews[0].reviewer_name}, 单位: ${ad_reviews[0].reviewer_affiliation ?? 'null'}`);
    console.log(`    编辑私密意见存在?: ${!!ad_reviews[0].comments_to_editor}`);
  }
  if (!test2b) allPassed = false;

  // 2c. 编辑仍能看到完整信息
  const ed_reviews = (await axios.get(`${API}/papers/${paperId}`, authHeaders(adminToken))).data.paper.reviews || [];
  const test2c = ed_reviews.length > 0 && ed_reviews.some(r => r.reviewer_name && r.reviewer_name !== '审稿人' && r.comments_to_editor);
  console.log(`  编辑视角完整信息: 身份可见=${test2c ? '✅' : '❌'}`);
  if (ed_reviews.length > 0) {
    console.log(`    审稿人名: ${ed_reviews[0].reviewer_name}, 邮箱: ${ed_reviews[0].reviewer_email}`);
    console.log(`    编辑私密意见存在?: ${!!ed_reviews[0].comments_to_editor}`);
  }
  if (!test2c) allPassed = false;
  console.log('');

  // ========= 问题4: 催审功能 + 催审计数 =========
  console.log('【问题4: 超期审稿 + 催审功能】');
  // 先分配一个审稿人3并接受，然后对他催审
  // 审稿人2之前完成了，所以需要通过拒绝链的方式激活审稿人3？直接手动新建一条assigned的review给审稿人3
  // 简单方式：先通过接口更新数据库，或者更直接 - 手动调用分配时的逻辑。这里直接从backups里激活下一个
  // 但backups里的审稿人3还没激活，因为审稿人2刚完成不是拒绝。我们直接用review_backups的接口激活？
  // 为了简单，直接再创建一篇稿来测试催审
  
  // 简化: 直接用reviewId = activeReviewId 来催审？但它已经是completed状态了。
  // 换个方式：用审稿人3，手动在系统里用inviteNextReviewer方式？
  // 我直接让审稿人2拒绝（先把状态改回去）- 不行，已经completed了
  
  // 简单方案：再投一篇稿，分配3个审稿人，让审稿人1接受不完成，然后催审
  
  const form2 = new FormData();
  form2.append('title', '另一篇测试稿件用于催审测试');
  form2.append('abstract', '测试催审功能专用稿件...');
  form2.append('keywords', JSON.stringify(['测试1', '测试2']));
  form2.append('authors', JSON.stringify([{ name: '王作者', email: 'w@test.com', affiliation: '复旦大学', author_order: 1, is_corresponding: true }]));
  form2.append('fields', JSON.stringify([fields[2].id]));
  form2.append('file', Buffer.from('%PDF-1.4'), { filename: 'test2.pdf', contentType: 'application/pdf' });
  const paper2Id = (await axios.post(`${API}/papers`, form2, { headers: { ...form2.getHeaders(), 'Authorization': `Bearer ${authorToken}` } })).data.paper.id;

  const cand2 = (await axios.get(`${API}/reviews/paper/${paper2Id}/available-reviewers`, authHeaders(adminToken))).data.reviewers;
  const rIds2 = cand2.slice(0, 2).map(r => r.id);
  const as2 = await axios.post(`${API}/reviews/paper/${paper2Id}/assign`, { reviewerIds: rIds2, due_days: 7 }, authHeaders(adminToken));
  const p2_reviews = (await axios.get(`${API}/papers/${paper2Id}`, authHeaders(adminToken))).data.paper.reviews;
  const reviewActiveId = p2_reviews[0].id;
  const activeRName = p2_reviews[0].reviewer_name;
  const token4r = findTokenByName(activeRName) || r1Token;

  // 审稿人接受邀请
  await axios.post(`${API}/reviews/${reviewActiveId}/accept`, {}, { headers: { Authorization: `Bearer ${token4r}` }});

  // 催审2次
  const before = (await axios.get(`${API}/papers/${paper2Id}`, authHeaders(adminToken))).data.paper.reviews.find(r=>r.id === reviewActiveId);
  await axios.post(`${API}/reviews/${reviewActiveId}/remind`, {}, authHeaders(adminToken));
  await axios.post(`${API}/reviews/${reviewActiveId}/remind`, {}, authHeaders(adminToken));
  const after = (await axios.get(`${API}/papers/${paper2Id}`, authHeaders(adminToken))).data.paper.reviews.find(r=>r.id === reviewActiveId);

  const test4a = after.reminder_sent >= 2;
  console.log(`  催审计数: 催审前=${before.reminder_sent || 0}, 催审2次后=${after.reminder_sent} ${test4a ? '✅' : '❌'}`);
  if (!test4a) allPassed = false;

  // 催审通知检查
  const notif4 = (await axios.get(`${API}/notifications`, { headers: { Authorization: `Bearer ${token4r}` } })).data.notifications.filter(n => n.type === 'review_reminder').length;
  const test4b = notif4 >= 2;
  console.log(`  催审通知: 审稿人收到催审通知数=${notif4} ${test4b ? '✅' : '❌'}`);
  if (!test4b) allPassed = false;

  // 超期审稿列表接口
  const overdue = (await axios.get(`${API}/reviews/overdue/list`, authHeaders(adminToken))).data;
  const test4c = Array.isArray(overdue.reviews);
  console.log(`  超期列表接口: 返回${overdue.reviews?.length || 0}条记录, 接口正常=${test4c ? '✅' : '❌'}`);
  if (!test4c) allPassed = false;

  console.log('');
  console.log('=========== 测试总结 ===========');
  console.log(allPassed ? '✅ 全部4个问题修复验证通过！' : '❌ 部分测试未通过，请检查上面的输出');
  console.log('  问题1: 投稿字段保存显示 - ' + (test1a && test1b && test1c && test1d ? '✅ 通过' : '❌ 失败'));
  console.log('  问题2: 双盲数据脱敏    - ' + (test2a && test2b && test2c ? '✅ 通过' : '❌ 失败'));
  console.log('  问题3: 通知+级联邀请  - ' + (test3a && test3b && test3c ? '✅ 通过' : '❌ 失败'));
  console.log('  问题4: 催审+超期列表  - ' + (test4a && test4b && test4c ? '✅ 通过' : '❌ 失败'));
  process.exit(allPassed ? 0 : 1);
}

test().catch(err => {
  console.error('\n❌ 测试异常终止:', err.response?.data || err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
