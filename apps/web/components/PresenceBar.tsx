'use client';

import React, { useEffect } from 'react';
import { usePresenceStore } from '@/stores/presenceStore';
import { useAuthStore } from '@/stores/authStore';

interface PresenceBarProps {
  productionId: string;
}

export function PresenceBar({ productionId }: PresenceBarProps) {
  const { user } = useAuthStore();
  const { users, connect, disconnect, isConnected } = usePresenceStore();

  useEffect(() => {
    if (productionId && user) {
      connect(productionId, user.id, user.display_name || user.email);
    }
    return () => {
      disconnect();
    };
  }, [productionId, user, connect, disconnect]);

  if (!users || users.length === 0) return null;

  // Filter out the current user if we only want to show OTHERS, 
  // but for now let's just show everyone to prove it works.
  
  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-accent/50 rounded-full border border-border text-xs transition-opacity duration-300" style={{ opacity: isConnected ? 1 : 0.5 }}>
      <div className="flex -space-x-1.5 overflow-hidden">
        {users.map(u => (
          <div
            key={u.session_id}
            title={`${u.user_name} (${u.state})`}
            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] text-white ring-2 ring-background shrink-0"
            style={{ backgroundColor: u.color || '#3B82F6' }}
          >
            {u.user_name.slice(0, 1).toUpperCase()}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-muted-foreground font-medium ml-1">
        {users.length} {users.length === 1 ? '在线' : '人协作'}
      </span>
    </div>
  );
}
