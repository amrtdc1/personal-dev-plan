import { MigrationDataPreview } from "@/components/dashboard/migration-data-preview";
import { MagicCodeAuth } from "@/components/auth/magic-code-auth";
import { CalendarWorkspace } from "@/components/dashboard/calendar-workspace";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10 md:px-10">
      <section className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-blue-700">
          Migration Workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 md:text-4xl">
          Personal Development Plan
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 md:text-base">
          This Next.js app is the in-place migration target for the legacy PDP app.
          Current focus is Phase 0/1: architecture foundation, security baseline,
          and PWA-ready setup before feature parity migration.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Implementation status</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Completed: Next.js app scaffolded in-repo</li>
            <li>Completed: environment template and docs baseline</li>
            <li>Completed: initial PWA manifest and service worker placeholder</li>
            <li>Completed: InstantDB Magic Code auth slice</li>
            <li>Completed: repository-backed goals, subgoals, and tasks CRUD/status/reorder flows</li>
            <li>Completed: first protected Instant server mutation route</li>
          </ul>
        </article>

        <article className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Project constraints</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Migration mode: in-place incremental</li>
            <li>Soft-delete retention: 60 days</li>
            <li>Offline-first behavior required (installable PWA)</li>
            <li>Calendar support: ICS export + subscription links</li>
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Next coding steps</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Expand protected server mutations beyond goal status updates.</li>
          <li>Push the current schema to InstantDB and add locked-down permissions.</li>
          <li>Introduce offline queue strategy and reconcile flow.</li>
          <li>Add Google as an optional secondary auth provider.</li>
        </ol>
      </section>

      <MagicCodeAuth />
      <CalendarWorkspace />
      <MigrationDataPreview />
    </main>
  );
}
