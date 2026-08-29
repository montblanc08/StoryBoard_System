'use client';

import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Production } from '@frameforge/types';
import { apiClient } from '@/lib/api-client';

interface ImportModalProps {
  production: Production;
  isOpen: boolean;
  onClose: () => void;
}

export function ImportModal({ production, isOpen, onClose }: ImportModalProps) {
  const queryClient = useQueryClient();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Preview data
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, { col: number; raw_header: string; confidence: number }>>({});
  const [rawRows, setRawRows] = useState<string[][]>([]);
  const [samplePreview, setSamplePreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    setFileName(selected.name);

    // Read and preview
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setIsLoading(true);
        const base64 = (reader.result as string).split(',')[1];
        const res = await apiClient<any>(`/api/v1/productions/${production.id}/import-preview`, {
          method: 'POST',
          json: {
            filename: selected.name,
            file_base64: base64
          }
        });

        setHeaders(res.headers || []);
        setMapping(res.mapping || {});
        setRawRows(res.raw_rows || []);
        setSamplePreview(res.sample_preview || []);
        setTotalRows(res.total_rows || 0);
        setStep(2);
      } catch (err: any) {
        alert(err.message || '解析表格失败');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsDataURL(selected);
  };

  const handleCommit = async () => {
    try {
      setIsLoading(true);
      await apiClient(`/api/v1/productions/${production.id}/import-commit`, {
        method: 'POST',
        json: {
          rows: rawRows,
          mapping: mapping
        }
      });
      await queryClient.invalidateQueries({ queryKey: ['shots', production.id] });
      await queryClient.invalidateQueries({ queryKey: ['production', production.id] });
      alert(`成功导入 ${totalRows} 个分镜镜头！`);
      onClose();
      setStep(1);
    } catch (err: any) {
      alert(err.message || '导入入库失败');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="flex h-[80vh] w-full max-w-3xl flex-col rounded-xl border border-studio-700 bg-studio-900 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex h-[50px] items-center justify-between border-b border-studio-700 bg-studio-950 px-6">
          <div className="flex items-center gap-2">
            <svg className="g-icon text-amber"><use href="#icon-table_rows" /></svg>
            <h3 className="text-sm font-bold text-white">智能导入分镜制作表 (Smart Table Importer)</h3>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <svg className="g-icon"><use href="#icon-close" /></svg>
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex border-b border-studio-800 bg-studio-950/50 px-6 py-2.5 text-slate-400 font-mono text-[11px]">
          <span className={`mr-4 ${step === 1 ? 'text-amber font-bold' : ''}`}>1. 上传表格文件</span>
          <span className={`mr-4 ${step === 2 ? 'text-amber font-bold' : ''}`}>2. 表头智能识别与核对</span>
          <span className={`${step === 3 ? 'text-amber font-bold' : ''}`}>3. 数据预览与确认入库</span>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="flex flex-col items-center justify-center h-full border-2 border-dashed border-studio-700 rounded-xl p-12 text-center hover:border-amber transition">
              <svg className="g-icon h-12 w-12 text-amber mb-4"><use href="#icon-file_download" /></svg>
              <h4 className="text-sm font-bold text-white mb-1">选择或拖放分镜制作表</h4>
              <p className="text-slate-400 mb-6 max-w-sm leading-relaxed">
                支持标准 Excel (.xlsx, .xls) 及 CSV 文件。自动识别多工作表及合并单元格。
              </p>
              <label className="cursor-pointer rounded bg-amber px-5 py-2.5 font-bold text-studio-950 hover:bg-amber-hover transition">
                <span>浏览本地文件</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
              {isLoading && <span className="mt-4 font-mono text-amber">正在智能解析表格结构...</span>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-300">
                  文件: <span className="font-mono text-amber">{fileName}</span> (共识别 {totalRows} 行数据)
                </span>
                <span className="font-mono text-[11px] text-emerald-400">已匹配 {Object.keys(mapping).length} 个标准字段</span>
              </div>

              <div className="rounded-lg border border-studio-800 bg-studio-950 p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-slate-500 border-b border-studio-800 pb-2">
                  <span>系统标准字段</span>
                  <span>识别表格表头</span>
                  <span className="text-right">匹配置信度</span>
                </div>

                {Object.entries(mapping).map(([field, info]) => (
                  <div key={field} className="grid grid-cols-3 gap-2 font-mono text-xs items-center">
                    <span className="font-bold text-slate-200">{field}</span>
                    <span className="text-amber truncate">[{info.col + 1}列] {info.raw_header}</span>
                    <span className="text-right text-emerald-400 font-bold">
                      {Math.round(info.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-200">数据样本预览 (前 {samplePreview.length} 镜)</h4>
              <div className="overflow-x-auto border border-studio-800 rounded-lg">
                <table className="w-full text-left text-[11px] font-mono">
                  <thead className="bg-studio-950 border-b border-studio-800 text-slate-400">
                    <tr>
                      <th className="p-2">镜号</th>
                      <th className="p-2">制作方式</th>
                      <th className="p-2">画面描述</th>
                      <th className="p-2">对应旁白</th>
                      <th className="p-2">时长</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-studio-800">
                    {samplePreview.map((row, idx) => (
                      <tr key={idx} className="hover:bg-studio-800/40">
                        <td className="p-2 font-bold text-amber">{row.number || idx + 1}</td>
                        <td className="p-2 text-slate-300">{row.primary_method || 'LIVE'}</td>
                        <td className="p-2 text-slate-200 font-sans truncate max-w-xs">{row.description || '—'}</td>
                        <td className="p-2 text-amber-200/90 font-sans truncate max-w-xs">{row.voiceover || '—'}</td>
                        <td className="p-2 text-slate-400">{row.duration || '3.0s'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-studio-700 bg-studio-950 px-6 py-3">
          {step > 1 ? (
            <button
              onClick={() => setStep(step === 3 ? 2 : 1)}
              className="rounded border border-studio-700 px-4 py-2 font-medium text-slate-300 hover:bg-studio-800"
            >
              上一步
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="rounded border border-studio-700 px-4 py-2 font-medium text-slate-400 hover:bg-studio-800"
            >
              取消
            </button>

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                className="rounded bg-amber px-5 py-2 font-bold text-studio-950 hover:bg-amber-hover"
              >
                下一步：预览样本
              </button>
            )}

            {step === 3 && (
              <button
                onClick={handleCommit}
                disabled={isLoading}
                className="rounded bg-amber px-6 py-2 font-bold text-studio-950 hover:bg-amber-hover disabled:opacity-50"
              >
                {isLoading ? '正在入库…' : `确认导入 ${totalRows} 个镜头`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
