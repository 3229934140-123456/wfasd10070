import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { FileText, ClipboardList, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { formatDate, statusLabels } from '../utils/format';

export default function Dashboard() {
  const { user } = useAuthStore();
  const [stats, setStats] = useState<any>(null);
  const [recentPapers, setRecentPapers] = useState<any[]>([]);
  const [recentReviews, setRecentReviews] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, [user?.role]);

  const loadDashboardData = async () => {
    try {
      if (user?.role === 'author') {
        const res = await api.get('/papers?limit=5');
        setRecentPapers(res.data.papers);
        setStats({
          total: res.data.total,
          underReview: res.data.papers.filter((p: any) => p.status === 'under_review').length,
          accepted: res.data.papers.filter((p: any) => p.status === 'accepted').length,
          revise: res.data.papers.filter((p: any) => p.status === 'revise').length,
        });
      } else if (user?.role === 'reviewer') {
        const res = await api.get('/reviews/my?limit=5');
        setRecentReviews(res.data.reviews);
        setStats({
          total: res.data.total,
          pending: res.data.reviews.filter((r: any) => r.status === 'invited' || r.status === 'accepted').length,
          completed: res.data.reviews.filter((r: any) => r.status === 'completed').length,
        });
      } else if (user?.role === 'editor') {
        const res = await api.get('/statistics/overview');
        setStats(res.data);
        const papersRes = await api.get('/papers?limit=5');
        setRecentPapers(papersRes.data.papers);
      }
    } catch (err) {
      console.error('加载数据失败', err);
    }
  };

  if (!stats) {
    return <div className="text-center py-10">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {user?.role === 'author' && (
          <>
            <StatCard title="投稿总数" value={stats.total} icon={FileText} color="blue" />
            <StatCard title="审稿中" value={stats.underReview} icon={Clock} color="yellow" />
            <StatCard title="待修改" value={stats.revise} icon={AlertTriangle} color="purple" />
            <StatCard title="已录用" value={stats.accepted} icon={CheckCircle} color="green" />
          </>
        )}
        {user?.role === 'reviewer' && (
          <>
            <StatCard title="总审稿数" value={stats.total} icon={ClipboardList} color="blue" />
            <StatCard title="待处理" value={stats.pending} icon={Clock} color="yellow" />
            <StatCard title="已完成" value={stats.completed} icon={CheckCircle} color="green" />
          </>
        )}
        {user?.role === 'editor' && (
          <>
            <StatCard title="总投稿数" value={stats.totalPapers} icon={FileText} color="blue" />
            <StatCard title="总审稿数" value={stats.totalReviews} icon={ClipboardList} color="purple" />
            <StatCard title="录用率" value={`${stats.acceptanceRate}%`} icon={CheckCircle} color="green" />
            <StatCard title="平均审稿周期" value={`${stats.avgReviewTime}天`} icon={Clock} color="yellow" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(user?.role === 'author' || user?.role === 'editor') && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">最近投稿</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {recentPapers.length === 0 ? (
                <p className="p-6 text-center text-gray-500">暂无稿件</p>
              ) : (
                recentPapers.map(paper => (
                  <div key={paper.id} className="p-4 hover:bg-gray-50">
                    <p className="font-medium text-gray-800 truncate">{paper.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`status-badge status-${paper.status}`}>
                        {statusLabels[paper.status] || paper.status}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(paper.submitted_at)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {user?.role === 'reviewer' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">最近审稿</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {recentReviews.length === 0 ? (
                <p className="p-6 text-center text-gray-500">暂无审稿任务</p>
              ) : (
                recentReviews.map(review => (
                  <div key={review.id} className="p-4 hover:bg-gray-50">
                    <p className="font-medium text-gray-800 truncate">{review.title}</p>
                    <div className="flex items-center justify-between mt-2">
                      <span className={`status-badge review-${review.status}`}>
                        {statusLabels[review.status] || review.status}
                      </span>
                      <span className="text-xs text-gray-500">{formatDate(review.invitation_date)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {user?.role === 'editor' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-800">状态分布</h3>
            </div>
            <div className="p-4 space-y-3">
              {stats.statusCounts?.map((s: any) => (
                <div key={s.status} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{statusLabels[s.status] || s.status}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${(s.count / stats.totalPapers) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-800 w-8 text-right">{s.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${colorClasses[color]}`}>
          <Icon size={24} />
        </div>
      </div>
    </div>
  );
}
