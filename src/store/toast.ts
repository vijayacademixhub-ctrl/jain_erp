import { create } from 'zustand';

export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  action?: { label: string; onClick: () => void };
  duration: number;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'duration'> & { duration?: number }) => number;
  dismiss: (id: number) => void;
}

let next = 1;

export const useToasts = create<ToastState>()((set, get) => ({
  toasts: [],
  push(t) {
    const id = next++;
    const toast: Toast = { duration: t.tone === 'error' ? 6000 : 4200, ...t, id };
    set({ toasts: [...get().toasts.slice(-3), toast] });
    window.setTimeout(() => get().dismiss(id), toast.duration);
    return id;
  },
  dismiss(id) {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

export const toast = {
  success: (title: string, description?: string, action?: Toast['action']) => useToasts.getState().push({ title, description, tone: 'success', action }),
  info: (title: string, description?: string, action?: Toast['action']) => useToasts.getState().push({ title, description, tone: 'info', action }),
  warning: (title: string, description?: string, action?: Toast['action']) => useToasts.getState().push({ title, description, tone: 'warning', action }),
  error: (title: string, description?: string, action?: Toast['action']) => useToasts.getState().push({ title, description, tone: 'error', action }),
};
