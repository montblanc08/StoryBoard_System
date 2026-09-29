'use client';

import { Button, Card, Icons } from '@frameforge/ui';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { framesToTimecode, framesToSeconds } from '@frameforge/timecode';
import { getMethodStyle, getMethodLabel } from '@/lib/media-resolver';

export default function AnonymousSharePage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : '';

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeShotIndex, setActiveShotIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'wall'>('cards');

  useEffect(() => {
    if (!token) return;
    const fetchSnapshot = async () => {
      try {
        setLoading(true);
        const res = await fetch(`http://localhost:8000/api/v1/share/${token}`);
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData?.error?.message || '该分享链接不存在或已过期');
        }
        const snapshot = await res.json();
        setData(snapshot);
      } catch (err: any) {
        setError(err.message || '载入审片页面失败');
      } finally {
        setLoading(false);
      }
    };
    fetchSnapshot();
  }, [token]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground font-mono text-xs">
        <div className="flex items-center gap-3">
          <Icons.Film className="animate-spin h-5 w-5 text-foreground" />
          <span>正在载入只读审片快照...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-background text-center p-8 text-xs">
        <Icons.TriangleAlert className="h-12 w-12 text-destructive mb-3" />
        <h2 className="text-base font-bold text-foreground mb-2">无法访问审片链接</h2>
        <p className="text-muted-foreground mb-4">{error || '该链接可能已被发布者撤销或已过有效期。'}</p>
      </div>
    );
  }

  const production = data.production || {};
  const shots: any[] = data.shots || [];
  const fps = (production.fps_num || 25) / (production.fps_den || 1);
  const totalFrames = shots.reduce((acc, s) => acc + (s.duration_frames || 0), 0);
  const totalTimecode = framesToTimecode(totalFrames, fps, production.drop_frame);
  const totalSeconds = framesToSeconds(totalFrames, fps).toFixed(1);

  const activeShot = shots[activeShotIndex] || shots[0];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-[55px] items-center justify-between border-b border-border bg-card/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-accent text-accent-foreground border border-border">
            <Icons.Film />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-foreground">{production.name}</h1>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-foreground border border-border">
                只读审片版本 (FROZEN)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              {shots.length} 镜头 · {totalSeconds}s · {totalTimecode} · {production.fps_num} FPS
            </p>
          </div>
        </div>

        {/* Right View Switch & Download */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center rounded border border-border bg-background p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('cards')}
              className={`${
                viewMode === 'cards' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }`}
            >
              分镜画册 (Cards)
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode('wall')}
              className={`${
                viewMode === 'wall' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              }`}
            >
              全片视觉墙 (Wall)
            </Button>
          </div>

          {data.allow_download && (
            <Button
              size="sm"
              onClick={() => alert('正在打包下载分镜工程数据...')}
            >
              <Icons.Download className="h-4 w-4" />
              下载交付物
            </Button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {/* Active Shot Theater Monitor */}
        {activeShot && (
          <Card className="p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3 text-xs font-mono">
              <span className="font-bold text-foreground text-sm">
                SHOT {activeShot.display_number} · {activeShot.name || `镜头 ${activeShot.display_number}`}
              </span>
              <div className="flex items-center gap-3">
                <span className="rounded bg-background px-2 py-1 text-foreground border border-border">
                  {getMethodLabel(activeShot.primary_method)}
                </span>
                <span className="rounded bg-background px-2 py-1 text-foreground font-bold border border-border">
                  {activeShot.duration_frames}f ({framesToSeconds(activeShot.duration_frames, fps).toFixed(1)}s)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left: Thumbnail Plate */}
              <div className="aspect-video rounded-lg bg-gradient-to-br from-muted to-background border border-border flex flex-col items-center justify-center p-6 text-center shadow-inner">
                <span className="font-mono text-4xl font-black text-foreground/80 drop-shadow">
                  {activeShot.display_number}
                </span>
                <span className="text-xs text-muted-foreground mt-2 font-mono">
                  {activeShot.shot_size || '全景'} · {activeShot.lens_mm ? `${activeShot.lens_mm}mm` : ''} · {activeShot.movement || '固定'}
                </span>
              </div>

              {/* Right: Narrative Description & Voiceover */}
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-foreground mb-1">画面构图与视觉描述</h4>
                  <p className="text-foreground leading-relaxed bg-background p-3 rounded border border-border">
                    {activeShot.description || '暂无画面描述'}
                  </p>
                </div>

                {activeShot.voiceover && (
                  <div>
                    <h4 className="font-bold text-foreground mb-1">对应解说词旁白</h4>
                    <p className="text-foreground leading-relaxed bg-background p-3 rounded border border-border">
                      {activeShot.voiceover}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Shot Cards Grid or Wall */}
        <div>
          <h3 className="text-sm font-bold text-foreground mb-4">全部镜头列表 (点击快速切换预览)</h3>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {shots.map((s, idx) => {
                const isCurrent = idx === activeShotIndex;
                const style = getMethodStyle(s.primary_method);

                return (
                  <div
                    key={s.id || idx}
                    onClick={() => setActiveShotIndex(idx)}
                    className={`rounded-lg border overflow-hidden cursor-pointer transition p-3 space-y-2 ${
                      isCurrent
                        ? 'border-ring bg-accent'
                        : 'border-border bg-card hover:border-ring'
                    }`}
                  >
                    <div className={`aspect-video rounded bg-gradient-to-br ${style.bg} flex items-center justify-center relative p-2`}>
                      <span className="font-mono text-xl font-bold text-foreground">
                        {s.display_number}
                      </span>
                      <span className="absolute bottom-1 right-1 bg-background/80 px-1.5 py-0.5 rounded font-mono text-[10px] text-foreground">
                        {s.duration_frames}f
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-bold text-foreground truncate">{s.name || `镜头 ${s.display_number}`}</div>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">{s.description || '—'}</p>
                      {s.voiceover && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 italic">VO: {s.voiceover}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
              {shots.map((s, idx) => {
                const isCurrent = idx === activeShotIndex;
                const style = getMethodStyle(s.primary_method);

                return (
                  <div
                    key={s.id || idx}
                    onClick={() => setActiveShotIndex(idx)}
                    className={`rounded border aspect-video flex items-center justify-center cursor-pointer transition relative bg-gradient-to-br ${style.bg} ${
                      isCurrent ? 'border-ring bg-accent' : 'border-border hover:border-ring'
                    }`}
                  >
                    <span className="font-mono text-sm font-bold text-foreground">{s.display_number}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground font-mono">
        FRAMEFORGE OS · 审片安全保护 · 发布时间: {data.published_at ? new Date(data.published_at).toLocaleString() : '—'}
      </footer>
    </div>
  );
}
