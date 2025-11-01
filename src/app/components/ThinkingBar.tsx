"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Square,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useActivityStore, type ActivityChip } from "@/app/components/useActivityStore";
import type { ActivityStatus, ActivityTimelineEntry } from "@/types";

type ThinkingBarProps = {
  onStop: () => void;
  onRetry: () => void;
};

type StepStatus = "done" | "active" | "pending";

type StepDisplay = {
  id: string;
  title: string;
  status: StepStatus;
  index: number;
};

function deriveStepStatus(chip: ActivityChip): StepStatus {
  if (chip.state === "completed") {
    return "done";
  }
  if (chip.state === "active") {
    return "active";
  }
  return "pending";
}

function classForStep(status: StepStatus): string {
  switch (status) {
    case "done":
      return "border-emerald-500/60 text-emerald-300 bg-emerald-500/10";
    case "active":
      return "border-amber-400/60 text-amber-200 bg-amber-500/10";
    case "pending":
    default:
      return "border-slate-700/80 text-slate-500 bg-slate-800/40";
  }
}

function fallbackStepsFromStatus(status: ActivityStatus): StepDisplay[] {
  const base: StepDisplay[] = [
    { id: "planning", title: "Planning", status: "pending", index: 1 },
    { id: "searching", title: "Searching", status: "pending", index: 2 },
    { id: "summarizing", title: "Summarizing", status: "pending", index: 3 },
  ];

  switch (status) {
    case "thinking":
      base[0].status = "active";
      break;
    case "tool-calling":
      base[0].status = "done";
      base[1].status = "active";
      break;
    case "streaming":
      base[0].status = "done";
      base[1].status = "done";
      base[2].status = "active";
      break;
    case "done":
      base.forEach((step) => {
        step.status = "done";
      });
      break;
    case "error":
    case "blocked":
    case "idle":
    default:
      break;
  }

  return base;
}

function formatTimelineEntry(entry: ActivityTimelineEntry): string | null {
  switch (entry.kind) {
    case "step.update":
      return entry.text ?? null;
    case "tool.call":
      return entry.name ? `Calling ${entry.name} tool…` : "Calling tool…";
    case "tool.result":
      if (entry.summary) {
        return entry.summary;
      }
      return entry.name ? `Finished ${entry.name}.` : "Tool completed.";
    case "warning":
      return entry.text ?? null;
    case "error":
      return entry.text ?? "Something went wrong.";
    default:
      return null;
  }
}

function buildDetailItems(timeline: ActivityTimelineEntry[], status: ActivityStatus): string[] {
  const relevantKinds = new Set([
    "step.update",
    "tool.call",
    "tool.result",
    "warning",
    "error",
  ]);

  const collected: string[] = [];
  const seen = new Set<string>();

  for (let index = timeline.length - 1; index >= 0; index -= 1) {
    const entry = timeline[index];
    if (!relevantKinds.has(entry.kind)) {
      continue;
    }

    const text = formatTimelineEntry(entry);
    if (!text) {
      continue;
    }

    if (seen.has(text)) {
      continue;
    }

    seen.add(text);
    collected.unshift(text);
    if (collected.length === 4) {
      break;
    }
  }

  if (collected.length > 0) {
    return collected;
  }

  switch (status) {
    case "done":
      return ["Generation completed."];
    case "error":
      return ["Encountered an error while thinking."];
    case "tool-calling":
      return ["Engaging available tools…"];
    case "streaming":
      return ["Writing the final response…"];
    default:
      return ["Working through the plan…"];
  }
}

const ThinkingBar = memo(function ThinkingBar(props: ThinkingBarProps) {
  const { onStop, onRetry } = props;
  const status = useActivityStore((state) => state.status);
  const label = useActivityStore((state) => state.label);
  const chips = useActivityStore((state) => state.chips);
  const collapsed = useActivityStore((state) => state.collapsed);
  const detailsOpen = useActivityStore((state) => state.detailsOpen);
  const toggleCollapsed = useActivityStore((state) => state.toggleCollapsed);
  const openDetails = useActivityStore((state) => state.openDetails);
  const closeDetails = useActivityStore((state) => state.closeDetails);
  const clearCurrent = useActivityStore((state) => state.clearCurrent);
  const timeline = useActivityStore((state) => state.timeline);
  const activeStep = useActivityStore((state) => state.activeStep);
  const currentActivity = useActivityStore((state) => state.currentActivity);

  const prefersReducedMotion = useReducedMotion() ?? false;
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let nextVisible = isVisible;

    if (status !== "idle") {
      nextVisible = true;
    } else if (!currentActivity) {
      nextVisible = false;
    }

    if (nextVisible !== isVisible) {
      setIsVisible(nextVisible);
    }
  }, [currentActivity, isVisible, status]);

  const handleStopClick = useCallback(() => {
    onStop();
  }, [onStop]);

  const handleRetryClick = useCallback(() => {
    onRetry();
  }, [onRetry]);

  const handleDismiss = useCallback(() => {
    closeDetails();
    clearCurrent();
    setIsVisible(false);
  }, [clearCurrent, closeDetails]);

  const canStop = status === "thinking" || status === "tool-calling" || status === "streaming";
  const isError = status === "error";
  const expanded = !collapsed;
  const shouldRender = isVisible && (status !== "idle" || !!currentActivity);

  const stepChips = useMemo(
    () => chips.filter((chip) => chip.kind === "step"),
    [chips],
  );

  const steps: StepDisplay[] = useMemo(() => {
    if (stepChips.length === 0) {
      return fallbackStepsFromStatus(status);
    }

    return stepChips.map((chip, index) => ({
      id: chip.id,
      title: chip.detail || chip.label || `Step ${chip.meta?.stepIndex ?? index + 1}`,
      status: deriveStepStatus(chip),
      index: (chip.meta?.stepIndex as number | undefined) ?? index + 1,
    }));
  }, [stepChips, status]);

  const detailHeading = useMemo(() => {
    if (activeStep?.title) {
      return activeStep.index ? `Step ${activeStep.index}: ${activeStep.title}` : activeStep.title;
    }
    if (label) {
      return label;
    }
    return "Thinking…";
  }, [activeStep, label]);

  const detailItems = useMemo(() => buildDetailItems(timeline, status), [timeline, status]);

  const indicatorTone = useMemo(() => {
    if (status === "error") {
      return "text-red-400";
    }
    if (status === "done") {
      return "text-emerald-400";
    }
    return "text-emerald-300";
  }, [status]);

  const indicator = useMemo(() => {
    if (prefersReducedMotion) {
      return (
        <div className={cn("flex items-center gap-1", indicatorTone)}>
          <span className="inline-flex size-2 rounded-full bg-current" />
          <span className="inline-flex size-2 rounded-full bg-current" />
          <span className="inline-flex size-2 rounded-full bg-current" />
        </div>
      );
    }

    return (
      <div className={cn("flex items-center gap-1", indicatorTone)}>
        {[0, 1, 2].map((dot) => (
          // eslint-disable-next-line react/no-array-index-key
          <motion.span
            key={dot}
            className="inline-flex size-2 rounded-full bg-current/80"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: dot * 0.2 }}
          />
        ))}
      </div>
    );
  }, [indicatorTone, prefersReducedMotion]);

  if (!shouldRender) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="pointer-events-auto mx-auto w-full max-w-xl rounded-2xl border border-slate-800/90 bg-slate-950/80 text-slate-100 shadow-2xl backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {indicator}
          <span className="text-sm font-medium">{label || "Thinking…"}</span>
        </div>
        <div className="flex items-center gap-1">
          {canStop && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleStopClick}
              aria-label="Stop generation"
              title="Stop"
            >
              <Square className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={detailsOpen ? closeDetails : openDetails}
            aria-label={detailsOpen ? "Hide timeline" : "Show timeline"}
            title={detailsOpen ? "Hide timeline" : "Show timeline"}
          >
            {detailsOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
          </Button>
          {isError && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleRetryClick}
              aria-label="Retry"
              title="Retry"
            >
              <RotateCcw className="size-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleCollapsed}
            aria-label={expanded ? "Collapse thinking details" : "Expand thinking details"}
            title={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDismiss}
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>
      {expanded && steps.length > 0 && (
        <div className="border-t border-slate-800/70 bg-slate-900/40 px-4 py-3">
          <div className="flex flex-wrap gap-2">
            {steps.map((step) => (
              <div
                key={step.id}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
                  classForStep(step.status),
                )}
              >
                {step.status === "active" && <Loader2 className="size-3.5 animate-spin" />}
                <span>{step.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expanded && (
        <div className="border-t border-slate-800/70 bg-slate-900/25 px-4 py-3 text-xs text-slate-400">
          <div className="mb-2 flex items-center gap-2 text-slate-300">
            <Info className="size-3" />
            <span className="font-medium">{detailHeading}</span>
          </div>
          <ul className="list-disc space-y-1 pl-5">
            {detailItems.map((item, index) => (
              // eslint-disable-next-line react/no-array-index-key
              <li key={`${item}-${index}`} className="leading-relaxed">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </motion.div>
  );
});

export default ThinkingBar;
