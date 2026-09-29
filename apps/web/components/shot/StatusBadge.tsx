import React from 'react';
import { Badge } from '@frameforge/ui';
import { getStatusBadge } from '@/lib/media-resolver';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const badge = getStatusBadge(status);

  return (
    <Badge variant="outline"
      className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[10px] font-mono tracking-wider ${badge.bg} ${className}`}
    >
      {badge.label}
    </Badge>
  );
}
