import { useState, useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../utils/api';
import { User, Mail, Building, BookOpen, Save } from 'lucide-react';

export default function Profile() {
  const { user, fetchMe } = useAuthStore();
  const [name, setName] = useState('');
  const [affiliation, setAffiliation] = useState('');
  const [bio, setBio] = useState('');
  const [fields, setFields] = useState<any[]>([]);
  const [selectedFields, setSelectedFields] = useState<number[]>([]);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setAffiliation(user.affiliation || '');
      setBio(user.bio || '');
      if (user.role === 'reviewer' && (user as any).fields) {
        setSelectedFields((user as any).fields.map((f: any) => f.id));
      }
    }
    loadFields();
  }, [user]);

  const loadFields = async () => {
    try {
      const res = await api.get('/fields');
      setFields(res.data.fields);
    } catch (err) {
      console.error('加载领域失败', err);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    setSaved(false);
    try {
      await api.put('/auth/profile', {
        name,
        affiliation,
        bio,
        fields: selectedFields,
      });
      await fetchMe();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      alert(err.response?.data?.error || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const toggleField = (fieldId: number) => {
    if (selectedFields.includes(fieldId)) {
      setSelectedFields(selectedFields.filter(id => id !== fieldId));
    } else {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const roleLabels: Record<string, string> = {
    author: '作者',
    reviewer: '审稿人',
    editor: '编辑',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-semibold text-gray-800">个人设置</h2>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
            <User size={32} className="text-primary-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800">{user?.name}</h3>
            <p className="text-sm text-gray-500">{user?.email}</p>
            <span className={`status-badge mt-1 ${
              user?.role === 'editor' ? 'bg-purple-100 text-purple-700' :
              user?.role === 'reviewer' ? 'bg-blue-100 text-blue-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {roleLabels[user?.role || '']}
            </span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              姓名
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              邮箱
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="email"
                value={user?.email || ''}
                disabled
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              单位/机构
            </label>
            <div className="relative">
              <Building className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                value={affiliation}
                onChange={e => setAffiliation(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="请输入单位名称"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              个人简介
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              rows={4}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              placeholder="简要介绍一下您自己..."
            />
          </div>

          {user?.role === 'reviewer' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                研究领域
              </label>
              <p className="text-xs text-gray-500 mb-3">
                选择您擅长的研究领域，系统将为您推荐相关的审稿邀请
              </p>
              <div className="flex flex-wrap gap-2">
                {fields.map(field => (
                  <label
                    key={field.id}
                    className={`px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                      selectedFields.includes(field.id)
                        ? 'bg-primary-100 text-primary-700 border border-primary-300'
                        : 'bg-gray-100 text-gray-600 border border-transparent hover:bg-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFields.includes(field.id)}
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

        <div className="mt-6 pt-6 border-t border-gray-100 flex items-center justify-between">
          {saved && (
            <span className="text-sm text-green-600">✓ 保存成功</span>
          )}
          {!saved && <div />}
          <button
            onClick={handleSave}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50"
          >
            <Save size={18} />
            {loading ? '保存中...' : '保存修改'}
          </button>
        </div>
      </div>
    </div>
  );
}
