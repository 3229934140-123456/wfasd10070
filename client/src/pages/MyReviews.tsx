import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { formatDate, statusLabels } from '../utils/format';
import { Filter, Clock } from 'lucide-react';

export default function MyReviews() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadReviews();
  }, [status, page, user?.role]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const endpoint = user?.role === 'editor' ? '/papers' : '/reviews/my';
      const res = await api.get(endpoint, {
        params: { status, page, limit: 10 },
      });
      
      if (user?.role === 'editor') {
        setReviews(res.data.papers);
      } else {
        setReviews(res.data.reviews);
      }
      setTotal(res.data.total);
    } catch (err) {
      console.error('加载审稿失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (review: any) => {
    if (user?.role === 'editor') {
      navigate(`/editor/papers/${review.id}`);
    } else {
      navigate(`/reviews/${review.id}`);
    }
  };

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'invited', label: '待接受' },
    { value: 'accepted', label: '进行中' },
    { value: 'completed', label: '已完成' },
    { value: 'declined', label: '已拒绝' },
  ];

  const isOverdue = (dueDate: string) => {
    return dueDate && new Date(dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">
          {user?.role === 'editor' ? '审稿管理' : '我的审稿'}
        </h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-gray-500" />
            <select
              value={status}
              onChange={e => setStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              {statusOptions.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <span className="text-sm text-gray-500">共 {total} 条</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">加载中...</div>
        ) : reviews.length === 0 ? (
          <div className="p-10 text-center text-gray-500">暂无审稿任务</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {reviews.map(review => (
              <div
                key={review.id}
                onClick={() => handleClick(review)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 hover:text-primary-600">
                      {review.title}
                    </h3>
                    {review.keywords && review.keywords.length > 0 && (
                      <p className="text-xs text-gray-500 mt-1">
                        关键词: {review.keywords.slice(0, 3).join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge ${
                      user?.role === 'editor' 
                        ? `status-${review.status}` 
                        : `review-${review.status}`
                    }`}>
                      {statusLabels[review.status] || review.status}
                    </span>
                    {review.status === 'accepted' && review.due_date && isOverdue(review.due_date) && (
                      <span className="flex items-center gap-1 text-xs text-red-500">
                        <Clock size={12} />
                        已超期
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                  <span>邀请时间：{formatDate(review.invitation_date || review.submitted_at)}</span>
                  {review.due_date && (
                    <span>截止日期：{formatDate(review.due_date)}</span>
                  )}
                  {review.completed_date && (
                    <span>完成时间：{formatDate(review.completed_date)}</span>
                  )}
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
    </div>
  );
}
