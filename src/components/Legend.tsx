'use client';

import type { ReactElement } from 'react';

import { cn } from '@/lib/utils';

const LEGEND_ITEMS: Array<{ label: string; colorClass: string }> = [
  { label: 'Step', colorClass: 'bg-neutral-400' },
  { label: 'Tool', colorClass: 'bg-sky-400' },
  { label: 'Artifact', colorClass: 'bg-emerald-400' },
  { label: 'Error', colorClass: 'bg-rose-400' },
];

export function Legend(): ReactElement {
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 text-[11px] text-neutral-400">
      {LEGEND_ITEMS.map((item) => (
        <span
          key={item.label}
          className={cn(
            'inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/60 px-2 py-0.5',
          )}
        >
          <span className={cn('inline-block h-2 w-2 rounded-full', item.colorClass)} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export default Legend;
