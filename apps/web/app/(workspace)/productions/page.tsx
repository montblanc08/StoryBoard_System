'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/authStore';
import type { Production } from '@frameforge/types';

export default function ProductionsPage() {
  const router = useRouter();
  const { user, logout, locale, setLocale, theme, setTheme, t } = useAuthStore();

  const [productions, setProductions] = useState<Production[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // New production form
  const [name, setName] = useState('');
  const [templateType, setTemplateType] = useState('corporate');
  const [fps, setFps] = useState(25);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [targetSeconds, setTargetSeconds] = useState(270);

  const fetchProductions = async () => {
    try {
      setLoading(true);
      const data = await apiClient<Production[]>('/api/v1/productions');
      setProductions(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductions();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const targetFrames = targetSeconds ? Math.round(targetSeconds * fps) : null;
      await apiClient<Production>('/api/v1/productions', {
        method: 'POST',
        json: {
          name,
          template_type: templateType,
          fps_num: fps,
          fps_den: 1,
          drop_frame: false,
          start_timecode_frames: Math.round(fps * 3600), // 01:00:00:00
          target_duration_frames: targetFrames,
          aspect_ratio: aspectRatio
        }
      });
      setShowModal(false);
      setName('');
      fetchProductions();
    } catch (err: any) {
      alert(err.message || '创建项目失败');
    }
  };

  return (
    <div className="min-h-screen bg-studio-950 text-slate-200">
      {/* Top Bar (50px) */}
      <header className="sticky top-0 z-30 flex h-[50px] items-center justify-between border-b border-studio-700 bg-studio-900/90 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded bg-amber-dim text-amber border border-amber/30">
            <svg className="g-icon"><use href="#icon-movie" /></svg>
          </div>
          <span className="font-bold text-sm tracking-tight text-white">{t('appName')}</span>
          <span className="rounded bg-studio-800 px-2 py-0.5 text-[11px] font-mono text-studio-600">V1.0 PRO</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <button
            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
            className="rounded border border-studio-700 px-2 py-1 hover:border-amber hover:text-amber"
          >
            {locale === 'zh-CN' ? 'EN' : '中'}
          </button>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded border border-studio-700 px-2 py-1 hover:border-amber hover:text-amber"
          >
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <div className="flex items-center gap-2 border-l border-studio-700 pl-4 text-slate-400">
            <span className="text-slate-200 font-medium">{user?.display_name || user?.email || '制作管理员'}</span>
            <button
              onClick={() => { logout(); router.push('/login'); }}
              className="text-studio-600 hover:text-film-red"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl p-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">{t('productions')}</h2>
            <p className="text-xs text-studio-600">单公司私有部署，镜头数据单一可信源 (Single Source of Truth)</p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded bg-amber px-4 py-2 text-xs font-bold text-studio-950 hover:bg-amber-hover transition"
          >
            <svg className="g-icon"><use href="#icon-add" /></svg>
            {t('newProduction')}
          </button>
        </div>

        {loading ? (
          <div className="py-20 text-center text-xs font-mono text-studio-600">
            正在载入项目库...
          </div>
        ) : productions.length === 0 ? (
          <div className="rounded-lg border border-dashed border-studio-700 p-12 text-center">
            <p className="text-slate-400 text-sm mb-4">暂无影视制作项目</p>
            <button
              onClick={() => setShowModal(true)}
              className="rounded bg-amber px-4 py-2 text-xs font-bold text-studio-950"
            >
              {t('newProduction')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {productions.map(prod => (
              <div
                key={prod.id}
                onClick={() => router.push(`/production/${prod.id}/storyboard`)}
                className="group relative cursor-pointer rounded-lg border border-studio-700 bg-studio-900 p-5 transition hover:border-amber hover:shadow-xl"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="rounded bg-studio-800 px-2 py-0.5 text-[10px] font-mono text-amber uppercase tracking-wider">
                    {prod.template_type}
                  </span>
                  <span className="text-[11px] font-mono text-studio-600">
                    {prod.fps_num} FPS · {prod.aspect_ratio}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white group-hover:text-amber transition line-clamp-2 mb-2">
                  {prod.name}
                </h3>

                <div className="flex items-center justify-between border-t border-studio-800 pt-3 text-xs text-studio-600 font-mono">
                  <span>{(prod as any).shot_count || 0} 镜头</span>
                  <span>{prod.status}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New Production Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-lg border border-studio-700 bg-studio-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-studio-700">
              <h3 className="text-sm font-bold text-white">{t('newProduction')}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white">
                <svg className="g-icon"><use href="#icon-close" /></svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">项目全称</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：天津国际农产品交易中心 · 形象宣传片"
                  className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 mb-1">制作模板类型</label>
                  <select
                    value={templateType}
                    onChange={e => setTemplateType(e.target.value)}
                    className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
                  >
                    <option value="corporate">企业宣传片 (Corporate)</option>
                    <option value="tvc">TVC 广告片 (TVC)</option>
                    <option value="film">电影长片 (Film)</option>
                    <option value="documentary">纪录片 (Documentary)</option>
                    <option value="motion_graphics">MG / 动效包装 (MG)</option>
                    <option value="vfx_3d">3D / 视效制作 (VFX & 3D)</option>
                    <option value="custom">自定义管线 (Custom)</option>
                  </select>
                </div>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                <div>
                  <label className="block text-slate-400 mb-1">目标规划片长 (秒)</label>
                  <input
                    type="number"
                    value={targetSeconds}
                    onChange={e => setTargetSeconds(Number(e.target.value))}
                    className="w-full rounded border border-studio-700 bg-studio-950 px-3 py-2 text-white outline-none focus:border-amber"
                  />
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-studio-700">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded border border-studio-700 px-4 py-2 font-medium text-slate-300 hover:bg-studio-800"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded bg-amber px-5 py-2 font-bold text-studio-950 hover:bg-amber-hover"
                >
                  创建并进入管线
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
