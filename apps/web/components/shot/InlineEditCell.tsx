'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@frameforge/ui';
import { useUpdateShot } from '@/lib/hooks/useProduction';
import type { Shot } from '@frameforge/types';
import { ApiError } from '@/lib/api-client';

interface InlineEditCellProps {
  productionId: string;
  shot: Shot;
  field: keyof Shot;
  value: string | number | null;
  placeholder?: React.ReactNode;
  className?: string;
  type?: 'text' | 'number';
}

export function InlineEditCell({
  productionId,
  shot,
  field,
  value,
  placeholder,
  className = '',
  type = 'text'
}: InlineEditCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const updateShot = useUpdateShot(productionId);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (type === 'text') {
        inputRef.current.select();
      }
    }
  }, [isEditing, type]);

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent opening the inspector
    setEditValue(value !== null && value !== undefined ? String(value) : '');
    setIsEditing(true);
  };

  const saveChange = async () => {
    if (!isEditing || isSaving) return;
    
    let finalValue: string | number | null = editValue;
    if (type === 'number') {
      finalValue = editValue === '' ? null : Number(editValue);
    }

    if (finalValue === value) {
      setIsEditing(false);
      return;
    }

    try {
      setIsSaving(true);
      await updateShot.mutateAsync({
        id: shot.id,
        revision: shot.revision,
        changes: { [field]: finalValue }
      });
      setIsEditing(false);
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 409 || err.code === 'SHOT_REVISION_CONFLICT')) {
        alert('并发版本冲突：该镜头已被修改，请刷新。');
      } else {
        alert('保存失败，请重试');
      }
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation(); // prevent row keyboard selection
    if (e.key === 'Enter') {
      e.preventDefault();
      saveChange();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className={`relative ${className}`} onClick={(e) => e.stopPropagation()}>
        <Input
          ref={inputRef}
          type={type}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveChange}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="h-7 w-full min-w-[60px] px-1.5 py-0 text-xs bg-background border-ring"
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={`cursor-text rounded px-1.5 py-0.5 -mx-1.5 transition-colors hover:bg-muted ${className} ${isSaving ? 'opacity-50' : ''}`}
      title="双击进行编辑"
    >
      <div className="line-clamp-1">{value || placeholder || <span className="text-muted-foreground italic">空</span>}</div>
    </div>
  );
}
