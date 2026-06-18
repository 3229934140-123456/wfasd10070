export const statusLabels: Record<string, string> = {
  submitted: '已提交',
  under_review: '审稿中',
  revise: '待修改',
  revision_submitted: '修改稿已提交',
  accepted: '已录用',
  rejected: '已拒绝',
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
