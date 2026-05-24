import type { InstantRules } from "@instantdb/react";

const rules = {
  userProfiles: {
    allow: {
      view: "auth.id != null && data.uid == auth.id",
      create: "auth.id != null && newData.uid == auth.id",
      update: "auth.id != null && data.uid == auth.id && (newData.uid == null || newData.uid == auth.id)",
      delete: "false",
    },
  },
  $default: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules;

export default rules;