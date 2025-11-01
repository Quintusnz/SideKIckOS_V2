'use client';

import { type ReactElement, useCallback, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  MessageSquare,
  PlugZap,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import type { TimelineDensity, TimelineEvent, EventKind } from '@/types/timeline';

const KIND_ICON: Record<EventKind, typeof CalendarClock> = {
  step: CalendarClock,
  tool: PlugZap,
  artifact: FileText,
  message: MessageSquare,
  error: AlertTriangle,
};

const KIND_NODE_CLASS: Record<EventKind, string> = {
  step: 'bg-neutral-400',
  tool: 'bg-sky-400',
  artifact: 'bg-emerald-400',
  message: 'bg-neutral-500',
  error: 'bg-rose-400',
};

const KIND_ACCENT_CLASS: Record<EventKind, string> = {
  step: 'bg-neutral-700',
  tool: 'bg-sky-500',
  artifact: 'bg-emerald-500',
  message: 'bg-neutral-600',
  error: 'bg-rose-500',
};

const KIND_BADGE_CLASS: Record<EventKind, string> = {
  step: 'border-neutral-800 text-neutral-300',
  tool: 'border-sky-800 text-sky-300',
  artifact: 'border-emerald-800 text-emerald-300',
  message: 'border-neutral-800 text-neutral-300',
  error: 'border-rose-800 text-rose-300',
};

const KIND_LABEL: Record<EventKind, string> = {
  step: 'Step',
  tool: 'Tool',
  artifact: 'Artifact',
  message: 'Message',
  error: 'Error',
};

export interface TimelineProps {
  events: TimelineEvent[];
  onOpenArtifact?: (id: string) => void;
  onFocusArtifact?: (id: string) => void;
  density?: TimelineDensity;
}

export function Timeline({ events, onOpenArtifact, onFocusArtifact, density = 'compact' }: TimelineProps): ReactElement {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [expandedState, setExpandedState] = useState<Record<string, boolean>>({});

  const handleToggle = useCallback((eventId: string) => {
    setExpandedState((prev) => ({
      ...prev,
      [eventId]: !prev[eventId],
    }));
  }, []);

  const handleOpenArtifact = useCallback(
    (eventId: string) => {
      if (onOpenArtifact) {
        onOpenArtifact(eventId);
        return;
      }
      router.push(`/artifact/${eventId}`);
    },
    [onOpenArtifact, router],
  );

  const handleFocusArtifact = useCallback(
    (eventId: string) => {
      if (onFocusArtifact) {
        onFocusArtifact(eventId);
        return;
      }
      router.push(`/chat?focus=${eventId}`);
    },
    [onFocusArtifact, router],
  );

  const spacingClass = density === 'dense' ? 'mb-4' : 'mb-5';

  return (
    <div className="relative" data-testid="timeline">
      <ul className="relative pl-12">
        <div className="pointer-events-none absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-neutral-700/60 via-neutral-700/30 to-transparent" />
        {events.map((event, index) => {
          const Icon = KIND_ICON[event.kind] ?? CalendarClock;
          const nodeClass = KIND_NODE_CLASS[event.kind] ?? KIND_NODE_CLASS.message;
          const accentClass = KIND_ACCENT_CLASS[event.kind] ?? KIND_ACCENT_CLASS.message;
          const badgeTone = KIND_BADGE_CLASS[event.kind] ?? KIND_BADGE_CLASS.message;
          const label = KIND_LABEL[event.kind] ?? 'Event';
          const isExpanded = Boolean(expandedState[event.id]);
          const expandable = event.expandable ?? true;
          const showSummary = Boolean(event.summary && (isExpanded || event.kind === 'artifact'));
          const showDetail = Boolean(expandable && isExpanded && event.detail);

          return (
            <li key={event.id} className={cn('group relative', spacingClass)} data-testid={`timeline-item-${event.id}`}>
              <div
                className="pointer-events-none absolute left-6 top-5 -translate-x-1/2 z-10"
                data-testid={`timeline-node-${event.id}`}
              >
                <motion.div
                  initial={{ scale: prefersReducedMotion ? 1 : 0.8, opacity: prefersReducedMotion ? 1 : 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: prefersReducedMotion ? 'tween' : 'spring', stiffness: 320, damping: 20 }}
                  className={cn('h-3 w-3 rounded-full ring-4 ring-neutral-950', nodeClass)}
                />
              </div>
              <div className="pointer-events-none absolute left-6 top-[26px] -translate-x-1/2 h-px w-6 bg-neutral-700/60" />

              <motion.div
                initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : 4 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                transition={{ duration: 0.18 }}
                className="relative ml-6 rounded-xl border border-neutral-800/80 bg-neutral-900/70 px-3.5 py-2.5 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)] backdrop-blur"
              >
                <span aria-hidden className={cn('absolute left-0 top-0 h-full w-[2px] rounded-l-xl', accentClass)} />
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase tracking-wider text-neutral-500">{event.time}</span>
                    <Icon size={13} className="text-neutral-300" />
                    <h3 className="text-[13px] font-medium leading-6 text-neutral-100" title={event.title}>
                      {event.title}
                    </h3>
                  </div>
                  {event.kind === 'artifact' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenArtifact(event.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-700/50 bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300 transition hover:bg-emerald-500/15"
                      >
                        Open
                        <ExternalLink size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleFocusArtifact(event.id)}
                        className="inline-flex items-center gap-1 rounded-full border border-neutral-800 bg-neutral-900 px-2 py-0.5 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
                      >
                        Focus in Chat
                        <ArrowUpRight size={12} />
                      </button>
                    </div>
                  )}
                  {event.kind !== 'artifact' && expandable && (
                    <button
                      type="button"
                      onClick={() => handleToggle(event.id)}
                      className="rounded-full border border-neutral-800 px-2 py-0.5 text-[11px] text-neutral-300 transition hover:bg-neutral-800"
                      aria-expanded={isExpanded}
                    >
                      {isExpanded ? (
                        <span className="inline-flex items-center gap-1">
                          Hide
                          <ChevronUp size={12} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          Details
                          <ChevronDown size={12} />
                        </span>
                      )}
                    </button>
                  )}
                </div>

                {(showSummary || event.artifactLabel) && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-neutral-400">
                    <span className={cn(
                      'inline-flex items-center gap-1 rounded-full border bg-neutral-950/60 px-2 py-0.5 text-[11px]',
                      badgeTone,
                    )}
                    >
                      <Icon size={11} />
                      {label}
                    </span>
                    {showSummary && <span className="text-neutral-300/90">{event.summary}</span>}
                    {event.kind === 'artifact' && event.artifactLabel && (
                      <span className="truncate text-neutral-300">— {event.artifactLabel}</span>
                    )}
                  </div>
                )}

                <AnimatePresence initial={false}>
                  {showDetail && (
                    <motion.div
                      key="detail"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-2 overflow-hidden"
                    >
                      <div className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3 text-[12px] text-neutral-300 whitespace-pre-wrap">
                        {event.detail}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {index < events.length - 1 && (
                <motion.div
                  initial={{ opacity: prefersReducedMotion ? 1 : 0, y: prefersReducedMotion ? 0 : -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="ml-7 mt-1 h-2 w-8 rounded-r-full bg-gradient-to-r from-neutral-700/40 to-transparent"
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Timeline;
