'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Production } from '@frameforge/types';
import { useAuthStore } from '@/stores/authStore';

interface TopBarProps {
  production?: Production | null;
}

export function TopBar({ production }: TopBarProps) {
  const router = useRouter();
  const { user, logout, locale, setLocale, theme, setTheme, t } = useAuthStore();

  return (
    <header className="sticky top-0 z-30 flex h-[50px] items-center justify-between border-b border-studio-700 bg-studio-900/90 px-5 backdrop-blur">
      {/* Left: Brand & Breadcrumb */}
      <div className="flex items-center gap-3">
        <Link href="/productions" className="flex items-center gap-2.5 group">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-dim text-amber border border-amber/30 group-hover:border-amber transition shadow-sm">
            <svg className="g-icon"><use href="#icon-movie" /></svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white group-hover:text-amber transition">
            {t('appName')}
          </span>
        </Link>

        {production && (
          <>
            <span className="text-slate-600">/</span>
            <div className="flex items-center gap-2">
              <span className="rounded bg-studio-800 px-1.5 py-0.5 text-[10px] font-mono text-amber border border-studio-700 uppercase">
                {production.code || 'PROD'}
              </span>
              <span className="text-xs font-bold text-slate-200 truncate max-w-sm">
                {production.name}
              </span>
              <span className="text-[11px] font-mono text-slate-500 hidden sm:inline">
                ({production.fps_num} FPS · {production.aspect_ratio})
              </span>
            </div>
          </>
        )}
      </div>

      {/* Right: Controls, Theme, i18n & User Profile */}
      <div className="flex items-center gap-4 text-xs">
        {/* Sync Status Badge */}
        <div className="hidden md:flex items-center gap-1.5 rounded-full bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 text-[11px] font-mono text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>已实时同步 (Shot = Truth)</span>
        </div>

        {/* Locale Toggle */}
        <button
          onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
          className="rounded border border-studio-700 bg-studio-950 px-2 py-1 font-mono text-slate-300 hover:border-amber hover:text-amber transition"
          title="切换中英文语言"
        >
          {locale === 'zh-CN' ? 'EN' : '中文'}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1 text-slate-300 hover:border-amber hover:text-amber transition"
          title="切换暗黑/明亮主题"
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>

        {/* User Menu */}
        <div className="flex items-center gap-3 border-l border-studio-700 pl-4">
          <div className="flex items-center gap-1.5">
            <svg className="g-icon h-4 w-4 text-slate-400"><use href="#icon-account_circle" /></svg>
            <span className="text-slate-200 font-medium">{user?.display_name || user?.email || '制作管理员'}</span>
          </div>

          <button
            onClick={() => {
              logout();
              router.push('/login');
            }}
            className="text-studio-600 hover:text-film-red transition"
          >
            退出
          </button>
        </div>
      </div>
    </header>
  );
}
