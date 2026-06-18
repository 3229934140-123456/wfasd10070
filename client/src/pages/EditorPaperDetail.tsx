import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, formatDateTime, statusLabels, statusColors, decisionLabels, recommendationLabels } from '../utils/format';
import {
  ArrowLeft, Download, UserPlus, Bell, CheckCircle, XCircle,
  FileText, Users, MessageSquare, Clock, Eye, History, User,
  Loader2, AlertCircle
} from 'lucide-react';

export default function EditorPaperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableReviewers, setAvailableReviewers] = useState<any[]>([]);
  const [paperFields, setPaperFields] = useState<any[]>([]);
  const [selectedReviewers, setSelectedReviewers] = useState<string[]>([]);
  const [requiredReviews, setRequiredReviews] = useState(3);
  const [dueDays, setDueDays] = useState(14);
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decision, setDecision] = useState('');
  const [decisionComments, setDecisionComments] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showScreeningModal, setShowScreeningModal] = useState(false);
  const [screeningAction, setScreeningAction] = useState<'request_revision' | 'mark_unsuitable' | null>(null);
  const [screeningComments, setScreeningComments] = useState('');
  const [reviewerPool, setReviewerPool] = useState<any>(null);
  const [poolLoading, setPoolLoading] = useState(false);

  useEffect(() => {
    loadPaper();
  }, [id]);

  const loadPaper = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/papers/${id}`);
      setPaper(res.data.paper);
      if (res.data.paper.status === 'under_review' || res.data.paper.status === 'pending_assignment') {
        loadReviewerPool();
      }
    } catch (err) {
      console.error('加载稿件失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadReviewerPool = async () => {
    setPoolLoading(true);
    try {
      const res = await api.get(`/reviews/paper/${id}/reviewer-pool`);
      setReviewerPool(res.data);
    } catch (err) {
      console.error('加载候选池进度失败', err);
    } finally {
      setPoolLoading(false);
    }
  };

  const loadAvailableReviewers = async () => {
    try {
      const res = await api.get(`/reviews/paper/${id}/available-reviewers`);
      setAvailableReviewers(res.data.reviewers);
      setPaperFields(res.data.paper_fields || []);
      setSelectedReviewers([]);
      setRequiredReviews(3);
    } catch (err) {
      console.error('加载可用审稿人失败', err);
    }
  };

  const handleAssignReviewers = async () => {
    if (selectedReviewers.length === 0) {
      alert('请至少选择一位审稿人');
      return;
    }
    if (selectedReviewers.length < requiredReviews) {
      alert(`需要至少选择 ${requiredReviews} 位审稿人以保证有 ${requiredReviews} 份有效意见`);
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/reviews/paper/${id}/assign`, {
        reviewerIds: selectedReviewers,
        due_days: dueDays,
        required_reviews: requiredReviews,
      });
      setShowAssignModal(false);
      loadPaper();
      loadReviewerPool();
    } catch (err: any) {
      alert(err.response?.data?.error || '分配失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemind = async (reviewId: string) => {
    if (!confirm('确定要发送催审提醒吗？')) return;
    
    try {
      await api.post(`/reviews/${reviewId}/remind`);
      alert('催审提醒已发送');
      loadPaper();
    } catch (err: any) {
      alert(err.response?.data?.error || '催审失败');
    }
  };

  const handleMakeDecision = async () => {
    if (!decision) {
      alert('请选择决定');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/reviews/paper/${id}/decision`, {
        decision,
        comments: decisionComments,
      });
      setShowDecisionModal(false);
      setDecision('');
      setDecisionComments('');
      loadPaper();
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = (version?: number) => {
    const url = version
      ? `/api/papers/${id}/download?version=${version}`
      : `/api/papers/${id}/download`;
    window.open(url, '_blank');
  };

  const toggleReviewer = (reviewerId: string) => {
    if (selectedReviewers.includes(reviewerId)) {
      setSelectedReviewers(selectedReviewers.filter(id => id !== reviewerId));
    } else {
      setSelectedReviewers([...selectedReviewers, reviewerId]);
    }
  };

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (!paper) {
    return <div className="text-center py-10 text-gray-500">稿件不存在</div>;
  }

  const handleScreening = async () => {
    if (!screeningAction) return;

    setSubmitting(true);
    try {
      const endpoint = screeningAction === 'request_revision'
        ? `/papers/${id}/screening/request-revision`
        : `/papers/${id}/screening/mark-unsuitable`;

      await api.post(endpoint, {
        comments: screeningComments,
      });
      setShowScreeningModal(false);
      setScreeningAction(null);
      setScreeningComments('');
      loadPaper();
      alert('操作成功');
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendToReview = async () => {
    try {
      await api.post(`/papers/${id}/screening/send-to-review`);
      loadAvailableReviewers();
      setShowAssignModal(true);
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const canScreen = paper.status === 'submitted' || paper.status === 'revision_submitted';
  const canAssign = paper.status === 'pending_assignment';
  const canMakeDecision = paper.reviews?.filter((r: any) => r.status === 'completed').length > 0;
  const completedCount = paper.reviews?.filter((r: any) => r.status === 'completed').length || 0;
  const acceptedCount = paper.reviews?.filter((r: any) => r.status === 'accepted').length || 0;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-gray-800">稿件详情</h2>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canScreen && (
            <>
              <button
                onClick={() => {
                  setScreeningAction('request_revision');
                  setScreeningComments('');
                  setShowScreeningModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg"
              >
                <XCircle size={18} />
                退回补资料
              </button>
              <button
                onClick={() => {
                  setScreeningAction('mark_unsuitable');
                  setScreeningComments('');
                  setShowScreeningModal(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                <XCircle size={18} />
                不适合送审
              </button>
              <button
                onClick={handleSendToReview}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
              >
                <UserPlus size={18} />
                送审并分配
              </button>
            </>
          )}
          {!canScreen && canAssign && (
            <button
              onClick={() => {
                loadAvailableReviewers();
                setShowAssignModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
            >
              <UserPlus size={18} />
              分配审稿
            </button>
          )}
          {canMakeDecision && (
            <button
              onClick={() => setShowDecisionModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              <CheckCircle size={18} />
              做出决定
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-4">
              <h1 className="text-xl font-bold text-gray-800">{paper.title}</h1>
              <span className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${statusColors[paper.status] || 'bg-gray-100 text-gray-700'}`}>
                {statusLabels[paper.status] || paper.status}
              </span>
            </div>

            <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
              <span>投稿：{formatDate(paper.submitted_at)}</span>
              <span>版本：v{paper.current_version}</span>
              <span>
                作者：{paper.corresponding_author_name || '未知'}
              </span>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">摘要</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{paper.abstract}</p>
            </div>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-800 mb-2">关键词</h3>
              <div className="flex flex-wrap gap-2">
                {paper.keywords?.map((kw: string, i: number) => (
                  <span
                    key={i}
                    className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            </div>

            {paper.fields && paper.fields.length > 0 && (
              <div className="mb-6">
                <h3 className="font-semibold text-gray-800 mb-2">研究领域</h3>
                <div className="flex flex-wrap gap-2">
                  {paper.fields.map((field: any, i: number) => (
                    <span
                      key={i}
                      className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                    >
                      {field.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-gray-800 mb-3">作者列表</h3>
              <div className="space-y-2">
                {paper.authors?.map((author: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <span className="font-medium text-gray-800">{author.name}</span>
                    {author.is_corresponding && (
                      <span className="text-xs text-primary-600">(通讯)</span>
                    )}
                    {author.affiliation && (
                      <span className="text-sm text-gray-500">· {author.affiliation}</span>
                    )}
                    {author.email && (
                      <span className="text-sm text-gray-400">· {author.email}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">版本历史</h3>
            </div>
            <div className="space-y-2">
              {paper.versions?.map((v: any) => (
                <div
                  key={v.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <FileText size={20} className="text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-800">
                        v{v.version_number} - {v.version_notes}
                      </p>
                      <p className="text-xs text-gray-500">{formatDate(v.created_at)}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDownload(v.version_number)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    下载
                  </button>
                </div>
              ))}
            </div>
          </div>

          {paper.decisions && paper.decisions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <History size={20} className="text-gray-400" />
                <h3 className="font-semibold text-gray-800">处理流程记录</h3>
              </div>
              
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                
                <div className="space-y-6">
                  {paper.decisions.map((d: any, i: number) => (
                    <div key={d.id} className="relative pl-10">
                      <div className="absolute left-2 top-1.5 w-5 h-5 bg-white border-2 border-primary-500 rounded-full flex items-center justify-center">
                        <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              d.decision === 'screening_passed' ? 'bg-green-100 text-green-700' :
                              d.decision === 'reviewers_assigned' ? 'bg-blue-100 text-blue-700' :
                              d.decision === 'request_revision' ? 'bg-yellow-100 text-yellow-700' :
                              d.decision === 'not_suitable' ? 'bg-red-100 text-red-700' :
                              d.decision === 'accept' ? 'bg-green-100 text-green-700' :
                              d.decision === 'reject' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {decisionLabels[d.decision] || d.decision}
                            </span>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <Clock size={12} />
                              {formatDateTime(d.decision_date)}
                            </span>
                          </div>
                          {d.editor_name && (
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                              <User size={12} />
                              {d.editor_name}
                            </span>
                          )}
                        </div>
                        {d.comments && (
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{d.comments}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users size={18} />
              审稿进度
            </h3>
            
            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">已完成</span>
                <span className="font-medium text-gray-800">{completedCount} 人</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">进行中</span>
                <span className="font-medium text-gray-800">{acceptedCount} 人</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">需要审稿数</span>
                <span className="font-medium text-primary-600">{paper.required_reviews || 3} 份意见</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">总审稿人</span>
                <span className="font-medium text-gray-800">
                  {paper.reviews?.length || 0} 人
                </span>
              </div>
            </div>

            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all"
                style={{
                  width: `${paper.reviews?.length ? (completedCount / (paper.required_reviews || 3)) * 100 : 0}%`,
                  maxWidth: '100%'
                }}
              />
            </div>
            {completedCount >= (paper.required_reviews || 3) && (
              <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                <CheckCircle size={12} />
                已收集足够意见，可以做出决定
              </p>
            )}
          </div>

          {reviewerPool && reviewerPool.pool && reviewerPool.pool.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Loader2 size={18} className="text-primary-500" />
                  候选池进度
                </h3>
                <button
                  onClick={loadReviewerPool}
                  className="text-xs text-primary-600 hover:text-primary-700"
                >
                  刷新
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-600">{reviewerPool.validCount}/{reviewerPool.requiredReviews}</p>
                  <p className="text-xs text-blue-600 mt-1">有效意见</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-orange-600">{reviewerPool.remainingNeeded}</p>
                  <p className="text-xs text-orange-600 mt-1">还差</p>
                </div>
              </div>

              <div className="space-y-2">
                {reviewerPool.pool.map((item: any, idx: number) => {
                  const isCurrent = idx === reviewerPool.currentInvitedIndex;
                  const isDeclined = item.pool_status === 'declined';
                  const isCompleted = item.review_status === 'completed';
                  const isAccepted = item.review_status === 'accepted';
                  const isPending = item.pool_status === 'pending';
                  
                  let statusColor = 'bg-gray-100 text-gray-600';
                  let statusIcon: any = Clock;
                  
                  if (isCompleted) {
                    statusColor = 'bg-green-100 text-green-700';
                    statusIcon = CheckCircle;
                  } else if (isDeclined) {
                    statusColor = 'bg-red-100 text-red-700';
                    statusIcon = XCircle;
                  } else if (isAccepted) {
                    statusColor = 'bg-blue-100 text-blue-700';
                    statusIcon = Users;
                  } else if (isCurrent) {
                    statusColor = 'bg-yellow-100 text-yellow-700';
                    statusIcon = Loader2;
                  } else if (isPending) {
                    statusColor = 'bg-gray-100 text-gray-500';
                    statusIcon = Clock;
                  }

                  const StatusIcon = statusIcon;
                  
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                        isCurrent ? 'border-yellow-300 bg-yellow-50' : 
                        isDeclined ? 'border-red-200 bg-red-50/50' :
                        isCompleted ? 'border-green-200 bg-green-50/50' :
                        'border-gray-200 bg-gray-50/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusColor}`}>
                        <span className="text-sm font-bold">{idx + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800 text-sm truncate">
                            {item.reviewer_name}
                          </span>
                          <StatusIcon size={12} className={
                            isCompleted ? 'text-green-600' :
                            isDeclined ? 'text-red-600' :
                            isCurrent ? 'text-yellow-600 animate-spin' :
                            'text-gray-400'
                          } />
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor}`}>
                            {isCompleted ? '已完成' :
                             isDeclined ? '已拒绝' :
                             isAccepted ? '审稿中' :
                             isCurrent ? '已邀请' :
                             '等待中'}
                          </span>
                          {item.recommendation && isCompleted && (
                            <span className="text-xs text-gray-500">
                              · {recommendationLabels[item.recommendation]}
                            </span>
                          )}
                        </div>
                      </div>
                      {item.review_status === 'invited' && (
                        <button
                          onClick={() => handleRemind(item.review_id)}
                          className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded"
                          title="发送催审"
                        >
                          <Bell size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>共 {reviewerPool.totalCandidates} 位候选人</span>
                <span>{reviewerPool.declinedCount} 位拒绝 · {reviewerPool.pendingCount} 位等待</span>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <MessageSquare size={18} />
              审稿人列表
            </h3>
            
            <div className="space-y-3">
              {paper.reviews?.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">暂无审稿人</p>
              ) : (
                paper.reviews.map((review: any) => (
                  <div
                    key={review.id}
                    className="p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-800">
                        {review.reviewer_name || '审稿人'}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        review.status === 'completed' ? 'bg-green-100 text-green-700' :
                        review.status === 'accepted' ? 'bg-blue-100 text-blue-700' :
                        review.status === 'declined' ? 'bg-red-100 text-red-700' :
                        review.status === 'invited' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {review.status === 'invited' ? '已邀请' :
                         review.status === 'accepted' ? '进行中' :
                         review.status === 'completed' ? '已完成' :
                         review.status === 'declined' ? '已拒绝' :
                         review.status}
                      </span>
                    </div>
                    
                    {review.recommendation && (
                      <div className="mb-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          review.recommendation === 'accept' ? 'bg-green-100 text-green-700' :
                          review.recommendation === 'reject' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          建议：{recommendationLabels[review.recommendation]}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>邀请：{formatDate(review.invitation_date)}</span>
                      <div className="flex items-center gap-3">
                        {review.reminder_sent > 0 && (
                          <span className="text-orange-600 flex items-center gap-1">
                            <Bell size={12} />
                            已催审 {review.reminder_sent} 次
                          </span>
                        )}
                        {review.status === 'accepted' && (
                          <button
                            onClick={() => handleRemind(review.id)}
                            className="flex items-center gap-1 text-orange-600 hover:text-orange-700"
                          >
                            <Bell size={12} />
                            催审
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {review.status === 'accepted' && review.due_date && (
                      <p className={`text-xs mt-1 ${
                        new Date(review.due_date) < new Date() ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        截止：{formatDate(review.due_date)}
                        {new Date(review.due_date) < new Date() && ' (已超期)'}
                      </p>
                    )}
                    
                    {review.status === 'completed' && review.comments_to_editor && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded text-xs text-yellow-700">
                        <p className="font-medium mb-1">给编辑的意见：</p>
                        <p className="whitespace-pre-wrap">{review.comments_to_editor}</p>
                      </div>
                    )}
                    
                    {review.status === 'completed' && review.comments_to_author && (
                      <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                        <p className="font-medium mb-1">给作者的意见：</p>
                        <p className="whitespace-pre-wrap line-clamp-3">{review.comments_to_author}</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {paper.decisions && paper.decisions.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-800 mb-4">决定记录</h3>
              <div className="space-y-3">
                {paper.decisions.map((d: any) => (
                  <div key={d.id} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className={`status-badge ${
                        d.decision === 'accept' ? 'bg-green-100 text-green-800' :
                        d.decision === 'reject' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {decisionLabels[d.decision]}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(d.decision_date)}</span>
                    </div>
                    {d.comments && (
                      <p className="text-sm text-gray-600 mt-2">{d.comments}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      v{d.paper_version} · {d.editor_name}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">分配审稿人</h3>
              <p className="text-sm text-gray-500 mt-1">
                选择审稿人，系统将按顺序邀请，第一位拒绝后自动邀请下一位
              </p>
              {paperFields.length > 0 && (
                <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-2">论文研究领域：</p>
                  <div className="flex flex-wrap gap-1.5">
                    {paperFields.map((f: any, i: number) => (
                      <span key={i} className="px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {f.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <div className="p-4 border-b border-gray-200 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">需要审稿数：</label>
                <select
                  value={requiredReviews}
                  onChange={e => setRequiredReviews(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value={2}>2 份意见</option>
                  <option value={3}>3 份意见</option>
                  <option value={4}>4 份意见</option>
                  <option value={5}>5 份意见</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-600 whitespace-nowrap">审稿期限：</label>
                <select
                  value={dueDays}
                  onChange={e => setDueDays(Number(e.target.value))}
                  className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                >
                  <option value={7}>7 天</option>
                  <option value={14}>14 天</option>
                  <option value={21}>21 天</option>
                  <option value={30}>30 天</option>
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {availableReviewers.length === 0 ? (
                <p className="text-center text-gray-500 py-8">暂无可用审稿人</p>
              ) : (
                <div className="space-y-2">
                  {availableReviewers.map((reviewer, index) => (
                    <div
                      key={reviewer.id}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                        selectedReviewers.includes(reviewer.id)
                          ? 'border-primary-500 bg-primary-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => toggleReviewer(reviewer.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                            {reviewer.name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">{reviewer.name}</p>
                            <p className="text-xs text-gray-500">{reviewer.affiliation}</p>
                          </div>
                        </div>
                        {reviewer.match_count > 0 && (
                          <div className="text-right">
                            <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                              匹配度: {reviewer.match_count}
                            </span>
                          </div>
                        )}
                      </div>
                      {reviewer.matched_fields && reviewer.matched_fields.length > 0 && (
                        <div className="mt-2 p-2 bg-green-50 rounded">
                          <p className="text-xs text-green-700 mb-1">匹配原因：</p>
                          <div className="flex flex-wrap gap-1">
                            {reviewer.matched_fields.map((f: string, i: number) => (
                              <span key={i} className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">
                                {f}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {reviewer.fields && reviewer.fields.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {reviewer.fields.slice(0, 3).map((f: string, i: number) => (
                            <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                      {selectedReviewers.includes(reviewer.id) && (
                        <div className="mt-2 text-xs text-primary-600">
                          邀请顺序：第 {selectedReviewers.indexOf(reviewer.id) + 1} 位
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-between">
              <div className="text-sm text-gray-500">
                需要 {requiredReviews} 份意见 · 已选择 {selectedReviewers.length} 位审稿人
                {selectedReviewers.length > 0 && selectedReviewers.length < requiredReviews && (
                  <span className="text-yellow-600 ml-2">（还需 {requiredReviews - selectedReviewers.length} 位）</span>
                )}
                {selectedReviewers.length >= requiredReviews && (
                  <span className="text-green-600 ml-2">✓ 人数充足</span>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  onClick={handleAssignReviewers}
                  disabled={selectedReviewers.length === 0 || selectedReviewers.length < requiredReviews || submitting}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
                >
                  {submitting ? '分配中...' : '确认分配'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDecisionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">做出最终决定</h3>
              <p className="text-sm text-gray-500 mt-1">
                请查看汇总的审稿意见后做出决定
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 意见汇总 */}
              {paper.reviews?.filter((r: any) => r.status === 'completed').length > 0 && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    审稿意见汇总
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(['accept', 'minor_revision', 'major_revision', 'reject'] as const).map(rec => {
                      const count = paper.reviews.filter((r: any) => r.status === 'completed' && r.recommendation === rec).length;
                      return count > 0 ? (
                        <div key={rec} className={`p-3 rounded-lg text-center ${
                          rec === 'accept' ? 'bg-green-100 text-green-800' :
                          rec === 'minor_revision' ? 'bg-blue-100 text-blue-800' :
                          rec === 'major_revision' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          <p className="text-2xl font-bold">{count}</p>
                          <p className="text-xs mt-1">{recommendationLabels[rec]}</p>
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
              )}

              {/* 各位审稿人意见 */}
              <div>
                <h4 className="font-medium text-gray-800 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-primary-600" />
                  各位审稿人意见
                </h4>
                <div className="space-y-3">
                  {paper.reviews?.filter((r: any) => r.status === 'completed').map((review: any, idx: number) => (
                    <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-800">
                            审稿人 {idx + 1}
                          </span>
                          {review.recommendation && (
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              review.recommendation === 'accept' ? 'bg-green-100 text-green-700' :
                              review.recommendation === 'reject' ? 'bg-red-100 text-red-700' :
                              review.recommendation === 'minor_revision' ? 'bg-blue-100 text-blue-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {recommendationLabels[review.recommendation]}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          完成时间：{formatDate(review.completed_date)}
                        </span>
                      </div>

                      {review.comments_to_author && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-gray-600 mb-1">给作者的意见：</p>
                          <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded whitespace-pre-wrap">
                            {review.comments_to_author}
                          </p>
                        </div>
                      )}

                      {review.comments_to_editor && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-orange-600 mb-1">给编辑的私密意见：</p>
                          <p className="text-sm text-orange-700 bg-orange-50 p-3 rounded whitespace-pre-wrap">
                            {review.comments_to_editor}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 决定选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  最终决定 <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: 'accept', label: '接受', color: 'green' },
                    { value: 'minor_revision', label: '小修', color: 'blue' },
                    { value: 'major_revision', label: '大修', color: 'yellow' },
                    { value: 'reject', label: '拒绝', color: 'red' },
                  ].map(opt => (
                    <label
                      key={opt.value}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition-all text-center ${
                        decision === opt.value
                          ? opt.color === 'green' ? 'border-green-500 bg-green-50' :
                            opt.color === 'blue' ? 'border-blue-500 bg-blue-50' :
                            opt.color === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                            'border-red-500 bg-red-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="decision"
                        value={opt.value}
                        checked={decision === opt.value}
                        onChange={e => setDecision(e.target.value)}
                        className="sr-only"
                      />
                      <span className={`font-medium ${
                        decision === opt.value
                          ? opt.color === 'green' ? 'text-green-700' :
                            opt.color === 'blue' ? 'text-blue-700' :
                            opt.color === 'yellow' ? 'text-yellow-700' :
                            'text-red-700'
                          : 'text-gray-700'
                      }`}>
                        {opt.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  决定意见（给作者）
                </label>
                <textarea
                  value={decisionComments}
                  onChange={e => setDecisionComments(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="请输入决定的详细说明，作者将看到此意见..."
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDecisionModal(false);
                  setDecision('');
                  setDecisionComments('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleMakeDecision}
                disabled={!decision || submitting}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50"
              >
                {submitting ? '发布中...' : '确认发布决定'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showScreeningModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {screeningAction === 'request_revision' ? '退回补资料' : '标记不适合送审'}
              </h3>
              <p className="text-sm text-gray-500 mt-1">
                {screeningAction === 'request_revision'
                  ? '请输入需要作者补充的资料说明'
                  : '请输入不适合送审的原因说明'}
              </p>
            </div>
            
            <div className="p-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  说明 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={screeningComments}
                  onChange={e => setScreeningComments(e.target.value)}
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder={screeningAction === 'request_revision'
                    ? '请详细说明需要作者补充哪些资料...'
                    : '请详细说明不适合送审的原因...'}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowScreeningModal(false);
                  setScreeningAction(null);
                  setScreeningComments('');
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleScreening}
                disabled={!screeningComments.trim() || submitting}
                className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 ${
                  screeningAction === 'request_revision'
                    ? 'bg-yellow-600 hover:bg-yellow-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {submitting ? '提交中...' : '确认提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
