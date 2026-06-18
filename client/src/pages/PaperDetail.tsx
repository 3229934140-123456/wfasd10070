import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { formatDate, formatDateTime, statusLabels, statusColors, decisionLabels, recommendationLabels } from '../utils/format';
import { ArrowLeft, Download, Edit, FileText, MessageSquare, Clock, CheckCircle, History, User } from 'lucide-react';

export default function PaperDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [responseText, setResponseText] = useState('');
  const [pointByPoint, setPointByPoint] = useState('');

  useEffect(() => {
    loadPaper();
  }, [id]);

  const loadPaper = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/papers/${id}`);
      setPaper(res.data.paper);
    } catch (err) {
      console.error('加载稿件失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (version?: number) => {
    const url = version
      ? `/api/papers/${id}/download?version=${version}`
      : `/api/papers/${id}/download`;
    window.open(url, '_blank');
  };

  const handleSubmitResponse = async () => {
    if (!selectedReview) return;
    
    try {
      await api.post(`/reviews/${selectedReview.id}/response`, {
        response_text: responseText,
        point_by_point: pointByPoint,
      });
      setShowResponseModal(false);
      setResponseText('');
      setPointByPoint('');
      loadPaper();
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失败');
    }
  };

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (!paper) {
    return <div className="text-center py-10 text-gray-500">稿件不存在</div>;
  }

  const isAuthor = user?.role === 'author';
  const canRevise = isAuthor && (paper.status === 'revise' || paper.status === 'needs_revision');

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
        {canRevise && (
          <button
            onClick={() => navigate(`/papers/${id}/edit`)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
          >
            <Edit size={18} />
            提交修改稿
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">{paper.title}</h1>
          <span className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap ${statusColors[paper.status] || 'bg-gray-100 text-gray-700'}`}>
            {statusLabels[paper.status] || paper.status}
          </span>
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
          <span>投稿时间：{formatDate(paper.submitted_at)}</span>
          <span>当前版本：v{paper.current_version}</span>
          {paper.decision && (
            <span>最终决定：{decisionLabels[paper.decision] || paper.decision}</span>
          )}
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
          <h3 className="font-semibold text-gray-800 mb-3">作者</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {paper.authors?.map((author: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center text-primary-700 font-medium">
                  {author.name?.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {author.name}
                    {author.is_corresponding && (
                      <span className="ml-2 text-xs text-primary-600">(通讯作者)</span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">{author.affiliation}</p>
                  {author.email && (
                    <p className="text-xs text-gray-400">{author.email}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800">论文文件</h3>
          <button
            onClick={() => handleDownload()}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <Download size={18} />
            下载最新版本
          </button>
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
                  <p className="font-medium text-gray-800">v{v.version_number} - {v.version_notes}</p>
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

      {paper.reviews && paper.reviews.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">审稿意见</h3>
          
          <div className="space-y-4">
            {paper.reviews.map((review: any) => (
              <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <MessageSquare size={16} className="text-gray-500" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-800">
                        审稿人（双盲）
                      </p>
                      <p className="text-xs text-gray-500">
                        {review.status === 'completed' ? formatDate(review.completed_date) : formatDate(review.invitation_date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`status-badge review-${review.status}`}>
                      {review.status === 'completed' ? '已完成' : review.status === 'accepted' ? '审稿中' : '已邀请'}
                    </span>
                    {review.recommendation && (
                      <span className={`status-badge ${
                        review.recommendation === 'accept' ? 'bg-green-100 text-green-800' :
                        review.recommendation === 'reject' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {recommendationLabels[review.recommendation]}
                      </span>
                    )}
                  </div>
                </div>

                {review.status === 'completed' && review.comments_to_author && (
                  <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">给作者的意见</h4>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{review.comments_to_author}</p>
                  </div>
                )}

                {review.status === 'completed' && isAuthor && paper.status === 'revise' && (
                  <button
                    onClick={() => {
                      setSelectedReview(review);
                      setShowResponseModal(true);
                    }}
                    className="mt-3 text-sm text-primary-600 hover:text-primary-700"
                  >
                    回复审稿意见
                  </button>
                )}

                {review.responses && review.responses.length > 0 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-700 mb-2">作者回复</h4>
                    {review.responses.map((resp: any, idx: number) => (
                      <div key={idx} className="text-sm text-blue-600">
                        <p className="text-xs text-blue-500 mb-1">v{resp.paper_version} - {formatDate(resp.submitted_at)}</p>
                        <p className="whitespace-pre-wrap">{resp.response_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {paper.decisions && paper.decisions.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">编辑决定</h3>
          
          <div className="space-y-3">
            {paper.decisions.map((decision: any) => (
              <div key={decision.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle size={18} className="text-primary-500" />
                    <span className="font-medium text-gray-800">
                      {decisionLabels[decision.decision] || decision.decision}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {formatDate(decision.decision_date)}
                  </span>
                </div>
                {decision.comments && (
                  <p className="text-sm text-gray-600 mt-2">{decision.comments}</p>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  版本 v{decision.paper_version} · {decision.editor_name}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {showResponseModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">回复审稿意见</h3>
            </div>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              {selectedReview?.comments_to_author && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-700 mb-1">审稿意见：</p>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{selectedReview.comments_to_author}</p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  总体回复
                </label>
                <textarea
                  value={responseText}
                  onChange={e => setResponseText(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="请输入对审稿意见的总体回复"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  逐条回复
                </label>
                <textarea
                  value={pointByPoint}
                  onChange={e => setPointByPoint(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                  placeholder="请逐条回复审稿人的意见"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowResponseModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmitResponse}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
              >
                提交回复
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
