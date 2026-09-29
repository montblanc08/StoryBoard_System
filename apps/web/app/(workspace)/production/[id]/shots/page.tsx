'use client';

import { Button, Icons, Input, Select } from '@frameforge/ui';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import type { Shot } from '@frameforge/types';
import { useProduction, useShots, useUpdateShot } from '@/lib/hooks/useProduction';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { MethodBadge } from '@/components/shot/MethodBadge';
import { StatusBadge } from '@/components/shot/StatusBadge';
import { ShotInspector } from '@/components/shot/ShotInspector';
import { ShotTrashModal } from '@/components/shot/ShotTrashModal';
import { InlineEditCell } from '@/components/shot/InlineEditCell';
import { ShotColumnManager } from '@/components/shot/ShotColumnManager';
import { BulkActionToolbar } from '@/components/storyboard/BulkActionToolbar';
import { shotMovementLabel } from '@/lib/shot-display';
import {
  SHOT_TABLE_COLUMN_LABELS,
  clampShotTableColumnWidth,
  defaultShotTablePresentationPreferences,
  loadShotTablePresentationPreferences,
  saveShotTablePresentationPreferences,
  type ShotTableColumnKey,
  type ShotTablePresentationPreferences,
  type ShotTableRowHeight
} from '@/lib/shot-table-presentation';

const ROW_PADDING: Record<ShotTableRowHeight, string> = {
  compact: 'py-1',
  standard: 'py-2',
  comfortable: 'py-3',
  auto: 'py-2'
};

export default function ShotListPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [], isLoading } = useShots(id);
  const updateShot = useUpdateShot(id);

  const [isTrashOpen, setIsTrashOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [sortKey, setSortKey] = useState<'default' | 'display_number' | 'duration_frames' | 'status'>('default');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [tablePresentation, setTablePresentation] = useState<ShotTablePresentationPreferences>(
    () => defaultShotTablePresentationPreferences()
  );

  const {
    filters,
    setFilter,
    resetFilters,
    selectedShotIds,
    selectShot,
    selectAllShots,
    clearSelection,
    inspectedShotId,
    isInspectorOpen,
    openInspector,
    closeInspector
  } = useWorkspaceStore();

  useEffect(() => {
    if (!id || typeof window === 'undefined') return;
    setTablePresentation(loadShotTablePresentationPreferences(id, window.localStorage));
  }, [id]);

  const commitTablePresentation = (
    updater: (current: ShotTablePresentationPreferences) => ShotTablePresentationPreferences
  ) => {
    setTablePresentation(current => {
      const next = updater(current);
      if (id && typeof window !== 'undefined') {
        saveShotTablePresentationPreferences(id, next, window.localStorage);
      }
      return next;
    });
  };

  const handleColumnVisibleChange = (column: ShotTableColumnKey, visible: boolean) => {
    commitTablePresentation(current => ({
      ...current,
      hiddenColumns: visible
        ? current.hiddenColumns.filter(item => item !== column)
        : Array.from(new Set([...current.hiddenColumns, column]))
    }));
  };

  const handleColumnMove = (column: ShotTableColumnKey, direction: -1 | 1) => {
    commitTablePresentation(current => {
      const index = current.columnOrder.indexOf(column);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.columnOrder.length) return current;

      const nextOrder = [...current.columnOrder];
      [nextOrder[index], nextOrder[target]] = [nextOrder[target], nextOrder[index]];
      return { ...current, columnOrder: nextOrder };
    });
  };

  const handleRowHeightChange = (rowHeight: ShotTableRowHeight) => {
    commitTablePresentation(current => ({ ...current, rowHeight }));
  };

  const resetColumnLayout = () => {
    const next = defaultShotTablePresentationPreferences();
    setTablePresentation(next);
    if (id && typeof window !== 'undefined') {
      saveShotTablePresentationPreferences(id, next, window.localStorage);
    }
  };

  const resizeColumnBy = (column: ShotTableColumnKey, delta: number) => {
    commitTablePresentation(current => ({
      ...current,
      columnWidths: {
        ...current.columnWidths,
        [column]: clampShotTableColumnWidth(column, current.columnWidths[column] + delta)
      }
    }));
  };

  const handleResizePointerDown = (
    column: ShotTableColumnKey,
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = tablePresentation.columnWidths[column];
    let latestWidth = startWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handlePointerMove = (moveEvent: PointerEvent) => {
      latestWidth = clampShotTableColumnWidth(
        column,
        startWidth + moveEvent.clientX - startX
      );
      setTablePresentation(current => ({
        ...current,
        columnWidths: {
          ...current.columnWidths,
          [column]: latestWidth
        }
      }));
    };

    const finishResize = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', finishResize);
      window.removeEventListener('pointercancel', finishResize);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;

      setTablePresentation(current => {
        const next = {
          ...current,
          columnWidths: {
            ...current.columnWidths,
            [column]: latestWidth
          }
        };
        if (id && typeof window !== 'undefined') {
          saveShotTablePresentationPreferences(id, next, window.localStorage);
        }
        return next;
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', finishResize, { once: true });
    window.addEventListener('pointercancel', finishResize, { once: true });
  };

  const handleResizeKeyDown = (
    column: ShotTableColumnKey,
    event: React.KeyboardEvent<HTMLButtonElement>
  ) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      resizeColumnBy(column, -8);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      resizeColumnBy(column, 8);
    }
  };

  const inspectedShot = shots.find(shot => shot.id === inspectedShotId) || null;

  if (!production) return null;

  const fps = production.fps_num / (production.fps_den || 1);

  const methodOptions = useMemo(
    () => Array.from(new Set(shots.map(item => item.primary_method).filter((value): value is string => Boolean(value)))).sort(),
    [shots]
  );
  const departmentOptions = useMemo(
    () => Array.from(new Set(shots.map(item => item.department).filter((value): value is string => Boolean(value)))).sort(),
    [shots]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(shots.map(item => item.status).filter((value): value is string => Boolean(value)))).sort(),
    [shots]
  );

  const visibleShots = useMemo(() => {
    const query = filters.searchQuery.trim().toLowerCase();
    const filtered = shots.filter(item => {
      if (
        query &&
        ![
          item.display_number,
          item.name,
          item.description,
          item.voice_over,
          item.owner_id,
          item.department,
          item.status,
          item.primary_method
        ].some(value => String(value || '').toLowerCase().includes(query))
      ) return false;

      if (filters.primaryMethod !== 'all' && item.primary_method !== filters.primaryMethod) return false;
      if (filters.department !== 'all' && item.department !== filters.department) return false;
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      return true;
    });

    if (sortKey === 'default') return filtered;

    return [...filtered].sort((a, b) => {
      let left: string | number = '';
      let right: string | number = '';

      if (sortKey === 'display_number') {
        left = a.display_number || '';
        right = b.display_number || '';
      } else if (sortKey === 'duration_frames') {
        left = a.duration_frames || 0;
        right = b.duration_frames || 0;
      } else if (sortKey === 'status') {
        left = a.status || '';
        right = b.status || '';
      }

      const comparison =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right), undefined, {
              numeric: true,
              sensitivity: 'base'
            });

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [shots, filters, sortKey, sortDirection]);

  const visibleShotIds = visibleShots.map(item => item.id);
  const visibleColumns = tablePresentation.columnOrder.filter(
    column => !tablePresentation.hiddenColumns.includes(column)
  );
  const tableMinWidth =
    192 + visibleColumns.reduce(
      (sum, column) => sum + tablePresentation.columnWidths[column],
      0
    );
  const rowPadding = ROW_PADDING[tablePresentation.rowHeight];

  const activeFilterCount = [
    filters.primaryMethod !== 'all',
    filters.department !== 'all',
    filters.status !== 'all'
  ].filter(Boolean).length;

  const toggleLock = async (shot: Shot, event: React.MouseEvent) => {
    event.stopPropagation();
    await updateShot.mutateAsync({
      id: shot.id,
      revision: shot.revision,
      changes: { timing_locked: !shot.timing_locked }
    });
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
      <div className="z-10 shrink-0 border-b border-border bg-card/90 px-3 py-2 sm:px-6 sm:py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-xs">
            <Icons.Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              value={filters.searchQuery}
              onChange={event => setFilter('searchQuery', event.target.value)}
              placeholder="搜索镜号、画面、旁白、负责人..."
              className="w-full min-w-0 pl-8"
            />
          </div>

          <span className="whitespace-nowrap text-xs font-mono text-muted-foreground">
            显示 <span className="font-bold text-foreground">{visibleShots.length}</span> / {shots.length}
          </span>

          {selectedShotIds.length > 0 && (
            <span className="whitespace-nowrap rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
              已选 {selectedShotIds.length}
            </span>
          )}

          <div className="ml-auto flex max-w-full items-center gap-1 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <Button
              variant={showFilters || activeFilterCount > 0 ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowFilters(value => !value)}
              aria-expanded={showFilters}
              className="h-8 text-xs"
            >
              <Icons.Filter className="h-3.5 w-3.5" />
              筛选{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => selectAllShots(visibleShotIds)}
              disabled={!visibleShotIds.length}
              className="h-8 text-xs"
            >
              全选可见
            </Button>

            {selectedShotIds.length > 0 && (
              <Button variant="ghost" size="sm" onClick={clearSelection} className="h-8 text-xs">
                清除选择
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              disabled={selectedShotIds.length !== 1}
              onClick={() => selectedShotIds[0] && openInspector(selectedShotIds[0])}
              className="h-8 text-xs"
            >
              <Icons.PanelRightOpen className="h-3.5 w-3.5" />
              详情
            </Button>

            <ShotColumnManager
              columnOrder={tablePresentation.columnOrder}
              hiddenColumns={tablePresentation.hiddenColumns}
              rowHeight={tablePresentation.rowHeight}
              onVisibleChange={handleColumnVisibleChange}
              onMove={handleColumnMove}
              onRowHeightChange={handleRowHeightChange}
              onReset={resetColumnLayout}
            />

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsTrashOpen(true)}
              className="h-8 text-xs hover:text-foreground"
            >
              <Icons.Trash2 className="h-3.5 w-3.5" />
              废纸篓
            </Button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="z-10 shrink-0 border-b border-border bg-background px-3 py-3 sm:px-6">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Select
              label="制作方式筛选"
              value={filters.primaryMethod}
              onChange={value => setFilter('primaryMethod', value)}
              options={[
                { value: 'all', label: '全部制作方式' },
                ...methodOptions.map(value => ({ value, label: value }))
              ]}
              className="h-9 text-xs"
            />
            <Select
              label="部门筛选"
              value={filters.department}
              onChange={value => setFilter('department', value)}
              options={[
                { value: 'all', label: '全部部门' },
                ...departmentOptions.map(value => ({ value, label: value }))
              ]}
              className="h-9 text-xs"
            />
            <Select
              label="状态筛选"
              value={filters.status}
              onChange={value => setFilter('status', value)}
              options={[
                { value: 'all', label: '全部状态' },
                ...statusOptions.map(value => ({ value, label: value }))
              ]}
              className="h-9 text-xs"
            />
            <Select
              label="排序字段"
              value={sortKey}
              onChange={value => setSortKey(value as typeof sortKey)}
              options={[
                { value: 'default', label: '默认镜头顺序' },
                { value: 'display_number', label: '按镜号' },
                { value: 'duration_frames', label: '按时长' },
                { value: 'status', label: '按状态' }
              ]}
              className="h-9 text-xs"
            />
            <div className="flex min-w-0 gap-2">
              <Select
                label="排序方向"
                value={sortDirection}
                onChange={value => setSortDirection(value as typeof sortDirection)}
                options={[
                  { value: 'asc', label: '升序' },
                  { value: 'desc', label: '降序' }
                ]}
                className="h-9 min-w-0 flex-1 text-xs"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetFilters();
                  setSortKey('default');
                  setSortDirection('asc');
                }}
                className="h-9 shrink-0 text-xs"
              >
                重置
              </Button>
            </div>
          </div>
        </div>
      )}

      {isTrashOpen && (
        <ShotTrashModal
          productionId={production.id}
          onClose={() => setIsTrashOpen(false)}
        />
      )}

      <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <div
          className="min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain"
          role="region"
          aria-label="镜头制作表"
          tabIndex={0}
        >
          {isLoading ? (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-muted-foreground">
              正在加载镜头制作表...
            </div>
          ) : (
            <table
              className="w-full table-fixed border-collapse text-left font-sans text-xs"
              style={{ minWidth: `${Math.max(tableMinWidth, 360)}px` }}
            >
              <thead className="sticky top-0 z-10 border-b border-border bg-card text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-30 w-20 border-r border-border bg-card px-3 py-2.5"
                  >
                    镜号
                  </th>
                  <th
                    scope="col"
                    className="sticky left-20 z-30 w-28 border-r border-border bg-card px-3 py-2.5"
                  >
                    制作方式
                  </th>
                  {visibleColumns.map(column => (
                    <th
                      key={column}
                      scope="col"
                      className={`relative px-3 py-2.5 ${
                        column === 'duration_frames'
                          ? 'text-right'
                          : column === 'status'
                            ? 'text-center'
                            : ''
                      }`}
                      style={{ width: tablePresentation.columnWidths[column] }}
                    >
                      <span className="block truncate pr-1">
                        {SHOT_TABLE_COLUMN_LABELS[column]}
                      </span>
                      <button
                        type="button"
                        aria-label={`调整${SHOT_TABLE_COLUMN_LABELS[column]}列宽`}
                        title={`拖动调整${SHOT_TABLE_COLUMN_LABELS[column]}列宽；方向键微调`}
                        onPointerDown={event => handleResizePointerDown(column, event)}
                        onKeyDown={event => handleResizeKeyDown(column, event)}
                        className="absolute inset-y-0 right-0 z-20 w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {visibleShots.map(shot => {
                  const isSelected = selectedShotIds.includes(shot.id);
                  const isInspected = inspectedShotId === shot.id;
                  const durationSec = ((shot.duration_frames || 0) / fps).toFixed(1);

                  return (
                    <tr
                      key={shot.id}
                      onClick={event => {
                        selectShot(
                          shot.id,
                          event.shiftKey,
                          event.metaKey || event.ctrlKey,
                          visibleShotIds
                        );
                      }}
                      onDoubleClick={() => openInspector(shot.id)}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          openInspector(shot.id);
                        } else if (event.key === ' ') {
                          event.preventDefault();
                          selectShot(
                            shot.id,
                            event.shiftKey,
                            event.metaKey || event.ctrlKey,
                            visibleShotIds
                          );
                        }
                      }}
                      tabIndex={0}
                      aria-selected={isSelected}
                      aria-current={isInspected ? 'true' : undefined}
                      className={`group cursor-pointer transition-colors duration-100 ${
                        isSelected ? 'bg-accent hover:bg-accent/80' : 'hover:bg-accent'
                      } ${isInspected ? 'ring-1 ring-inset ring-ring/50' : ''}`}
                    >
                      <td
                        className={`sticky left-0 z-10 w-20 border-r border-border px-3 ${rowPadding} font-mono font-bold text-foreground ${
                          isSelected ? 'bg-accent' : 'bg-card group-hover:bg-accent'
                        }`}
                      >
                        {shot.display_number}
                      </td>
                      <td
                        className={`sticky left-20 z-10 w-28 border-r border-border px-3 ${rowPadding} ${
                          isSelected ? 'bg-accent' : 'bg-card group-hover:bg-accent'
                        }`}
                      >
                        <MethodBadge method={shot.primary_method} size="sm" />
                      </td>

                      {visibleColumns.map(column => {
                        if (column === 'shot_size') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} font-mono text-foreground`}>
                              {shot.shot_size || '全景'}
                            </td>
                          );
                        }

                        if (column === 'lens_mm') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} font-mono text-muted-foreground`}>
                              {shot.lens_mm ? `${shot.lens_mm}mm` : '—'}
                            </td>
                          );
                        }

                        if (column === 'camera_movement') {
                          return (
                            <td key={column} className={`max-w-[120px] truncate px-3 ${rowPadding} text-foreground`}>
                              {shotMovementLabel(shot)}
                            </td>
                          );
                        }

                        if (column === 'description') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} text-foreground`}>
                              <InlineEditCell
                                productionId={production.id}
                                shot={shot}
                                field="description"
                                value={shot.description || ''}
                                placeholder="双击输入画面描述"
                              />
                            </td>
                          );
                        }

                        if (column === 'voice_over') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} text-foreground`}>
                              <InlineEditCell
                                productionId={production.id}
                                shot={shot}
                                field="voice_over"
                                value={shot.voice_over || ''}
                                placeholder="双击输入旁白"
                              />
                            </td>
                          );
                        }

                        if (column === 'duration_frames') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} text-right font-mono`}>
                              <div className="flex items-center justify-end gap-1.5">
                                <span className="font-bold text-foreground">
                                  {shot.duration_frames}f
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  ({durationSec}s)
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={event => toggleLock(shot, event)}
                                  aria-label={shot.timing_locked ? '已锁定' : '未锁定'}
                                  title={shot.timing_locked ? '已锁定' : '未锁定'}
                                  className={`h-6 w-6 ${
                                    shot.timing_locked ? 'text-foreground' : 'text-muted-foreground'
                                  }`}
                                >
                                  {shot.timing_locked ? (
                                    <Icons.Lock className="h-3 w-3" />
                                  ) : (
                                    <Icons.LockOpen className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </td>
                          );
                        }

                        if (column === 'department') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} font-mono text-muted-foreground`}>
                              {shot.department || 'Camera'}
                            </td>
                          );
                        }

                        if (column === 'owner_id') {
                          return (
                            <td key={column} className={`px-3 ${rowPadding} text-foreground`}>
                              {shot.owner_id || '—'}
                            </td>
                          );
                        }

                        return (
                          <td key={column} className={`px-3 ${rowPadding} text-center`}>
                            <StatusBadge status={shot.status} />
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {isInspectorOpen && inspectedShot && (
          <>
            <div
              className="fixed inset-0 z-40 bg-background/70 md:hidden"
              onClick={closeInspector}
              aria-hidden="true"
            />
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

      <BulkActionToolbar
        production={production}
        allShotIds={visibleShotIds}
      />
    </div>
  );
}
