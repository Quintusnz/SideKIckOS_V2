import type { TimelineEvent } from "@/types/timeline";
import type { ActivityTimelineEntry } from "@/types";

type PhaseId = "planning" | "research" | "synthesis" | "output";

interface PhaseDefinition {
  id: PhaseId;
  title: string;
  kind: TimelineEvent["kind"];
  defaultSummary: string;
}

interface PhaseAccumulator {
  id: PhaseId;
  title: string;
  kind: TimelineEvent["kind"];
  summary?: string;
  detailLines: string[];
  artifactLabel?: string;
  timestamp?: number;
}

const TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const PHASES: PhaseDefinition[] = [
  { id: "planning", title: "Planning", kind: "step", defaultSummary: "Outlined approach" },
  { id: "research", title: "Gathering Evidence", kind: "tool", defaultSummary: "Searched external sources" },
  { id: "synthesis", title: "Synthesis", kind: "message", defaultSummary: "Drafted findings" },
  { id: "output", title: "Deliverable", kind: "artifact", defaultSummary: "Produced final output" },
];

export const FALLBACK_TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: "phase-planning",
    time: "10:12",
    title: "Planning",
    kind: "step",
    summary: "Agent outlined a 3-step plan",
    detail: "Defined research scope and success criteria.",
    expandable: true,
  },
  {
    id: "phase-research",
    time: "10:13",
    title: "Gathering Evidence",
    kind: "tool",
    summary: "Consulted web.search for relevant docs",
    detail: "docs.vercel.ai • activity stream handlers • streaming patterns",
    expandable: true,
  },
  {
    id: "phase-synthesis",
    time: "10:14",
    title: "Synthesis",
    kind: "message",
    summary: "Consolidated research into a concise summary",
    detail: "Drafted key points and structured the narrative.",
    expandable: true,
  },
  {
    id: "phase-output",
    time: "10:16",
    title: "Deliverable",
    kind: "artifact",
    summary: "Research Report ready",
    artifactLabel: "Research Report (markdown)",
    expandable: false,
  },
];

function formatTime(timestamp?: number): string {
  if (!timestamp) {
    return "--:--";
  }

  try {
    return TIME_FORMATTER.format(new Date(timestamp));
  } catch (error) {
    return "--:--";
  }
}

function pushDetail(phase: PhaseAccumulator, text?: string, limit = 4) {
  if (!text) {
    return;
  }
  const trimmed = text.trim();
  if (!trimmed) {
    return;
  }
  if (phase.detailLines.includes(trimmed)) {
    return;
  }
  if (phase.detailLines.length >= limit) {
    return;
  }
  phase.detailLines.push(trimmed);
}

function ensurePhase(phases: Map<PhaseId, PhaseAccumulator>, def: PhaseDefinition): PhaseAccumulator {
  const existing = phases.get(def.id);
  if (existing) {
    return existing;
  }
  const accumulator: PhaseAccumulator = {
    id: def.id,
    title: def.title,
    kind: def.kind,
    detailLines: [],
  };
  phases.set(def.id, accumulator);
  return accumulator;
}

function classifyPhase(entry: ActivityTimelineEntry, current: PhaseId): PhaseId {
  switch (entry.kind) {
    case "activity.start":
      return "planning";
    case "step.start": {
      const title = entry.title?.toLowerCase() ?? "";
      if (title.includes("plan") || title.includes("analy")) {
        return "planning";
      }
      if (title.includes("search") || title.includes("research") || title.includes("gather")) {
        return "research";
      }
      if (title.includes("summar") || title.includes("synth") || title.includes("write") || title.includes("draft")) {
        return "synthesis";
      }
      return current;
    }
    case "tool.call":
    case "tool.result":
      return "research";
    case "status":
      if (entry.status === "streaming") {
        return "synthesis";
      }
      return current;
    case "activity.done":
      return "output";
    case "warning":
    case "error":
      return current;
    case "step.update":
      return current;
    default:
      return current;
  }
}

function describeEntryForPhase(entry: ActivityTimelineEntry): string | undefined {
  switch (entry.kind) {
    case "tool.call":
      return entry.name ? `Called ${entry.name}` : "Tool invoked";
    case "tool.result":
      return entry.summary ?? (entry.name ? `Received result from ${entry.name}` : undefined);
    case "step.update":
      return entry.text;
    case "warning":
    case "error":
      return entry.text;
    case "status":
      return entry.status ? `Status → ${entry.status}` : undefined;
    case "activity.done":
      return entry.summary ?? entry.text;
    default:
      return undefined;
  }
}

function assignSummary(phase: PhaseAccumulator, entry: ActivityTimelineEntry) {
  if (phase.summary) {
    return;
  }

  switch (entry.kind) {
    case "activity.start":
    case "step.start":
      phase.summary = entry.title ?? entry.text ?? phase.summary;
      break;
    case "tool.call":
      phase.summary = entry.name ? `Consulted ${entry.name}` : phase.summary;
      break;
    case "tool.result":
      phase.summary = entry.summary ?? entry.text ?? phase.summary;
      break;
    case "activity.done":
      phase.summary = entry.text ?? entry.summary ?? phase.summary;
      break;
    default:
      break;
  }
}

export function mapActivityTimelineToEvents(
  timeline: ActivityTimelineEntry[],
  options: { includeFallback?: boolean } = { includeFallback: true },
): TimelineEvent[] {
  if (timeline.length === 0) {
    return options.includeFallback ? FALLBACK_TIMELINE_EVENTS : [];
  }

  const phaseMap = new Map<PhaseId, PhaseAccumulator>();
  let currentPhase: PhaseId = "planning";

  const sorted = [...timeline].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

  for (const entry of sorted) {
    currentPhase = classifyPhase(entry, currentPhase);
    const definition = PHASES.find((phase) => phase.id === currentPhase) ?? PHASES[0];
    const phase = ensurePhase(phaseMap, definition);

    if (!phase.timestamp && entry.timestamp) {
      phase.timestamp = entry.timestamp;
    }

    assignSummary(phase, entry);
    const detail = describeEntryForPhase(entry);
    pushDetail(phase, detail);

    if (currentPhase === "output" && entry.summary) {
      phase.artifactLabel = entry.summary;
    }
  }

  const events: TimelineEvent[] = [];

  for (const definition of PHASES) {
    const phase = phaseMap.get(definition.id);
    if (!phase) {
      continue;
    }

    const time = formatTime(phase.timestamp);
    const detail = phase.detailLines.length > 0 ? phase.detailLines.join("\n") : undefined;

    events.push({
      id: `phase-${phase.id}`,
      time,
      title: phase.title,
      kind: phase.kind,
      summary: phase.summary ?? definition.defaultSummary,
      detail,
      expandable: Boolean(detail),
      artifactLabel: phase.artifactLabel,
    });
  }

  if (events.length === 0 && options.includeFallback) {
    return FALLBACK_TIMELINE_EVENTS;
  }

  return events;
}
