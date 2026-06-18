import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, statusLabels, statusColors } from '../utils/format';
import { Plus, Search, Filter, Users } from 'lucide-react';

export default function Papers() {
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    loadPapers();
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

  const statusOptions = [
    { value: 'all', label: '全部' },
    { value: 'submitted', label: '已提交' },
    { value: 'needs_revision', label: '退回补资料' },
    { value: 'not_suitable', label: '不适合送审' },
    { value: 'pending_assignment', label: '待分配审稿人' },
    { value: 'under_review', label: '审稿中' },
    { value: 'revise', label: '待修改' },
    { value: 'revision_submitted', label: '修改稿已提交' },
    { value: 'accepted', label: '已录用' },
    { value: 'rejected', label: '已拒绝' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">我的稿件</h2>
        <button
          onClick={() => navigate('/papers/submit')}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors"
        >
          <Plus size={20} />
          提交新稿件
        </button>
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
          <span className="text-sm text-gray-500">共 {total} 篇稿件</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">加载中...</div>
        ) : papers.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-gray-500">暂无稿件</p>
            <button
              onClick={() => navigate('/papers/submit')}
              className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
            >
              提交第一篇稿件
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {papers.map(paper => (
              <div
                key={paper.id}
                onClick={() => navigate(`/papers/${paper.id}`)}
                className="p-4 hover:bg-gray-50 cursor-pointer"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-800 hover:text-primary-600">
                      {paper.title}
                    </h3>
                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[paper.status] || 'bg-gray-100 text-gray-700'}`}>
                        {statusLabels[paper.status] || paper.status}
                      </span>
                    </div>
                    {paper.authors && paper.authors.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-600">
                        <Users size={12} className="text-gray-400" />
                        <span>
                          {paper.authors.map((a: any) => 
                            a.is_corresponding ? `${a.name}*` : a.name
                          ).join(', ')}
                        </span>
                      </div>
                    )}
                    {paper.keywords && paper.keywords.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {paper.keywords.slice(0, 4).map((kw: string, i: number) => (
                          <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {kw}
                          </span>
                        ))}
                      </div>
                    )}
                    {paper.fields && paper.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {paper.fields.slice(0, 3).map((f: any, i: number) => (
                          <span key={i} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded">
                            {f.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">投稿时间</p>
                    <p className="text-sm text-gray-700">{formatDate(paper.submitted_at)}</p>
                    {typeof paper.review_count !== 'undefined' && (
                      <p className="text-xs text-gray-500 mt-1">
                        审稿进度: {paper.completed_reviews}/{paper.review_count}
                      </p>
                    )}
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
