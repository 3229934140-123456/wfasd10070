export const statusLabels: Record<string, string> = {
  submitted: '已提交',
  needs_revision: '退回补资料',
  not_suitable: '不适合送审',
  pending_assignment: '待分配审稿人',
  under_review: '审稿中',
  revise: '待修改',
  revision_submitted: '修改稿已提交',
  accepted: '已录用',
  rejected: '已拒绝',
};

export const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  needs_revision: 'bg-yellow-100 text-yellow-700',
  not_suitable: 'bg-red-100 text-red-700',
  pending_assignment: 'bg-purple-100 text-purple-700',
  under_review: 'bg-indigo-100 text-indigo-700',
  revise: 'bg-orange-100 text-orange-700',
  revision_submitted: 'bg-cyan-100 text-cyan-700',
  accepted: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-700',
};

export const reviewStatusLabels: Record<string, string> = {
  invited: '已邀请',
  accepted: '已接受',
  declined: '已拒绝',
  completed: '已完成',
};

export const decisionLabels: Record<string, string> = {
  accept: '接受',
  minor_revision: '小修',
  major_revision: '大修',
  reject: '拒绝',
  request_revision: '退回补资料',
  not_suitable: '不适合送审',
  screening_passed: '通过初审',
  reviewers_assigned: '分配审稿人',
};

export const recommendationLabels: Record<string, string> = {
  accept: '接受',
  minor_revision: '小修',
  major_revision: '大修',
  reject: '拒绝',
};

export const formatDate = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (dateStr: string) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const getStatusClass = (status: string) => {
  return `status-${status}`;
};

export const getReviewStatusClass = (status: string) => {
  return `review-${status}`;
};
