import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../utils/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  affiliation?: string;
  bio?: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  fetchMe: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  name: string;
  role: string;
  affiliation?: string;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      login: async (email, password) => {
        const response = await api.post('/auth/login', { email, password });
        const { token, user } = response.data;
        set({ token, user, isAuthenticated: true });
      },

      register: async (data) => {
        const response = await api.post('/auth/register', data);
        const { token, user } = response.data;
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
      },

      fetchMe: async () => {
        try {
          const response = await api.get('/auth/me');
          set({ user: response.data.user });
        } catch (error) {
          set({ token: null, user: null, isAuthenticated: false });
        }
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
