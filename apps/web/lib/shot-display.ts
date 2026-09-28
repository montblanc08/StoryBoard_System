import type { Shot } from '@frameforge/types';

export function shotMovementLabel(
  shot: Pick<Shot, 'camera_movement'>,
  fallback = '固定'
): string {
  const value = shot.camera_movement?.type;
  return typeof value === 'string' && value.trim() ? value : fallback;
}
