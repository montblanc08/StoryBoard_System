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
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Table Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-card/90 px-6 py-2.5 z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <Icons.Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索镜头数据表..."
              className="w-64 pl-8"
            />
          </div>
          <span className="text-xs font-mono text-muted-foreground">
            共 <span className="font-bold text-foreground">{filteredShots.length}</span> 个镜头
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
          <span>单击行即可在右侧展开检查器</span>
          <Button variant="ghost" size="sm" onClick={() => setIsTrashOpen(true)} className="ml-4 h-7 text-xs hover:text-foreground">
            <Icons.Trash2 className="mr-1.5 h-3.5 w-3.5" />
            废纸篓
          </Button>
        </div>
      </div>

      {isTrashOpen && <ShotTrashModal productionId={production.id} onClose={() => setIsTrashOpen(false)} />}

      {/* Table & Inspector Container */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
              正在加载镜头制作表...
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-card border-b border-border text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2.5 px-3 w-16">镜号</th>
                  <th className="py-2.5 px-3 w-28">制作方式</th>
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
                      className={`cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-accent hover:bg-accent/80'
                          : 'hover:bg-accent'
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-foreground">
                        {shot.display_number}
                      </td>
                      <td className="py-2 px-3">
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

        {/* Inspector on click */}
        {isInspectorOpen && inspectedShot && (
          <ShotInspector
            shot={inspectedShot}
            production={production}
            onClose={closeInspector}
          />
        )}
      </div>
    </div>
  );
}
