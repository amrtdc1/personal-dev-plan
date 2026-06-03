import type { InstantRules } from "@instantdb/react";

const ownerScopedRules = {
  allow: {
    view: "auth.id != null && data.ownerUid == auth.id",
    create: "auth.id != null && newData.ownerUid == auth.id",
    update: "auth.id != null && data.ownerUid == auth.id && (newData.ownerUid == null || newData.ownerUid == auth.id)",
    delete: "auth.id != null && data.ownerUid == auth.id",
  },
};

const rules = {
  userProfiles: {
    allow: {
      view: "auth.id != null && data.uid == auth.id",
      create: "auth.id != null && newData.uid == auth.id",
      update: "auth.id != null && data.uid == auth.id && (newData.uid == null || newData.uid == auth.id)",
      delete: "false",
    },
  },
  goals: {
    allow: {
      view: "auth.id != null && data.ownerUid == auth.id",
      create: "auth.id != null && newData.ownerUid == auth.id && newData.timeframeLevel != null",
      update:
        "auth.id != null && data.ownerUid == auth.id && (newData.ownerUid == null || newData.ownerUid == auth.id) && newData.timeframeLevel != null",
      delete: "auth.id != null && data.ownerUid == auth.id",
    },
  },
  tasks: {
    allow: {
      view: "auth.id != null && data.ownerUid == auth.id",
      create: "auth.id != null && newData.ownerUid == auth.id",
      update:
        "auth.id != null && data.ownerUid == auth.id && (newData.ownerUid == null || newData.ownerUid == auth.id)",
      delete: "auth.id != null && data.ownerUid == auth.id",
    },
  },
  journalEntries: ownerScopedRules,
  habits: ownerScopedRules,
  habitCheckins: ownerScopedRules,
  pushSubscriptions: ownerScopedRules,
  notificationPreferences: ownerScopedRules,
  notificationDeliveries: ownerScopedRules,
  planningCycles: ownerScopedRules,
  planningCommitments: ownerScopedRules,
  visionStatements: ownerScopedRules,
  dailyFocusPlans: ownerScopedRules,
  $default: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules;

export default rules;