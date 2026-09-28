'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import type { Shot } from '@frameforge/types';
import { framesToTimecode, framesToSeconds } from '@frameforge/timecode';
import { useProduction, useShots, useUpdateShot } from '@/lib/hooks/useProduction';
import { MethodBadge } from '@/components/shot/MethodBadge';
import { StatusBadge } from '@/components/shot/StatusBadge';
import { ShotInspector } from '@/components/shot/ShotInspector';
import { shotMovementLabel } from '@/lib/shot-display';

export default function ShotListPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [], isLoading } = useShots(id);
  const updateShot = useUpdateShot(id);

  const [search, setSearch] = useState('');
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);

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
      <div className="flex items-center justify-between border-b border-studio-700 bg-studio-900/90 px-6 py-2.5 z-10">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center">
            <svg className="g-icon absolute left-2.5 h-3.5 w-3.5 text-slate-400"><use href="#icon-search" /></svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索镜头数据表..."
              className="w-64 rounded border border-studio-700 bg-studio-950 pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-amber"
            />
          </div>
          <span className="text-xs font-mono text-slate-400">
            共 <span className="font-bold text-white">{filteredShots.length}</span> 个镜头
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
          <span>单击行即可在右侧展开检查器</span>
        </div>
      </div>

      {/* Table & Inspector Container */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-slate-500">
              正在加载镜头制作表...
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse font-sans">
              <thead className="sticky top-0 z-10 bg-studio-900 border-b border-studio-700 text-[11px] font-mono uppercase tracking-wider text-slate-400">
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
              <tbody className="divide-y divide-studio-800">
                {filteredShots.map(shot => {
                  const isSelected = selectedShot?.id === shot.id;
                  const durationSec = framesToSeconds(shot.duration_frames, fps).toFixed(1);
                  const timecode = framesToTimecode(shot.duration_frames, fps, production.drop_frame);

                  return (
                    <tr
                      key={shot.id}
                      onClick={() => setSelectedShot(shot)}
                      className={`cursor-pointer transition-colors duration-100 ${
                        isSelected
                          ? 'bg-amber-dim/50 hover:bg-amber-dim/70'
                          : 'hover:bg-studio-900'
                      }`}
                    >
                      <td className="py-2 px-3 font-mono font-bold text-amber">
                        {shot.display_number}
                      </td>
                      <td className="py-2 px-3">
                        <MethodBadge method={shot.primary_method} size="sm" />
                      </td>
                      <td className="py-2 px-3 text-slate-300 font-mono">
                        {shot.shot_size || '全景'}
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">
                        {shot.lens_mm ? `${shot.lens_mm}mm` : '—'}
                      </td>
                      <td className="py-2 px-3 text-slate-300 truncate max-w-[120px]">
                        {shotMovementLabel(shot)}
                      </td>
                      <td className="py-2 px-3 text-slate-200">
                        <div className="line-clamp-1">{shot.description || '—'}</div>
                      </td>
                      <td className="py-2 px-3 text-amber-200/90">
                        <div className="line-clamp-1">{shot.voice_over || <span className="text-slate-600 italic">无旁白</span>}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="font-bold text-slate-200">{shot.duration_frames}f</span>
                          <span className="text-[10px] text-slate-500">({durationSec}s)</span>
                          <button
                            onClick={e => toggleLock(shot, e)}
                            title={shot.timing_locked ? '已锁定' : '未锁定'}
                            className={`p-0.5 rounded ${shot.timing_locked ? 'text-amber' : 'text-slate-600 hover:text-slate-400'}`}
                          >
                            <svg className="g-icon h-3 w-3">
                              <use href={shot.timing_locked ? '#icon-lock' : '#icon-lock_open'} />
                            </svg>
                          </button>
                        </div>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-mono">
                        {shot.department || 'Camera'}
                      </td>
                      <td className="py-2 px-3 text-slate-300">
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
        {selectedShot && (
          <ShotInspector
            shot={selectedShot}
            production={production}
            onClose={() => setSelectedShot(null)}
          />
        )}
      </div>
    </div>
  );
}
