'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface NavRailProps {
  productionId: string;
}

export function NavRail({ productionId }: NavRailProps) {
  const pathname = usePathname();
  const t = useAuthStore(s => s.t);
  const [collapsed, setCollapsed] = useState(false);

  const navItems = [
    {
      href: `/production/${productionId}/storyboard`,
      icon: 'icon-view_kanban',
      label: t('storyboard'),
      sub: 'Cards & Wall'
    },
    {
      href: `/production/${productionId}/shots`,
      icon: 'icon-table_rows',
      label: t('shotList'),
      sub: 'Pipeline Table'
    },
    {
      href: `/production/${productionId}/timeline`,
      icon: 'icon-view_timeline',
      label: t('timeline'),
      sub: 'Animatic Multi-track'
    },
    {
      href: `/production/${productionId}/assets`,
      icon: 'icon-perm_media',
      label: t('assets'),
      sub: 'Proxy Hub'
    },
    {
      href: `/production/${productionId}/review`,
      icon: 'icon-rate_review',
      label: t('review'),
      sub: 'Frame Annotations'
    },
    {
      href: `/production/${productionId}/deliverables`,
      icon: 'icon-file_download',
      label: t('deliverables'),
      sub: 'EDL / OTIO / PDF / XLSX'
    },
    {
      href: `/production/${productionId}/settings`,
      icon: 'icon-settings',
      label: t('settings'),
      sub: 'Pipeline Config'
    }
  ];

  return (
    <nav
      className={`relative flex flex-col border-r border-studio-700 bg-studio-950 transition-all duration-200 select-none z-20 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Navigation List */}
      <div className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {navItems.map(item => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 transition text-xs ${
                isActive
                  ? 'bg-amber text-studio-950 font-bold shadow-md shadow-amber/10'
                  : 'text-slate-400 hover:bg-studio-900 hover:text-slate-200'
              }`}
              title={collapsed ? item.label : undefined}
            >
              <svg className={`g-icon h-4 w-4 ${isActive ? 'text-studio-950' : 'text-slate-400 group-hover:text-amber'}`}>
                <use href={`#${item.icon}`} />
              </svg>

              {!collapsed && (
                <div className="flex flex-col truncate">
                  <span className="leading-tight">{item.label}</span>
                  <span className={`text-[10px] font-mono leading-tight ${isActive ? 'text-studio-800' : 'text-slate-500'}`}>
                    {item.sub}
                  </span>
                </div>
              )}
            </Link>
          );
        })}
      </div>

      {/* Collapse/Expand Toggle Footer */}
      <div className="border-t border-studio-800 p-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center gap-2 rounded-lg p-2 text-slate-500 hover:bg-studio-900 hover:text-slate-300 transition text-xs"
        >
          <svg className="g-icon h-4 w-4">
            <use href={collapsed ? '#icon-chevron_right' : '#icon-chevron_left'} />
          </svg>
          {!collapsed && <span>收起侧边栏</span>}
        </button>
      </div>
    </nav>
  );
}
