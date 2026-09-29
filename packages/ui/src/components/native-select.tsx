import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  function NativeSelect({ className, children, ...props }, ref) {
    return (
      <span className="relative inline-flex min-w-0 items-center">
        <select ref={ref} className={cn('h-10 w-full appearance-none rounded-md border border-input bg-background pl-3 pr-9 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props}>{children}</select>
        <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 opacity-60" aria-hidden="true" />
      </span>
    );
  }
);
