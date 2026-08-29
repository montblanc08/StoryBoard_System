'use client';

import React from 'react';
import type { Production, Sequence, Shot } from '@frameforge/types';
import { framesToSeconds } from '@frameforge/timecode';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { ShotCard } from './ShotCard';

interface StoryboardGridProps {
  production: Production;
  sequences: Sequence[];
  shots: Shot[];
  onSelectShot: (id: string, e: React.MouseEvent) => void;
  onInspectShot: (id: string) => void;
}

export function StoryboardGrid({
  production,
  sequences,
  shots,
  onSelectShot,
  onInspectShot
}: StoryboardGridProps) {
  const { selectedShotIds, groupBySequence, cardSize, filters } = useWorkspaceStore();
  const fps = production.fps_num / (production.fps_den || 1);

  const gridColsClass =
    cardSize === 'sm'
      ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
      : cardSize === 'lg'
      ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-6'
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4';

  const allIds = shots.map(s => s.id);

  if (shots.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center text-xs text-slate-500">
        <svg className="g-icon h-12 w-12 text-studio-700 mb-3"><use href="#icon-search" /></svg>
        <p className="text-slate-300 font-medium text-sm mb-1">未找到匹配的分镜镜头</p>
        <p>请尝试调整搜索关键字或筛选条件</p>
      </div>
    );
  }

  // If grouping is enabled and no specific sequence filter is applied
  if (groupBySequence && filters.sequenceId === 'all' && sequences.length > 0) {
    return (
      <div className="p-6 space-y-8">
        {sequences.map(seq => {
          const seqShots = shots.filter(s => s.sequence_id === seq.id);
          if (seqShots.length === 0) return null;

          const seqFrames = seqShots.reduce((acc, s) => acc + (s.duration_frames || 0), 0);
          const seqSec = framesToSeconds(seqFrames, fps).toFixed(1);

          return (
            <div key={seq.id} className="space-y-3">
              {/* Sequence Header */}
              <div className="flex items-center justify-between border-b border-studio-800 pb-2">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-amber/10 border border-amber/30 px-2 py-0.5 font-mono text-xs font-bold text-amber">
                    {seq.display_number}
                  </span>
                  <h3 className="text-sm font-bold text-slate-200">{seq.name}</h3>
                </div>

                <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
                  <span>{seqShots.length} 镜头</span>
                  <span>·</span>
                  <span className="text-amber font-semibold">{seqSec}s ({seqFrames}f)</span>
                </div>
              </div>

              {/* Grid of Shots */}
              <div className={`grid ${gridColsClass}`}>
                {seqShots.map(shot => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    production={production}
                    isSelected={selectedShotIds.includes(shot.id)}
                    onSelect={e => onSelectShot(shot.id, e)}
                    onInspect={() => onInspectShot(shot.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {/* Unassigned shots if any */}
        {shots.filter(s => !s.sequence_id || !sequences.some(seq => seq.id === s.sequence_id)).length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-studio-800 pb-2">
              <h3 className="text-sm font-bold text-slate-400">未归类篇章镜头</h3>
            </div>
            <div className={`grid ${gridColsClass}`}>
              {shots
                .filter(s => !s.sequence_id || !sequences.some(seq => seq.id === s.sequence_id))
                .map(shot => (
                  <ShotCard
                    key={shot.id}
                    shot={shot}
                    production={production}
                    isSelected={selectedShotIds.includes(shot.id)}
                    onSelect={e => onSelectShot(shot.id, e)}
                    onInspect={() => onInspectShot(shot.id)}
                  />
                ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Flat Grid
  return (
    <div className={`grid ${gridColsClass} p-6`}>
      {shots.map(shot => (
        <ShotCard
          key={shot.id}
          shot={shot}
          production={production}
          isSelected={selectedShotIds.includes(shot.id)}
          onSelect={e => onSelectShot(shot.id, e)}
          onInspect={() => onInspectShot(shot.id)}
        />
      ))}
    </div>
  );
}
