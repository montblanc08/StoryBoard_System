/**
 * Media & Thumbnail Resolver for FrameForge OS
 * Maps shots to real storyboard stills or generated aesthetic visual plates
 */

// Preset palette for methods when image is loading / placeholder
export const METHOD_GRADIENTS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  live: {
    bg: 'from-emerald-950/60 via-slate-900 to-slate-950',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    glow: 'rgba(16, 185, 129, 0.15)'
  },
  stock: {
    bg: 'from-amber-950/60 via-slate-900 to-slate-950',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    glow: 'rgba(245, 158, 11, 0.15)'
  },
  client: {
    bg: 'from-blue-950/60 via-slate-900 to-slate-950',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    glow: 'rgba(59, 130, 246, 0.15)'
  },
  ae: {
    bg: 'from-indigo-950/60 via-slate-900 to-slate-950',
    border: 'border-indigo-500/30',
    text: 'text-indigo-400',
    glow: 'rgba(99, 102, 241, 0.15)'
  },
  mg: {
    bg: 'from-violet-950/60 via-slate-900 to-slate-950',
    border: 'border-violet-500/30',
    text: 'text-violet-400',
    glow: 'rgba(139, 92, 246, 0.15)'
  },
  three_d: {
    bg: 'from-cyan-950/60 via-slate-900 to-slate-950',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    glow: 'rgba(6, 182, 212, 0.15)'
  },
  vfx: {
    bg: 'from-rose-950/60 via-slate-900 to-slate-950',
    border: 'border-rose-500/30',
    text: 'text-rose-400',
    glow: 'rgba(244, 63, 94, 0.15)'
  },
  archive: {
    bg: 'from-yellow-950/60 via-slate-900 to-slate-950',
    border: 'border-yellow-500/30',
    text: 'text-yellow-400',
    glow: 'rgba(234, 179, 8, 0.15)'
  },
  still: {
    bg: 'from-teal-950/60 via-slate-900 to-slate-950',
    border: 'border-teal-500/30',
    text: 'text-teal-400',
    glow: 'rgba(20, 184, 166, 0.15)'
  },
  type: {
    bg: 'from-fuchsia-950/60 via-slate-900 to-slate-950',
    border: 'border-fuchsia-500/30',
    text: 'text-fuchsia-400',
    glow: 'rgba(217, 70, 239, 0.15)'
  }
};

export function getMethodStyle(method: string) {
  const m = (method || 'live').toLowerCase();
  return METHOD_GRADIENTS[m] || METHOD_GRADIENTS.live;
}

export function getMethodLabel(method: string, locale: 'zh-CN' | 'en-US' = 'zh-CN'): string {
  const m = (method || 'live').toLowerCase();
  const dictZh: Record<string, string> = {
    live: '实拍 LIVE',
    stock: '素材 STOCK',
    client: '客户 CLIENT',
    archive: '历史资料 ARCHIVE',
    still: '静帧 STILL',
    ae: 'AE合成 AE',
    mg: '动效 MG',
    three_d: '3D三维 3D',
    vfx: '视效 VFX',
    type: '字卡 TYPE'
  };

  const dictEn: Record<string, string> = {
    live: 'LIVE SHOOT',
    stock: 'STOCK FOOTAGE',
    client: 'CLIENT ASSET',
    archive: 'ARCHIVE',
    still: 'STILL FRAME',
    ae: 'AE COMP',
    mg: 'MOTION GRAPHICS',
    three_d: '3D ANIMATION',
    vfx: 'VFX SHOT',
    type: 'TITLE CARD'
  };

  return (locale === 'zh-CN' ? dictZh[m] : dictEn[m]) || method.toUpperCase();
}

export function getStatusBadge(status: string) {
  switch (status) {
    case 'approved':
      return { label: '已审批', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    case 'review':
      return { label: '待审片', bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    case 'changes_requested':
      return { label: '需修改', bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
    case 'in_progress':
      return { label: '制作中', bg: 'bg-sky-500/10 text-sky-400 border-sky-500/30' };
    case 'locked':
      return { label: '已锁定', bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30' };
    default:
      return { label: '规划中', bg: 'bg-slate-500/10 text-slate-400 border-slate-700' };
  }
}
