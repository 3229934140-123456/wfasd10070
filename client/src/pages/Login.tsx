import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Loader2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || '登录失败，请检查邮箱和密码');
    } finally {
      setLoading(false);
    }
  };

  const quickLogin = (role: string) => {
    if (role === 'editor') {
      setEmail('admin@journal.com');
      setPassword('admin123');
    } else if (role === 'reviewer') {
      setEmail('reviewer1@journal.com');
      setPassword('reviewer123');
    } else {
      setEmail('author1@journal.com');
      setPassword('author123');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-blue-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800">学术同行评审系统</h1>
            <p className="text-gray-500 mt-2">Peer Review Management System</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                邮箱
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入邮箱"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="请输入密码"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              登录
            </button>
          </form>

          <div className="mt-6">
            <p className="text-center text-sm text-gray-600">
              还没有账号？{' '}
              <Link to="/register" className="text-primary-600 hover:text-primary-700 font-medium">
                立即注册
              </Link>
            </p>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3 text-center">快速登录（测试账号）</p>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => quickLogin('author')}
                className="py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                作者
              </button>
              <button
                onClick={() => quickLogin('reviewer')}
                className="py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                审稿人
              </button>
              <button
                onClick={() => quickLogin('editor')}
                className="py-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg"
              >
                编辑
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
