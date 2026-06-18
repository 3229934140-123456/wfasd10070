import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import {
  FileText,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Bell,
  User,
  Home,
  BookOpen,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../utils/api';

interface Notification {
  id: number;
  title: string;
  content: string;
  type: string;
  is_read: number;
  created_at: string;
}

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications?limit=10');
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unreadCount);
    } catch (err) {
      console.error('获取通知失败', err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const markAsRead = async (id: number) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
      );
    } catch (err) {
      console.error('标记已读失败', err);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      console.error('全部已读失败', err);
    }
  };

  const isActive = (path: string) => {
    return location.pathname.startsWith(path);
  };

  const menuItems = [
    { path: '/', label: '控制台', icon: Home, roles: ['author', 'reviewer', 'editor'] },
    { path: '/papers', label: '我的稿件', icon: FileText, roles: ['author'] },
    { path: '/papers/submit', label: '投稿', icon: BookOpen, roles: ['author'] },
    { path: '/reviews', label: '我的审稿', icon: ClipboardList, roles: ['reviewer', 'editor'] },
    { path: '/editor/papers', label: '稿件管理', icon: FileText, roles: ['editor'] },
    { path: '/editor/statistics', label: '统计报告', icon: BarChart3, roles: ['editor'] },
    { path: '/editor/users', label: '用户管理', icon: Users, roles: ['editor'] },
    { path: '/profile', label: '个人设置', icon: Settings, roles: ['author', 'reviewer', 'editor'] },
  ];

  const filteredMenu = menuItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-xl font-bold text-primary-700">学术同行评审系统</h1>
          <p className="text-sm text-gray-500 mt-1">Peer Review System</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {filteredMenu.map(item => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.path)
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <LogOut size={20} />
            退出登录
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-800">
              {filteredMenu.find(item => isActive(item.path))?.label || '控制台'}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-800">通知</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-sm text-primary-600 hover:text-primary-700"
                      >
                        全部已读
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-gray-500 text-sm">暂无通知</p>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => {
                            markAsRead(n.id);
                            setShowNotifications(false);
                          }}
                          className={`p-3 border-b border-gray-100 cursor-pointer hover:bg-gray-50 ${
                            n.is_read ? 'bg-white' : 'bg-blue-50'
                          }`}
                        >
                          <p className="text-sm font-medium text-gray-800">{n.title}</p>
                          <p className="text-xs text-gray-500 mt-1">{n.content}</p>
                          <p className="text-xs text-gray-400 mt-1">{n.created_at}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <User size={16} className="text-primary-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{user?.name}</p>
                <p className="text-xs text-gray-500">
                  {user?.role === 'editor' ? '编辑' : user?.role === 'reviewer' ? '审稿人' : '作者'}
                </p>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
