import type { ReactNode } from "react";

type LoadingSectionProps = {
  title: string;
  message?: string;
  className?: string;
  titleClassName?: string;
  messageClassName?: string;
  icon?: ReactNode;
};

export function LoadingSection({
  title,
  message = "Loading...",
  className,
  titleClassName,
  messageClassName,
  icon,
}: LoadingSectionProps) {
  return (
    <section className={`pdp-panel ${className ?? ""}`.trim()} aria-live="polite" aria-busy="true">
      <div className="flex items-start gap-3">
        {icon ? <span className="mt-0.5 text-slate-500">{icon}</span> : null}
        <div>
          <h2 className={`text-lg font-semibold text-slate-900 ${titleClassName ?? ""}`.trim()}>{title}</h2>
          <p className={`mt-3 text-sm text-slate-700 ${messageClassName ?? ""}`.trim()}>{message}</p>
        </div>
      </div>
    </section>
  );
}
