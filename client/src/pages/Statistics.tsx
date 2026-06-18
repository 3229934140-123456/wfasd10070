import { useEffect, useState } from 'react';
import api from '../utils/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell, ResponsiveContainer
} from 'recharts';
import { Download, FileText, Users, Clock, TrendingUp } from 'lucide-react';

export default function Statistics() {
  const [overview, setOverview] = useState<any>(null);
  const [monthlyPapers, setMonthlyPapers] = useState<any[]>([]);
  const [monthlyDecisions, setMonthlyDecisions] = useState<any[]>([]);
  const [reviewerWorkload, setReviewerWorkload] = useState<any[]>([]);
  const [fieldsDistribution, setFieldsDistribution] = useState<any[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAllData();
  }, [year]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [overviewRes, papersRes, decisionsRes, workloadRes, fieldsRes] = await Promise.all([
        api.get('/statistics/overview'),
        api.get('/statistics/papers-by-month', { params: { year } }),
        api.get('/statistics/decisions-by-month', { params: { year } }),
        api.get('/statistics/reviewer-workload'),
        api.get('/statistics/fields-distribution'),
      ]);

      setOverview(overviewRes.data);
      setMonthlyPapers(papersRes.data.monthlyData);
      setMonthlyDecisions(decisionsRes.data.monthlyData);
      setReviewerWorkload(workloadRes.data.reviewers);
      setFieldsDistribution(fieldsRes.data.fields);
    } catch (err) {
      console.error('加载统计数据失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (type: string) => {
    window.open(`/api/statistics/export/csv?type=${type}`, '_blank');
  };

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">统计报告</h2>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <button
            onClick={() => handleExport('papers')}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm"
          >
            <Download size={16} />
            导出稿件
          </button>
          <button
            onClick={() => handleExport('reviews')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm"
          >
            <Download size={16} />
            导出审稿
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="总投稿数" value={overview?.totalPapers || 0} icon={FileText} color="blue" />
        <StatCard title="总审稿数" value={overview?.totalReviews || 0} icon={Users} color="purple" />
        <StatCard title="录用率" value={`${overview?.acceptanceRate || 0}%`} icon={TrendingUp} color="green" />
        <StatCard title="平均审稿周期" value={`${overview?.avgReviewTime || 0} 天`} icon={Clock} color="yellow" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">月度投稿量</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyPapers.map((m, i) => ({ ...m, month: monthLabels[i - 1] || `${i}月` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="count" name="投稿数" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">月度决定分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyDecisions.map((m, i) => ({ ...m, month: monthLabels[i - 1] || `${i}月` }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="accept" name="接受" fill="#10b981" stackId="a" />
              <Bar dataKey="minor_revision" name="小修" fill="#3b82f6" stackId="a" />
              <Bar dataKey="major_revision" name="大修" fill="#f59e0b" stackId="a" />
              <Bar dataKey="reject" name="拒绝" fill="#ef4444" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">审稿人工作量</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600 font-medium">审稿人</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">总数</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">已完成</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">进行中</th>
                  <th className="text-center py-2 px-3 text-gray-600 font-medium">平均周期</th>
                </tr>
              </thead>
              <tbody>
                {reviewerWorkload.slice(0, 10).map(r => (
                  <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <p className="font-medium text-gray-800">{r.name}</p>
                      <p className="text-xs text-gray-500">{r.affiliation}</p>
                    </td>
                    <td className="text-center py-2 px-3">{r.total_reviews}</td>
                    <td className="text-center py-2 px-3 text-green-600">{r.completed_reviews}</td>
                    <td className="text-center py-2 px-3 text-blue-600">{r.active_reviews}</td>
                    <td className="text-center py-2 px-3">{r.avg_review_days} 天</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">研究领域分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={fieldsDistribution.filter(f => f.paper_count > 0)}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="paper_count"
                nameKey="name"
              >
                {fieldsDistribution.filter(f => f.paper_count > 0).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {overview?.decisions && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">决定汇总</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <DecisionCard label="接受" value={overview.decisions.find((d: any) => d.decision === 'accept')?.count || 0} color="green" />
            <DecisionCard label="小修" value={overview.decisions.find((d: any) => d.decision === 'minor_revision')?.count || 0} color="blue" />
            <DecisionCard label="大修" value={overview.decisions.find((d: any) => d.decision === 'major_revision')?.count || 0} color="yellow" />
            <DecisionCard label="拒绝" value={overview.decisions.find((d: any) => d.decision === 'reject')?.count || 0} color="red" />
          </div>
        </div>
      )}
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

function DecisionCard({ label, value, color }: any) {
  const colorClasses: Record<string, string> = {
    green: 'bg-green-50 text-green-700 border-green-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    red: 'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className={`p-4 rounded-lg border ${colorClasses[color]}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
