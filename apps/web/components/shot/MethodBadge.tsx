import React from 'react';
import { getMethodLabel, getMethodStyle } from '@/lib/media-resolver';
import { useAuthStore } from '@/stores/authStore';

interface MethodBadgeProps {
  method: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function MethodBadge({ method, size = 'sm', className = '' }: MethodBadgeProps) {
  const locale = useAuthStore(s => s.locale);
  const style = getMethodStyle(method);
  const label = getMethodLabel(method, locale);

  const sizeClasses =
    size === 'sm'
      ? 'text-[10px] px-1.5 py-0.5 font-mono'
      : 'text-xs px-2.5 py-1 font-mono font-medium';

  return (
    <span
      className={`inline-flex items-center gap-1 rounded border uppercase tracking-wider font-semibold shadow-sm transition ${style.border} ${style.text} bg-studio-950/80 backdrop-blur-sm ${sizeClasses} ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
