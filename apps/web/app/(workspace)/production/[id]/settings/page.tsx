'use client';

import { Button, Card, Field, Icons, Input, Select } from '@frameforge/ui';

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
        <h2 className="text-lg font-bold text-foreground">项目与管线设置 (Pipeline Settings)</h2>
        <p className="text-xs text-muted-foreground">
          配置影视制作管线的标准帧率、画幅比例、色彩工作流及团队权限
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">基本信息</h3>

          <div className="grid grid-cols-2 gap-4">
            <Field label="项目全称">
              <Input
                type="text"
                value={name || production.name}
                onChange={e => setName(e.target.value)}
              />
            </Field>

            <Field label="项目代码 (Code)">
              <Input
                type="text"
                value={code || production.code}
                onChange={e => setCode(e.target.value)}
                className="font-mono uppercase"
              />
            </Field>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-sm font-bold text-foreground">画面规格与时码标准</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              <span>标准帧率 (FPS)</span>
              <Select
                label="标准帧率 (FPS)"
                value={String(fps)}
                onChange={value => setFps(Number(value))}
                options={[
                  { value: '24', label: '24 FPS (电影标准)' },
                  { value: '25', label: '25 FPS (欧洲/国内广播)' },
                  { value: '30', label: '30 FPS (网络视频)' },
                  { value: '50', label: '50 FPS (高帧率电视)' },
                  { value: '60', label: '60 FPS (高帧率商业片)' }
                ]}
              />
            </div>

            <div className="grid min-w-0 gap-2 text-sm font-medium text-foreground">
              <span>画幅比例 (Aspect Ratio)</span>
              <Select
                label="画幅比例 (Aspect Ratio)"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={[
                  { value: '16:9', label: '16:9 (1920×1080 / 4K UHD)' },
                  { value: '2.39:1', label: '2.39:1 (宽银幕 Anamorphic)' },
                  { value: '9:16', label: '9:16 (竖屏社交媒体)' },
                  { value: '4:3', label: '4:3 (经典复古)' }
                ]}
              />
            </div>
          </div>
        </Card>

        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="submit"
            disabled={isSaving}
          >
            <Icons.Check className="h-4 w-4" />
            {isSaving ? '保存中…' : '保存设置'}
          </Button>
        </div>
      </form>

      {/* Danger Zone */}
      <Card className="border-destructive/30 bg-destructive/5 p-6 space-y-4 text-xs">
        <h3 className="text-sm font-bold text-destructive">危险操作区 (Danger Zone)</h3>
        <p className="text-muted-foreground">
          归档或删除项目后，所有镜头及关联资产将执行软删除标记。
        </p>
        <Button
          variant="destructive"
          onClick={handleDelete}
        >
          归档并删除本制作项目
        </Button>
      </Card>
    </div>
  );
}
