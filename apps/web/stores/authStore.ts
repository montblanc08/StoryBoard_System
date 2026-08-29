import { create } from 'zustand';
import type { User } from '@frameforge/types';
import type { Locale } from '@frameforge/ui';
import { I18N_DICTIONARY } from '@frameforge/ui';

interface AuthState {
  user: User | null;
  token: string | null;
  locale: Locale;
  theme: 'dark' | 'light';
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  t: (key: keyof typeof I18N_DICTIONARY['zh-CN']) => string;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: typeof window !== 'undefined' ? localStorage.getItem('frameforge_token') : null,
  locale: 'zh-CN',
  theme: 'dark',

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('frameforge_token', token);
    }
    set({ user, token });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('frameforge_token');
    }
    set({ user: null, token: null });
  },

  setLocale: locale => {
    set({ locale });
  },

  setTheme: theme => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('light', theme === 'light');
    }
    set({ theme });
  },

  t: key => {
    const loc = get().locale;
    const dict = I18N_DICTIONARY[loc] || I18N_DICTIONARY['zh-CN'];
    return dict[key] || key;
  }
}));
