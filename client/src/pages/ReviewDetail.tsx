import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatDate, recommendationLabels } from '../utils/format';
import { ArrowLeft, Download, Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react';

export default function ReviewDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recommendation, setRecommendation] = useState('');
  const [commentsToAuthor, setCommentsToAuthor] = useState('');
  const [commentsToEditor, setCommentsToEditor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadReview();
  }, [id]);

  const loadReview = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/reviews/${id}`);
      setReview(res.data.review);
      if (res.data.review.recommendation) {
        setRecommendation(res.data.review.recommendation);
        setCommentsToAuthor(res.data.review.comments_to_author || '');
        setCommentsToEditor(res.data.review.comments_to_editor || '');
      }
    } catch (err) {
      console.error('加载审稿失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    try {
      await api.post(`/reviews/${id}/accept`);
      loadReview();
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleDecline = async () => {
    const reason = prompt('请说明拒绝原因（可选）');
    try {
      await api.post(`/reviews/${id}/decline`, { reason });
      navigate('/reviews');
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const handleSubmit = async () => {
    if (!recommendation) {
      alert('请选择审稿建议');
      return;
    }
    if (!commentsToAuthor.trim()) {
      alert('请填写给作者的意见');
      return;
    }

    setSubmitting(true);
    try {
      await api.post(`/reviews/${id}/submit`, {
        recommendation,
        comments_to_author: commentsToAuthor,
        comments_to_editor: commentsToEditor,
      });
      loadReview();
      alert('审稿意见提交成功');
    } catch (err: any) {
      alert(err.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = () => {
    window.open(`/api/papers/${review.paper_id}/download`, '_blank');
  };

  const isOverdue = review?.due_date && new Date(review.due_date) < new Date();

  if (loading) {
    return <div className="text-center py-10">加载中...</div>;
  }

  if (!review) {
    return <div className="text-center py-10 text-gray-500">审稿不存在</div>;
  }

  const canEdit = review.status === 'accepted' || review.status === 'revision_submitted';
  const isCompleted = review.status === 'completed';
  const isInvited = review.status === 'invited';

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
          <h2 className="text-xl font-semibold text-gray-800">审稿详情</h2>
        </div>
        <span className={`status-badge review-${review.status}`}>
          {review.status === 'invited' ? '待接受' : 
           review.status === 'accepted' ? '审稿中' :
           review.status === 'completed' ? '已完成' :
           review.status === 'declined' ? '已拒绝' : review.status}
        </span>
      </div>

      {isInvited && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
          <h3 className="font-semibold text-yellow-800 mb-2">审稿邀请</h3>
          <p className="text-yellow-700 mb-4">
            您被邀请为这篇论文进行审稿，请确认是否接受。
            {review.due_date && (
              <span> 若接受，请在 {formatDate(review.due_date)} 前完成审稿。</span>
            )}
          </p>
          <div className="flex gap-3">
            <button
              onClick={handleAccept}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg"
            >
              <CheckCircle size={18} />
              接受邀请
            </button>
            <button
              onClick={handleDecline}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
            >
              <XCircle size={18} />
              拒绝邀请
            </button>
          </div>
        </div>
      )}

      {isOverdue && canEdit && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <Clock className="text-red-500" size={24} />
          <div>
            <p className="font-medium text-red-700">审稿已超期</p>
            <p className="text-sm text-red-600">原定于 {formatDate(review.due_date)} 截止，请尽快完成审稿</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <h1 className="text-xl font-bold text-gray-800">{review.title}</h1>
          <button
            onClick={handleDownload}
            className="flex items-center gap-2 text-primary-600 hover:text-primary-700"
          >
            <Download size={18} />
            下载论文
          </button>
        </div>

        <div className="flex items-center gap-6 text-sm text-gray-500 mb-6">
          <span>投稿时间：{formatDate(review.submitted_at)}</span>
          <span>版本：v{review.current_version}</span>
          {review.due_date && <span>截止日期：{formatDate(review.due_date)}</span>}
        </div>

        <div className="mb-6">
          <h3 className="font-semibold text-gray-800 mb-2">摘要</h3>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{review.abstract}</p>
        </div>

        <div className="p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-700">
            <strong>双盲审稿：</strong>为保证评审的公平性，作者信息已被隐藏。请您在审稿过程中不要尝试识别作者身份。
          </p>
        </div>
      </div>

      {(canEdit || isCompleted) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">审稿意见</h3>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              审稿建议 <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { value: 'accept', label: '接受', color: 'green' },
                { value: 'minor_revision', label: '小修', color: 'blue' },
                { value: 'major_revision', label: '大修', color: 'yellow' },
                { value: 'reject', label: '拒绝', color: 'red' },
              ].map(opt => (
                <label
                  key={opt.value}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all text-center ${
                    recommendation === opt.value
                      ? opt.color === 'green' ? 'border-green-500 bg-green-50' :
                        opt.color === 'blue' ? 'border-blue-500 bg-blue-50' :
                        opt.color === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
                        'border-red-500 bg-red-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${!canEdit ? 'cursor-not-allowed opacity-60' : ''}`}
                >
                  <input
                    type="radio"
                    name="recommendation"
                    value={opt.value}
                    checked={recommendation === opt.value}
                    onChange={e => canEdit && setRecommendation(e.target.value)}
                    disabled={!canEdit}
                    className="sr-only"
                  />
                  <span className={`font-medium ${
                    recommendation === opt.value
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

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              给作者的意见 <span className="text-red-500">*</span>
            </label>
            <textarea
              value={commentsToAuthor}
              onChange={e => setCommentsToAuthor(e.target.value)}
              rows={8}
              disabled={!canEdit}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="请详细描述您的审稿意见，包括论文的优点、不足和修改建议..."
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              给编辑的意见（仅编辑可见）
            </label>
            <textarea
              value={commentsToEditor}
              onChange={e => setCommentsToEditor(e.target.value)}
              rows={4}
              disabled={!canEdit}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none disabled:bg-gray-50 disabled:text-gray-500"
              placeholder="您可以在此填写仅供编辑参考的意见..."
            />
          </div>

          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                <MessageSquare size={18} />
                {submitting ? '提交中...' : '提交审稿意见'}
              </button>
            </div>
          )}

          {isCompleted && (
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-green-700 font-medium">
                ✓ 审稿意见已提交
              </p>
              <p className="text-sm text-green-600 mt-1">
                提交时间：{formatDate(review.completed_date)}
              </p>
            </div>
          )}
        </div>
      )}

      {review.responses && review.responses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">作者回复</h3>
          
          <div className="space-y-4">
            {review.responses.map((resp: any, idx: number) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    第 v{resp.paper_version} 版回复
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(resp.submitted_at)}
                  </span>
                </div>
                {resp.response_text && (
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">总体回复：</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{resp.response_text}</p>
                  </div>
                )}
                {resp.point_by_point && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">逐条回复：</p>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">{resp.point_by_point}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
