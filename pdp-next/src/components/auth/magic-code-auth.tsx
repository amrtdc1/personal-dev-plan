"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { env } from "@/lib/config/env";
import { validateUserProfileWrite } from "@/lib/data/validation";
import { db, isInstantConfigured } from "@/lib/instantdb/client";

type AuthStage = "enter-email" | "enter-code";

export function MagicCodeAuth() {
  if (!isInstantConfigured) {
    return (
      <section className="rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-950">InstantDB configuration required</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          Set <strong>NEXT_PUBLIC_INSTANT_APP_ID</strong> in your local environment
          before testing Magic Code auth.
        </p>
      </section>
    );
  }

  return (
    <>
      <db.SignedIn>
        <SignedInPanel />
      </db.SignedIn>
      <db.SignedOut>
        <MagicCodeLogin />
      </db.SignedOut>
    </>
  );
}

function SignedInPanel() {
  const { isLoading, user, error } = db.useAuth();
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const { data, isLoading: isProfileLoading, error: profileError } = db.useQuery(
    user
      ? {
          userProfiles: {
            $: {
              where: {
                id: user.id,
              },
            },
          },
        }
      : null,
  );

  const profile = data?.userProfiles?.[0];

  useEffect(() => {
    if (!user || isProfileLoading || profile || bootstrapError) {
      return;
    }

    const currentUser = user;
    let isCancelled = false;

    async function bootstrapProfile() {
      try {
        const profilePayload = validateUserProfileWrite({
          uid: currentUser.id,
          email: currentUser.email ?? "",
          firstName: null,
          lastName: null,
          displayName: currentUser.email ?? null,
          theme: "light",
          palette: "ocean",
          timezone: getDefaultTimezone(),
          retentionDays: env.softDeleteRetentionDays,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          collegeLogoUrl: null,
        });

        await db.transact(
          db.tx.userProfiles[currentUser.id].update({
            uid: profilePayload.uid,
            email: profilePayload.email,
            firstName: profilePayload.firstName ?? null,
            lastName: profilePayload.lastName ?? null,
            displayName: profilePayload.displayName,
            theme: profilePayload.theme,
            palette: profilePayload.palette,
            timezone: profilePayload.timezone,
            retentionDays: profilePayload.retentionDays,
            createdAt: profilePayload.createdAt,
            updatedAt: profilePayload.updatedAt,
          }),
        );
      } catch (transactionError) {
        if (!isCancelled) {
          setBootstrapError(
            getErrorMessage(transactionError, "We could not create your initial profile."),
          );
        }
      }
    }

    void bootstrapProfile();

    return () => {
      isCancelled = true;
    };
  }, [bootstrapError, isProfileLoading, profile, user]);

  if (isLoading) {
    return <AuthCard title="Loading account">Checking your Magic Code session…</AuthCard>;
  }

  if (error) {
    return (
      <AuthCard title="Auth error">
        <p className="text-sm text-red-700">{error.message}</p>
      </AuthCard>
    );
  }

  if (!user) {
    return null;
  }

  const statusMessage = bootstrapError
    ? bootstrapError
    : profileError
      ? profileError.message
      : isProfileLoading || !profile
        ? "Setting up your profile defaults…"
        : "Profile defaults are provisioned and ready for data migration.";

  return (
    <AuthCard title="Signed in">
      <p className="text-sm leading-6 text-slate-700">
        Signed in as <strong>{user.email}</strong> using InstantDB Magic Code.
      </p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{statusMessage}</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => db.auth.signOut()}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Sign out
        </button>
        <span className="text-sm text-slate-500">Google can be added later as a secondary provider.</span>
      </div>
    </AuthCard>
  );
}

function MagicCodeLogin() {
  const [stage, setStage] = useState<AuthStage>("enter-email");
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);

  async function handleSendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!normalizedEmail) {
      setError("Enter an email address to receive a Magic Code.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await db.auth.sendMagicCode({ email: normalizedEmail });
      setSentEmail(normalizedEmail);
      setStage("enter-code");
    } catch (submissionError) {
      setError(getErrorMessage(submissionError, "We could not send a Magic Code."));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentEmail || !code.trim()) {
      setError("Enter the Magic Code that was sent to your email.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await db.auth.signInWithMagicCode({
        email: sentEmail,
        code: code.trim(),
      });
      setCode("");
    } catch (submissionError) {
      setError(getErrorMessage(submissionError, "That Magic Code was not accepted."));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthCard title="Magic Code sign in">
      <p className="text-sm leading-6 text-slate-700">
        Start with Magic Code only. This keeps sign-in lightweight for coworkers while we
        migrate the app to InstantDB.
      </p>
      <p className="mt-2 text-sm text-slate-500">
        App URL: {env.appUrl}
      </p>

      {stage === "enter-email" ? (
        <form className="mt-5 space-y-4" onSubmit={handleSendCode}>
          <label className="block text-sm font-medium text-slate-800" htmlFor="email">
            Work email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-500"
            placeholder="name@company.com"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isSubmitting ? "Sending…" : "Send Magic Code"}
          </button>
        </form>
      ) : (
        <form className="mt-5 space-y-4" onSubmit={handleVerifyCode}>
          <p className="text-sm text-slate-700">
            We sent a Magic Code to <strong>{sentEmail}</strong>.
          </p>
          <label className="block text-sm font-medium text-slate-800" htmlFor="code">
            Magic Code
          </label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none ring-0 transition focus:border-blue-500"
            placeholder="123456"
          />
          {error ? <p className="text-sm text-red-700">{error}</p> : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? "Signing in…" : "Verify code"}
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                setStage("enter-email");
                setCode("");
                setError(null);
              }}
              className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Use different email
            </button>
          </div>
        </form>
      )}
    </AuthCard>
  );
}

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string) {
  if (typeof error === "object" && error !== null) {
    const maybeMessage = (error as { body?: { message?: string }; message?: string }).body?.message;
    if (maybeMessage) {
      return maybeMessage;
    }

    if ((error as { message?: string }).message) {
      return (error as { message: string }).message;
    }
  }

  return fallbackMessage;
}

function getDefaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}