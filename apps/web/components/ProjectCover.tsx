'use client';

import React from 'react';

interface ProjectCoverProps {
  name: string;
  coverMediaId?: string;
  className?: string;
}

export function ProjectCover({ name, coverMediaId, className = '' }: ProjectCoverProps) {
  // Determine monogram text
  const safeName = name || '';
  const isCJK = /[\u4e00-\u9fff]/.test(safeName);
  const mono = safeName ? (isCJK ? safeName.slice(0, 1) : safeName.slice(0, 2).toUpperCase()) : '#';

  // Calculate hue hash
  let hue = 0;
  for (let i = 0; i < safeName.length; i++) {
    hue = (hue * 31 + safeName.charCodeAt(i)) % 360;
  }

  // Linear gradient based on CSS specs:
  // background: linear-gradient(135deg, hsl(var(--cover-h, 215) 30% 25%), hsl(calc(var(--cover-h, 215) + 26) 36% 15%))
  const bgStyle = {
    background: `linear-gradient(135deg, hsl(${hue} 30% 25%), hsl(${(hue + 26) % 360} 36% 15%))`
  };

  // We are currently not fetching real media in V-Web, so we fallback.
  // In the future coverMediaUrl will be used.
  const hasImage = false; // !!coverMediaId (for now mocked false)

  return (
    <div 
      className={`relative grid shrink-0 place-items-center overflow-hidden rounded-lg ${className}`}
      style={{ width: '96px', height: '56px', ...(!hasImage ? bgStyle : {}) }}
      aria-hidden="true"
    >
      {/* Wash fade on the right edge to blend into panel surfaces */}
      <div 
        className="pointer-events-none absolute inset-0 z-10" 
        style={{
          background: 'linear-gradient(90deg, rgba(0,0,0,0) 62%, hsl(var(--card)) 128%)'
        }}
      />
      
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img 
          src={''} // coverMediaUrl
          alt="" 
          loading="lazy" 
          decoding="async"
          className="h-full w-full object-cover grayscale brightness-75 contrast-75"
        />
      ) : (
        <span className="text-base font-semibold leading-none tracking-[0.04em] text-white/80">
          {mono}
        </span>
      )}
    </div>
  );
}
