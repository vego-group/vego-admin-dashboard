import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'info' | 'delete';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /** Optional undo callback — if present, an Undo button is rendered */
  onUndo?: () => void;
  /** Auto-dismiss duration in ms. Default 3000. Set to 0 to disable. */
  duration?: number;
}

interface ToastState {
  toasts: Toast[];
  show: (toast: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  show: (toast) => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const duration = toast.duration ?? 3500;
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    if (duration > 0) {
      setTimeout(() => get().dismiss(id), duration);
    }
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));
