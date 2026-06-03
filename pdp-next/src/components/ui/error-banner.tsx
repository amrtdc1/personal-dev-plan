import type { ReactNode } from "react";

type ErrorBannerProps = {
  title: string;
  message: string;
  className?: string;
  actions?: ReactNode;
};

export function ErrorBanner({ title, message, className, actions }: ErrorBannerProps) {
  return (
    <section className={`pdp-panel rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm ${className ?? ""}`.trim()} role="alert">
      <h2 className="text-lg font-semibold text-red-700">{title}</h2>
      <p className="mt-2 text-sm text-red-700">{message}</p>
      {actions ? <div className="mt-3">{actions}</div> : null}
    </section>
  );
}
