import type { InstantRules } from "@instantdb/react";

const rules = {
  attrs: {
    allow: {
      $default: "false",
    },
  },
} satisfies InstantRules;

export default rules;