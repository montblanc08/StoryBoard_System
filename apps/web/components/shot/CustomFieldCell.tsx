'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Select, TextArea } from '@frameforge/ui';
import type { Shot } from '@frameforge/types';
import { ApiError } from '@/lib/api-client';
import {
  type CustomFieldDefinition,
  usePatchCustomFieldValue
} from '@/lib/hooks/useCustomFields';

interface CustomFieldCellProps {
  productionId: string;
  shot: Shot;
  field: CustomFieldDefinition;
  value: unknown;
}

function displayValue(field: CustomFieldDefinition, value: unknown) {
  const effective = value === undefined ? field.default_value : value;
  if (effective === null || effective === undefined || effective === '') return '';
  if (field.field_type === 'boolean') return effective ? '是' : '否';
  return String(effective);
}

export function CustomFieldCell({
  productionId,
  shot,
  field,
  value
}: CustomFieldCellProps) {
  const mutation = usePatchCustomFieldValue(productionId);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);

  const currentDisplay = displayValue(field, value);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (field.field_type !== 'number' && field.field_type !== 'date') {
        inputRef.current.select();
      }
    }
  }, [isEditing, field.field_type]);

  useEffect(() => {
    if (hasConflict && conflictRevision !== null && shot.revision !== conflictRevision) {
      setHasConflict(false);
      setConflictRevision(null);
      setSaveError(null);
    }
  }, [hasConflict, conflictRevision, shot.revision]);

  const beginEdit = (event: React.MouseEvent) => {
    event.stopPropagation();
    setEditValue(currentDisplay);
    setSaveError(null);
    setHasConflict(false);
    setConflictRevision(null);
    setIsEditing(true);
  };

  const parseValue = (raw: string): unknown => {
    if (field.field_type === 'number') {
      return raw.trim() === '' ? null : Number(raw);
    }
    if (field.field_type === 'boolean') {
      return raw === 'true';
    }
    return raw;
  };

  const save = async (rawValue: string = editValue) => {
    if (!isEditing || mutation.isPending || hasConflict) return;

    const nextValue = parseValue(rawValue);
    const effectiveCurrent = value === undefined ? field.default_value : value;

    if (nextValue === effectiveCurrent) {
      setIsEditing(false);
      return;
    }

    try {
      await mutation.mutateAsync({
        shotId: shot.id,
        fieldId: field.id,
        revision: shot.revision,
        value: nextValue
      });
      setSaveError(null);
      setHasConflict(false);
      setConflictRevision(null);
      setIsEditing(false);
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 409 || error.code === 'CUSTOM_FIELD_REVISION_CONFLICT')
      ) {
        setHasConflict(true);
        setConflictRevision(shot.revision);
        setSaveError(
          '镜头已在别处修改。当前输入已保留；列表同步到最新 revision 后可再次保存，或放弃输入。'
        );
      } else {
        setSaveError(error instanceof Error ? error.message : '保存自定义列失败');
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.stopPropagation();
    if (event.key === 'Enter' && field.field_type !== 'textarea') {
      event.preventDefault();
      void save();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setIsEditing(false);
      setSaveError(null);
      setHasConflict(false);
      setConflictRevision(null);
    }
  };

  if (isEditing) {
    const editor =
      field.field_type === 'select' ? (
        <Select
          label={field.label}
          value={editValue}
          onChange={next => {
            setEditValue(next);
            void save(next);
          }}
          options={[
            ...(!field.required ? [{ value: '', label: '— 空 —' }] : []),
            ...field.options.map(option => ({ value: option, label: option }))
          ]}
          disabled={mutation.isPending}
          className="h-8 text-xs"
        />
      ) : field.field_type === 'boolean' ? (
        <Select
          label={field.label}
          value={editValue === '是' || editValue === 'true' ? 'true' : 'false'}
          onChange={next => {
            setEditValue(next);
            void save(next);
          }}
          options={[
            { value: 'true', label: '是' },
            { value: 'false', label: '否' }
          ]}
          disabled={mutation.isPending}
          className="h-8 text-xs"
        />
      ) : field.field_type === 'textarea' ? (
        <TextArea
          value={editValue}
          onChange={event => setEditValue(event.target.value)}
          onBlur={() => {
            if (!saveError) void save();
          }}
          onKeyDown={handleKeyDown}
          disabled={mutation.isPending}
          rows={2}
          className="min-h-14 text-xs"
          autoFocus
        />
      ) : (
        <Input
          ref={inputRef}
          type={
            field.field_type === 'number'
              ? 'number'
              : field.field_type === 'date'
                ? 'date'
                : field.field_type === 'url'
                  ? 'url'
                  : 'text'
          }
          value={editValue}
          onChange={event => setEditValue(event.target.value)}
          onBlur={() => {
            if (!saveError) void save();
          }}
          onKeyDown={handleKeyDown}
          disabled={mutation.isPending}
          className="h-8 min-w-24 text-xs"
        />
      );

    return (
      <div
        className="relative min-w-0"
        onClick={event => event.stopPropagation()}
        onDoubleClick={event => event.stopPropagation()}
      >
        {editor}
        {saveError && (
          <div
            role="alert"
            className="absolute left-0 top-full z-40 mt-1 min-w-72 rounded-md border border-warning/40 bg-popover p-2 text-xs text-popover-foreground shadow-lg"
          >
            <p>{saveError}</p>
            <div className="mt-2 flex gap-2">
              {!hasConflict && (
                <Button
                  size="sm"
                  variant="outline"
                  onMouseDown={event => event.preventDefault()}
                  onClick={() => void save()}
                >
                  重试保存
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  setIsEditing(false);
                  setSaveError(null);
                  setHasConflict(false);
                  setConflictRevision(null);
                }}
              >
                放弃输入
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={beginEdit}
      className="mx-[-6px] cursor-text rounded px-1.5 py-0.5 transition-colors hover:bg-muted"
      title="双击编辑自定义列"
    >
      <div className={field.wrap_text ? 'whitespace-pre-wrap' : 'truncate'}>
        {currentDisplay || (
          <span className="italic text-muted-foreground">
            {field.required ? '必填' : '空'}
          </span>
        )}
      </div>
    </div>
  );
}
