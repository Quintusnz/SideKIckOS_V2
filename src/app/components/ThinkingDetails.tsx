"use client";

import type { ReactElement } from "react";
import { memo, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquareText,
  Sparkles,
  Workflow,
  Wrench,
  XCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  useActivityStore,
  type ActivityTimelineEntry,
} from "@/app/components/useActivityStore";

function formatTimestamp(timestamp: number | undefined): string {
  if (!timestamp) {
    return "";
  }

  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (error) {
    return "";
  }
}

function entryTitle(entry: ActivityTimelineEntry): string {
  switch (entry.kind) {
    case "activity.start":
      return "Activity started";
    case "step.start":
      return entry.title ? `Step started — ${entry.title}` : "Step started";
    case "step.update":
      return "Progress update";
    case "tool.call":
      return entry.name ? `Tool call — ${entry.name}` : "Tool call";
    case "tool.result":
      return entry.name ? `Tool result — ${entry.name}` : "Tool result";
    case "status":
      return entry.status ? `Status — ${entry.status}` : "Status update";
    case "warning":
      return "Warning";
    case "error":
      return "Error";
    case "activity.done":
      return "Activity completed";
    default:
      return "Update";
  }
}

function entryIcon(entry: ActivityTimelineEntry): ReactElement {
  switch (entry.kind) {
    case "activity.start":
      return <Sparkles className="size-4 text-blue-400" />;
    case "step.start":
      return <Workflow className="size-4 text-indigo-400" />;
    case "step.update":
      return <ClipboardList className="size-4 text-slate-300" />;
    case "tool.call":
      return <Wrench className="size-4 text-cyan-300" />;
    case "tool.result":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    case "status":
      return <Loader2 className="size-4 text-slate-300" />;
    case "warning":
      return <AlertTriangle className="size-4 text-amber-300" />;
    case "error":
      return <XCircle className="size-4 text-red-300" />;
    case "activity.done":
      return <CheckCircle2 className="size-4 text-emerald-400" />;
    default:
      return <MessageSquareText className="size-4 text-slate-300" />;
  }
}

function ToolSummary(props: { summary?: string }) {
  const { summary } = props;
  const [open, setOpen] = useState(false);

  if (!summary) {
    return null;
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-1">
      <p
        className={cn(
          "text-xs text-slate-300",
          open ? "whitespace-pre-wrap" : "line-clamp-1",
        )}
      >
        {summary}
      </p>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="px-0 text-xs text-blue-300 hover:text-blue-200"
        >
          {open ? "Show less" : "View more"}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-1 whitespace-pre-wrap text-xs text-slate-300">
        {summary}
      </CollapsibleContent>
    </Collapsible>
  );
}

const ThinkingDetails = memo(function ThinkingDetails() {
  const timeline = useActivityStore((state) => state.timeline);
  const currentActivity = useActivityStore((state) => state.currentActivity);
  const detailsOpen = useActivityStore((state) => state.detailsOpen);
  const openDetails = useActivityStore((state) => state.openDetails);
  const closeDetails = useActivityStore((state) => state.closeDetails);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        openDetails();
      } else {
        closeDetails();
      }
    },
    [closeDetails, openDetails],
  );

  const items = useMemo(() => timeline.slice().reverse(), [timeline]);

  if (!currentActivity && !timeline.length) {
    return null;
  }

  return (
    <Sheet open={detailsOpen} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="max-h-[75vh] w-full overflow-hidden border-slate-800 bg-slate-900/95 p-0 shadow-2xl backdrop-blur">
        <SheetHeader className="border-b border-slate-800/80 bg-slate-900/90">
          <SheetTitle className="text-base text-slate-100">
            {currentActivity?.title ?? "Activity timeline"}
          </SheetTitle>
          {currentActivity?.label && (
            <p className="text-xs text-slate-400">{currentActivity.label}</p>
          )}
        </SheetHeader>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-4">
          <div className="space-y-3">
            {items.map((entry) => (
              <div
                key={entry.id}
                className="flex gap-3 rounded-xl border border-slate-800/60 bg-slate-900/80 px-3 py-3"
              >
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-full bg-slate-800/70">
                  {entryIcon(entry)}
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-100">
                      {entryTitle(entry)}
                    </p>
                    <span className="text-xs text-slate-500">
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  {entry.title && entry.kind === "step.start" && (
                    <p className="text-xs text-slate-300">{entry.title}</p>
                  )}
                  {entry.text && (
                    <p className="text-xs text-slate-300">{entry.text}</p>
                  )}
                  {entry.summary && <ToolSummary summary={entry.summary} />}
                  {entry.args && Object.keys(entry.args).length > 0 && (
                    <pre className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-slate-950/70 px-3 py-2 text-[11px] text-slate-300">
                      {JSON.stringify(entry.args, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <p className="rounded-lg border border-dashed border-slate-700 px-3 py-6 text-center text-sm text-slate-400">
                Waiting for activity updates…
              </p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
});

export default ThinkingDetails;
