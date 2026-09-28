'use client';

import React, { useState } from 'react';
import type { Production, Sequence } from '@frameforge/types';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useCreateShot } from '@/lib/hooks/useProduction';

interface NewShotModalProps {
  production: Production;
  sequences: Sequence[];
  nextNumber: string;
}

export function NewShotModal({ production, sequences, nextNumber }: NewShotModalProps) {
  const { isNewShotModalOpen, setNewShotModalOpen } = useWorkspaceStore();
  const createShot = useCreateShot(production.id);

  const fps = production.fps_num / (production.fps_den || 1);

  const [displayNumber, setDisplayNumber] = useState(nextNumber);
  const [sequenceId, setSequenceId] = useState(sequences[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [voiceover, setVoiceover] = useState('');
  const [primaryMethod, setPrimaryMethod] = useState('live');
  const [department, setDepartment] = useState('camera');
  const [durationSeconds, setDurationSeconds] = useState(3.0);
  const [shotSize, setShotSize] = useState('全景');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isNewShotModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const durationFrames = Math.max(1, Math.round(durationSeconds * fps));

      await createShot.mutateAsync({
        display_number: displayNumber,
        sequence_id: sequenceId || null,
        name: name || `镜头 ${displayNumber}`,
        description,
        voice_over: voiceover,
        primary_method: primaryMethod as any,
        department: department as any,
        duration_frames: durationFrames,
        shot_size: shotSize,
        timing_locked: false,
        status: 'draft'
      });

      setNewShotModalOpen(false);
    } catch (err: any) {
      alert(err.message || '创建镜头失败');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-studio-700 bg-studio-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-[50px] items-center justify-between border-b border-studio-700 bg-studio-950 px-6">
          <div className="flex items-center gap-2">
            <svg className="g-icon text-amber"><use href="#icon-add" /></svg>
            <h3 className="text-sm font-bold text-white">新建分镜镜头 (New Shot)</h3>
          </div>

          <button
            onClick={() => setNewShotModalOpen(false)}
            className="text-slate-400 hover:text-white"
          >
            <svg className="g-icon"><use href="#icon-close" /></svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">镜号 (Display Number)</label>
              <input
                type="text"
                required
                value={displayNumber}
                onChange={e => setDisplayNumber(e.target.value)}
                placeholder="例如：081"
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white font-mono font-bold outline-none focus:border-amber"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">所属篇章 / 幕</label>
              <select
                value={sequenceId}
                onChange={e => setSequenceId(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
              >
                {sequences.map(seq => (
                  <option key={seq.id} value={seq.id}>
                    {seq.display_number} · {seq.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">镜头标题 / 内容概要</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：主大门车流与全景特写"
              className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">制作方式</label>
              <select
                value={primaryMethod}
                onChange={e => setPrimaryMethod(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-2 text-white outline-none focus:border-amber font-mono font-semibold"
              >
                <option value="live">实拍 (LIVE)</option>
                <option value="stock">购买素材 (STOCK)</option>
                <option value="client">客户素材 (CLIENT)</option>
                <option value="ae">AE合成 (AE)</option>
                <option value="mg">动效 (MG)</option>
                <option value="three_d">3D三维 (3D)</option>
                <option value="vfx">视效 (VFX)</option>
                <option value="still">静帧 (STILL)</option>
                <option value="type">字卡 (TYPE)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">标准景别</label>
              <select
                value={shotSize}
                onChange={e => setShotSize(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-2 text-white outline-none focus:border-amber"
              >
                <option value="全景">全景 (FS)</option>
                <option value="特写">特写 (CU)</option>
                <option value="中景">中景 (MS)</option>
                <option value="近景">近景 (MCU)</option>
                <option value="远景">远景 (WS)</option>
                <option value="大特写">大特写 (ECU)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">规划时长 (秒)</label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={durationSeconds}
                onChange={e => setDurationSeconds(Number(e.target.value))}
                className="w-full rounded border border-studio-700 bg-studio-950 px-2.5 py-2 text-white font-mono outline-none focus:border-amber"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">画面构图与视觉描述</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="画面主体、运镜方式与光影氛围设计..."
              className="w-full rounded border border-studio-700 bg-studio-950 p-2.5 text-white outline-none focus:border-amber"
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-medium">对应解说词旁白</label>
            <textarea
              rows={2}
              value={voiceover}
              onChange={e => setVoiceover(e.target.value)}
              placeholder="本镜头对应的解说旁白或对白内容..."
              className="w-full rounded border border-studio-700 bg-studio-950 p-2.5 text-white outline-none focus:border-amber"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-studio-700">
            <button
              type="button"
              onClick={() => setNewShotModalOpen(false)}
              className="rounded border border-studio-700 px-4 py-2 font-medium text-slate-300 hover:bg-studio-800"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded bg-amber px-5 py-2 font-bold text-studio-950 hover:bg-amber-hover disabled:opacity-50 transition"
            >
              <svg className="g-icon h-4 w-4"><use href="#icon-check" /></svg>
              {isSubmitting ? '正在创建…' : '创建镜头'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
