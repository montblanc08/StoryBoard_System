'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProduction } from '@/lib/hooks/useProduction';
import { TopBar } from '@/components/app-shell/TopBar';
import { NavRail } from '@/components/app-shell/NavRail';

export default function ProductionLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production, isLoading, error } = useProduction(id);

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen flex-col bg-studio-950">
        <TopBar />
        <div className="flex flex-1 items-center justify-center text-slate-500 font-mono text-xs">
          <div className="flex items-center gap-3">
            <svg className="g-icon animate-spin h-5 w-5 text-amber"><use href="#icon-movie" /></svg>
            <span>正在载入影视管线数据...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !production) {
    return (
      <div className="flex h-screen w-screen flex-col bg-studio-950">
        <TopBar />
        <div className="flex flex-1 flex-col items-center justify-center text-center p-8">
          <svg className="g-icon h-12 w-12 text-rose-500 mb-3"><use href="#icon-warning" /></svg>
          <h2 className="text-base font-bold text-white mb-2">未找到该影视制作项目</h2>
          <p className="text-xs text-slate-400 mb-6 max-w-sm">
            该项目可能已被归档或删除，或者当前账号未获得访问权限。
          </p>
          <button
            onClick={() => router.push('/productions')}
            className="rounded bg-amber px-4 py-2 text-xs font-bold text-studio-950 hover:bg-amber-hover transition"
          >
            返回项目列表
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-studio-950 overflow-hidden select-none">
      {/* Top Header */}
      <TopBar production={production} />

      {/* Main Workspace Frame */}
      <div className="flex flex-1 overflow-hidden">
        {/* Navigation Sidebar */}
        <NavRail productionId={production.id} />

        {/* Dynamic Route Content */}
        <main className="flex-1 overflow-y-auto bg-studio-950 relative">
          {children}
        </main>
      </div>
    </div>
  );
}
