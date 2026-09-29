'use client';

import { Button, Icons, Input } from '@frameforge/ui';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Shot } from '@frameforge/types';
import { useProduction, useShots, useUpdateShot } from '@/lib/hooks/useProduction';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { MethodBadge } from '@/components/shot/MethodBadge';
import { StatusBadge } from '@/components/shot/StatusBadge';
import { ShotInspector } from '@/components/shot/ShotInspector';
import { ShotTrashModal } from '@/components/shot/ShotTrashModal';
import { InlineEditCell } from '@/components/shot/InlineEditCell';
import { shotMovementLabel } from '@/lib/shot-display';

export default function ShotListPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [], isLoading } = useShots(id);
  const updateShot = useUpdateShot(id);

  const [search, setSearch] = useState('');
  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const {
    selectedShotIds,
    selectShot,
    inspectedShotId,
    isInspectorOpen,
    openInspector,
    closeInspector
  } = useWorkspaceStore();

  const inspectedShot = shots.find(s => s.id === inspectedShotId) || null;

  if (!production) return null;

  const fps = production.fps_num / (production.fps_den || 1);

  const filteredShots = shots.filter(s => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (s.display_number || '').toLowerCase().includes(q) ||
      (s.name || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.voice_over || '').toLowerCase().includes(q) ||
      (s.owner_id || '').toLowerCase().includes(q)
    );
  });

  const toggleLock = async (shot: Shot, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateShot.mutateAsync({
      id: shot.id,
      revision: shot.revision,
      changes: { timing_locked: !shot.timing_locked }
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      {/* Table Toolbar */}
      <div className="z-10 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card/90 px-3 py-2 sm:flex sm:justify-between sm:px-6 sm:py-2.5">
        <div className="contents sm:flex sm:min-w-0 sm:items-center sm:gap-3">
          <div className="relative col-span-2 flex min-w-0 items-center sm:col-auto">
            <Icons.Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索镜头数据表..."
              className="w-full min-w-0 pl-8 sm:w-64"
            />
          </div>
          <span className="min-w-0 text-xs font-mono text-muted-foreground">
            共 <span className="font-bold text-foreground">{filteredShots.length}</span> 个镜头
          </span>
        </div>

        <div className="flex items-center justify-end gap-2 text-xs font-mono text-muted-foreground">
          <span className="hidden lg:inline">双击镜头打开详情</span>
          <Button variant="ghost" size="sm" onClick={() => setIsTrashOpen(true)} className="h-8 text-xs hover:text-foreground">
            <Icons.Trash2 className="mr-1.5 h-3.5 w-3.5" />
            废纸篓
          </Button>
        </div>
      </div>

      {isTrashOpen && <ShotTrashModal productionId={production.id} onClose={() => setIsTrashOpen(false)} />}

      {/* Table & Inspector Container */}
      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain" role="region" aria-label="镜头制作表" tabIndex={0}>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
              正在加载镜头制作表...
            </div>
          ) : (
            <table className="w-full min-w-[1200px] table-fixed border-collapse text-left font-sans text-xs">
              <thead className="sticky top-0 z-10 bg-card border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th scope="col" className="sticky left-0 z-30 w-20 border-r border-border bg-card px-3 py-2.5">镜号</th>
                  <th scope="col" className="sticky left-20 z-30 w-28 border-r border-border bg-card px-3 py-2.5">制作方式</th>
                  <th className="py-2.5 px-3 w-20">景别</th>
                  <th className="py-2.5 px-3 w-20">焦段</th>
                  <th className="py-2.5 px-3 w-28">机位运镜</th>
                  <th className="py-2.5 px-3 min-w-[200px]">画面内容与构图</th>
                  <th className="py-2.5 px-3 min-w-[200px]">对应旁白</th>
                  <th className="py-2.5 px-3 w-24 text-right">时长/帧数</th>
                  <th className="py-2.5 px-3 w-20">部门</th>
                  <th className="py-2.5 px-3 w-24">负责人</th>
                  <th className="py-2.5 px-3 w-24 text-center">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredShots.map(shot => {
                  const isSelected = selectedShotIds.includes(shot.id) || inspectedShotId === shot.id;
                  const durationSec = ((shot.duration_frames || 0) / fps).toFixed(1);

                  return (
                    <tr
                      key={shot.id}
                      onClick={() => {
                        selectShot(shot.id, false, false, filteredShots.map(s => s.id));
                      }}
                      onDoubleClick={() => {
                        openInspector(shot.id);
                      }}
                      aria-selected={isSelected}
                      className={`group cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-accent hover:bg-accent/80'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <td className={`sticky left-0 z-10 w-20 border-r border-border px-3 py-2 font-mono font-bold text-foreground ${isSelected ? 'bg-accent' : 'bg-card group-hover:bg-accent'}`}>
                        {shot.display_number}
                      </td>
                      <td className={`sticky left-20 z-10 w-28 border-r border-border px-3 py-2 ${isSelected ? 'bg-accent' : 'bg-card group-hover:bg-accent'}`}>
                        <MethodBadge method={shot.primary_method} size="sm" />
                      </td>
                      <td className="py-2 px-3 text-foreground font-mono">
                        {shot.shot_size || '全景'}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground font-mono">
                        {shot.lens_mm ? `${shot.lens_mm}mm` : '—'}
                      </td>
                      <td className="py-2 px-3 text-foreground truncate max-w-[120px]">
                        {shotMovementLabel(shot)}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        <InlineEditCell productionId={production.id} shot={shot} field="description" value={shot.description || ''} placeholder="双击输入画面描述" />
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        <InlineEditCell productionId={production.id} shot={shot} field="voice_over" value={shot.voice_over || ''} placeholder="双击输入旁白" />
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-foreground">{shot.duration_frames}f</span>
                          <span className="text-[10px] text-muted-foreground">({durationSec}s)</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={e => toggleLock(shot, e)}
                            aria-label={shot.timing_locked ? '已锁定' : '未锁定'}
                            title={shot.timing_locked ? '已锁定' : '未锁定'}
                            className={`h-6 w-6 ${shot.timing_locked ? 'text-foreground' : 'text-muted-foreground'}`}
                          >
                            {shot.timing_locked ? <Icons.Lock className="h-3 w-3" /> : <Icons.LockOpen className="h-3 w-3" />}
                          </Button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-muted-foreground font-mono">
                        {shot.department || 'Camera'}
                      </td>
                      <td className="py-2 px-3 text-foreground">
                        {shot.owner_id || '—'}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <StatusBadge status={shot.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Inspector opens on double-click; it overlays the table on narrow screens. */}
        {isInspectorOpen && inspectedShot && (
          <>
            <div className="fixed inset-0 z-40 bg-background/70 md:hidden" onClick={closeInspector} aria-hidden="true" />
            <div className="fixed inset-x-2 top-[58px] bottom-[calc(env(safe-area-inset-bottom)+8px)] z-50 min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-2xl [&>aside]:h-full [&>aside]:w-full md:static md:inset-auto md:z-auto md:w-[380px] md:shrink-0 md:rounded-none md:border-0 md:shadow-none md:[&>aside]:w-[380px]">
              <ShotInspector
                shot={inspectedShot}
                production={production}
                onClose={closeInspector}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
