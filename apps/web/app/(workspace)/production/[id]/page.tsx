'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProduction } from '@/lib/hooks/useProduction';
import { Button, Card, Icons } from '@frameforge/ui';
import { ProjectCover } from '@/components/ProjectCover';

export default function ProjectHubPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { data: production, isLoading } = useProduction(id);

  if (isLoading || !production) return null;

  const features = [
    { name: '制作台 (Shots)', icon: Icons.LayoutGrid, href: `/production/${id}/shots`, desc: '核心分镜列表与镜头管理' },
    { name: '时间线 (Timeline)', icon: Icons.Clock, href: `/production/${id}/timeline`, desc: '剪辑节奏与动态预览' },
    { name: '故事板 (Storyboard)', icon: Icons.Image, href: `/production/${id}/storyboard`, desc: '经典连环画式预览' },
    { name: '交付与导出 (Deliverables)', icon: Icons.Download, href: `/production/${id}/deliverables`, desc: 'PDF / EDL / CSV / 视频生成' },
    // These are stubbed for future functional recovery
    { name: '旁白与对齐 (Narration)', icon: Icons.Mic, href: `/production/${id}/narration`, desc: '文本到时长自动对齐' },
    { name: '情绪板 (Moodboard)', icon: Icons.Palette, href: `/production/${id}/moodboard`, desc: '视觉参考与灵感库' },
    { name: '灯光与调度 (Lighting)', icon: Icons.Lightbulb, href: `/production/${id}/lighting`, desc: '平面与 3D 灯光分布' },
    { name: '审阅与版本 (Review)', icon: Icons.MessageSquare, href: `/production/${id}/review`, desc: '批注、版本对比与历史' },
  ];

  return (
    <div className="flex h-full flex-col bg-background/50 p-6 sm:p-12">
      <div className="mb-8 flex items-end gap-6">
        <ProjectCover name={production.name} coverMediaId={(production as any).cover_media_id} className="h-24 w-40 rounded-xl text-4xl shadow-md" />
        <div className="flex-1 pb-1">
          <div className="mb-2 inline-block rounded bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            {production.template_type}
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">{production.name}</h1>
          <div className="mt-3 flex gap-6 text-sm text-muted-foreground">
            <div>
              <span className="block font-mono text-xs uppercase text-muted-foreground/70">分辨率</span>
              <span className="font-medium text-foreground">{production.aspect_ratio}</span>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase text-muted-foreground/70">帧率</span>
              <span className="font-medium text-foreground">{production.fps_num} FPS</span>
            </div>
            <div>
              <span className="block font-mono text-xs uppercase text-muted-foreground/70">总镜头</span>
              <span className="font-medium text-foreground">{(production as any).shot_count || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {features.map(f => {
          const Icon = f.icon;
          return (
            <Card 
              key={f.name}
              onClick={() => router.push(f.href)}
              className="group flex cursor-pointer flex-col justify-between p-5 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-1 hover:ring-ring"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Icon className="h-5 w-5" />
                </div>
                <Icons.ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">{f.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
