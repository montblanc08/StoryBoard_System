'use client';

import { Button, Card, Icons } from '@frameforge/ui';

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
          <h2 className="text-base font-bold text-foreground">素材资产库 (Media Asset Hub)</h2>
          <p className="text-xs text-muted-foreground">
            集中管理分镜图版、实拍参考、购买素材、视效资产与代理文件
          </p>
        </div>

        <Button size="sm">
          <Icons.Plus className="h-4 w-4" />
          上传新资产
        </Button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 mb-6 text-xs">
        {[
          { key: 'all', label: '全部资产' },
          { key: 'storyboard', label: '分镜画面 (80)' },
          { key: 'stock', label: '待购/已购素材' },
          { key: 'reference', label: '参考图/气氛图' },
          { key: 'proxy', label: '审片代理视频' }
        ].map(tab => (
          <Button
            variant="ghost"
            size="sm"
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`${
              activeTab === tab.key
                ? 'bg-accent text-accent-foreground'
                : 'text-muted-foreground'
            }`}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {shots.slice(0, 24).map((shot, idx) => (
          <Card
            key={shot.id}
            className="group overflow-hidden hover:border-ring transition cursor-pointer"
          >
            <div className="aspect-video bg-gradient-to-br from-muted to-background flex items-center justify-center p-4 text-center">
              <span className="font-mono text-xl font-bold text-foreground">
                {shot.display_number}
              </span>
            </div>
            <div className="p-3 text-xs space-y-1">
              <div className="font-bold text-foreground truncate">
                {shot.name || `镜头 ${shot.display_number} 画面`}
              </div>
              <div className="text-[10px] font-mono text-muted-foreground flex justify-between">
                <span>1920×1080</span>
                <span>JPG · 250KB</span>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
