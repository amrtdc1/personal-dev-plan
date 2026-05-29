import type { ReactNode } from "react";

type WorkspaceShellProps = {
  title: string;
  titleTrailing?: ReactNode;
  description?: string;
  descriptionClassName?: string;
  sectionClassName?: string;
  headerAside?: ReactNode;
  notices?: ReactNode;
  mobileNav?: ReactNode;
  leftRailTitle?: string;
  leftRailClassName?: string;
  leftRailContent?: ReactNode;
  children: ReactNode;
};

export function WorkspaceShell({
  title,
  titleTrailing,
  description,
  descriptionClassName,
  sectionClassName,
  headerAside,
  notices,
  mobileNav,
  leftRailTitle,
  leftRailClassName,
  leftRailContent,
  children,
}: WorkspaceShellProps) {
  return (
    <section className={`pdp-panel min-w-0 overflow-x-clip ${sectionClassName ?? ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="pdp-section-title text-slate-900">{title}</h2>
            {titleTrailing}
          </div>
          {description ? (
            <p className={`mt-2 max-w-3xl text-sm leading-6 text-slate-700 ${descriptionClassName ?? ""}`}>
              {description}
            </p>
          ) : null}
        </div>
        {headerAside}
      </div>

      {notices}

      {mobileNav ? <div className="mt-4 lg:hidden">{mobileNav}</div> : null}

      {leftRailContent ? (
        <div className="mt-4 grid min-w-0 gap-3 lg:grid-cols-[15rem_minmax(0,1fr)]">
          <aside className={`pdp-panel-muted hidden lg:block ${leftRailClassName ?? ""}`}>
            {leftRailTitle ? <h3 className="pdp-section-kicker text-slate-600">{leftRailTitle}</h3> : null}
            <div className={leftRailTitle ? "mt-3" : ""}>{leftRailContent}</div>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      ) : (
        <div className="mt-4 min-w-0">{children}</div>
      )}
    </section>
  );
}
