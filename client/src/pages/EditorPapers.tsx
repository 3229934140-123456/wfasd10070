import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, statusLabels } from '../utils/format';
import { Filter, AlertTriangle, Bell, ArrowLeft, FileText, Clock, User } from 'lucide-react';

export default function EditorPapers() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [overdueReviews, setOverdueReviews] = useState<any[]>([]);
  const [remindingId, setRemindingId] = useState<string | null>(null);

  useEffect(() => {
    if (showOverdueOnly) {
      loadOverdueReviews();
    } else {
      loadPapers();
    }
    loadOverdueCount();
  }, [status, page, showOverdueOnly]);

  const loadPapers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/papers', {
        params: { status, page, limit: 10 },
      });
      setPapers(res.data.papers);
      setTotal(res.data.total);
    } catch (err) {
      console.error('加载稿件失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadOverdueCount = async () => {
    try {
      const res = await api.get('/reviews/overdue/list');
      setOverdueCount(res.data.reviews.length);
    } catch (err) {
      console.error('加载超期审稿失败', err);
    }
  };

  const loadOverdueReviews = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reviews/overdue/list');
      setOverdueReviews(res.data.reviews);
    } catch (err) {
      console.error('加载超期审稿失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemind = async (reviewId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('确定要发送催审提醒吗？')) return;
    
    setRemindingId(reviewId);
    try {
      await api.post(`/reviews/${reviewId}/remind`);
      alert('催审提醒已发送');
      loadOverdueReviews();
      loadOverdueCount();
    } catch (err: any) {
      alert(err.response?.data?.error || '催审失败');
    } finally {
      setRemindingId(null);
    }
  };

  const statusOptions = [
    { value: 'all', label: '全部状态' },
    { value: 'submitted', label: '待分配' },
    { value: 'under_review', label: '审稿中' },
    { value: 'revise', label: '待修改' },
    { value: 'revision_submitted', label: '修改稿已提交' },
    { value: 'accepted', label: '已录用' },
    { value: 'rejected', label: '已拒绝' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {showOverdueOnly && (
            <button
              onClick={() => setShowOverdueOnly(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <ArrowLeft size={20} />
              返回稿件列表
            </button>
          )}
          <h2 className="text-xl font-semibold text-gray-800">
            {showOverdueOnly ? '超期审稿任务' : '稿件管理'}
          </h2>
        </div>
        {!showOverdueOnly && overdueCount > 0 && (
          <button
            onClick={() => setShowOverdueOnly(true)}
            className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 rounded-lg transition-colors"
          >
            <AlertTriangle size={18} />
            超期审稿 ({overdueCount})
          </button>
        )}
      </div>

      {showOverdueOnly ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 bg-red-50">
            <div className="flex items-center gap-2 text-red-700">
              <AlertTriangle size={18} />
              <span className="font-medium">共 {overdueReviews.length} 个超期审稿任务</span>
            </div>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">加载中...</div>
          ) : overdueReviews.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              <Clock size={40} className="mx-auto mb-2 text-gray-300" />
              <p>太棒了！目前没有超期的审稿任务</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {overdueReviews.map(review => (
                <div
                  key={review.id}
                  className="p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div 
                      className="flex-1 cursor-pointer"
                      onClick={() => navigate(`/editor/papers/${review.paper_id}`)}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <FileText size={16} className="text-gray-400" />
                        <h3 className="font-medium text-gray-800 hover:text-primary-600 line-clamp-1">
                          {review.title}
                        </h3>
                      </div>
                      
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-1.5">
                          <User size={14} className="text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {review.reviewer_name}
                          </span>
                          <span className="text-xs text-gray-400">
                            ({review.reviewer_email})
                          </span>
                        </div>
                        <span className={`status-badge review-${review.status}`}>
                          {review.status === 'accepted' ? '审稿中' : review.status}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>
                          邀请时间：{formatDate(review.invitation_date)}
                        </span>
                        <span className="text-red-600 font-medium">
                          超期：{Math.floor(review.days_overdue)} 天
                        </span>
                        <span>
                          截止日期：{formatDate(review.due_date)}
                        </span>
                        {review.reminder_sent > 0 && (
                          <span className="flex items-center gap-1 text-orange-600">
                            <Bell size={12} />
                            已催审 {review.reminder_sent} 次
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={(e) => handleRemind(review.id, e)}
                        disabled={remindingId === review.id}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg disabled:opacity-50 transition-colors min-w-[100px]"
                      >
                        <Bell size={14} />
                        {remindingId === review.id ? '发送中...' : '催审'}
                      </button>
                      <button
                        onClick={() => navigate(`/editor/papers/${review.paper_id}`)}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded-lg transition-colors min-w-[100px]"
                      >
                        查看稿件
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter size={18} className="text-gray-500" />
              <select
                value={status}
                onChange={e => { setStatus(e.target.value); setPage(1); }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {statusOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <span className="text-sm text-gray-500">共 {total} 篇稿件</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-gray-500">加载中...</div>
          ) : papers.length === 0 ? (
            <div className="p-10 text-center text-gray-500">暂无稿件</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {papers.map(paper => (
                <div
                  key={paper.id}
                  onClick={() => navigate(`/editor/papers/${paper.id}`)}
                  className="p-4 hover:bg-gray-50 cursor-pointer"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-800 hover:text-primary-600">
                        {paper.title}
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        作者：{paper.author_name || '未知'}
                      </p>
                      {paper.keywords && paper.keywords.length > 0 && (
                        <p className="text-xs text-gray-400 mt-1">
                          关键词: {paper.keywords.slice(0, 3).join(', ')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <span className={`status-badge status-${paper.status}`}>
                        {statusLabels[paper.status] || paper.status}
                      </span>
                      <p className="text-xs text-gray-500 mt-2">
                        投稿：{formatDate(paper.submitted_at)}
                      </p>
                      <p className="text-xs text-gray-500">
                        审稿进度：{paper.completed_reviews || 0}/{paper.review_count || 0}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {total > 10 && (
            <div className="p-4 border-t border-gray-200 flex items-center justify-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                上一页
              </button>
              <span className="text-sm text-gray-600">第 {page} 页</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page * 10 >= total}
                className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
