import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  pendingPhone: string | null;
  sendOtp: (phone: string) => Promise<boolean>;
  verifyOtp: (otp: string) => Promise<boolean>;
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
      pendingPhone: null,
      sendOtp: async (phone) => {
        set({ isLoading: true, error: null });
        await new Promise((resolve) => setTimeout(resolve, 600));
        if (phone && phone.length >= 9) {
          set({ pendingPhone: phone, isLoading: false });
          return true;
        }
        set({ error: 'Please enter a valid phone number', isLoading: false });
        return false;
      },
      verifyOtp: async (otp) => {
        set({ isLoading: true, error: null });
        await new Promise((resolve) => setTimeout(resolve, 800));
        if (otp.length === 6) {
          set({ user: MOCK_USER, isAuthenticated: true, isLoading: false, pendingPhone: null });
          return true;
        }
        set({ error: 'Invalid OTP code. Please try again.', isLoading: false });
        return false;
      },
      signOut: () => set({ user: null, isAuthenticated: false, error: null, pendingPhone: null }),
    }),
    {
      name: 'myvego.auth',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
