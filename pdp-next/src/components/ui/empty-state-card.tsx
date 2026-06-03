import type { ReactNode } from "react";

type EmptyStateCardProps = {
  title: string;
  description: string;
  className?: string;
  action?: ReactNode;
};

export function EmptyStateCard({ title, description, className, action }: EmptyStateCardProps) {
  return (
    <section
      className={`pdp-panel rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 ${className ?? ""}`.trim()}
      aria-live="polite"
    >
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm text-slate-700">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}
