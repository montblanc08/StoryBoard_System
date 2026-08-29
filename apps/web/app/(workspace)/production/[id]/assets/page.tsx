'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProduction, useShots } from '@/lib/hooks/useProduction';

export default function AssetsPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [] } = useShots(id);

  const [activeTab, setActiveTab] = useState<'all' | 'storyboard' | 'stock' | 'reference' | 'proxy'>('all');
  const [search, setSearch] = useState('');

  if (!production) return null;

  return (
    <div className="flex h-full w-full flex-col p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-bold text-white">素材资产库 (Media Asset Hub)</h2>
          <p className="text-xs text-slate-400">
            集中管理分镜图版、实拍参考、购买素材、视效资产与代理文件
          </p>
        </div>

        <button className="flex items-center gap-2 rounded bg-amber px-4 py-2 text-xs font-bold text-studio-950 hover:bg-amber-hover transition">
          <svg className="g-icon h-4 w-4"><use href="#icon-add" /></svg>
          上传新资产
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-studio-700 pb-3 mb-6 text-xs">
        {[
          { key: 'all', label: '全部资产' },
          { key: 'storyboard', label: '分镜画面 (80)' },
          { key: 'stock', label: '待购/已购素材' },
          { key: 'reference', label: '参考图/气氛图' },
          { key: 'proxy', label: '审片代理视频' }
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              activeTab === tab.key
                ? 'bg-studio-800 text-amber font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {shots.slice(0, 24).map((shot, idx) => (
          <div
            key={shot.id}
            className="group rounded-lg border border-studio-700 bg-studio-900 overflow-hidden hover:border-amber transition cursor-pointer"
          >
            <div className="aspect-video bg-gradient-to-br from-studio-800 to-studio-950 flex items-center justify-center p-4 text-center">
              <span className="font-mono text-xl font-bold text-amber">
                {shot.display_number}
              </span>
            </div>
            <div className="p-3 text-xs space-y-1">
              <div className="font-bold text-slate-200 truncate">
                {shot.name || `镜头 ${shot.display_number} 画面`}
              </div>
              <div className="text-[10px] font-mono text-slate-500 flex justify-between">
                <span>1920×1080</span>
                <span>JPG · 250KB</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
