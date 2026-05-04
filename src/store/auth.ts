import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => void;
}

const MOCK_USER: User = {
  id: 'usr_001',
  name: 'John Doe',
  email: 'admin@myvego.com',
  role: 'admin',
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      signIn: async (email, password) => {
        set({ isLoading: true, error: null });
        // Simulate network latency
        await new Promise((resolve) => setTimeout(resolve, 600));
        // Demo credentials — any non-empty values pass
        if (email && password.length >= 4) {
          set({ user: MOCK_USER, isAuthenticated: true, isLoading: false });
          return true;
        }
        set({ error: 'Invalid email or password', isLoading: false });
        return false;
      },
      signOut: () => set({ user: null, isAuthenticated: false, error: null }),
    }),
    {
      name: 'myvego.auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
