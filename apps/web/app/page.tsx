'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function HomePage() {
  const router = useRouter();
  const token = useAuthStore(s => s.token);

  useEffect(() => {
    if (token) {
      router.replace('/productions');
    } else {
      router.replace('/login');
    }
  }, [token, router]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-studio-950 text-studio-600">
      <div className="flex items-center gap-3">
        <svg className="g-icon animate-spin"><use href="#icon-movie" /></svg>
        <span className="font-mono text-xs uppercase tracking-wider">Loading FrameForge OS...</span>
      </div>
    </div>
  );
}
