'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarClock, Clock } from 'lucide-react';

import { useActivityStore } from '@/app/components/useActivityStore';
import { FALLBACK_TIMELINE_EVENTS, mapActivityTimelineToEvents } from '@/lib/timeline';
import type { ActivityHistoryPhaseSummary, ActivityStatus } from '@/types';

interface RunSummary {
  id: string;
  title: string;
  startedAtLabel: string;
  statusLabel: string;
  durationLabel: string;
  phases: ActivityHistoryPhaseSummary[];
  isPending: boolean;
}

const STATUS_LABEL: Record<ActivityStatus, string> = {
  idle: 'Not started',
  thinking: 'Thinking…',
  'tool-calling': 'Calling tool…',
  streaming: 'Summarizing…',
  blocked: 'Awaiting input…',
  done: 'Completed',
  error: 'Error',
};

const KIND_BADGE_CLASS: Record<ActivityHistoryPhaseSummary['kind'], string> = {
  step: 'border-neutral-800 text-neutral-200 bg-neutral-900/80',
  tool: 'border-sky-800 text-sky-300 bg-sky-500/10',
  artifact: 'border-emerald-800 text-emerald-300 bg-emerald-500/10',
  message: 'border-neutral-800 text-neutral-300 bg-neutral-900/80',
  error: 'border-rose-800 text-rose-300 bg-rose-500/10',
};

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatDuration(durationMs?: number): string {
  if (!durationMs || durationMs <= 0) {
    return '—';
  }
  if (durationMs < 1000) {
    return `${durationMs} ms`;
  }
  if (durationMs < 60_000) {
    return `${(durationMs / 1000).toFixed(1)} s`;
  }
  const minutes = durationMs / 60_000;
  return minutes >= 10 ? `${minutes.toFixed(0)} min` : `${minutes.toFixed(1)} min`;
}

function formatStartedAt(startedAt: string): string {
  const timestamp = Date.parse(startedAt);
  if (Number.isNaN(timestamp)) {
    return 'Unknown start time';
  }
  return DATE_FORMATTER.format(new Date(timestamp));
}

const FALLBACK_HISTORY: RunSummary[] = [
  {
    id: 'sample-run-primary',
    title: 'Competitive Research Demo',
    startedAtLabel: 'Today • 10:12',
    statusLabel: 'Completed demo run',
    durationLabel: '3.5 min',
    phases: FALLBACK_TIMELINE_EVENTS.map((event) => ({
      id: `${event.id}-sample-primary`,
      title: event.title,
      summary: event.summary ?? 'Phase summary unavailable.',
      kind: event.kind,
    })),
    isPending: false,
  },
  {
    id: 'sample-run-secondary',
    title: 'Support Playbook Update',
    startedAtLabel: 'Yesterday • 17:42',
    statusLabel: 'Completed demo run',
    durationLabel: '2.9 min',
    phases: [
      {
        id: 'phase-planning-sample-secondary',
        title: 'Planning',
        summary: 'Captured common ticket themes and success criteria.',
        kind: 'step',
      },
      {
        id: 'phase-research-sample-secondary',
        title: 'Gathering Evidence',
        summary: 'Pulled three high-signal support transcripts.',
        kind: 'tool',
      },
      {
        id: 'phase-synthesis-sample-secondary',
        title: 'Synthesis',
        summary: 'Combined takeaways into action items for agents.',
        kind: 'message',
      },
      {
        id: 'phase-output-sample-secondary',
        title: 'Deliverable',
        summary: 'Generated FAQ updates and escalation checklist.',
        kind: 'artifact',
      },
    ],
    isPending: false,
  },
];

export default function ConversationTimelinePage() {
  const history = useActivityStore((state) => state.history);
  const currentActivity = useActivityStore((state) => state.currentActivity);
  const timelineEntries = useActivityStore((state) => state.timeline);

  const historyRuns = useMemo<RunSummary[]>(() => {
    if (history.length === 0) {
      return [];
    }

    return [...history]
      .sort((a, b) => {
        const aTime = Date.parse(a.completedAt);
        const bTime = Date.parse(b.completedAt);
        return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
      })
      .slice(0, 10)
      .map((entry) => ({
        id: entry.id,
        title: entry.title || 'Agent Run',
        startedAtLabel: formatStartedAt(entry.startedAt),
        statusLabel: entry.label || STATUS_LABEL[entry.status],
        durationLabel: formatDuration(entry.durationMs),
        phases: entry.phases,
        isPending: entry.status !== 'done',
      }));
  }, [history]);

  const activeRun = useMemo<RunSummary | null>(() => {
    if (!currentActivity) {
      return null;
    }

    const status = currentActivity.status;

    if (status === 'done') {
      return null;
    }

    const phases = mapActivityTimelineToEvents(timelineEntries, { includeFallback: false });
    const condensedPhases: ActivityHistoryPhaseSummary[] = (phases.length > 0 ? phases : FALLBACK_TIMELINE_EVENTS).map(
      (phase) => ({
        id: phase.id,
        title: phase.title,
        summary: phase.summary ?? 'Summary unavailable.',
        kind: phase.kind,
        artifactLabel: phase.artifactLabel,
      }),
    );

    return {
      id: currentActivity.id,
      title: currentActivity.title || 'Agent Run',
      startedAtLabel: formatStartedAt(currentActivity.startedAt),
      statusLabel: currentActivity.label || STATUS_LABEL[status],
      durationLabel: formatDuration(currentActivity.durationMs),
      phases: condensedPhases,
      isPending: status !== 'error',
    } satisfies RunSummary;
  }, [currentActivity, timelineEntries]);

  const combinedRuns = useMemo<RunSummary[]>(() => {
    const base = historyRuns.filter((run) => run.id !== (activeRun?.id ?? ''));
    if (activeRun && activeRun.isPending) {
      return [activeRun, ...base];
    }
    if (activeRun && !base.some((run) => run.id === activeRun.id)) {
      return [activeRun, ...base];
    }
    return base;
  }, [activeRun, historyRuns]);

  const usingFallback = combinedRuns.length === 0;
  const displayRuns = usingFallback ? FALLBACK_HISTORY : combinedRuns;

  return (
    <div
      className="min-h-screen bg-neutral-950 text-neutral-100"
      data-testid="conversation-timeline-root"
    >
      <header className="sticky top-0 z-10 border-b border-neutral-800/70 bg-neutral-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conversation Timeline</h1>
            <p className="mt-1 max-w-2xl text-[13px] text-neutral-400">
              Condensed history of recent agent runs. Each entry highlights the four key phases so you can spot progress at a glance.
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
              href="/activities"
              className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 transition hover:bg-neutral-800"
            >
              Live activities
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {usingFallback && (
          <div className="mb-4 rounded-xl border border-dashed border-neutral-800/60 bg-neutral-900/40 px-4 py-3 text-[12px] text-neutral-400">
            No conversation runs captured yet. This sample timeline illustrates the compact history view until live data becomes available.
          </div>
        )}
        <ul className="grid gap-4" role="list">
          {displayRuns.map((run) => (
            <li key={run.id}>
              <article className="rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-5 py-4 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] backdrop-blur">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-neutral-500">
                      <CalendarClock size={12} className="text-neutral-400" />
                      <span>{run.startedAtLabel}</span>
                    </div>
                    <h2 className="mt-1 text-sm font-semibold text-neutral-50">{run.title}</h2>
                    <p className="text-[12px] text-neutral-400">{run.statusLabel}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-start">
                    <span className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-950 px-2 py-0.5 text-[11px] text-neutral-300">
                      <Clock size={12} />
                      {run.durationLabel}
                    </span>
                    <Link
                      href="/activities"
                      className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
                    >
                      View live phases
                      <ArrowUpRight size={12} />
                    </Link>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {run.phases.length > 0 ? (
                    run.phases.map((phase) => (
                      <span
                        key={phase.id}
                        className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${KIND_BADGE_CLASS[phase.kind]}`}
                      >
                        <strong className="font-semibold text-current">{phase.title}</strong>
                        <span className="text-neutral-400">
                          — {phase.summary}
                          {phase.artifactLabel ? (
                            <span className="text-neutral-400/80"> • {phase.artifactLabel}</span>
                          ) : null}
                        </span>
                      </span>
                    ))
                  ) : (
                    <span className="text-[12px] text-neutral-500">
                      Phase details pending — the agent is still working.
                    </span>
                  )}
                </div>
                {run.isPending && (
                  <p className="mt-3 text-[11px] uppercase tracking-wide text-amber-400/80">
                    In progress — refresh to see the latest snapshot.
                  </p>
                )}
              </article>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
