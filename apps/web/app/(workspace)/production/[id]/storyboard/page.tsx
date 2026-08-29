'use client';

import React, { useMemo, useEffect } from 'react';
import { useParams } from 'next/navigation';
import type { Sequence, Shot } from '@frameforge/types';
import { useProduction, useShots } from '@/lib/hooks/useProduction';
import { useWorkspaceStore } from '@/stores/useWorkspaceStore';
import { StoryboardHeader } from '@/components/storyboard/StoryboardHeader';
import { StoryboardGrid } from '@/components/storyboard/StoryboardGrid';
import { WallView } from '@/components/storyboard/WallView';
import { ShotInspector } from '@/components/shot/ShotInspector';
import { BulkActionToolbar } from '@/components/storyboard/BulkActionToolbar';
import { VOTimingModal } from '@/components/storyboard/VOTimingModal';
import { NewShotModal } from '@/components/storyboard/NewShotModal';

export default function StoryboardPage() {
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';

  const { data: production } = useProduction(id);
  const { data: shots = [], isLoading } = useShots(id);

  const {
    viewMode,
    filters,
    selectedShotIds,
    selectShot,
    clearSelection,
    inspectedShotId,
    isInspectorOpen,
    openInspector,
    closeInspector,
    toggleInspector
  } = useWorkspaceStore();

  // Extract unique sequences or mock 4 standard sequences from Tianjin dataset
  const sequences: Sequence[] = useMemo(() => {
    return [
      { id: 'seq-1', production_id: id, display_number: 'SEQ010', name: '篇章一｜强强联手·战略启航', description: '', sort_index: 1000, created_at: '', updated_at: '' },
      { id: 'seq-2', production_id: id, display_number: 'SEQ020', name: '篇章二｜区位优势·立体交通', description: '', sort_index: 2000, created_at: '', updated_at: '' },
      { id: 'seq-3', production_id: id, display_number: 'SEQ030', name: '篇章三｜规划引领·产业高地', description: '', sort_index: 3000, created_at: '', updated_at: '' },
      { id: 'seq-4', production_id: id, display_number: 'SEQ040', name: '篇章四｜数字赋能·智慧运营', description: '', sort_index: 4000, created_at: '', updated_at: '' }
    ];
  }, [id]);

  // Enrich shots with sequence mapping if not set
  const enrichedShots: Shot[] = useMemo(() => {
    return shots.map((s, idx) => {
      if (s.sequence_id) return s;
      const seqIdx = Math.floor(idx / 20) % sequences.length;
      return {
        ...s,
        sequence_id: sequences[seqIdx]?.id || sequences[0]?.id
      };
    });
  }, [shots, sequences]);

  // Filtered shots
  const filteredShots = useMemo(() => {
    return enrichedShots.filter(s => {
      if (filters.sequenceId !== 'all' && s.sequence_id !== filters.sequenceId) {
        return false;
      }
      if (filters.primaryMethod !== 'all' && (s.primary_method || '').toLowerCase() !== filters.primaryMethod.toLowerCase()) {
        return false;
      }
      if (filters.status !== 'all' && (s.status || '').toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }
      if (filters.searchQuery) {
        const q = filters.searchQuery.toLowerCase();
        const matchNum = (s.display_number || '').toLowerCase().includes(q);
        const matchName = (s.name || '').toLowerCase().includes(q);
        const matchDesc = (s.description || '').toLowerCase().includes(q);
        const matchVo = (s.voiceover || '').toLowerCase().includes(q);
        const matchOwner = (s.owner_id || '').toLowerCase().includes(q);
        if (!matchNum && !matchName && !matchDesc && !matchVo && !matchOwner) {
          return false;
        }
      }
      return true;
    });
  }, [enrichedShots, filters]);

  const allFilteredIds = useMemo(() => filteredShots.map(s => s.id), [filteredShots]);

  // Currently inspected shot
  const activeInspectedShot = useMemo(() => {
    return enrichedShots.find(s => s.id === inspectedShotId) || null;
  }, [enrichedShots, inspectedShotId]);

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs/textareas
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'Escape') {
        clearSelection();
        closeInspector();
      } else if (e.key === 'i' || e.key === 'I') {
        toggleInspector();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearSelection, closeInspector, toggleInspector]);

  const handleSelectShot = (shotId: string, e: React.MouseEvent) => {
    const isShift = e.shiftKey;
    const isCtrlOrCmd = e.ctrlKey || e.metaKey;
    selectShot(shotId, isShift, isCtrlOrCmd, allFilteredIds);
  };

  const handleInspectShot = (shotId: string) => {
    openInspector(shotId);
  };

  if (!production) return null;

  const nextShotNumber = `${(enrichedShots.length + 1).toString().padStart(3, '0')}`;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Sticky Header & Filter Toolbar */}
      <StoryboardHeader
        production={production}
        sequences={sequences}
        shots={enrichedShots}
        filteredShots={filteredShots}
      />

      {/* Main View Area + Inspector Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Scrollable Storyboard Grid / Wall */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex h-64 items-center justify-center font-mono text-xs text-slate-500">
              <svg className="g-icon animate-spin h-5 w-5 mr-2 text-amber"><use href="#icon-movie" /></svg>
              正在载入分镜画面...
            </div>
          ) : viewMode === 'wall' ? (
            <WallView
              production={production}
              shots={filteredShots}
              onSelectShot={handleSelectShot}
              onInspectShot={handleInspectShot}
            />
          ) : (
            <StoryboardGrid
              production={production}
              sequences={sequences}
              shots={filteredShots}
              onSelectShot={handleSelectShot}
              onInspectShot={handleInspectShot}
            />
          )}
        </div>

        {/* Shot Inspector Side Panel */}
        {isInspectorOpen && activeInspectedShot && (
          <ShotInspector
            shot={activeInspectedShot}
            production={production}
            onClose={closeInspector}
          />
        )}
      </div>

      {/* Multi-Selection Bulk Action Bar */}
      <BulkActionToolbar
        production={production}
        allShotIds={allFilteredIds}
      />

      {/* VO Auto-Timing Engine Modal */}
      <VOTimingModal
        production={production}
        shots={enrichedShots}
      />

      {/* New Shot Modal */}
      <NewShotModal
        production={production}
        sequences={sequences}
        nextNumber={nextShotNumber}
      />
    </div>
  );
}
