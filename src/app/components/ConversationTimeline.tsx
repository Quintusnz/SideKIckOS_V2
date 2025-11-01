'use client';

import { useMemo } from 'react';
import { ArrowRight, ArrowUpRight, CalendarClock, Clock, FileText, MessageSquare } from 'lucide-react';

import { useActivityStore } from '@/app/components/useActivityStore';
import { FALLBACK_TIMELINE_EVENTS, mapActivityTimelineToEvents } from '@/lib/timeline';
import type { ActivityHistoryPhaseSummary, ActivityStatus } from '@/types';

const STATUS_LABEL: Record<ActivityStatus, string> = {
  idle: 'Not started',
  thinking: 'Thinking…',
  'tool-calling': 'Calling tool…',
  streaming: 'Summarizing…',
  blocked: 'Awaiting input…',
  done: 'Completed',
  error: 'Error',
};

const GROUP_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const SHORT_GROUP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
});

const TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
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

function parseDate(value?: string | null): Date | null {
  if (!value) {
    return null;
  }
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }
  return new Date(timestamp);
}

function formatTimeLabel(date: Date | null, fallback: string): string {
  if (!date) {
    return fallback;
  }
  return TIME_FORMATTER.format(date);
}

function formatGroupLabel(date: Date | null, fallback: string): { primary: string; secondary: string } {
  if (!date) {
    return { primary: fallback, secondary: '' };
  }

  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const dayMatches = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  if (dayMatches(date, now)) {
    return { primary: 'Today', secondary: GROUP_DATE_FORMATTER.format(date) };
  }
  if (dayMatches(date, yesterday)) {
    return { primary: 'Yesterday', secondary: GROUP_DATE_FORMATTER.format(date) };
  }
  return {
    primary: SHORT_GROUP_FORMATTER.format(date),
    secondary: GROUP_DATE_FORMATTER.format(date),
  };
}

type TimelineRun = {
  id: string;
  title: string;
  startedAt: string | null;
  startedAtLabel: string;
  statusLabel: string;
  durationLabel: string;
  phases: ActivityHistoryPhaseSummary[];
  isPending: boolean;
};

const NOW = Date.now();

const FALLBACK_HISTORY: TimelineRun[] = [
  {
    id: 'sample-run-primary',
    title: 'Competitive Research Demo',
    startedAt: new Date(NOW).toISOString(),
    startedAtLabel: 'Today • 10:12',
    statusLabel: 'Competitive research completed',
    durationLabel: '3.5 min',
    phases: FALLBACK_TIMELINE_EVENTS.map((event) => ({
      id: `${event.id}-sample-primary`,
      title: event.title,
      summary: event.summary ?? 'Phase summary unavailable.',
      kind: event.kind,
      artifactLabel: event.artifactLabel,
    } satisfies ActivityHistoryPhaseSummary)),
    isPending: false,
  },
  {
    id: 'sample-run-secondary',
    title: 'Support Playbook Update',
    startedAt: new Date(NOW - 24 * 60 * 60 * 1000).toISOString(),
    startedAtLabel: 'Yesterday • 17:42',
    statusLabel: 'FAQs refreshed for support team',
    durationLabel: '2.9 min',
    phases: [
      {
        id: 'phase-synthesis-sample-secondary',
        title: 'Summary',
        summary: 'Shared takeaways and proposed changes for agents.',
        kind: 'message',
        artifactLabel: undefined,
      },
      {
        id: 'phase-output-sample-secondary',
        title: 'Deliverable',
        summary: 'Generated FAQ updates and escalation checklist.',
        kind: 'artifact',
        artifactLabel: 'Support Playbook Draft (docx)',
      },
    ] satisfies ActivityHistoryPhaseSummary[],
    isPending: false,
  },
];

type ConversationTimelineProps = {
  onViewActivities?: () => void;
};

function selectPrimarySummary(run: TimelineRun): string {
  const messagePhase = run.phases.find((phase) => phase.kind === 'message');
  if (messagePhase?.summary) {
    return messagePhase.summary;
  }
  const artifactPhase = run.phases.find((phase) => phase.kind === 'artifact');
  if (artifactPhase?.summary) {
    return artifactPhase.summary;
  }
  const firstPhase = run.phases[0];
  if (firstPhase?.summary) {
    return firstPhase.summary;
  }
  return run.statusLabel;
}

function collectHighlights(run: TimelineRun, primarySummary: string): ActivityHistoryPhaseSummary[] {
  const seen = new Set<string>();
  const highlights: ActivityHistoryPhaseSummary[] = [];
  for (const phase of run.phases) {
    if (!phase.summary || phase.summary === primarySummary) {
      continue;
    }
    if (phase.kind !== 'message' && phase.kind !== 'step') {
      continue;
    }
    if (seen.has(phase.summary)) {
      continue;
    }
    seen.add(phase.summary);
    highlights.push(phase);
    if (highlights.length >= 3) {
      break;
    }
  }
  return highlights;
}

function collectDeliverables(run: TimelineRun): ActivityHistoryPhaseSummary[] {
  return run.phases.filter((phase) => phase.kind === 'artifact');
}

export function ConversationTimeline(props: ConversationTimelineProps) {
  const { onViewActivities } = props;
  const history = useActivityStore((state) => state.history);
  const currentActivity = useActivityStore((state) => state.currentActivity);
  const timelineEntries = useActivityStore((state) => state.timeline);

  const historyRuns = useMemo<TimelineRun[]>(() => {
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
        title: entry.title || 'Agent run',
        startedAt: entry.startedAt,
        startedAtLabel: (() => {
          const date = parseDate(entry.startedAt);
          return date ? GROUP_DATE_FORMATTER.format(date) : 'Unknown start time';
        })(),
        statusLabel: entry.label || STATUS_LABEL[entry.status],
        durationLabel: formatDuration(entry.durationMs),
        phases: entry.phases,
        isPending: entry.status !== 'done' && entry.status !== 'error',
      }));
  }, [history]);

  const activeRun = useMemo<TimelineRun | null>(() => {
    if (!currentActivity) {
      return null;
    }

    const status = currentActivity.status;
    if (status === 'done') {
      return null;
    }

    const phases = mapActivityTimelineToEvents(timelineEntries, { includeFallback: false });
    const condensed: ActivityHistoryPhaseSummary[] = (phases.length > 0 ? phases : FALLBACK_TIMELINE_EVENTS).map(
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
      title: currentActivity.title || 'Agent run',
      startedAt: currentActivity.startedAt,
      startedAtLabel: (() => {
        const date = parseDate(currentActivity.startedAt);
        return date ? GROUP_DATE_FORMATTER.format(date) : 'Unknown start time';
      })(),
      statusLabel: currentActivity.label || STATUS_LABEL[status],
      durationLabel: formatDuration(currentActivity.durationMs),
      phases: condensed,
      isPending: status !== 'error',
    } satisfies TimelineRun;
  }, [currentActivity, timelineEntries]);

  const displayRuns = useMemo<TimelineRun[]>(() => {
    const base = historyRuns.filter((run) => run.id !== (activeRun?.id ?? ''));
    if (activeRun && activeRun.isPending) {
      return [activeRun, ...base];
    }
    if (activeRun && !base.some((run) => run.id === activeRun.id)) {
      return [activeRun, ...base];
    }
    return base;
  }, [activeRun, historyRuns]);

  const usingFallback = displayRuns.length === 0;
  const runsToRender = usingFallback ? FALLBACK_HISTORY : displayRuns;

  const groupedRuns = useMemo(() => {
    const groups: Array<{ key: string; primary: string; secondary: string; runs: TimelineRun[] }> = [];
    const index = new Map<string, { key: string; primary: string; secondary: string; runs: TimelineRun[] }>();

    for (const run of runsToRender) {
      const date = parseDate(run.startedAt);
      const label = formatGroupLabel(date, run.startedAtLabel);
      const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : `unknown-${run.id}`;
      if (!index.has(key)) {
        const bucket = { key, primary: label.primary, secondary: label.secondary, runs: [] as TimelineRun[] };
        index.set(key, bucket);
        groups.push(bucket);
      }
      index.get(key)!.runs.push(run);
    }

    return groups;
  }, [runsToRender]);

  return (
    <div className="space-y-6" data-testid="conversation-timeline">
      {usingFallback && (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
          No conversation runs captured yet. Browse this example timeline to see how previous chats and deliverables will appear once you begin working.
        </div>
      )}

      {groupedRuns.map((group) => (
        <section key={group.key} className="space-y-4">
          <header className="pl-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{group.primary}</p>
            {group.secondary && (
              <p className="text-[11px] text-slate-500">{group.secondary}</p>
            )}
          </header>
          <div className="relative">
            <div className="pointer-events-none absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-slate-700/60 via-slate-700/30 to-transparent" />
            <ul className="space-y-6 pl-10" role="list">
              {group.runs.map((run, index) => {
                const startedAtDate = parseDate(run.startedAt);
                const timeLabel = formatTimeLabel(startedAtDate, run.startedAtLabel);
                const primarySummary = selectPrimarySummary(run);
                const highlights = collectHighlights(run, primarySummary);
                const deliverables = collectDeliverables(run);

                return (
                  <li key={run.id} className="relative">
                    <div className="pointer-events-none absolute left-4 top-3 -translate-x-1/2">
                      <span className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-slate-950 bg-blue-500 shadow-[0_0_10px_-4px_rgba(56,189,248,0.8)]" />
                    </div>
                    <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 px-5 py-4 shadow-[0_8px_24px_-16px_rgba(0,0,0,0.7)] backdrop-blur">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-slate-500">
                            <CalendarClock size={12} className="text-slate-400" />
                            <span>{timeLabel}</span>
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-600">
                              <ArrowRight size={10} />
                              {run.statusLabel}
                            </span>
                          </div>
                          <h2 className="text-base font-semibold text-slate-50">{run.title}</h2>
                          <p className="text-sm text-slate-300">{primarySummary}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[11px] text-slate-300">
                            <Clock size={12} />
                            {run.durationLabel}
                          </span>
                          {onViewActivities && (
                            <button
                              type="button"
                              onClick={onViewActivities}
                              className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-900 px-3 py-1 text-[11px] text-slate-200 transition hover:bg-slate-800"
                            >
                              {run.isPending ? 'View live phases' : 'Open activities'}
                              <ArrowUpRight size={12} />
                            </button>
                          )}
                          {run.isPending && (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                              In progress
                            </span>
                          )}
                        </div>
                      </div>

                      {deliverables.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-300/80">
                            Deliverables
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {deliverables.map((deliverable) => (
                              <span
                                key={deliverable.id}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-800/60 bg-emerald-500/10 px-3 py-1 text-[12px] text-emerald-200"
                              >
                                <FileText size={12} />
                                <span className="font-medium text-emerald-100">{deliverable.title}</span>
                                {deliverable.artifactLabel && (
                                  <span className="text-emerald-200/80">— {deliverable.artifactLabel}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {highlights.length > 0 && (
                        <div className="mt-3 space-y-1">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                            Conversation highlights
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            {highlights.map((highlight) => (
                              <span
                                key={highlight.id}
                                className="inline-flex items-center gap-1 rounded-full border border-slate-800 bg-slate-950 px-3 py-1 text-[12px] text-slate-200"
                              >
                                <MessageSquare size={12} className="text-slate-300" />
                                {highlight.summary}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                    {index < group.runs.length - 1 && (
                      <div className="absolute left-4 top-full h-6 -translate-x-1/2 bg-gradient-to-b from-slate-700/40 via-slate-700/20 to-transparent" style={{ width: '2px' }} />
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}

export default ConversationTimeline;
