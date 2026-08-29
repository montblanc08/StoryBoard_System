'use client';

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
      <div className="flex h-screen w-screen items-center justify-center bg-studio-950 text-slate-500 font-mono text-xs">
        <div className="flex items-center gap-3">
          <svg className="g-icon animate-spin h-5 w-5 text-amber"><use href="#icon-movie" /></svg>
          <span>正在载入只读审片快照...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-studio-950 text-center p-8 text-xs">
        <svg className="g-icon h-12 w-12 text-rose-500 mb-3"><use href="#icon-warning" /></svg>
        <h2 className="text-base font-bold text-white mb-2">无法访问审片链接</h2>
        <p className="text-slate-400 mb-4">{error || '该链接可能已被发布者撤销或已过有效期。'}</p>
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
    <div className="min-h-screen bg-studio-950 text-slate-200 flex flex-col font-sans select-none">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex h-[55px] items-center justify-between border-b border-studio-700 bg-studio-900/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-dim text-amber border border-amber/30">
            <svg className="g-icon"><use href="#icon-movie" /></svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-sm text-white">{production.name}</h1>
              <span className="rounded bg-studio-800 px-1.5 py-0.5 text-[10px] font-mono text-amber border border-studio-700">
                只读审片版本 (FROZEN)
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {shots.length} 镜头 · {totalSeconds}s · {totalTimecode} · {production.fps_num} FPS
            </p>
          </div>
        </div>

        {/* Right View Switch & Download */}
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center rounded border border-studio-700 bg-studio-950 p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1 rounded transition font-medium ${
                viewMode === 'cards' ? 'bg-amber text-studio-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              分镜画册 (Cards)
            </button>
            <button
              onClick={() => setViewMode('wall')}
              className={`px-3 py-1 rounded transition font-medium ${
                viewMode === 'wall' ? 'bg-amber text-studio-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              全片视觉墙 (Wall)
            </button>
          </div>

          {data.allow_download && (
            <button
              onClick={() => alert('正在打包下载分镜工程数据...')}
              className="flex items-center gap-1.5 rounded bg-amber px-4 py-1.5 font-bold text-studio-950 hover:bg-amber-hover transition"
            >
              <svg className="g-icon h-4 w-4"><use href="#icon-file_download" /></svg>
              下载交付物
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 space-y-8">
        {/* Active Shot Theater Monitor */}
        {activeShot && (
          <div className="rounded-xl border border-studio-700 bg-studio-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-studio-800 pb-3 text-xs font-mono">
              <span className="font-bold text-amber text-sm">
                SHOT {activeShot.display_number} · {activeShot.name || `镜头 ${activeShot.display_number}`}
              </span>
              <div className="flex items-center gap-3">
                <span className="rounded bg-studio-950 px-2 py-1 text-slate-300 border border-studio-700">
                  {getMethodLabel(activeShot.primary_method)}
                </span>
                <span className="rounded bg-studio-950 px-2 py-1 text-amber font-bold border border-amber/30">
                  {activeShot.duration_frames}f ({framesToSeconds(activeShot.duration_frames, fps).toFixed(1)}s)
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              {/* Left: Thumbnail Plate */}
              <div className="aspect-video rounded-lg bg-gradient-to-br from-studio-800 to-studio-950 border border-studio-700 flex flex-col items-center justify-center p-6 text-center shadow-inner">
                <span className="font-mono text-4xl font-black text-amber/80 drop-shadow">
                  {activeShot.display_number}
                </span>
                <span className="text-xs text-slate-400 mt-2 font-mono">
                  {activeShot.shot_size || '全景'} · {activeShot.lens_mm ? `${activeShot.lens_mm}mm` : ''} · {activeShot.movement || '固定'}
                </span>
              </div>

              {/* Right: Narrative Description & Voiceover */}
              <div className="space-y-4 text-xs">
                <div>
                  <h4 className="font-bold text-slate-300 mb-1">画面构图与视觉描述</h4>
                  <p className="text-slate-300 leading-relaxed bg-studio-950 p-3 rounded border border-studio-800">
                    {activeShot.description || '暂无画面描述'}
                  </p>
                </div>

                {activeShot.voiceover && (
                  <div>
                    <h4 className="font-bold text-amber mb-1">对应解说词旁白</h4>
                    <p className="text-amber-200/90 leading-relaxed bg-studio-950 p-3 rounded border border-amber/30">
                      {activeShot.voiceover}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Shot Cards Grid or Wall */}
        <div>
          <h3 className="text-sm font-bold text-white mb-4">全部镜头列表 (点击快速切换预览)</h3>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {shots.map((s, idx) => {
                const isCurrent = idx === activeShotIndex;
                const style = getMethodStyle(s.primary_method);

                return (
                  <div
                    key={s.id || idx}
                    onClick={() => setActiveShotIndex(idx)}
                    className={`rounded-lg border bg-studio-900 overflow-hidden cursor-pointer transition p-3 space-y-2 ${
                      isCurrent
                        ? 'border-amber ring-2 ring-amber/50 bg-studio-850'
                        : 'border-studio-700 hover:border-slate-400'
                    }`}
                  >
                    <div className={`aspect-video rounded bg-gradient-to-br ${style.bg} flex items-center justify-center relative p-2`}>
                      <span className="font-mono text-xl font-bold text-amber">
                        {s.display_number}
                      </span>
                      <span className="absolute bottom-1 right-1 bg-studio-950/80 px-1.5 py-0.5 rounded font-mono text-[10px] text-amber">
                        {s.duration_frames}f
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="font-bold text-slate-200 truncate">{s.name || `镜头 ${s.display_number}`}</div>
                      <p className="text-[11px] text-slate-400 line-clamp-2">{s.description || '—'}</p>
                      {s.voiceover && (
                        <p className="text-[11px] text-amber-200/80 line-clamp-1 italic">VO: {s.voiceover}</p>
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
                      isCurrent ? 'border-amber ring-2 ring-amber' : 'border-studio-700 hover:border-slate-300'
                    }`}
                  >
                    <span className="font-mono text-sm font-bold text-amber">{s.display_number}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-studio-800 py-4 text-center text-xs text-slate-500 font-mono">
        FRAMEFORGE OS · 审片安全保护 · 发布时间: {data.published_at ? new Date(data.published_at).toLocaleString() : '—'}
      </footer>
    </div>
  );
}
