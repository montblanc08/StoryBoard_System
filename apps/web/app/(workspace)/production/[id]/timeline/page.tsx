'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import type { Shot } from '@frameforge/types';
import { framesToTimecode, framesToSeconds } from '@frameforge/timecode';
import { useProduction, useShots } from '@/lib/hooks/useProduction';
import { getMethodStyle } from '@/lib/media-resolver';
import { ShotInspector } from '@/components/shot/ShotInspector';

export default function TimelinePage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [], isLoading } = useShots(id);

  const [currentFrame, setCurrentFrame] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoomScale, setZoomScale] = useState(1.5); // pixels per frame
  const [selectedShot, setSelectedShot] = useState<Shot | null>(null);

  const playIntervalRef = useRef<NodeJS.Timeout | null>(null);

  if (!production) return null;

  const fps = production.fps_num / (production.fps_den || 1);
  const totalFrames = shots.reduce((acc, s) => acc + (s.duration_frames || 0), 0);
  const totalTimecode = framesToTimecode(totalFrames, fps, production.drop_frame);
  const currentTimecode = framesToTimecode(currentFrame, fps, production.drop_frame);

  // Playhead animation
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentFrame(prev => {
          if (prev >= totalFrames) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 1;
        });
      }, 1000 / fps);
    } else if (playIntervalRef.current) {
      clearInterval(playIntervalRef.current);
    }

    return () => {
      if (playIntervalRef.current) clearInterval(playIntervalRef.current);
    };
  }, [isPlaying, totalFrames, fps]);

  // Compute accumulated shot start frames
  let accumulated = 0;
  const shotTimelineData = shots.map(s => {
    const start = accumulated;
    accumulated += s.duration_frames;
    return {
      ...s,
      startFrame: start,
      endFrame: accumulated
    };
  });

  // Current active shot under playhead
  const activeShot = shotTimelineData.find(
    s => currentFrame >= s.startFrame && currentFrame < s.endFrame
  ) || shotTimelineData[0];

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Timeline Controls & Monitor Split */}
      <div className="flex flex-1 border-b border-studio-700 bg-studio-950 overflow-hidden">
        {/* Left: Video Animatic Preview Monitor */}
        <div className="flex flex-1 flex-col items-center justify-center p-6 border-r border-studio-800 bg-studio-950/80">
          <div className="relative w-full max-w-xl aspect-video rounded-lg border border-studio-700 bg-studio-900 shadow-2xl overflow-hidden flex flex-col justify-between p-4">
            {/* Monitor Top Bar */}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="rounded bg-studio-950/80 px-2 py-0.5 text-amber font-bold border border-amber/30">
                {activeShot ? `SHOT ${activeShot.display_number}` : 'NO SHOT'}
              </span>
              <span className="text-emerald-400 font-bold bg-studio-950/80 px-2 py-0.5 rounded">
                {currentTimecode}
              </span>
            </div>

            {/* Monitor Visual Content */}
            <div className="text-center space-y-2">
              <h4 className="text-sm font-bold text-white">
                {activeShot?.name || `镜头 ${activeShot?.display_number || '001'}`}
              </h4>
              <p className="text-xs text-slate-400 line-clamp-2 max-w-md mx-auto">
                {activeShot?.description || '暂无画面描述'}
              </p>
              {activeShot?.voiceover && (
                <div className="text-xs text-amber-300/90 font-medium bg-studio-950/70 p-2 rounded max-w-md mx-auto line-clamp-2 border border-amber/20">
                  <span className="font-bold text-amber mr-1">VO:</span>
                  {activeShot.voiceover}
                </div>
              )}
            </div>

            {/* Monitor Footer */}
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>{activeShot?.shot_size || '全景'} · {activeShot?.lens_mm ? `${activeShot.lens_mm}mm` : ''}</span>
              <span>{activeShot?.primary_method?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        {/* Right: Selected Shot Inspector if open */}
        {selectedShot && (
          <ShotInspector
            shot={selectedShot}
            production={production}
            onClose={() => setSelectedShot(null)}
          />
        )}
      </div>

      {/* Timeline Controls Header */}
      <div className="flex items-center justify-between border-b border-studio-700 bg-studio-900 px-6 py-2 z-10 text-xs">
        <div className="flex items-center gap-3">
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-amber text-studio-950 hover:bg-amber-hover transition shadow"
          >
            <svg className="g-icon h-4 w-4">
              <use href={isPlaying ? '#icon-pause' : '#icon-play_arrow'} />
            </svg>
          </button>

          <button
            onClick={() => setCurrentFrame(0)}
            className="rounded border border-studio-700 px-2 py-1 text-slate-400 hover:text-white"
          >
            回退起点
          </button>

          {/* Timecode Readout */}
          <div className="flex items-center gap-2 font-mono text-sm font-bold pl-2 border-l border-studio-800">
            <span className="text-amber">{currentTimecode}</span>
            <span className="text-slate-600">/</span>
            <span className="text-slate-400">{totalTimecode}</span>
          </div>
        </div>

        {/* Zoom scale slider */}
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span>缩放:</span>
          <input
            type="range"
            min="0.5"
            max="4.0"
            step="0.1"
            value={zoomScale}
            onChange={e => setZoomScale(Number(e.target.value))}
            className="w-24 accent-amber cursor-pointer"
          />
        </div>
      </div>

      {/* Multi-Track Timeline Scroll Area */}
      <div className="h-64 overflow-x-auto overflow-y-hidden bg-studio-950 relative select-none">
        {/* Playhead Vertical Line */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-amber z-30 pointer-events-none shadow-md"
          style={{ left: `${currentFrame * zoomScale}px` }}
        >
          <div className="absolute -top-1 -left-1.5 h-3 w-3 rounded-full bg-amber shadow" />
        </div>

        {/* Timeline Tracks */}
        <div className="flex flex-col p-4 space-y-2 min-w-max">
          {/* Ruler Track */}
          <div className="h-6 flex items-center border-b border-studio-800 text-[10px] font-mono text-slate-500">
            {shotTimelineData.map(s => (
              <div
                key={s.id}
                style={{ width: `${s.duration_frames * zoomScale}px` }}
                className="border-l border-studio-800 pl-1 truncate"
              >
                {framesToTimecode(s.startFrame, fps)}
              </div>
            ))}
          </div>

          {/* Video / Shot Track */}
          <div className="h-16 flex items-center gap-0.5">
            {shotTimelineData.map(s => {
              const isSelected = selectedShot?.id === s.id;
              const isCurrent = currentFrame >= s.startFrame && currentFrame < s.endFrame;
              const style = getMethodStyle(s.primary_method);

              return (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedShot(s);
                    setCurrentFrame(s.startFrame);
                  }}
                  style={{ width: `${s.duration_frames * zoomScale}px` }}
                  className={`h-full rounded border flex flex-col justify-between p-1.5 cursor-pointer transition-all overflow-hidden bg-gradient-to-r ${style.bg} ${
                    isCurrent
                      ? 'border-amber ring-2 ring-amber/50 shadow-md'
                      : isSelected
                      ? 'border-amber'
                      : 'border-studio-700 hover:border-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono">
                    <span className="font-bold text-white drop-shadow">
                      {s.display_number}
                    </span>
                    <span className="text-slate-300">
                      {s.duration_frames}f
                    </span>
                  </div>

                  <span className="text-[10px] text-slate-200 truncate font-medium">
                    {s.name || s.description}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Voiceover Track */}
          <div className="h-10 flex items-center gap-0.5">
            {shotTimelineData.map(s => (
              <div
                key={s.id}
                style={{ width: `${s.duration_frames * zoomScale}px` }}
                className="h-full rounded border border-studio-800 bg-studio-900/80 p-1 text-[10px] text-amber-200/90 truncate flex items-center"
                title={s.voiceover}
              >
                {s.voiceover ? `VO: ${s.voiceover}` : <span className="text-slate-600">—</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
