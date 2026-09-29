'use client';

import React from 'react';
import {
  Button,
  Checkbox,
  Icons,
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@frameforge/ui';
import {
  SHOT_TABLE_COLUMN_LABELS,
  type ShotTableColumnKey
} from '@/lib/shot-table-presentation';

interface ShotColumnManagerProps {
  columnOrder: ShotTableColumnKey[];
  hiddenColumns: ShotTableColumnKey[];
  onVisibleChange: (column: ShotTableColumnKey, visible: boolean) => void;
  onMove: (column: ShotTableColumnKey, direction: -1 | 1) => void;
  onReset: () => void;
}

export function ShotColumnManager({
  columnOrder,
  hiddenColumns,
  onVisibleChange,
  onMove,
  onReset
}: ShotColumnManagerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 text-xs">
          <Icons.SlidersHorizontal className="h-3.5 w-3.5" />
          列管理
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <div className="text-sm font-medium text-foreground">表格列</div>
          <div className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
            镜号与制作方式固定显示；其余列可隐藏、调整顺序，并可拖动表头右边缘调整列宽。
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {columnOrder.map((column, index) => {
            const visible = !hiddenColumns.includes(column);
            return (
              <div
                key={column}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
              >
                <Checkbox
                  checked={visible}
                  onCheckedChange={checked => onVisibleChange(column, checked === true)}
                  aria-label={visible ? `隐藏${SHOT_TABLE_COLUMN_LABELS[column]}` : `显示${SHOT_TABLE_COLUMN_LABELS[column]}`}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {SHOT_TABLE_COLUMN_LABELS[column]}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === 0}
                  onClick={() => onMove(column, -1)}
                  className="h-7 px-2 text-[11px]"
                  aria-label={`上移${SHOT_TABLE_COLUMN_LABELS[column]}`}
                >
                  上移
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={index === columnOrder.length - 1}
                  onClick={() => onMove(column, 1)}
                  className="h-7 px-2 text-[11px]"
                  aria-label={`下移${SHOT_TABLE_COLUMN_LABELS[column]}`}
                >
                  下移
                </Button>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border p-2">
          <Button variant="ghost" size="sm" onClick={onReset} className="h-8 w-full text-xs">
            恢复默认列布局
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
