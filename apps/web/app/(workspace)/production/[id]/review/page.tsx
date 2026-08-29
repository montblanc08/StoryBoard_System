'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProduction, useShots, useUpdateShot } from '@/lib/hooks/useProduction';
import { StatusBadge } from '@/components/shot/StatusBadge';
import { MethodBadge } from '@/components/shot/MethodBadge';

export default function ReviewPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [] } = useShots(id);
  const updateShot = useUpdateShot(id);

  const [activeShotIndex, setActiveShotIndex] = useState(0);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState<Record<string, { id: string; user: string; text: string; time: string }[]>>({
    '001': [
      { id: 'c1', user: '李制片', text: '开篇渤海海面航拍气势不错，注意调色保持冷色调质感。', time: '10:30' }
    ]
  });

  if (!production || shots.length === 0) return null;

  const currentShot = shots[activeShotIndex] || shots[0];

  const handleApprove = async () => {
    await updateShot.mutateAsync({
      id: currentShot.id,
      revision: currentShot.revision,
      changes: { status: 'approved' }
    });
  };

  const handleRequestChanges = async () => {
    await updateShot.mutateAsync({
      id: currentShot.id,
      revision: currentShot.revision,
      changes: { status: 'changes_requested' }
    });
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    const shotNum = currentShot.display_number;
    const existing = comments[shotNum] || [];
    setComments({
      ...comments,
      [shotNum]: [
        ...existing,
        { id: String(Date.now()), user: '制作审片员', text: commentText, time: '刚刚' }
      ]
    });
    setCommentText('');
  };

  const shotComments = comments[currentShot.display_number] || [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: Shot Queue List */}
      <aside className="w-72 border-r border-studio-700 bg-studio-950 flex flex-col">
        <div className="p-4 border-b border-studio-700 bg-studio-900/60">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">审片镜头队列 ({shots.length})</h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-studio-800">
          {shots.map((shot, idx) => (
            <div
              key={shot.id}
              onClick={() => setActiveShotIndex(idx)}
              className={`p-3 cursor-pointer transition flex items-center justify-between text-xs ${
                idx === activeShotIndex
                  ? 'bg-amber-dim text-white border-l-4 border-amber'
                  : 'hover:bg-studio-900 text-slate-300'
              }`}
            >
              <div className="space-y-0.5 truncate">
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className="text-amber">{shot.display_number}</span>
                  <span className="truncate">{shot.name || `镜头 ${shot.display_number}`}</span>
                </div>
                <div className="text-[10px] text-slate-500">{shot.duration_frames}f · {shot.primary_method}</div>
              </div>

              <StatusBadge status={shot.status} />
            </div>
          ))}
        </div>
      </aside>

      {/* Center: Frame Review Monitor & Discussion */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-studio-950 p-8 space-y-6">
        {/* Monitor Frame */}
        <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-xl border border-studio-700 bg-studio-900 shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between z-10">
            <span className="font-mono text-sm font-bold text-amber">
              SHOT {currentShot.display_number}
            </span>
            <div className="flex items-center gap-2">
              <MethodBadge method={currentShot.primary_method} />
              <StatusBadge status={currentShot.status} />
            </div>
          </div>

          <div className="text-center space-y-3 z-10">
            <h2 className="text-lg font-bold text-white">{currentShot.name}</h2>
            <p className="text-xs text-slate-300 max-w-lg mx-auto leading-relaxed">{currentShot.description}</p>
            {currentShot.voiceover && (
              <div className="bg-studio-950/80 border border-amber/30 p-3 rounded text-xs text-amber-200/90 max-w-lg mx-auto">
                <span className="font-bold text-amber mr-2">旁白:</span>
                {currentShot.voiceover}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-slate-400 z-10">
            <span>{currentShot.shot_size} · {currentShot.lens_mm}mm · {currentShot.movement}</span>
            <span className="font-bold text-amber">{currentShot.duration_frames} 帧</span>
          </div>
        </div>

        {/* Approval Actions Bar */}
        <div className="flex items-center justify-center gap-4 max-w-3xl mx-auto w-full">
          <button
            onClick={handleRequestChanges}
            className="flex-1 rounded-lg border border-rose-500/30 bg-rose-500/10 py-3 text-xs font-bold text-rose-400 hover:bg-rose-500/20 transition text-center"
          >
            提出修改意见 (Request Changes)
          </button>
          <button
            onClick={handleApprove}
            className="flex-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 py-3 text-xs font-bold text-emerald-400 hover:bg-emerald-500/30 transition text-center"
          >
            通过审批 (Approve Shot)
          </button>
        </div>

        {/* Comments & Notes */}
        <div className="max-w-3xl mx-auto w-full rounded-xl border border-studio-700 bg-studio-900 p-6 space-y-4 text-xs">
          <h3 className="font-bold text-white text-sm">审片批注与意见 ({shotComments.length})</h3>

          <div className="space-y-3">
            {shotComments.map(c => (
              <div key={c.id} className="rounded border border-studio-800 bg-studio-950 p-3 space-y-1">
                <div className="flex items-center justify-between text-slate-400 font-mono text-[11px]">
                  <span className="font-bold text-slate-200">{c.user}</span>
                  <span>{c.time}</span>
                </div>
                <p className="text-slate-300">{c.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
            <input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="添加该镜头的导演审片批注..."
              className="flex-1 rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
            />
            <button
              type="submit"
              className="rounded bg-amber px-4 py-2 font-bold text-studio-950 hover:bg-amber-hover transition"
            >
              发送批注
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
