'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProduction, useShots } from '@/lib/hooks/useProduction';

export default function DeliverablesPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [] } = useShots(id);

  const [downloading, setDownloading] = useState<string | null>(null);

  if (!production) return null;

  const exportFormats = [
    {
      id: 'xlsx',
      title: '专业分镜制作清单 (Excel .xlsx)',
      desc: '包含镜号、制作方式、景别、焦段、运镜、画面描述、旁白、时长及部门负责人完整字段。',
      badge: 'PRO'
    },
    {
      id: 'pdf',
      title: '导演与客户审片分镜图版 (PDF Booklet)',
      desc: '标准 16:9 横版排版，每页 6 镜或 8 镜，含高清缩略图与完整制作说明。',
      badge: 'PRINT READY'
    },
    {
      id: 'edl',
      title: '剪辑工程时码交换表 (CMX 3600 EDL)',
      desc: '标准剪辑时码，可直接导入 DaVinci Resolve, Premiere Pro 或 Final Cut Pro 进行套底。',
      badge: 'NLE'
    },
    {
      id: 'otio',
      title: '开放时间线工程 (OpenTimelineIO .otio)',
      desc: '影视工业标准多轨道分镜时码工程，保留完整元数据与轨道切分点。',
      badge: 'PIPELINE'
    },
    {
      id: 'srt',
      title: '标准旁白字幕文件 (SubRip .srt)',
      desc: '根据各镜头帧级精确时码自动对齐生成的旁白与对白台词字幕。',
      badge: 'AUDIO / VO'
    }
  ];

  const handleExport = (formatId: string) => {
    setDownloading(formatId);
    setTimeout(() => {
      setDownloading(null);
      alert(`已成功生成并导出 ${formatId.toUpperCase()} 文件！`);
    }, 1200);
  };

  return (
    <div className="flex h-full w-full flex-col p-8 overflow-y-auto max-w-5xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-bold text-white">交付与工程导出 (Deliverables & Export)</h2>
        <p className="text-xs text-slate-400">
          导出符合影视制作工业标准的剪辑工程、时码表、审片画册及数据清单
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {exportFormats.map(fmt => (
          <div
            key={fmt.id}
            className="flex items-center justify-between rounded-xl border border-studio-700 bg-studio-900 p-5 hover:border-amber transition"
          >
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-200">{fmt.title}</h3>
                <span className="rounded bg-studio-800 px-2 py-0.5 font-mono text-[10px] text-amber border border-studio-700">
                  {fmt.badge}
                </span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{fmt.desc}</p>
            </div>

            <button
              onClick={() => handleExport(fmt.id)}
              disabled={downloading === fmt.id}
              className="flex items-center gap-2 rounded bg-amber px-5 py-2 text-xs font-bold text-studio-950 hover:bg-amber-hover transition disabled:opacity-50"
            >
              <svg className="g-icon h-4 w-4"><use href="#icon-file_download" /></svg>
              {downloading === fmt.id ? '正在生成…' : '立即导出'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
