'use client';

import React from 'react';
import type { Production, Sequence, Shot } from '@frameforge/types';
import { framesToTimecode, framesToSeconds } from '@frameforge/timecode';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

interface StoryboardHeaderProps {
  production: Production;
  sequences: Sequence[];
  shots: Shot[];
  filteredShots: Shot[];
}

export function StoryboardHeader({
  production,
  sequences,
  shots,
  filteredShots
}: StoryboardHeaderProps) {
  const {
    viewMode,
    setViewMode,
    cardSize,
    setCardSize,
    groupBySequence,
    setGroupBySequence,
    filters,
    setFilter,
    resetFilters,
    setVOTimingModalOpen,
    setNewShotModalOpen
  } = useWorkspaceStore();

  const fps = production.fps_num / (production.fps_den || 1);
  const totalFrames = filteredShots.reduce((acc, s) => acc + (s.duration_frames || 0), 0);
  const totalSeconds = framesToSeconds(totalFrames, fps).toFixed(1);
  const totalTimecode = framesToTimecode(totalFrames, fps, production.drop_frame);

  const hasActiveFilters =
    filters.searchQuery ||
    filters.sequenceId !== 'all' ||
    filters.primaryMethod !== 'all' ||
    filters.status !== 'all';

  return (
    <div className="flex flex-col border-b border-studio-700 bg-studio-900/90 backdrop-blur z-10 sticky top-[50px]">
      {/* Top row: Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search Box */}
          <div className="relative flex items-center">
            <svg className="g-icon absolute left-2.5 h-3.5 w-3.5 text-slate-400"><use href="#icon-search" /></svg>
            <input
              type="text"
              value={filters.searchQuery}
              onChange={e => setFilter('searchQuery', e.target.value)}
              placeholder="搜索镜号、描述、旁白、负责人..."
              className="w-56 rounded border border-studio-700 bg-studio-950 pl-8 pr-3 py-1.5 text-white outline-none focus:border-amber transition"
            />
          </div>

          {/* Sequence Filter */}
          <select
            value={filters.sequenceId}
            onChange={e => setFilter('sequenceId', e.target.value)}
            className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none focus:border-amber"
          >
            <option value="all">所有篇章 / 幕 (All Sequences)</option>
            {sequences.map(seq => (
              <option key={seq.id} value={seq.id}>
                {seq.display_number} · {seq.name}
              </option>
            ))}
          </select>

          {/* Method Filter */}
          <select
            value={filters.primaryMethod}
            onChange={e => setFilter('primaryMethod', e.target.value)}
            className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none focus:border-amber font-mono"
          >
            <option value="all">制作方式 (All Methods)</option>
            <option value="live">实拍 (LIVE)</option>
            <option value="stock">购买素材 (STOCK)</option>
            <option value="client">客户素材 (CLIENT)</option>
            <option value="archive">历史资料 (ARCHIVE)</option>
            <option value="ae">AE合成 (AE)</option>
            <option value="mg">动效 (MG)</option>
            <option value="three_d">3D三维 (3D)</option>
            <option value="vfx">视效 (VFX)</option>
            <option value="type">字卡 (TYPE)</option>
          </select>

          {/* Status Filter */}
          <select
            value={filters.status}
            onChange={e => setFilter('status', e.target.value)}
            className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none focus:border-amber"
          >
            <option value="all">制作状态 (All Statuses)</option>
            <option value="draft">规划中 (Draft)</option>
            <option value="in_progress">制作中 (In Progress)</option>
            <option value="review">待审片 (Review)</option>
            <option value="changes_requested">需修改 (Changes)</option>
            <option value="approved">已审批 (Approved)</option>
            <option value="locked">已锁定 (Locked)</option>
          </select>

          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] text-amber hover:underline px-1"
            >
              <svg className="g-icon h-3 w-3"><use href="#icon-close" /></svg>
              重置筛选
            </button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          {/* VO Auto-Timing Button */}
          <button
            onClick={() => setVOTimingModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-amber/50 bg-amber/10 px-3 py-1.5 text-xs font-bold text-amber hover:bg-amber/20 hover:border-amber transition shadow-sm"
          >
            <svg className="g-icon h-4 w-4"><use href="#icon-schedule" /></svg>
            智能旁白计时
          </button>

          {/* New Shot Button */}
          <button
            onClick={() => setNewShotModalOpen(true)}
            className="flex items-center gap-1.5 rounded bg-amber px-3.5 py-1.5 text-xs font-bold text-studio-950 hover:bg-amber-hover transition shadow-sm"
          >
            <svg className="g-icon h-4 w-4"><use href="#icon-add" /></svg>
            新建镜头
          </button>
        </div>
      </div>

      {/* Bottom row: View Mode, Grouping & Stats Bar */}
      <div className="flex items-center justify-between border-t border-studio-800/80 bg-studio-950/40 px-6 py-2 text-xs">
        {/* Left: View Modes & Grouping */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded border border-studio-700 bg-studio-900 p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'grid'
                  ? 'bg-amber text-studio-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <svg className="g-icon h-3.5 w-3.5"><use href="#icon-grid_view" /></svg>
              分镜卡片板
            </button>

            <button
              onClick={() => setViewMode('wall')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'wall'
                  ? 'bg-amber text-studio-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <svg className="g-icon h-3.5 w-3.5"><use href="#icon-view_module" /></svg>
              视觉墙 (Wall)
            </button>
          </div>

          {/* Group by Sequence Switch */}
          {viewMode === 'grid' && (
            <label className="flex items-center gap-1.5 text-slate-400 cursor-pointer select-none text-xs">
              <input
                type="checkbox"
                checked={groupBySequence}
                onChange={e => setGroupBySequence(e.target.checked)}
                className="h-3.5 w-3.5 rounded accent-amber cursor-pointer"
              />
              按篇章幕分组
            </label>
          )}

          {/* Zoom Size */}
          <div className="flex items-center gap-1 border-l border-studio-800 pl-4 text-slate-500 font-mono text-[11px]">
            <span>缩放:</span>
            {(['sm', 'md', 'lg'] as const).map(sz => (
              <button
                key={sz}
                onClick={() => setCardSize(sz)}
                className={`rounded px-1.5 py-0.5 uppercase ${
                  cardSize === sz ? 'bg-studio-700 text-amber font-bold' : 'hover:text-slate-300'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-slate-400">
            镜头数: <span className="font-bold text-white">{filteredShots.length}</span> / {shots.length}
          </div>

          <div className="text-slate-400">
            总时长: <span className="font-bold text-amber">{totalSeconds}s</span> ({totalFrames}f)
          </div>

          <div className="rounded bg-studio-800 px-2 py-0.5 font-bold text-emerald-400 border border-emerald-500/30">
            {totalTimecode}
          </div>
        </div>
      </div>
    </div>
  );
}
