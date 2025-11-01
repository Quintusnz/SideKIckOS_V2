'use client';

import { useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import Timeline from '@/components/Timeline';
import Legend from '@/components/Legend';
import { useActivityStore } from '@/app/components/useActivityStore';
import { FALLBACK_TIMELINE_EVENTS, mapActivityTimelineToEvents } from '@/lib/timeline';

export default function ActivitiesPage() {
  const router = useRouter();
  const timelineEntries = useActivityStore((state) => state.timeline);

  const usingFallback = timelineEntries.length === 0;
  const events = useMemo(() => {
    if (timelineEntries.length === 0) {
      return FALLBACK_TIMELINE_EVENTS;
    }

    return mapActivityTimelineToEvents(timelineEntries, { includeFallback: false });
  }, [timelineEntries]);

  const handleOpenArtifact = useCallback(
    (id: string) => {
      router.push(`/artifact/${id}`);
    },
    [router],
  );

  const handleFocusArtifact = useCallback(
    (id: string) => {
      router.push(`/chat?focus=${id}`);
    },
    [router],
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100" data-testid="activities-root">
      <header className="sticky top-0 z-10 border-b border-neutral-800/70 bg-neutral-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Agent Activities</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-neutral-400">
              Review the latest agent run in four condensed phases. Open an artifact to inspect the generated output or jump back into chat.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              Back to chat
            </Link>
            <Link
              href="/timeline"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              Conversation timeline
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Legend />
        {usingFallback && (
          <div className="mb-4 rounded-xl border border-dashed border-neutral-800/60 bg-neutral-900/40 px-4 py-3 text-[12px] text-neutral-400">
            No live timeline data yet. This sample run illustrates the layout until a new activity is captured.
          </div>
        )}
        <Timeline
          events={events}
          onOpenArtifact={handleOpenArtifact}
          onFocusArtifact={handleFocusArtifact}
        />
      </main>
    </div>
  );
}
