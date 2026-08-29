'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, locale, setLocale, theme, setTheme, t } = useAuthStore();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('admin@company.internal');
  const [password, setPassword] = useState('FrameForge2026!Admin');
  const [displayName, setDisplayName] = useState('');
  const [roleName, setRoleName] = useState('producer');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (mode === 'login') {
        const res = await apiClient<{ access_token: string; user: any }>('/api/v1/auth/login', {
          method: 'POST',
          json: { email, password }
        });
        setAuth(res.user, res.access_token);
        router.push('/productions');
      } else {
        const res = await apiClient<{ access_token: string; user: any }>('/api/v1/auth/register', {
          method: 'POST',
          json: { email, password, display_name: displayName, role_name: roleName }
        });
        setAuth(res.user, res.access_token);
        router.push('/productions');
      }
    } catch (err: any) {
      setError(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-studio-950 p-6">
      {/* Top right utility controls */}
      <div className="absolute top-6 right-6 flex items-center gap-3 text-xs font-mono text-studio-600">
        <button
          onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
          className="rounded border border-studio-700 bg-studio-900 px-2.5 py-1 text-slate-300 hover:border-amber hover:text-amber"
        >
          {locale === 'zh-CN' ? 'EN / English' : '中 / 简体中文'}
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded border border-studio-700 bg-studio-900 px-2.5 py-1 text-slate-300 hover:border-amber hover:text-amber"
        >
          {theme === 'dark' ? '☀ Light' : '☾ Dark'}
        </button>
        <span className="flex items-center gap-1.5 text-film-green">
          <span className="h-2 w-2 rounded-full bg-film-green animate-pulse" />
          ● Internal Node
        </span>
      </div>

      <div className="w-full max-w-md rounded-lg border border-studio-700 bg-studio-900 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-dim border border-amber/30 text-amber">
            <svg className="g-icon"><use href="#icon-movie" /></svg>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white">{t('appName')}</h1>
            <p className="text-xs text-studio-600">{t('appSub')}</p>
          </div>
        </div>

        {/* Mode switcher tabs */}
        <div className="mb-6 grid grid-cols-2 rounded border border-studio-700 bg-studio-950 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`rounded py-1.5 font-medium transition ${
              mode === 'login' ? 'bg-studio-800 text-amber shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('loginBtn')}
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`rounded py-1.5 font-medium transition ${
              mode === 'register' ? 'bg-studio-800 text-amber shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t('registerBtn')}
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded border border-film-red/40 bg-film-red/10 p-3 text-xs text-film-red">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1">{t('email')}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
              placeholder="user@company.internal"
            />
          </div>

          {mode === 'register' && (
            <>
              <div>
                <label className="block text-slate-400 mb-1">姓名 / 制作代号</label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
                  placeholder="例如：王摄影 / 李剪辑"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">管线职责角色</label>
                <select
                  value={roleName}
                  onChange={e => setRoleName(e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
                >
                  <option value="producer">Producer 制片管理</option>
                  <option value="director">Director 导演/分镜</option>
                  <option value="camera">Camera 摄影/实拍</option>
                  <option value="art">Art 美术/道具</option>
                  <option value="motion">Motion 包装/动态</option>
                  <option value="vfx">VFX 视效/合成</option>
                  <option value="editor">Editor 剪辑/DIT</option>
                  <option value="reviewer">Reviewer 审片审批</option>
                </select>
              </div>
            </>
          )}

          <div>
            <label className="block text-slate-400 mb-1">{t('password')}</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-4 flex items-center justify-center gap-2 rounded bg-amber py-2.5 font-bold text-studio-950 transition hover:bg-amber-hover disabled:opacity-50"
          >
            {loading ? '处理中...' : mode === 'login' ? t('loginBtn') : t('registerBtn')}
          </button>
        </form>

        <div className="mt-6 border-t border-studio-800 pt-4 text-center text-[11px] text-studio-600 font-mono">
          Single Source of Truth · Shot = Entity · Zero Public Residency
        </div>
      </div>
    </div>
  );
}
