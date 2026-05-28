"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { db } from "@/lib/instantdb/client";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type PushSubscriptionPayload = {
  endpoint: string;
  expirationTime: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};

type ReminderType = "daily_agenda" | "weekly_review" | "due_tasks";

type NotificationPreferences = {
  dailyAgendaEnabled: boolean;
  weeklyReviewEnabled: boolean;
  dueTasksEnabled: boolean;
  preferredHourLocal: number | null;
  timezone: string | null;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
};

type DeliveryHistoryItem = {
  id: string;
  reminderType: string;
  status: "sent" | "failed" | "skipped";
  title?: string;
  message?: string;
  createdAt: string;
};

type HistoryStatusFilter = "all" | "sent" | "failed" | "skipped";
type HistoryTypeFilter = "all" | "daily_agenda" | "weekly_review" | "due_tasks" | "test";
type HistoryWindowFilter = "24h" | "7d" | "30d" | "all";

const DISMISS_KEY = "pdp.installNotify.dismissedAt";
const DISMISS_WINDOW_MS = 1000 * 60 * 60 * 24 * 7;
export const OPEN_PUSH_SETTINGS_EVENT = "pdp:open-push-settings";

export function InstallAndNotifyBanner() {
  const { user } = db.useAuth();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return "unsupported";
    }

    return window.Notification.permission;
  });
  const [hasPushSubscription, setHasPushSubscription] = useState(false);
  const [isLoadingAction, setIsLoadingAction] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isDismissed, setIsDismissed] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const dismissedAtRaw = window.localStorage.getItem(DISMISS_KEY);
    if (!dismissedAtRaw) {
      return false;
    }

    const dismissedAt = Number(dismissedAtRaw);
    return !Number.isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_WINDOW_MS;
  });
  const [selectedReminderType, setSelectedReminderType] = useState<ReminderType>("daily_agenda");
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    dailyAgendaEnabled: true,
    weeklyReviewEnabled: true,
    dueTasksEnabled: true,
    preferredHourLocal: null,
    timezone: null,
    quietHoursStart: null,
    quietHoursEnd: null,
  });
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [deliveryHistory, setDeliveryHistory] = useState<DeliveryHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>("all");
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>("all");
  const [historyWindowFilter, setHistoryWindowFilter] = useState<HistoryWindowFilter>("7d");
  const [historyNextCursor, setHistoryNextCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  const isIosSafari = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }

    const userAgent = window.navigator.userAgent;
    const isIosDevice = /iPhone|iPad|iPod/i.test(userAgent);
    const isWebkit = /WebKit/i.test(userAgent);
    const isNonSafariIosBrowser = /CriOS|FxiOS|EdgiOS|OPiOS/i.test(userAgent);
    return isIosDevice && isWebkit && !isNonSafariIosBrowser;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const checkStandalone = () => {
      const isIosStandalone =
        "standalone" in window.navigator && typeof window.navigator.standalone === "boolean"
          ? Boolean(window.navigator.standalone)
          : false;
      const isDisplayStandalone = window.matchMedia("(display-mode: standalone)").matches;
      setIsStandalone(isIosStandalone || isDisplayStandalone);
    };

    checkStandalone();

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      checkStandalone();
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    const loadSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setHasPushSubscription(Boolean(subscription));
      } catch {
        setHasPushSubscription(false);
      }
    };

    void loadSubscription();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const onOpenPushSettings = () => {
      setIsDismissed(false);
      setError(null);
      setSuccess(null);
      window.localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener(OPEN_PUSH_SETTINGS_EVENT, onOpenPushSettings);

    return () => {
      window.removeEventListener(OPEN_PUSH_SETTINGS_EVENT, onOpenPushSettings);
    };
  }, []);

  const shouldShowInstallPrompt = useMemo(
    () => Boolean(user) && !isDismissed && !isStandalone && deferredPrompt !== null,
    [deferredPrompt, isDismissed, isStandalone, user],
  );

  const shouldShowIosInstallHelp = useMemo(
    () => Boolean(user) && !isDismissed && !isStandalone && deferredPrompt === null && isIosSafari,
    [deferredPrompt, isDismissed, isIosSafari, isStandalone, user],
  );

  const shouldShowNotificationPrompt = useMemo(() => {
    if (!user || isDismissed || !isStandalone || !vapidPublicKey || notificationPermission === "unsupported") {
      return false;
    }

    return notificationPermission !== "granted" || !hasPushSubscription;
  }, [hasPushSubscription, isDismissed, isStandalone, notificationPermission, user, vapidPublicKey]);

  const shouldShowNotificationManagement = useMemo(
    () => Boolean(user) && !isDismissed && isStandalone && notificationPermission === "granted" && hasPushSubscription,
    [hasPushSubscription, isDismissed, isStandalone, notificationPermission, user],
  );
  const timezoneOptions = useMemo(() => getTimezoneOptions(preferences.timezone ?? undefined), [preferences.timezone]);

  const refreshDeliveryHistory = useCallback(async (cursor?: string) => {
    setIsLoadingHistory(true);

    try {
      const query = buildHistoryQuery({
        status: historyStatusFilter,
        type: historyTypeFilter,
        window: historyWindowFilter,
        before: cursor,
      });
      const response = await fetch(`/api/notifications/deliveries?${query}`, {
        method: "GET",
      });

      const responseBody = (await response.json().catch(() => null)) as
        | {
            deliveries?: DeliveryHistoryItem[];
            hasMore?: boolean;
            nextCursor?: string | null;
            error?: string;
          }
        | null;

      if (!response.ok) {
        throw new Error(responseBody?.error || "Could not refresh delivery history.");
      }

      const incoming = responseBody?.deliveries ?? [];
      setDeliveryHistory((current) => (cursor ? [...current, ...incoming] : incoming));
      setHistoryHasMore(Boolean(responseBody?.hasMore));
      setHistoryNextCursor(responseBody?.nextCursor ?? null);
    } catch {
      setDeliveryHistory([]);
      setHistoryHasMore(false);
      setHistoryNextCursor(null);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyStatusFilter, historyTypeFilter, historyWindowFilter]);

  useEffect(() => {
    if (!shouldShowNotificationManagement) {
      return;
    }

    let isCancelled = false;

    const loadPreferences = async () => {
      setIsLoadingPreferences(true);
      try {
        const response = await fetch("/api/notifications/preferences", { method: "GET" });
        const responseBody = (await response.json().catch(() => null)) as { preferences?: NotificationPreferences; error?: string } | null;

        if (!response.ok) {
          throw new Error(responseBody?.error || "Could not load notification preferences.");
        }

        if (!isCancelled && responseBody?.preferences) {
          setPreferences(responseBody.preferences);
        }
      } catch {
        if (!isCancelled) {
          setPreferences((current) => current);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPreferences(false);
        }
      }
    };

    void loadPreferences();
    queueMicrotask(() => {
      void refreshDeliveryHistory();
    });

    return () => {
      isCancelled = true;
    };
  }, [refreshDeliveryHistory, shouldShowNotificationManagement]);

  useEffect(() => {
    if (!shouldShowNotificationManagement) {
      return;
    }

    queueMicrotask(() => {
      void refreshDeliveryHistory();
    });
  }, [refreshDeliveryHistory, shouldShowNotificationManagement]);

  const shouldRenderBanner =
    shouldShowInstallPrompt || shouldShowIosInstallHelp || shouldShowNotificationPrompt || shouldShowNotificationManagement;

  if (!shouldRenderBanner) {
    return null;
  }

  return (
    <aside className="fixed inset-x-2 top-2 z-40 max-w-[calc(100vw-1rem)] sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:w-[22rem]">
      <div className="pdp-card pdp-modal-theme flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-2.5 text-sm shadow-lg sm:max-h-[min(80vh,46rem)] sm:p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 sm:text-xs">
              {shouldShowInstallPrompt
                ? "Install app"
                : shouldShowIosInstallHelp
                  ? "Install on iPhone"
                  : shouldShowNotificationPrompt
                    ? "Enable notifications"
                    : "Manage notifications"}
            </p>
            <p className="mt-1 text-xs text-slate-700 sm:text-sm">
              {shouldShowInstallPrompt
                ? "Install PDP on your home screen to unlock reminder notifications and a native app feel."
                : shouldShowIosInstallHelp
                  ? "On iPhone Safari: tap Share, then Add to Home Screen. iOS does not show an automatic install pop-up."
                  : shouldShowNotificationPrompt
                    ? "Turn on push notifications for daily agenda, weekly review, and habit reminders."
                    : "Push notifications are enabled. Send a quick test or disable notifications for this device."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Dismiss
          </button>
        </div>

        {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        {success ? <p className="mt-2 text-xs text-emerald-700">{success}</p> : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5 sm:pr-1">
          <div className="mt-2.5 space-y-2.5 sm:mt-3 sm:space-y-3">
            {shouldShowInstallPrompt ? (
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={isLoadingAction}
                className="w-full rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoadingAction ? "Opening..." : "Install app"}
              </button>
            ) : shouldShowIosInstallHelp ? (
              <div className="w-full rounded-2xl border border-slate-200 p-2.5 text-xs text-slate-700 sm:p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Install steps</p>
                <p className="mt-1">1. Tap Share in Safari</p>
                <p>2. Tap Add to Home Screen</p>
                <p>3. Tap Add</p>
              </div>
            ) : shouldShowNotificationPrompt ? (
              <button
                type="button"
                onClick={() => void handleEnableNotifications()}
                disabled={isLoadingAction}
                className="w-full rounded-full bg-slate-900 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoadingAction ? "Updating..." : "Enable push"}
              </button>
            ) : (
              <>
                <section className="w-full rounded-2xl border border-slate-200 p-2.5 sm:p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reminder preferences</p>
                  <div className="space-y-1.5 text-xs text-slate-700 sm:space-y-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.dailyAgendaEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            dailyAgendaEnabled: event.target.checked,
                          }))
                        }
                      />
                      Daily agenda
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.weeklyReviewEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            weeklyReviewEnabled: event.target.checked,
                          }))
                        }
                      />
                      Weekly review
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.dueTasksEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            dueTasksEnabled: event.target.checked,
                          }))
                        }
                      />
                      Due tasks
                    </label>
                  </div>

                  <div className="mt-2.5 grid grid-cols-1 gap-2 sm:mt-3 sm:grid-cols-2">
                    <div className="min-w-0 sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Preferred hour (local)</label>
                      <select
                        value={preferences.preferredHourLocal === null ? "" : String(preferences.preferredHourLocal)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPreferences((current) => ({
                            ...current,
                            preferredHourLocal: value === "" ? null : Number(value),
                          }));
                        }}
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 max-w-full rounded-xl px-2 py-1 text-xs"
                      >
                        <option value="">Any hour</option>
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={String(hour)}>
                            {`${String(hour).padStart(2, "0")}:00`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Timezone</label>
                      <select
                        value={preferences.timezone ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            timezone: event.target.value || null,
                          }))
                        }
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 max-w-full rounded-xl px-2 py-1 text-xs"
                      >
                        <option value="">Use device timezone</option>
                        {timezoneOptions.map((timezoneValue) => (
                          <option key={timezoneValue} value={timezoneValue}>
                            {timezoneValue}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="min-w-0 sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Quiet start</label>
                      <input
                        type="time"
                        value={preferences.quietHoursStart ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            quietHoursStart: event.target.value || null,
                          }))
                        }
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 max-w-[11.5rem] rounded-xl px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Quiet end</label>
                      <input
                        type="time"
                        value={preferences.quietHoursEnd ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            quietHoursEnd: event.target.value || null,
                          }))
                        }
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 max-w-[11.5rem] rounded-xl px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleSavePreferences()}
                    disabled={isLoadingAction || isLoadingPreferences}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingAction ? "Saving..." : "Save preferences"}
                  </button>
                  <select
                    value={selectedReminderType}
                    onChange={(event) => setSelectedReminderType(event.target.value as ReminderType)}
                    disabled={isLoadingAction || isLoadingPreferences}
                    className="pdp-control rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                    aria-label="Reminder type"
                  >
                    <option value="daily_agenda">Daily agenda</option>
                    <option value="weekly_review">Weekly review</option>
                    <option value="due_tasks">Due tasks</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleSendReminderNotification()}
                    disabled={isLoadingAction}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isLoadingAction ? "Sending..." : "Send reminder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendTestNotification()}
                    disabled={isLoadingAction}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isLoadingAction ? "Sending..." : "Send test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisableNotifications()}
                    disabled={isLoadingAction}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Disable push
                  </button>
                </div>

                <section className="w-full rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Recent notification activity
                  </p>
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={historyStatusFilter}
                      onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs"
                      disabled={isLoadingHistory}
                      aria-label="Activity status filter"
                    >
                      <option value="all">All statuses</option>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                    <select
                      value={historyTypeFilter}
                      onChange={(event) => setHistoryTypeFilter(event.target.value as HistoryTypeFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs"
                      disabled={isLoadingHistory}
                      aria-label="Activity type filter"
                    >
                      <option value="all">All types</option>
                      <option value="daily_agenda">Daily agenda</option>
                      <option value="weekly_review">Weekly review</option>
                      <option value="due_tasks">Due tasks</option>
                      <option value="test">Test</option>
                    </select>
                    <select
                      value={historyWindowFilter}
                      onChange={(event) => setHistoryWindowFilter(event.target.value as HistoryWindowFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs sm:col-span-2"
                      disabled={isLoadingHistory}
                      aria-label="Activity window filter"
                    >
                      <option value="24h">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Sent {deliveryHistory.filter((entry) => entry.status === "sent").length}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Failed {deliveryHistory.filter((entry) => entry.status === "failed").length}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Skipped {deliveryHistory.filter((entry) => entry.status === "skipped").length}
                    </span>
                  </div>
                  {isLoadingHistory ? <p className="text-xs text-slate-500">Loading activity...</p> : null}
                  {!isLoadingHistory && deliveryHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No delivery records yet.</p>
                  ) : null}
                  <div className="mt-2 max-h-52 space-y-2 overflow-y-auto pr-1 sm:max-h-56">
                    {!isLoadingHistory && deliveryHistory.length > 0
                      ? deliveryHistory.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-slate-100 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {formatReminderLabel(entry.reminderType)} - {entry.status}
                            </p>
                            <p className="text-xs text-slate-700">{entry.message || entry.title || "No message"}</p>
                            <p className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      : null}
                  </div>
                  {historyHasMore ? (
                    <button
                      type="button"
                      onClick={() => void refreshDeliveryHistory(historyNextCursor ?? undefined)}
                      className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory ? "Loading..." : "Load more"}
                    </button>
                  ) : null}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );

  async function handleInstall() {
    if (!deferredPrompt) {
      setError("Install is not available in this browser yet.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;

      if (choice.outcome === "accepted") {
        setSuccess("App install started.");
        setDeferredPrompt(null);
      } else {
        setSuccess("Install dismissed.");
      }
    } catch {
      setError("Install prompt could not be shown. Try using your browser menu to install the app.");
    } finally {
      setIsLoadingAction(false);
    }
  }

  async function handleEnableNotifications() {
    if (!("Notification" in window)) {
      setError("Notifications are not supported in this browser.");
      return;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setError("Push notifications are not supported in this environment.");
      return;
    }

    if (!vapidPublicKey) {
      setError("Push notifications are not configured yet.");
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      let permission = window.Notification.permission;
      if (permission === "default") {
        permission = await window.Notification.requestPermission();
      }

      setNotificationPermission(permission);

      if (permission !== "granted") {
        setError("Notification permission was not granted.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(vapidPublicKey),
        });
      }

      const payload = toPayload(subscription);
      if (!payload) {
        setError("Could not read push subscription details.");
        return;
      }

      const response = await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const responseBody = await response.json().catch(() => null);
        throw new Error(responseBody?.error || "Subscription failed.");
      }

      setHasPushSubscription(true);
      setSuccess("Push notifications enabled. You can send a test notification now.");
    } catch (subscriptionError) {
      setError(
        subscriptionError instanceof Error ? subscriptionError.message : "Could not enable push notifications.",
      );
    } finally {
      setIsLoadingAction(false);
    }
  }

  async function handleDisableNotifications() {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      return;
    }

    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setHasPushSubscription(false);
        return;
      }

      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      await fetch("/api/notifications/unsubscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ endpoint }),
      });

      setHasPushSubscription(false);
      setSuccess("Push notifications disabled for this device.");
    } catch {
      setError("Could not disable push notifications.");
    } finally {
      setIsLoadingAction(false);
    }
  }

  async function handleSendTestNotification() {
    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      const response = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: "PDP Test",
          body: "If you see this, push delivery is working.",
          url: "/",
        }),
      });

      const responseBody = (await response.json().catch(() => null)) as
        | { delivered?: number; totalSubscriptions?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(responseBody?.error || "Test notification failed.");
      }

      const delivered = responseBody?.delivered ?? 0;
      const totalSubscriptions = responseBody?.totalSubscriptions ?? 0;

      if (delivered > 0) {
        setSuccess("Test notification sent.");
        void refreshDeliveryHistory();
      } else if (totalSubscriptions === 0) {
        setSuccess("No active subscriptions were found for this account yet.");
      } else {
        setSuccess("Notification request completed. Delivery may be delayed by the browser.");
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send test notification.");
    } finally {
      setIsLoadingAction(false);
    }
  }

  async function handleSendReminderNotification() {
    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      const response = await fetch("/api/notifications/reminders/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: selectedReminderType,
        }),
      });

      const responseBody = (await response.json().catch(() => null)) as
        | { skipped?: boolean; reason?: string; delivered?: number; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(responseBody?.error || "Reminder notification failed.");
      }

      if (responseBody?.skipped) {
        setSuccess(responseBody.reason || "Reminder was skipped by current preference settings.");
        void refreshDeliveryHistory();
        return;
      }

      const delivered = responseBody?.delivered ?? 0;
      if (delivered > 0) {
        setSuccess("Reminder notification sent.");
      } else {
        setSuccess("Reminder processed. Delivery may be delayed by browser policy.");
      }
      void refreshDeliveryHistory();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send reminder notification.");
    } finally {
      setIsLoadingAction(false);
    }
  }

  async function handleSavePreferences() {
    setError(null);
    setSuccess(null);
    setIsLoadingAction(true);

    try {
      const response = await fetch("/api/notifications/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(preferences),
      });

      const responseBody = (await response.json().catch(() => null)) as
        | { preferences?: NotificationPreferences; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(responseBody?.error || "Could not save notification preferences.");
      }

      if (responseBody?.preferences) {
        setPreferences(responseBody.preferences);
      }

      setSuccess("Notification preferences saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save notification preferences.");
    } finally {
      setIsLoadingAction(false);
    }
  }

  function dismissBanner() {
    setIsDismissed(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    }
  }

  return (
    <aside className="fixed inset-x-2 top-2 z-40 sm:bottom-6 sm:left-auto sm:right-6 sm:top-auto sm:w-[22rem]">
      <div className="pdp-card flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden p-3 text-sm shadow-lg sm:max-h-[min(80vh,46rem)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {shouldShowInstallPrompt
                ? "Install app"
                : shouldShowIosInstallHelp
                  ? "Install on iPhone"
                  : shouldShowNotificationPrompt
                    ? "Enable notifications"
                    : "Manage notifications"}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {shouldShowInstallPrompt
                ? "Install PDP on your home screen to unlock reminder notifications and a native app feel."
                : shouldShowIosInstallHelp
                  ? "On iPhone Safari: tap Share, then Add to Home Screen. iOS does not show an automatic install pop-up."
                  : shouldShowNotificationPrompt
                    ? "Turn on push notifications for daily agenda, weekly review, and habit reminders."
                    : "Push notifications are enabled. Send a quick test or disable notifications for this device."}
            </p>
          </div>
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss"
            className="rounded-full px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100"
          >
            Dismiss
          </button>
        </div>

        {error ? <p className="mt-2 text-xs text-red-700">{error}</p> : null}
        {success ? <p className="mt-2 text-xs text-emerald-700">{success}</p> : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mt-3 space-y-3">
            {shouldShowInstallPrompt ? (
              <button
                type="button"
                onClick={() => void handleInstall()}
                disabled={isLoadingAction}
                className="w-full rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoadingAction ? "Opening..." : "Install app"}
              </button>
            ) : shouldShowIosInstallHelp ? (
              <div className="w-full rounded-2xl border border-slate-200 p-3 text-xs text-slate-700">
                <p className="font-semibold uppercase tracking-wide text-slate-500">Install steps</p>
                <p className="mt-1">1. Tap Share in Safari</p>
                <p>2. Tap Add to Home Screen</p>
                <p>3. Tap Add</p>
              </div>
            ) : shouldShowNotificationPrompt ? (
              <button
                type="button"
                onClick={() => void handleEnableNotifications()}
                disabled={isLoadingAction}
                className="w-full rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {isLoadingAction ? "Updating..." : "Enable push"}
              </button>
            ) : (
              <>
                <section className="w-full rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reminder preferences</p>
                  <div className="space-y-2 text-xs text-slate-700">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.dailyAgendaEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            dailyAgendaEnabled: event.target.checked,
                          }))
                        }
                      />
                      Daily agenda
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.weeklyReviewEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            weeklyReviewEnabled: event.target.checked,
                          }))
                        }
                      />
                      Weekly review
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={preferences.dueTasksEnabled}
                        disabled={isLoadingAction || isLoadingPreferences}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            dueTasksEnabled: event.target.checked,
                          }))
                        }
                      />
                      Due tasks
                    </label>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Preferred hour (local)</label>
                      <select
                        value={preferences.preferredHourLocal === null ? "" : String(preferences.preferredHourLocal)}
                        onChange={(event) => {
                          const value = event.target.value;
                          setPreferences((current) => ({
                            ...current,
                            preferredHourLocal: value === "" ? null : Number(value),
                          }));
                        }}
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 rounded-xl px-2 py-1 text-xs"
                      >
                        <option value="">Any hour</option>
                        {Array.from({ length: 24 }, (_, hour) => (
                          <option key={hour} value={String(hour)}>
                            {`${String(hour).padStart(2, "0")}:00`}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Timezone</label>
                      <input
                        type="text"
                        value={preferences.timezone ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            timezone: event.target.value,
                          }))
                        }
                        placeholder="America/New_York"
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 rounded-xl px-2 py-1 text-xs"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Quiet start</label>
                      <input
                        type="time"
                        value={preferences.quietHoursStart ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            quietHoursStart: event.target.value || null,
                          }))
                        }
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 rounded-xl px-2 py-1 text-xs"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-medium text-slate-600">Quiet end</label>
                      <input
                        type="time"
                        value={preferences.quietHoursEnd ?? ""}
                        onChange={(event) =>
                          setPreferences((current) => ({
                            ...current,
                            quietHoursEnd: event.target.value || null,
                          }))
                        }
                        disabled={isLoadingAction || isLoadingPreferences}
                        className="pdp-control w-full min-w-0 rounded-xl px-2 py-1 text-xs"
                      />
                    </div>
                  </div>
                </section>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void handleSavePreferences()}
                    disabled={isLoadingAction || isLoadingPreferences}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLoadingAction ? "Saving..." : "Save preferences"}
                  </button>
                  <select
                    value={selectedReminderType}
                    onChange={(event) => setSelectedReminderType(event.target.value as ReminderType)}
                    disabled={isLoadingAction || isLoadingPreferences}
                    className="pdp-control rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide"
                    aria-label="Reminder type"
                  >
                    <option value="daily_agenda">Daily agenda</option>
                    <option value="weekly_review">Weekly review</option>
                    <option value="due_tasks">Due tasks</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleSendReminderNotification()}
                    disabled={isLoadingAction}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isLoadingAction ? "Sending..." : "Send reminder"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSendTestNotification()}
                    disabled={isLoadingAction}
                    className="rounded-full bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isLoadingAction ? "Sending..." : "Send test"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDisableNotifications()}
                    disabled={isLoadingAction}
                    className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Disable push
                  </button>
                </div>

                <section className="w-full rounded-2xl border border-slate-200 p-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    Recent notification activity
                  </p>
                  <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <select
                      value={historyStatusFilter}
                      onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs"
                      disabled={isLoadingHistory}
                      aria-label="Activity status filter"
                    >
                      <option value="all">All statuses</option>
                      <option value="sent">Sent</option>
                      <option value="failed">Failed</option>
                      <option value="skipped">Skipped</option>
                    </select>
                    <select
                      value={historyTypeFilter}
                      onChange={(event) => setHistoryTypeFilter(event.target.value as HistoryTypeFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs"
                      disabled={isLoadingHistory}
                      aria-label="Activity type filter"
                    >
                      <option value="all">All types</option>
                      <option value="daily_agenda">Daily agenda</option>
                      <option value="weekly_review">Weekly review</option>
                      <option value="due_tasks">Due tasks</option>
                      <option value="test">Test</option>
                    </select>
                    <select
                      value={historyWindowFilter}
                      onChange={(event) => setHistoryWindowFilter(event.target.value as HistoryWindowFilter)}
                      className="pdp-control rounded-xl px-2 py-1 text-xs sm:col-span-2"
                      disabled={isLoadingHistory}
                      aria-label="Activity window filter"
                    >
                      <option value="24h">Last 24 hours</option>
                      <option value="7d">Last 7 days</option>
                      <option value="30d">Last 30 days</option>
                      <option value="all">All time</option>
                    </select>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-1">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Sent {deliveryHistory.filter((entry) => entry.status === "sent").length}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Failed {deliveryHistory.filter((entry) => entry.status === "failed").length}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-700">
                      Skipped {deliveryHistory.filter((entry) => entry.status === "skipped").length}
                    </span>
                  </div>
                  {isLoadingHistory ? <p className="text-xs text-slate-500">Loading activity...</p> : null}
                  {!isLoadingHistory && deliveryHistory.length === 0 ? (
                    <p className="text-xs text-slate-500">No delivery records yet.</p>
                  ) : null}
                  <div className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
                    {!isLoadingHistory && deliveryHistory.length > 0
                      ? deliveryHistory.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-slate-100 p-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
                              {formatReminderLabel(entry.reminderType)} - {entry.status}
                            </p>
                            <p className="text-xs text-slate-700">{entry.message || entry.title || "No message"}</p>
                            <p className="text-[11px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                          </div>
                        ))
                      : null}
                  </div>
                  {historyHasMore ? (
                    <button
                      type="button"
                      onClick={() => void refreshDeliveryHistory(historyNextCursor ?? undefined)}
                      className="mt-2 rounded-full border border-slate-300 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 transition hover:bg-slate-50"
                      disabled={isLoadingHistory}
                    >
                      {isLoadingHistory ? "Loading..." : "Load more"}
                    </button>
                  ) : null}
                </section>
              </>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}

function toPayload(subscription: PushSubscription): PushSubscriptionPayload | null {
  try {
    const json = subscription.toJSON();
    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");

    if (!json.endpoint || !p256dhKey || !authKey) {
      return null;
    }

    return {
      endpoint: json.endpoint,
      expirationTime: json.expirationTime ?? null,
      keys: {
        p256dh: arrayBufferToBase64(p256dhKey),
        auth: arrayBufferToBase64(authKey),
      },
    };
  } catch {
    return null;
  }
}

function toUint8Array(base64String: string) {
  const padded = `${base64String}${"=".repeat((4 - (base64String.length % 4)) % 4)}`;
  const normalized = padded.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(normalized);
  const output = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    output[index] = rawData.charCodeAt(index);
  }

  return output;
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }

  return window.btoa(binary);
}

function getDefaultTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function getTimezoneOptions(initialTimezone?: string) {
  const defaultTimezone = getDefaultTimezone();
  const fallback = [
    "UTC",
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "Europe/London",
    "Europe/Paris",
    "Asia/Tokyo",
    "Asia/Kolkata",
    "Australia/Sydney",
  ];

  const intlWithSupported = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  const fromRuntime =
    typeof intlWithSupported.supportedValuesOf === "function"
      ? intlWithSupported.supportedValuesOf("timeZone")
      : fallback;

  return Array.from(new Set([initialTimezone ?? "", defaultTimezone, ...fromRuntime])).filter(
    (value) => value.length > 0,
  );
}

function formatReminderLabel(type: string) {
  if (type === "daily_agenda") {
    return "Daily agenda";
  }

  if (type === "weekly_review") {
    return "Weekly review";
  }

  if (type === "due_tasks") {
    return "Due tasks";
  }

  if (type === "test") {
    return "Test";
  }

  return type;
}

function buildHistoryQuery(params: {
  status: HistoryStatusFilter;
  type: HistoryTypeFilter;
  window: HistoryWindowFilter;
  before?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("limit", "6");

  if (params.status !== "all") {
    searchParams.set("status", params.status);
  }

  if (params.type !== "all") {
    searchParams.set("type", params.type);
  }

  if (params.before) {
    searchParams.set("before", params.before);
  } else {
    const afterIso = toWindowAfterIso(params.window);
    if (afterIso) {
      searchParams.set("after", afterIso);
    }
  }

  return searchParams.toString();
}

function toWindowAfterIso(windowFilter: HistoryWindowFilter) {
  if (windowFilter === "all") {
    return null;
  }

  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  const dayMs = 24 * hourMs;

  if (windowFilter === "24h") {
    return new Date(now - dayMs).toISOString();
  }

  if (windowFilter === "7d") {
    return new Date(now - 7 * dayMs).toISOString();
  }

  return new Date(now - 30 * dayMs).toISOString();
}
