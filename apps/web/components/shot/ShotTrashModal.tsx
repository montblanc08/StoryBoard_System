'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Icons } from '@frameforge/ui';
import { apiClient } from '@/lib/api-client';

interface TrashShot {
  id: string;
  display_number: string;
  name: string | null;
  deleted_at: string;
}

interface ShotTrashModalProps {
  productionId: string;
  onClose: () => void;
}

export function ShotTrashModal({ productionId, onClose }: ShotTrashModalProps) {
  const queryClient = useQueryClient();
  const [actingOn, setActingOn] = useState<string | null>(null);

  const { data: trashShots = [], isLoading } = useQuery<TrashShot[]>({
    queryKey: ['production', productionId, 'trash'],
    queryFn: () => apiClient(`/api/v1/productions/${productionId}/shots/trash`),
  });

  const restoreMutation = useMutation({
    mutationFn: (shotId: string) => apiClient(`/api/v1/shots/${shotId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', productionId, 'trash'] });
      queryClient.invalidateQueries({ queryKey: ['production', productionId, 'shots'] });
    }
  });

  const purgeMutation = useMutation({
    mutationFn: (shotId: string) => apiClient(`/api/v1/shots/${shotId}/purge`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['production', productionId, 'trash'] });
    }
  });

  const handleRestore = async (shotId: string) => {
    setActingOn(shotId);
    try {
      await restoreMutation.mutateAsync(shotId);
    } finally {
      setActingOn(null);
    }
  };

  const handlePurge = async (shotId: string) => {
    if (!confirm('确定彻底删除该镜头吗？此操作不可逆。')) return;
    setActingOn(shotId);
    try {
      await purgeMutation.mutateAsync(shotId);
    } finally {
      setActingOn(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border p-4">
          <div className="flex items-center gap-2 text-foreground">
            <Icons.Trash2 className="h-5 w-5" />
            <h2 className="font-bold">镜头废纸篓</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="关闭">
            <Icons.X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="py-12 text-center text-xs font-mono text-muted-foreground">正在加载废纸篓...</div>
          ) : trashShots.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              废纸篓是空的。<br />已删除的镜头将保留 30 天，随后被彻底清理。
            </div>
          ) : (
            <div className="space-y-2">
              {trashShots.map(shot => (
                <div key={shot.id} className="flex items-center justify-between rounded-lg border border-border bg-background p-3 text-sm">
                  <div>
                    <div className="font-mono font-bold text-foreground">{shot.display_number}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      删除时间: {new Date(shot.deleted_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => handleRestore(shot.id)}
                      disabled={actingOn === shot.id}
                    >
                      <Icons.Undo2 className="mr-2 h-4 w-4" />
                      恢复
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm" 
                      onClick={() => handlePurge(shot.id)}
                      disabled={actingOn === shot.id}
                    >
                      彻底删除
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
