import { useEffect, useState } from 'react';
import api from '../utils/api';
import { formatDate } from '../utils/format';
import { Plus, Search, UserPlus, Edit2 } from 'lucide-react';

export default function UserManagement() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('all');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [fields, setFields] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'author',
    affiliation: '',
    fields: [] as number[],
  });

  useEffect(() => {
    loadUsers();
    loadFields();
  }, [role, page]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users', {
        params: { role, page, limit: 10 },
      });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch (err) {
      console.error('加载用户失败', err);
    } finally {
      setLoading(false);
    }
  };

  const loadFields = async () => {
    try {
      const res = await api.get('/fields');
      setFields(res.data.fields);
    } catch (err) {
      console.error('加载领域失败', err);
    }
  };

  const handleAddUser = () => {
    setEditingUser(null);
    setFormData({
      email: '',
      password: '',
      name: '',
      role: 'author',
      affiliation: '',
      fields: [],
    });
    setShowAddModal(true);
  };

  const handleEditUser = (user: any) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      name: user.name,
      role: user.role,
      affiliation: user.affiliation || '',
      fields: user.fields?.map((f: any) => f.id) || [],
    });
    setShowAddModal(true);
  };

  const handleSubmit = async () => {
    try {
      if (editingUser) {
        await api.put(`/users/${editingUser.id}`, {
          name: formData.name,
          role: formData.role,
          affiliation: formData.affiliation,
          fields: formData.fields,
        });
      } else {
        await api.post('/users', formData);
      }
      setShowAddModal(false);
      loadUsers();
    } catch (err: any) {
      alert(err.response?.data?.error || '操作失败');
    }
  };

  const toggleField = (fieldId: number) => {
    if (formData.fields.includes(fieldId)) {
      setFormData({ ...formData, fields: formData.fields.filter(id => id !== fieldId) });
    } else {
      setFormData({ ...formData, fields: [...formData.fields, fieldId] });
    }
  };

  const roleLabels: Record<string, string> = {
    author: '作者',
    reviewer: '审稿人',
    editor: '编辑',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">用户管理</h2>
        <button
          onClick={handleAddUser}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
        >
          <UserPlus size={18} />
          添加用户
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200 flex items-center gap-4">
          <select
            value={role}
            onChange={e => { setRole(e.target.value); setPage(1); }}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="all">全部角色</option>
            <option value="author">作者</option>
            <option value="reviewer">审稿人</option>
            <option value="editor">编辑</option>
          </select>
          <span className="text-sm text-gray-500">共 {total} 位用户</span>
        </div>

        {loading ? (
          <div className="p-10 text-center text-gray-500">加载中...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">用户</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">角色</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">单位</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">研究领域</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">注册时间</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4">
                      <p className="font-medium text-gray-800">{user.name}</p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`status-badge ${
                        user.role === 'editor' ? 'bg-purple-100 text-purple-700' :
                        user.role === 'reviewer' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {roleLabels[user.role] || user.role}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{user.affiliation || '-'}</td>
                    <td className="py-3 px-4">
                      {user.fields && user.fields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {user.fields.slice(0, 3).map((f: any) => (
                            <span key={f.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {f.name}
                            </span>
                          ))}
                          {user.fields.length > 3 && (
                            <span className="text-xs text-gray-500">+{user.fields.length - 3}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleEditUser(user)}
                        className="text-primary-600 hover:text-primary-700"
                      >
                        <Edit2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">
                {editingUser ? '编辑用户' : '添加用户'}
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">姓名</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              {!editingUser && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">初始密码</label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">角色</label>
                <select
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="author">作者</option>
                  <option value="reviewer">审稿人</option>
                  <option value="editor">编辑</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">单位</label>
                <input
                  type="text"
                  value={formData.affiliation}
                  onChange={e => setFormData({ ...formData, affiliation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {(formData.role === 'reviewer' || editingUser?.role === 'reviewer') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">研究领域</label>
                  <div className="flex flex-wrap gap-2">
                    {fields.map(field => (
                      <label
                        key={field.id}
                        className={`px-3 py-1.5 rounded-full text-sm cursor-pointer ${
                          formData.fields.includes(field.id)
                            ? 'bg-primary-100 text-primary-700 border border-primary-300'
                            : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.fields.includes(field.id)}
                          onChange={() => toggleField(field.id)}
                          className="sr-only"
                        />
                        {field.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg"
              >
                {editingUser ? '保存' : '添加'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
