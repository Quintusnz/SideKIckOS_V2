"use client";

import { create } from "zustand";
import type {
  ActivityDoneMessage,
  ActivityMessage,
  ActivityStatus,
  ActivityUpdateMessage,
  ActivityUpdatePayload,
} from "@/types";

const STATUS_COPY: Record<ActivityStatus, string> = {
  idle: "",
  thinking: "Thinking…",
  "tool-calling": "Calling tool…",
  streaming: "Summarizing…",
  blocked: "Awaiting input…",
  done: "Finalizing…",
  error: "Something went wrong",
};

const TOOL_LABELS: Record<string, string> = {
  web: "Web",
  "web.search": "Web",
  "web-research": "Web",
  files: "Files",
  file: "Files",
  code: "Code",
  email: "Email",
  mail: "Email",
  calendar: "Calendar",
};

type ChipKind = "step" | "tool" | "warning" | "error" | "status";
type ChipState = "pending" | "active" | "completed" | "error";

export interface ActivityChip {
  id: string;
  kind: ChipKind;
  label: string;
  detail?: string;
  state: ChipState;
  timestamp: number;
  meta?: Record<string, unknown>;
}

type TimelineKind = "activity.start" | "activity.done" | ActivityUpdatePayload["kind"];

export interface ActivityTimelineEntry {
  id: string;
  activityId: string;
  timestamp: number;
  kind: TimelineKind;
  title?: string;
  text?: string;
  name?: string;
  summary?: string;
  args?: Record<string, unknown>;
  status?: ActivityStatus;
  stepIndex?: number;
}

interface ActivityRecord {
  id: string;
  title: string;
  status: ActivityStatus;
  label: string;
  startedAt: string;
  stepsTotal?: number;
  stepIndex?: number;
  stepCount: number;
  activeStepTitle?: string;
  updates: ActivityTimelineEntry[];
  chips: ActivityChip[];
  durationMs?: number;
  errorText?: string;
}

interface ActivityStoreState {
  activities: Record<string, ActivityRecord>;
  currentActivityId?: string;
  currentActivity?: ActivityRecord;
  status: ActivityStatus;
  label: string;
  collapsed: boolean;
  detailsOpen: boolean;
  chips: ActivityChip[];
  timeline: ActivityTimelineEntry[];
  activeStep?: { index: number; title?: string };
  ingestActivityMessage: (message: ActivityMessage) => void;
  ingestActivityUpdate: (message: ActivityUpdateMessage) => void;
  ingestActivityDone: (message: ActivityDoneMessage) => void;
  markBlocked: (message?: string) => void;
  markError: (message: string) => void;
  clearCurrent: () => void;
  reset: () => void;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  openDetails: () => void;
  closeDetails: () => void;
}

const INITIAL_STATE = {
  activities: {} as Record<string, ActivityRecord>,
  currentActivityId: undefined as string | undefined,
  currentActivity: undefined as ActivityRecord | undefined,
  status: "idle" as ActivityStatus,
  label: "",
  collapsed: false,
  detailsOpen: false,
  chips: [] as ActivityChip[],
  timeline: [] as ActivityTimelineEntry[],
  activeStep: undefined as { index: number; title?: string } | undefined,
};

function now(): number {
  return Date.now();
}

function fallbackLabel(status: ActivityStatus): string {
  return STATUS_COPY[status] ?? "Thinking…";
}

function friendlyToolLabel(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (TOOL_LABELS[normalized]) {
    return TOOL_LABELS[normalized];
  }

  const key = Object.keys(TOOL_LABELS).find((candidate) => normalized.startsWith(candidate));
  if (key) {
    return TOOL_LABELS[key];
  }

  if (normalized.includes("web")) {
    return "Web";
  }
  if (normalized.includes("file")) {
    return "Files";
  }
  if (normalized.includes("code")) {
    return "Code";
  }
  if (normalized.includes("mail")) {
    return "Email";
  }
  if (normalized.includes("calendar")) {
    return "Calendar";
  }

  return name;
}

function cloneChips(chips: ActivityChip[]): ActivityChip[] {
  return chips.map((chip) => ({ ...chip, meta: chip.meta ? { ...chip.meta } : undefined }));
}

function markLatestStepComplete(chips: ActivityChip[]): ActivityChip[] {
  const next = cloneChips(chips);
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const chip = next[index];
    if (chip.kind === "step" && chip.state === "active") {
      chip.state = "completed";
      break;
    }
  }
  return next;
}

function markLatestToolComplete(chips: ActivityChip[], summary?: string): ActivityChip[] {
  const next = cloneChips(chips);
  for (let index = next.length - 1; index >= 0; index -= 1) {
    const chip = next[index];
    if (chip.kind === "tool" && chip.state === "active") {
      chip.state = "completed";
      if (summary) {
        chip.detail = summary;
      }
      break;
    }
  }
  return next;
}

function findActiveStepChip(chips: ActivityChip[]): ActivityChip | undefined {
  for (let index = chips.length - 1; index >= 0; index -= 1) {
    const chip = chips[index];
    if (chip.kind === "step" && chip.state === "active") {
      return chip;
    }
  }
  return undefined;
}

export const useActivityStore = create<ActivityStoreState>()((set) => ({
  ...INITIAL_STATE,
  ingestActivityMessage: (message) => {
    const label = message.activity.label ?? fallbackLabel(message.activity.status);
    const startedTimestamp = Date.parse(message.activity.startedAt) || now();
    const record: ActivityRecord = {
      id: message.id,
      title: message.activity.title,
      status: message.activity.status,
      label,
      startedAt: message.activity.startedAt,
      stepsTotal: message.activity.stepsTotal,
      stepIndex: message.activity.stepIndex,
      stepCount: message.activity.stepIndex ?? 0,
      activeStepTitle: undefined,
      updates: [
        {
          id: `${message.id}:start`,
          activityId: message.id,
          timestamp: startedTimestamp,
          kind: "activity.start",
          title: message.activity.title,
          status: message.activity.status,
        },
      ],
      chips: [],
      durationMs: undefined,
      errorText: undefined,
    };

    set((state) => ({
      activities: { ...state.activities, [record.id]: record },
      currentActivityId: record.id,
      currentActivity: record,
      status: record.status,
      label: record.label,
      collapsed: false,
      chips: record.chips,
      timeline: record.updates,
      activeStep: undefined,
    }));
  },
  ingestActivityUpdate: (message) => {
    set((state) => {
      const existing = state.activities[message.activityId];
      if (!existing) {
        return state;
      }

      const timestamp = now();
      const updates = [...existing.updates];
      const entry: ActivityTimelineEntry = {
        id: message.id,
        activityId: message.activityId,
        timestamp,
        kind: message.update.kind,
      };

      let status = existing.status;
      let label = existing.label;
      let stepCount = existing.stepCount;
      let stepIndex = existing.stepIndex;
      let activeStepTitle = existing.activeStepTitle;
      let chips = cloneChips(existing.chips);
      let errorText = existing.errorText;

      switch (message.update.kind) {
        case "step.start": {
          stepCount = existing.stepCount + 1;
          stepIndex = stepCount;
          activeStepTitle = message.update.title;
          status = "thinking";
          label = message.update.title;
          chips = markLatestStepComplete(chips);
          chips.push({
            id: message.id,
            kind: "step",
            label: message.update.title,
            detail: message.update.title,
            state: "active",
            timestamp,
            meta: { stepIndex },
          });
          entry.title = message.update.title;
          entry.stepIndex = stepCount;
          break;
        }
        case "step.update": {
          entry.text = message.update.text;
          label = message.update.text;
          break;
        }
        case "tool.call": {
          const friendly = friendlyToolLabel(message.update.name);
          status = "tool-calling";
          label = `Calling ${friendly}`;
          entry.name = friendly;
          entry.args = message.update.args ?? {};
          chips = markLatestToolComplete(chips);
          chips.push({
            id: message.id,
            kind: "tool",
            label: `Tool: ${friendly}`,
            detail: friendly,
            state: "active",
            timestamp,
            meta: { rawName: message.update.name },
          });
          break;
        }
        case "tool.result": {
          const friendly = friendlyToolLabel(message.update.name);
          entry.name = friendly;
          entry.summary = message.update.summary;
          chips = markLatestToolComplete(chips, message.update.summary);
          status = "thinking";
          label = message.update.summary ?? `Finished ${friendly}`;
          break;
        }
        case "status": {
          status = message.update.status;
          label = fallbackLabel(message.update.status);
          entry.status = message.update.status;
          break;
        }
        case "warning": {
          entry.text = message.update.text;
          chips.push({
            id: message.id,
            kind: "warning",
            label: "Warning",
            detail: message.update.text,
            state: "pending",
            timestamp,
          });
          break;
        }
        case "error": {
          entry.text = message.update.text;
          status = "error";
          label = message.update.text;
          errorText = message.update.text;
          chips = chips.map((chip) =>
            chip.kind === "tool" && chip.state === "active"
              ? { ...chip, state: "error" }
              : chip,
          );
          chips.push({
            id: message.id,
            kind: "error",
            label: "Error",
            detail: message.update.text,
            state: "error",
            timestamp,
          });
          break;
        }
        default:
          break;
      }

      const existingIndex = updates.findIndex((update) => update.id === message.id);
      if (existingIndex >= 0) {
        const previous = updates[existingIndex];
        updates[existingIndex] = {
          ...previous,
          ...entry,
          timestamp,
        };
      } else {
        updates.push(entry);
      }

      const updatedRecord: ActivityRecord = {
        ...existing,
        status,
        label,
        stepCount,
        stepIndex,
        activeStepTitle,
        updates,
        chips,
        errorText,
      };

      const activities = { ...state.activities, [updatedRecord.id]: updatedRecord };
      const activeStepChip = findActiveStepChip(chips);

      return {
        activities,
        currentActivityId: updatedRecord.id,
        currentActivity: updatedRecord,
        status,
        label,
        chips,
        timeline: updates,
        activeStep: activeStepChip
          ? { index: (activeStepChip.meta?.stepIndex as number) ?? 0, title: activeStepTitle }
          : undefined,
      };
    });
  },
  ingestActivityDone: (message) => {
    set((state) => {
      const existing = state.activities[message.activityId];
      if (!existing) {
        return state;
      }

      const timestamp = now();
      const chips = markLatestToolComplete(markLatestStepComplete(existing.chips));
      const doneEntry: ActivityTimelineEntry = {
        id: message.id,
        activityId: message.activityId,
        timestamp,
        kind: "activity.done",
        status: "done",
      };
      const updates = [...existing.updates, doneEntry];

      const updatedRecord: ActivityRecord = {
        ...existing,
        status: "done",
        label: message.durationMs
          ? `Completed in ${(message.durationMs / 1000).toFixed(1)}s`
          : "Completed",
        durationMs: message.durationMs,
        chips,
        updates,
        activeStepTitle: undefined,
      };

      const activities = { ...state.activities, [updatedRecord.id]: updatedRecord };

      return {
        activities,
        currentActivityId: updatedRecord.id,
        currentActivity: updatedRecord,
        status: "done",
        label: updatedRecord.label,
        chips,
        timeline: updates,
        activeStep: undefined,
      };
    });
  },
  markBlocked: (message) => {
    set((state) => {
      if (!state.currentActivityId) {
        return state;
      }

      return {
        ...state,
        status: "blocked",
        label: message ?? fallbackLabel("blocked"),
      };
    });
  },
  markError: (message) => {
    set((state) => {
      if (!state.currentActivityId) {
        return state;
      }

      return {
        ...state,
        status: "error",
        label: message,
      };
    });
  },
  clearCurrent: () => {
    set((state) => ({
      ...state,
      currentActivityId: undefined,
      currentActivity: undefined,
      status: "idle",
      label: "",
      chips: [],
      timeline: [],
      activeStep: undefined,
    }));
  },
  reset: () => {
    set({ ...INITIAL_STATE });
  },
  setCollapsed: (collapsed) => {
    set((state) => ({
      ...state,
      collapsed,
    }));
  },
  toggleCollapsed: () => {
    set((state) => ({
      ...state,
      collapsed: !state.collapsed,
    }));
  },
  openDetails: () => {
    set((state) => ({
      ...state,
      detailsOpen: true,
    }));
  },
  closeDetails: () => {
    set((state) => ({
      ...state,
      detailsOpen: false,
    }));
  },
}));
