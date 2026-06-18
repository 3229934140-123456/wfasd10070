import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, statusLabels } from '../utils/format';
import { Filter, Search, AlertTriangle, Bell } from 'lucide-react';

export default function EditorPapers() {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);

  useEffect(() => {
    loadPapers();
    loadOverdueCount();
  }, [status, page]);

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
        <h2 className="text-xl font-semibold text-gray-800">稿件管理</h2>
        {overdueCount > 0 && (
          <button
            onClick={() => setShowOverdueOnly(!showOverdueOnly)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
              showOverdueOnly ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <AlertTriangle size={18} />
            超期审稿 ({overdueCount})
          </button>
        )}
      </div>

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
    </div>
  );
}
