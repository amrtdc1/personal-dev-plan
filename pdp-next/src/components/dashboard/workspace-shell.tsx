import type { ReactNode } from "react";

type WorkspaceShellProps = {
  title: string;
  description?: string;
  headerAside?: ReactNode;
  notices?: ReactNode;
  mobileNav?: ReactNode;
  leftRailTitle?: string;
  leftRailContent?: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({
  title,
  description,
  headerAside,
  notices,
  mobileNav,
  leftRailTitle,
  leftRailContent,
  children,
}: WorkspaceShellProps) {
  return (
    <section className="pdp-panel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="pdp-section-title text-slate-900">{title}</h2>
          {description ? <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700">{description}</p> : null}
        </div>
        {headerAside}
      </div>

      {notices}

      {mobileNav ? <div className="mt-4 lg:hidden">{mobileNav}</div> : null}

      {leftRailContent ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[15rem_1fr]">
          <aside className="pdp-panel-muted hidden lg:block">
            {leftRailTitle ? <h3 className="pdp-section-kicker text-slate-600">{leftRailTitle}</h3> : null}
            <div className={leftRailTitle ? "mt-3" : ""}>{leftRailContent}</div>
          </aside>
          <div>{children}</div>
        </div>
      ) : (
        <div className="mt-4">{children}</div>
      )}
    </section>
  );
}
