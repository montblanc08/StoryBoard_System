'use client';

import React, { useState } from 'react';
import type { Production } from '@frameforge/types';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useBulkUpdateShots, useDeleteShot } from '@/lib/hooks/useProduction';

interface BulkActionToolbarProps {
  production: Production;
  allShotIds: string[];
}

export function BulkActionToolbar({ production, allShotIds }: BulkActionToolbarProps) {
  const { selectedShotIds, clearSelection, selectAllShots } = useWorkspaceStore();
  const bulkUpdate = useBulkUpdateShots(production.id);
  const deleteShot = useDeleteShot(production.id);

  const [selectedMethod, setSelectedMethod] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedDept, setSelectedDept] = useState('');

  if (selectedShotIds.length === 0) return null;

  const handleApplyMethod = async (method: string) => {
    if (!method) return;
    await bulkUpdate.mutateAsync({
      shotIds: selectedShotIds,
      updates: { primary_method: method }
    });
    setSelectedMethod('');
  };

  const handleApplyStatus = async (status: string) => {
    if (!status) return;
    await bulkUpdate.mutateAsync({
      shotIds: selectedShotIds,
      updates: { status }
    });
    setSelectedStatus('');
  };

  const handleApplyDept = async (dept: string) => {
    if (!dept) return;
    await bulkUpdate.mutateAsync({
      shotIds: selectedShotIds,
      updates: { department: dept }
    });
    setSelectedDept('');
  };

  const handleBulkDelete = async () => {
    if (confirm(`确认批量删除选中的 ${selectedShotIds.length} 个镜头吗？`)) {
      for (const id of selectedShotIds) {
        await deleteShot.mutateAsync(id);
      }
      clearSelection();
    }
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-xl border border-amber/40 bg-studio-900/95 px-5 py-3 shadow-2xl backdrop-blur-md text-xs">
      {/* Selected Counter */}
      <div className="flex items-center gap-2 pr-3 border-r border-studio-700">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber text-studio-950 font-bold font-mono text-[11px]">
          {selectedShotIds.length}
        </span>
        <span className="font-medium text-slate-200">个镜头已选</span>
      </div>

      {/* Quick Batch Updates */}
      <div className="flex items-center gap-2">
        {/* Method Select */}
        <select
          value={selectedMethod}
          onChange={e => {
            setSelectedMethod(e.target.value);
            handleApplyMethod(e.target.value);
          }}
          className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none hover:border-amber cursor-pointer"
        >
          <option value="">批量设制作方式...</option>
          <option value="live">实拍 (LIVE)</option>
          <option value="stock">购买素材 (STOCK)</option>
          <option value="client">客户素材 (CLIENT)</option>
          <option value="ae">AE合成 (AE)</option>
          <option value="mg">动效 (MG)</option>
          <option value="three_d">3D三维 (3D)</option>
          <option value="vfx">视效 (VFX)</option>
        </select>

        {/* Status Select */}
        <select
          value={selectedStatus}
          onChange={e => {
            setSelectedStatus(e.target.value);
            handleApplyStatus(e.target.value);
          }}
          className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none hover:border-amber cursor-pointer"
        >
          <option value="">批量设制作状态...</option>
          <option value="draft">规划中 (Draft)</option>
          <option value="in_progress">制作中 (In Progress)</option>
          <option value="review">待审片 (Review)</option>
          <option value="approved">已审批 (Approved)</option>
          <option value="locked">已锁定 (Locked)</option>
        </select>

        {/* Department Select */}
        <select
          value={selectedDept}
          onChange={e => {
            setSelectedDept(e.target.value);
            handleApplyDept(e.target.value);
          }}
          className="rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-slate-200 outline-none hover:border-amber cursor-pointer"
        >
          <option value="">批量设责任部门...</option>
          <option value="camera">摄影组 (Camera)</option>
          <option value="stock">素材组 (Stock)</option>
          <option value="motion">动效组 (Motion)</option>
          <option value="three_d">三维组 (3D)</option>
          <option value="vfx">视效组 (VFX)</option>
          <option value="editorial">剪辑组 (Editorial)</option>
          <option value="sound">声音组 (Sound)</option>
        </select>
      </div>

      {/* Operations */}
      <div className="flex items-center gap-2 pl-3 border-l border-studio-700">
        <button
          onClick={() => selectAllShots(allShotIds)}
          className="rounded px-2.5 py-1.5 text-slate-300 hover:bg-studio-800 hover:text-white"
        >
          全选所有
        </button>

        <button
          onClick={clearSelection}
          className="rounded px-2.5 py-1.5 text-slate-400 hover:bg-studio-800 hover:text-white"
        >
          取消选择
        </button>

        <button
          onClick={handleBulkDelete}
          className="flex items-center gap-1 rounded bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 font-bold text-rose-400 hover:bg-rose-500/20"
        >
          <svg className="g-icon h-3.5 w-3.5"><use href="#icon-delete" /></svg>
          批量删除
        </button>
      </div>
    </div>
  );
}
