"use client";

import type { ReactNode } from "react";

type ItemKind = "goal" | "childGoal" | "task";

const KIND_LABEL: Record<ItemKind, string> = {
  goal: "Goal",
  childGoal: "Child goal",
  task: "Task",
};

// Mirrors the legacy app's `recently-updated-type` palette:
//   goal -> blue, child goal -> purple, task -> green.
const KIND_CLASSES: Record<ItemKind, string> = {
  goal: "bg-blue-100 text-blue-700 border border-blue-200",
  childGoal: "bg-purple-100 text-purple-700 border border-purple-200",
  task: "bg-emerald-100 text-emerald-700 border border-emerald-200",
};

const GOAL_TYPE_CLASSES: Record<"professional" | "personal", string> = {
  professional: "bg-slate-200/70 text-slate-700 border border-slate-300",
  personal: "bg-blue-100 text-blue-700 border border-blue-200",
};

const BASE_PILL_CLASS =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide";

export function KindTag({ kind, className }: { kind: ItemKind; className?: string }) {
  return (
    <span className={`${BASE_PILL_CLASS} ${KIND_CLASSES[kind]}${className ? ` ${className}` : ""}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}

export function GoalTypeTag({
  type,
  className,
}: {
  type: "professional" | "personal";
  className?: string;
}) {
  return (
    <span className={`${BASE_PILL_CLASS} ${GOAL_TYPE_CLASSES[type]}${className ? ` ${className}` : ""}`}>
      {type === "professional" ? "Professional" : "Personal"}
    </span>
  );
}

export function MetaTag({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "neutral" | "warning";
  className?: string;
}) {
  const toneClass =
    tone === "warning"
      ? "bg-amber-100 text-amber-800 border border-amber-200"
      : "bg-slate-100 text-slate-700 border border-slate-200";
  return (
    <span className={`${BASE_PILL_CLASS} ${toneClass}${className ? ` ${className}` : ""}`}>
      {children}
    </span>
  );
}
