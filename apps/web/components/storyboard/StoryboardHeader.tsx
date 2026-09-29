'use client';

import React from 'react';
import { Button, Input, Icons, Select, Checkbox } from '@frameforge/ui';
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
    <div className="flex flex-col border-b border-border bg-card/90 backdrop-blur z-10 sticky top-[50px]">
      {/* Top row: Filter & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        {/* Search & Filters */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Search Box */}
          <div className="relative flex items-center">
            <Icons.Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="text"
              value={filters.searchQuery}
              onChange={e => setFilter('searchQuery', e.target.value)}
              placeholder="搜索镜号、描述、旁白、负责人..."
              className="w-56 rounded border border-border bg-background pl-8 pr-3 py-1.5 text-foreground outline-none focus:border-ring transition"
            />
          </div>

          {/* Sequence Filter */}
          <Select
            label="篇章"
            value={filters.sequenceId}
            onChange={value => setFilter('sequenceId', value)}
            options={[ { value: "all", label: "所有篇章 / 幕 (All Sequences)" }, ...sequences.map(seq => ({ value: seq.id, label: seq.display_number + ' · ' + seq.name })) ]}
            className="rounded border border-border bg-background px-2.5 py-1.5 text-foreground outline-none focus:border-ring"
          />

          {/* Method Filter */}
          <Select
            label="制作方式"
            value={filters.primaryMethod}
            onChange={value => setFilter('primaryMethod', value)}
            options={[ { value: "all", label: "制作方式 (All Methods)" }, { value: "live", label: "实拍 (LIVE)" }, { value: "stock", label: "购买素材 (STOCK)" }, { value: "client", label: "客户素材 (CLIENT)" }, { value: "archive", label: "历史资料 (ARCHIVE)" }, { value: "ae", label: "AE合成 (AE)" }, { value: "mg", label: "动效 (MG)" }, { value: "three_d", label: "3D三维 (3D)" }, { value: "vfx", label: "视效 (VFX)" }, { value: "type", label: "字卡 (TYPE)" } ]}
            className="rounded border border-border bg-background px-2.5 py-1.5 text-foreground outline-none focus:border-ring font-mono"
          />

          {/* Status Filter */}
          <Select
            label="制作状态"
            value={filters.status}
            onChange={value => setFilter('status', value)}
            options={[ { value: "all", label: "制作状态 (All Statuses)" }, { value: "draft", label: "规划中 (Draft)" }, { value: "in_progress", label: "制作中 (In Progress)" }, { value: "review", label: "待审片 (Review)" }, { value: "changes_requested", label: "需修改 (Changes)" }, { value: "approved", label: "已审批 (Approved)" }, { value: "locked", label: "已锁定 (Locked)" } ]}
            className="rounded border border-border bg-background px-2.5 py-1.5 text-foreground outline-none focus:border-ring"
          />

          {hasActiveFilters && (
            <Button variant="ghost" size="sm"
              onClick={resetFilters}
              className="flex items-center gap-1 text-[11px] text-foreground hover:underline px-1"
            >
              <Icons.X className="h-3 w-3" />
              重置筛选
            </Button>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          {/* Import Table Button */}
          <Button variant="outline" size="sm"
            onClick={() => useWorkspaceStore.getState().setImportModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:border-ring hover:text-foreground transition"
          >
            <Icons.Table2 className="h-4 w-4" />
            导入分镜表
          </Button>

          {/* VO Auto-Timing Button */}
          <Button variant="secondary" size="sm"
            onClick={() => setVOTimingModalOpen(true)}
            className="flex items-center gap-1.5 rounded border border-ring/50 bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground hover:bg-accent/80 hover:border-ring transition shadow-sm"
          >
            <Icons.Clock3 className="h-4 w-4" />
            自动计时
          </Button>

          {/* New Shot Button */}
          <Button variant="default" size="sm"
            onClick={() => setNewShotModalOpen(true)}
            className="flex items-center gap-1.5 rounded px-3.5 py-1.5 text-xs font-bold transition shadow-sm"
          >
            <Icons.Plus className="h-4 w-4" />
            新建镜头
          </Button>
        </div>
      </div>

      {/* Bottom row: View Mode, Grouping & Stats Bar */}
      <div className="flex items-center justify-between border-t border-border/80 bg-background/40 px-6 py-2 text-xs">
        {/* Left: View Modes & Grouping */}
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded border border-border bg-card p-0.5">
            <Button variant="ghost" size="sm"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'grid'
                  ? 'bg-accent text-accent-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icons.LayoutGrid className="h-3.5 w-3.5" />
              分镜卡片板
            </Button>

            <Button variant="ghost" size="sm"
              onClick={() => setViewMode('wall')}
              className={`flex items-center gap-1 rounded px-2.5 py-1 font-medium transition ${
                viewMode === 'wall'
                  ? 'bg-accent text-accent-foreground font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icons.Columns3 className="h-3.5 w-3.5" />
              视觉墙 (Wall)
            </Button>
          </div>

          {/* Group by Sequence Switch */}
          {viewMode === 'grid' && (
            <label className="flex items-center gap-1.5 text-muted-foreground cursor-pointer select-none text-xs">
              <Checkbox
                checked={groupBySequence}
                onCheckedChange={checked => setGroupBySequence(checked === true)}
              />
              按篇章幕分组
            </label>
          )}

          {/* Zoom Size */}
          <div className="flex items-center gap-1 border-l border-border pl-4 text-muted-foreground font-mono text-[11px]">
            <span>缩放:</span>
            {(['sm', 'md', 'lg'] as const).map(sz => (
              <Button variant="ghost" size="sm"
                key={sz}
                onClick={() => setCardSize(sz)}
                className={`rounded px-1.5 py-0.5 uppercase ${
                  cardSize === sz ? 'bg-muted text-foreground font-bold' : 'hover:text-foreground'
                }`}
              >
                {sz}
              </Button>
            ))}
          </div>
        </div>

        {/* Right: Stats */}
        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="text-muted-foreground">
            镜头数: <span className="font-bold text-foreground">{filteredShots.length}</span> / {shots.length}
          </div>

          <div className="text-muted-foreground">
            总时长: <span className="font-bold text-foreground">{totalSeconds}s</span> ({totalFrames}f)
          </div>

          <div className="rounded bg-muted px-2 py-0.5 font-bold text-emerald-400 border border-emerald-500/30">
            {totalTimecode}
          </div>
        </div>
      </div>
    </div>
  );
}
