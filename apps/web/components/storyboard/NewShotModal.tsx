'use client';

import React, { useState } from 'react';
import { Button, Input, TextArea, Icons, Select } from '@frameforge/ui';
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
      <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex h-[50px] items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-2">
            <Icons.Plus className="h-4 w-4 text-foreground" />
            <h3 className="text-sm font-bold text-foreground">新建分镜镜头 (New Shot)</h3>
          </div>

          <Button variant="ghost" size="sm"
            onClick={() => setNewShotModalOpen(false)}
            aria-label="关闭新建镜头"
            className="text-muted-foreground hover:text-foreground"
          >
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">镜号 (Display Number)</label>
              <Input
                type="text"
                required
                value={displayNumber}
                onChange={e => setDisplayNumber(e.target.value)}
                placeholder="例如：081"
                className="w-full rounded border border-border bg-background px-3 py-2 text-foreground font-mono font-bold outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">所属篇章 / 幕</label>
              <Select
                label="篇章"
                value={sequenceId}
                onChange={value => setSequenceId(value)}
                options={sequences.map(seq => ({ value: seq.id, label: seq.display_number + ' · ' + seq.name }))}
                className="w-full rounded border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">镜头标题 / 内容概要</label>
            <Input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="例如：主大门车流与全景特写"
              className="w-full rounded border border-border bg-background px-3 py-2 text-foreground outline-none focus:border-ring"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-muted-foreground mb-1 font-medium">制作方式</label>
              <Select
                label="主要制作方式"
                value={primaryMethod}
                onChange={value => setPrimaryMethod(value)}
                options={[ { value: "live", label: "实拍 (LIVE)" }, { value: "stock", label: "购买素材 (STOCK)" }, { value: "client", label: "客户素材 (CLIENT)" }, { value: "ae", label: "AE合成 (AE)" }, { value: "mg", label: "动效 (MG)" }, { value: "three_d", label: "3D三维 (3D)" }, { value: "vfx", label: "视效 (VFX)" }, { value: "still", label: "静帧 (STILL)" }, { value: "type", label: "字卡 (TYPE)" } ]}
                className="w-full rounded border border-border bg-background px-2.5 py-2 text-foreground outline-none focus:border-ring font-mono font-semibold"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">标准景别</label>
              <Select
                label="标准景别"
                value={shotSize}
                onChange={value => setShotSize(value)}
                options={[ { value: "全景", label: "全景 (FS)" }, { value: "特写", label: "特写 (CU)" }, { value: "中景", label: "中景 (MS)" }, { value: "近景", label: "近景 (MCU)" }, { value: "远景", label: "远景 (WS)" }, { value: "大特写", label: "大特写 (ECU)" } ]}
                className="w-full rounded border border-border bg-background px-2.5 py-2 text-foreground outline-none focus:border-ring"
              />
            </div>

            <div>
              <label className="block text-muted-foreground mb-1 font-medium">规划时长 (秒)</label>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={durationSeconds}
                onChange={e => setDurationSeconds(Number(e.target.value))}
                className="w-full rounded border border-border bg-background px-2.5 py-2 text-foreground font-mono outline-none focus:border-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">画面构图与视觉描述</label>
            <TextArea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="画面主体、运镜方式与光影氛围设计..."
              className="w-full rounded border border-border bg-background p-2.5 text-foreground outline-none focus:border-ring"
            />
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">对应解说词旁白</label>
            <TextArea
              rows={2}
              value={voiceover}
              onChange={e => setVoiceover(e.target.value)}
              placeholder="本镜头对应的解说旁白或对白内容..."
              className="w-full rounded border border-border bg-background p-2.5 text-foreground outline-none focus:border-ring"
            />
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button variant="outline" size="sm"
              type="button"
              onClick={() => setNewShotModalOpen(false)}
              className="rounded border border-border px-4 py-2 font-medium text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button variant="default" size="sm"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded px-5 py-2 font-bold disabled:opacity-50 transition"
            >
              <Icons.Check className="h-4 w-4" />
              {isSubmitting ? '正在创建…' : '创建镜头'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
