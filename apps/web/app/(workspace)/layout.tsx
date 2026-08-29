import React from 'react';

export default function WorkspaceLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return <div className="min-h-screen bg-studio-950 text-slate-200">{children}</div>;
}
