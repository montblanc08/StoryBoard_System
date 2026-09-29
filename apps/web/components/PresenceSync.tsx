'use client';

import { useEffect } from 'react';
import { usePresenceStore } from '@/stores/presenceStore';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';

export function PresenceSync() {
  const { isConnected, sendHeartbeat } = usePresenceStore();
  const { selectedShotIds, inspectedShotId } = useWorkspaceStore();

  useEffect(() => {
    if (!isConnected) return;

    // We consider the inspected shot or the first selected shot as the selected_shot_id
    const activeShotId = inspectedShotId || (selectedShotIds.length > 0 ? selectedShotIds[0] : null);

    // Send a heartbeat every 15 seconds to keep the session alive
    const interval = setInterval(() => {
      sendHeartbeat(activeShotId, null);
    }, 15000);

    // Also send immediately when selection changes
    sendHeartbeat(activeShotId, null);

    return () => clearInterval(interval);
  }, [isConnected, sendHeartbeat, selectedShotIds, inspectedShotId]);

  return null;
}
