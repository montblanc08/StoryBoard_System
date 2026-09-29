'use client';

import { Button, Card, Input } from '@frameforge/ui';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProduction, useShots, useUpdateShot } from '@/lib/hooks/useProduction';
import { StatusBadge } from '@/components/shot/StatusBadge';
import { MethodBadge } from '@/components/shot/MethodBadge';
import { shotMovementLabel } from '@/lib/shot-display';

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
      <aside className="w-72 border-r border-border bg-background flex flex-col">
        <div className="p-4 border-b border-border bg-card/60">
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">审片镜头队列 ({shots.length})</h3>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-border">
          {shots.map((shot, idx) => (
            <div
              key={shot.id}
              onClick={() => setActiveShotIndex(idx)}
              className={`p-3 cursor-pointer transition flex items-center justify-between text-xs ${
                idx === activeShotIndex
                  ? 'bg-accent text-accent-foreground border-l-4 border-ring'
                  : 'hover:bg-accent text-foreground'
              }`}
            >
              <div className="space-y-0.5 truncate">
                <div className="flex items-center gap-2 font-mono font-bold">
                  <span className="text-foreground">{shot.display_number}</span>
                  <span className="truncate">{shot.name || `镜头 ${shot.display_number}`}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{shot.duration_frames}f · {shot.primary_method}</div>
              </div>

              <StatusBadge status={shot.status} />
            </div>
          ))}
        </div>
      </aside>

      {/* Center: Frame Review Monitor & Discussion */}
      <div className="flex-1 flex flex-col overflow-y-auto bg-background p-8 space-y-6">
        {/* Monitor Frame */}
        <div className="relative w-full max-w-3xl mx-auto aspect-video rounded-xl border border-border bg-card shadow-2xl p-6 flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between z-10">
            <span className="font-mono text-sm font-bold text-foreground">
              SHOT {currentShot.display_number}
            </span>
            <div className="flex items-center gap-2">
              <MethodBadge method={currentShot.primary_method} />
              <StatusBadge status={currentShot.status} />
            </div>
          </div>

          <div className="text-center space-y-3 z-10">
            <h2 className="text-lg font-bold text-foreground">{currentShot.name}</h2>
            <p className="text-xs text-foreground max-w-lg mx-auto leading-relaxed">{currentShot.description}</p>
            {currentShot.voice_over && (
              <div className="bg-background/80 border border-border p-3 rounded text-xs text-foreground max-w-lg mx-auto">
                <span className="font-bold text-foreground mr-2">旁白:</span>
                {currentShot.voice_over}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-xs font-mono text-muted-foreground z-10">
            <span>{currentShot.shot_size} · {currentShot.lens_mm}mm · {shotMovementLabel(currentShot)}</span>
            <span className="font-bold text-foreground">{currentShot.duration_frames} 帧</span>
          </div>
        </div>

        {/* Approval Actions Bar */}
        <div className="flex items-center justify-center gap-4 max-w-3xl mx-auto w-full">
          <Button
            variant="destructive"
            onClick={handleRequestChanges}
            className="flex-1"
          >
            提出修改意见 (Request Changes)
          </Button>
          <Button
            onClick={handleApprove}
            className="flex-1"
          >
            通过审批 (Approve Shot)
          </Button>
        </div>

        {/* Comments & Notes */}
        <Card className="max-w-3xl mx-auto w-full p-6 space-y-4 text-xs">
          <h3 className="font-bold text-foreground text-sm">审片批注与意见 ({shotComments.length})</h3>

          <div className="space-y-3">
            {shotComments.map(c => (
              <div key={c.id} className="rounded border border-border bg-background p-3 space-y-1">
                <div className="flex items-center justify-between text-muted-foreground font-mono text-[11px]">
                  <span className="font-bold text-foreground">{c.user}</span>
                  <span>{c.time}</span>
                </div>
                <p className="text-foreground">{c.text}</p>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddComment} className="flex gap-2 pt-2">
            <Input
              type="text"
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="添加该镜头的导演审片批注..."
              className="flex-1"
            />
            <Button
              type="submit"
            >
              发送批注
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
