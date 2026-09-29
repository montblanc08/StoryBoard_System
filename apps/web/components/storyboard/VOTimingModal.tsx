'use client';

import React, { useMemo, useState } from 'react';
import { Button, Input, Icons } from '@frameforge/ui';
import type { Production, Shot } from '@frameforge/types';
import {
  calculateVOTiming,
  DEFAULT_PUNCTUATION_WEIGHTS,
  framesToSeconds,
  framesToTimecode
} from '@frameforge/timecode';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { useUpdateShot } from '@/lib/hooks/useProduction';

interface VOTimingModalProps {
  production: Production;
  shots: Shot[];
}

export function VOTimingModal({ production, shots }: VOTimingModalProps) {
  const { isVOTimingModalOpen, setVOTimingModalOpen } = useWorkspaceStore();
  const updateShot = useUpdateShot(production.id);

  const fps = production.fps_num / (production.fps_den || 1);
  const defaultTargetFrames = production.target_duration_frames || Math.round(270 * fps);

  const [targetFrames, setTargetFrames] = useState(defaultTargetFrames);
  const [weights, setWeights] = useState(DEFAULT_PUNCTUATION_WEIGHTS);
  const [isApplying, setIsApplying] = useState(false);

  // Compute timing plan
  const computedShots = useMemo(() => {
    const timingInputs = shots.map(s => ({
      id: s.id,
      voiceover: s.voice_over || '',
      locked: Boolean(s.timing_locked),
      duration_frames: s.duration_frames
    }));

    const calculated = calculateVOTiming(timingInputs, targetFrames, fps, weights);
    const map = new Map(calculated.map(c => [c.id, c.duration_frames]));

    return shots.map(s => {
      const newDuration = map.get(s.id) || s.duration_frames;
      return {
        ...s,
        proposed_frames: newDuration,
        delta_frames: newDuration - s.duration_frames
      };
    });
  }, [shots, targetFrames, fps, weights]);

  if (!isVOTimingModalOpen) return null;

  const lockedCount = shots.filter(s => s.timing_locked).length;
  const targetSeconds = framesToSeconds(targetFrames, fps).toFixed(1);
  const totalProposedFrames = computedShots.reduce((acc, s) => acc + s.proposed_frames, 0);

  const handleApply = async () => {
    try {
      setIsApplying(true);
      for (const s of computedShots) {
        if (!s.timing_locked && s.delta_frames !== 0) {
          await updateShot.mutateAsync({
            id: s.id,
            revision: s.revision,
            changes: { duration_frames: s.proposed_frames }
          });
        }
      }
      setVOTimingModalOpen(false);
    } catch (err: any) {
      alert(err.message || '应用旁白计时失败');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex h-[85vh] w-full max-w-4xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex h-[55px] items-center justify-between border-b border-border bg-background px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-foreground border border-border">
              <Icons.Clock3 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">旁白自动计时</h3>
              <p className="text-[11px] text-muted-foreground">
                依据旁白字数与标点停顿权重，最大余数法严格分配总帧数，无累计漂移
              </p>
            </div>
          </div>

          <Button variant="ghost" size="sm"
            onClick={() => setVOTimingModalOpen(false)}
            aria-label="关闭旁白计时"
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Icons.X className="h-5 w-5" />
          </Button>
        </div>

        {/* Modal Config Bar */}
        <div className="grid grid-cols-3 gap-4 border-b border-border bg-background/50 p-4 text-xs">
          <div>
            <label className="block text-muted-foreground mb-1 font-medium">规划目标总时长</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={Math.round(framesToSeconds(targetFrames, fps))}
                onChange={e => setTargetFrames(Math.round(Number(e.target.value) * fps))}
                className="w-24 rounded border border-border bg-background px-2.5 py-1.5 text-foreground font-mono outline-none focus:border-ring"
              />
              <span className="text-muted-foreground">秒 ({targetFrames} 帧)</span>
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">标点停顿权重 (逗号 / 句号)</label>
            <div className="flex items-center gap-2 text-foreground font-mono">
              <span>逗号 +{weights.comma}f</span>
              <span className="text-muted-foreground">|</span>
              <span>句号 +{weights.period}f</span>
            </div>
          </div>

          <div>
            <label className="block text-muted-foreground mb-1 font-medium">锁定镜头保护</label>
            <div className="flex items-center gap-2 font-mono">
              <span className="text-foreground font-bold">{lockedCount}</span> 个镜头已锁定时长（不参与调整）
            </div>
          </div>
        </div>

        {/* Preview Table */}
        <div className="flex-1 overflow-y-auto p-4">
          <table className="w-full text-left text-xs border-collapse font-mono">
            <thead>
              <tr className="border-b border-border text-muted-foreground pb-2">
                <th className="py-2 px-3">镜号</th>
                <th className="py-2 px-3">旁白解说词</th>
                <th className="py-2 px-3 text-right">字数</th>
                <th className="py-2 px-3 text-right">原时长</th>
                <th className="py-2 px-3 text-right">计算后时长</th>
                <th className="py-2 px-3 text-right">帧数变化</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {computedShots.map(s => {
                const voClean = (s.voice_over || '').trim();
                const charCount = voClean.replace(/\s+/g, '').length;
                const oldSec = framesToSeconds(s.duration_frames, fps).toFixed(1);
                const newSec = framesToSeconds(s.proposed_frames, fps).toFixed(1);

                return (
                  <tr key={s.id} className="hover:bg-muted/50 transition">
                    <td className="py-2 px-3 font-bold text-foreground">
                      {s.display_number}
                      {s.timing_locked && (
                        <span className="ml-1 text-[10px] text-foreground">[LOCKED]</span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-sans text-foreground max-w-xs truncate">
                      {s.voice_over || <span className="text-muted-foreground italic">无旁白</span>}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {charCount}
                    </td>
                    <td className="py-2 px-3 text-right text-muted-foreground">
                      {s.duration_frames}f ({oldSec}s)
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-foreground">
                      {s.proposed_frames}f ({newSec}s)
                    </td>
                    <td className="py-2 px-3 text-right font-bold">
                      {s.delta_frames > 0 ? (
                        <span className="text-emerald-400">+{s.delta_frames}f</span>
                      ) : s.delta_frames < 0 ? (
                        <span className="text-rose-400">{s.delta_frames}f</span>
                      ) : (
                        <span className="text-muted-foreground">0f</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-border bg-background px-6 py-3 text-xs">
          <div className="font-mono text-muted-foreground">
            总计算分配帧数: <span className="font-bold text-foreground">{totalProposedFrames}f</span> ({framesToSeconds(totalProposedFrames, fps).toFixed(1)}s)
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm"
              onClick={() => setVOTimingModalOpen(false)}
              className="rounded border border-border px-4 py-2 text-foreground hover:bg-muted"
            >
              取消
            </Button>
            <Button variant="default" size="sm"
              onClick={handleApply}
              disabled={isApplying}
              className="flex items-center gap-1.5 rounded px-5 py-2 font-bold disabled:opacity-50 transition"
            >
              <Icons.Check className="h-4 w-4" />
              {isApplying ? '正在批量写入…' : '应用计算结果到所有镜头'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
