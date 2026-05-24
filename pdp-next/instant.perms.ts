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
  goals: ownerScopedRules,
  subgoals: ownerScopedRules,
  tasks: ownerScopedRules,
  journalEntries: ownerScopedRules,
  pushSubscriptions: ownerScopedRules,
  notificationPreferences: ownerScopedRules,
  notificationDeliveries: ownerScopedRules,
  $default: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules;

export default rules;