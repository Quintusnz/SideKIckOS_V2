export type EventKind = "step" | "tool" | "artifact" | "message" | "error";

export type TimelineEvent = {
  id: string;
  time: string;
  title: string;
  kind: EventKind;
  summary?: string;
  detail?: string;
  expandable?: boolean;
  artifactLabel?: string;
};

export type TimelineDensity = "compact" | "dense";
