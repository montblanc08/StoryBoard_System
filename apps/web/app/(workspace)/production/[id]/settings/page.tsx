'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProduction } from '@/lib/hooks/useProduction';
import { apiClient } from '@/lib/api-client';

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);

  const [name, setName] = useState(production?.name || '');
  const [code, setCode] = useState(production?.code || '');
  const [fps, setFps] = useState(production?.fps_num || 25);
  const [aspectRatio, setAspectRatio] = useState(production?.aspect_ratio || '16:9');
  const [isSaving, setIsSaving] = useState(false);

  if (!production) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      await apiClient(`/api/v1/productions/${id}`, {
        method: 'PATCH',
        json: {
          name,
          code,
          fps_num: fps,
          aspect_ratio: aspectRatio
        }
      });
      alert('项目设置已成功保存！');
    } catch (err: any) {
      alert(err.message || '保存设置失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (confirm(`确认归档/删除项目 "${production.name}" 吗？该操作不可逆。`)) {
      await apiClient(`/api/v1/productions/${id}`, { method: 'DELETE' });
      router.push('/productions');
    }
  };

  return (
    <div className="flex h-full w-full flex-col p-8 overflow-y-auto max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-lg font-bold text-white">项目与管线设置 (Pipeline Settings)</h2>
        <p className="text-xs text-slate-400">
          配置影视制作管线的标准帧率、画幅比例、色彩工作流及团队权限
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        <div className="rounded-xl border border-studio-700 bg-studio-900 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">基本信息</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">项目全称</label>
              <input
                type="text"
                value={name || production.name}
                onChange={e => setName(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">项目代码 (Code)</label>
              <input
                type="text"
                value={code || production.code}
                onChange={e => setCode(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white font-mono outline-none focus:border-amber uppercase"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-studio-700 bg-studio-900 p-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-200">画面规格与时码标准</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 mb-1">标准帧率 (FPS)</label>
              <select
                value={fps}
                onChange={e => setFps(Number(e.target.value))}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
              >
                <option value={24}>24 FPS (电影标准)</option>
                <option value={25}>25 FPS (欧洲/国内广播)</option>
                <option value={30}>30 FPS (网络视频)</option>
                <option value={50}>50 FPS (高帧率电视)</option>
                <option value={60}>60 FPS (高帧率商业片)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1">画幅比例 (Aspect Ratio)</label>
              <select
                value={aspectRatio}
                onChange={e => setAspectRatio(e.target.value)}
                className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
              >
                <option value="16:9">16:9 (1920×1080 / 4K UHD)</option>
                <option value="2.39:1">2.39:1 (宽银幕 Anamorphic)</option>
                <option value="9:16">9:16 (竖屏社交媒体)</option>
                <option value="4:3">4:3 (经典复古)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 rounded bg-amber px-6 py-2.5 text-xs font-bold text-studio-950 hover:bg-amber-hover transition disabled:opacity-50"
          >
            <svg className="g-icon h-4 w-4"><use href="#icon-check" /></svg>
            {isSaving ? '保存中…' : '保存设置'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-rose-400">危险操作区 (Danger Zone)</h3>
        <p className="text-slate-400">
          归档或删除项目后，所有镜头及关联资产将执行软删除标记。
        </p>
        <button
          onClick={handleDelete}
          className="rounded border border-rose-500/40 bg-rose-500/10 px-4 py-2 font-bold text-rose-400 hover:bg-rose-500/20 transition"
        >
          归档并删除本制作项目
        </button>
      </div>
    </div>
  );
}
