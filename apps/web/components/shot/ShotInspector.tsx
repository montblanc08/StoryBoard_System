'use client';

import React, { useEffect, useState } from 'react';
import type { Shot, Production } from '@frameforge/types';
import { framesToTimecode, framesToSeconds } from '@frameforge/timecode';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useUpdateShot, useDeleteShot } from '@/lib/hooks/useProduction';
import { MethodBadge } from './MethodBadge';

interface ShotInspectorProps {
  shot: Shot | null;
  production: Production;
  onClose: () => void;
}

export function ShotInspector({ shot, production, onClose }: ShotInspectorProps) {
  const updateShot = useUpdateShot(production.id);
  const deleteShot = useDeleteShot(production.id);

  const [formData, setFormData] = useState<Partial<Shot>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'creative' | 'camera' | 'pipeline' | 'timing'>('creative');

  useEffect(() => {
    if (shot) {
      setFormData({
        name: shot.name || '',
        display_number: shot.display_number,
        description: shot.description || '',
        voice_over: shot.voice_over || '',
        dialogue: shot.dialogue || '',
        subtitle: shot.subtitle || '',
        director_notes: shot.director_notes || '',
        primary_method: shot.primary_method,
        department: shot.department,
        owner_id: shot.owner_id || '',
        status: shot.status,
        duration_frames: shot.duration_frames,
        timing_locked: shot.timing_locked,
        shot_size: shot.shot_size || '全景',
        lens_mm: shot.lens_mm || 50,
        camera: shot.camera || 'ARRI Alexa Mini',
        camera_angle: shot.camera_angle || '平视',
        camera_height: shot.camera_height || '胸高',
        action: shot.action || '',
        composition: shot.composition || '',
        vfx_required: shot.vfx_required || false
      });
    }
  }, [shot]);

  if (!shot) return null;

  const fps = production.fps_num / (production.fps_den || 1);
  const durationSec = framesToSeconds(formData.duration_frames || shot.duration_frames, fps).toFixed(2);
  const timecode = framesToTimecode(formData.duration_frames || shot.duration_frames, fps, production.drop_frame);

  const handleFieldChange = (field: keyof Shot, value: unknown) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await updateShot.mutateAsync({
        id: shot.id,
        revision: shot.revision,
        changes: formData
      });
    } catch (err: any) {
      alert(err.message || '保存镜头失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`确认删除镜头 ${shot.display_number} 吗？`)) {
      await deleteShot.mutateAsync(shot.id);
      onClose();
    }
  };

  return (
    <aside className="flex h-full w-[380px] flex-col border-l border-studio-700 bg-studio-900 shadow-2xl z-20">
      {/* Inspector Header */}
      <div className="flex h-[50px] items-center justify-between border-b border-studio-700 px-4 bg-studio-950/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-bold text-amber">
            SHOT {shot.display_number}
          </span>
          <span className="rounded bg-studio-800 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
            REV #{shot.revision}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-1 rounded bg-amber px-3 py-1 text-xs font-bold text-studio-950 hover:bg-amber-hover disabled:opacity-50 transition"
          >
            <svg className="g-icon h-3.5 w-3.5"><use href="#icon-check" /></svg>
            {isSaving ? '保存中…' : '保存'}
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-studio-800 hover:text-white"
          >
            <svg className="g-icon h-4 w-4"><use href="#icon-close" /></svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-studio-700 bg-studio-950/40 text-xs font-medium text-slate-400">
        <button
          onClick={() => setActiveTab('creative')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'creative' ? 'border-amber text-amber bg-studio-900' : 'border-transparent hover:text-slate-200'
          }`}
        >
          画面与旁白
        </button>
        <button
          onClick={() => setActiveTab('camera')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'camera' ? 'border-amber text-amber bg-studio-900' : 'border-transparent hover:text-slate-200'
          }`}
        >
          摄影与构图
        </button>
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'pipeline' ? 'border-amber text-amber bg-studio-900' : 'border-transparent hover:text-slate-200'
          }`}
        >
          管线与制作
        </button>
        <button
          onClick={() => setActiveTab('timing')}
          className={`flex-1 py-2 text-center border-b-2 transition ${
            activeTab === 'timing' ? 'border-amber text-amber bg-studio-900' : 'border-transparent hover:text-slate-200'
          }`}
        >
          时码与锁定时长
        </button>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {activeTab === 'creative' && (
          <>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">镜头名称 / 标题</label>
              <input
                type="text"
                value={formData.name || ''}
                onChange={e => handleFieldChange('name', e.target.value)}
                placeholder="例如：园区鸟瞰全景"
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-1.5 text-white outline-none focus:border-amber"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">画面构图与视觉描述 (Visual Action)</label>
              <textarea
                rows={4}
                value={formData.description || ''}
                onChange={e => handleFieldChange('description', e.target.value)}
                placeholder="详细描述画面构图、运动轨迹与光影氛围..."
                className="w-full rounded border border-studio-700 bg-studio-950 p-2.5 text-white outline-none focus:border-amber leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">对应解说词旁白 (Voice Over)</label>
              <textarea
                rows={4}
                value={formData.voice_over || ''}
                onChange={e => handleFieldChange('voice_over', e.target.value)}
                placeholder="输入本镜对应的解说词或台词旁白..."
                className="w-full rounded border border-studio-700 bg-studio-950 p-2.5 text-white outline-none focus:border-amber leading-relaxed"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">导演备注 (Director Notes)</label>
              <textarea
                rows={2}
                value={formData.director_notes || ''}
                onChange={e => handleFieldChange('director_notes', e.target.value)}
                placeholder="导演特别要求与注意事项..."
                className="w-full rounded border border-studio-700 bg-studio-950 p-2 text-white outline-none focus:border-amber"
              />
            </div>
          </>
        )}

        {activeTab === 'camera' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">标准景别</label>
                <select
                  value={formData.shot_size || '全景'}
                  onChange={e => handleFieldChange('shot_size', e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                >
                  <option value="大远景">大远景 (EWS)</option>
                  <option value="远景">远景 (WS)</option>
                  <option value="全景">全景 (FS)</option>
                  <option value="中景">中景 (MS)</option>
                  <option value="近景">近景 (MCU)</option>
                  <option value="特写">特写 (CU)</option>
                  <option value="大特写">大特写 (ECU)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">焦段 (mm)</label>
                <input
                  type="number"
                  value={formData.lens_mm || ''}
                  onChange={e => handleFieldChange('lens_mm', Number(e.target.value))}
                  placeholder="50"
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">摄影机位角度</label>
                <select
                  value={formData.camera_angle || '平视'}
                  onChange={e => handleFieldChange('camera_angle', e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                >
                  <option value="平视">平视 (Eye Level)</option>
                  <option value="俯视">俯视 (High Angle)</option>
                  <option value="仰视">仰视 (Low Angle)</option>
                  <option value="鸟瞰">鸟瞰 (Bird's Eye)</option>
                  <option value="斜角">荷兰角 (Dutch Angle)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">机位高度</label>
                <select
                  value={formData.camera_height || '胸高'}
                  onChange={e => handleFieldChange('camera_height', e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                >
                  <option value="视平线">视平线</option>
                  <option value="胸高">胸高</option>
                  <option value="腰高">腰高</option>
                  <option value="贴地">贴地低角度</option>
                  <option value="高空航拍">高空航拍</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">摄影设备 / 载具</label>
              <input
                type="text"
                value={formData.camera || ''}
                onChange={e => handleFieldChange('camera', e.target.value)}
                placeholder="例如：ARRI Alexa Mini + 航拍无人机"
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-1.5 text-white outline-none focus:border-amber"
              />
            </div>
          </>
        )}

        {activeTab === 'pipeline' && (
          <>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">主要制作方式 (Primary Method)</label>
              <select
                value={formData.primary_method || 'live'}
                onChange={e => handleFieldChange('primary_method', e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber font-mono font-semibold"
              >
                <option value="live">实拍 (LIVE SHOOT)</option>
                <option value="stock">购买素材 (STOCK FOOTAGE)</option>
                <option value="client">客户素材 (CLIENT ASSET)</option>
                <option value="archive">历史资料 (ARCHIVE)</option>
                <option value="still">静帧 (STILL FRAME)</option>
                <option value="ae">AE合成包装 (AE COMP)</option>
                <option value="mg">动效设计 (MOTION GRAPHICS)</option>
                <option value="three_d">3D三维制作 (3D ANIMATION)</option>
                <option value="vfx">视效特效 (VFX SHOT)</option>
                <option value="type">纯文字字卡 (TITLE CARD)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">责任部门</label>
                <select
                  value={formData.department || 'camera'}
                  onChange={e => handleFieldChange('department', e.target.value)}
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                >
                  <option value="camera">摄影组 (Camera)</option>
                  <option value="director">导演组 (Director)</option>
                  <option value="production">制片组 (Production)</option>
                  <option value="art">美术组 (Art)</option>
                  <option value="stock">素材组 (Stock)</option>
                  <option value="editorial">剪辑组 (Editorial)</option>
                  <option value="motion">动效组 (Motion)</option>
                  <option value="three_d">三维组 (3D)</option>
                  <option value="vfx">视效组 (VFX)</option>
                  <option value="sound">声音组 (Sound)</option>
                  <option value="color">调色组 (Color)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">责任负责人</label>
                <input
                  type="text"
                  value={formData.owner_id || ''}
                  onChange={e => handleFieldChange('owner_id', e.target.value)}
                  placeholder="例如：张指导"
                  className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-1.5 text-white outline-none focus:border-amber"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">当前制作状态</label>
              <select
                value={formData.status || 'draft'}
                onChange={e => handleFieldChange('status', e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-1.5 text-white outline-none focus:border-amber"
              >
                <option value="draft">规划中 (Draft)</option>
                <option value="in_progress">制作中 (In Progress)</option>
                <option value="review">待审片 (Ready for Review)</option>
                <option value="changes_requested">需修改 (Changes Requested)</option>
                <option value="approved">已审批 (Approved)</option>
                <option value="locked">已锁定 (Locked)</option>
              </select>
            </div>

            <div className="flex items-center justify-between rounded border border-studio-700 bg-studio-950/60 p-3">
              <div>
                <div className="font-medium text-white">视效制作需求 (VFX Required)</div>
                <div className="text-[11px] text-slate-500">标记是否需要三维/合成组介入</div>
              </div>
              <input
                type="checkbox"
                checked={formData.vfx_required || false}
                onChange={e => handleFieldChange('vfx_required', e.target.checked)}
                className="h-4 w-4 rounded accent-amber cursor-pointer"
              />
            </div>
          </>
        )}

        {activeTab === 'timing' && (
          <>
            <div className="rounded-lg border border-studio-700 bg-studio-950/80 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">帧数规划 (Frames)</span>
                <span className="font-mono text-sm font-bold text-amber">
                  {formData.duration_frames || 0} f
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">换算时长 (Seconds)</span>
                <span className="font-mono text-sm font-bold text-slate-200">
                  {durationSec} s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">SMPTE 时码</span>
                <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-500/20">
                  {timecode}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">手动调整帧数 (Integer Frames)</label>
              <input
                type="number"
                min={1}
                value={formData.duration_frames || ''}
                onChange={e => handleFieldChange('duration_frames', Number(e.target.value))}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white font-mono outline-none focus:border-amber"
              />
            </div>

            <div className="flex items-center justify-between rounded border border-studio-700 bg-studio-950/60 p-3">
              <div>
                <div className="font-medium text-white">锁定镜头时长 (Lock Timing)</div>
                <div className="text-[11px] text-slate-500">智能旁白计时算法将跳过锁定镜头</div>
              </div>
              <input
                type="checkbox"
                checked={formData.timing_locked || false}
                onChange={e => handleFieldChange('timing_locked', e.target.checked)}
                className="h-4 w-4 rounded accent-amber cursor-pointer"
              />
            </div>
          </>
        )}
      </div>

      {/* Inspector Footer with Danger Zone */}
      <div className="border-t border-studio-700 p-4 bg-studio-950/60">
        <button
          onClick={handleDelete}
          className="flex w-full items-center justify-center gap-2 rounded border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-medium text-rose-400 hover:bg-rose-500/20 transition"
        >
          <svg className="g-icon h-4 w-4"><use href="#icon-delete" /></svg>
          删除镜头 (Trash Shot)
        </button>
      </div>
    </aside>
  );
}
