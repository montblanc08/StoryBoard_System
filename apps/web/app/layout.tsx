import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/app-shell/Providers';

export const metadata: Metadata = {
  title: 'FRAMEFORGE OS · 专业影视分镜与镜头制作管理系统',
  description: '面向专业影视管线的镜头规划、制作方式管理与审片交付工作台',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
