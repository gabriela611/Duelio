export const LEGACY_SETTLEMENT_REJECTION = {
  status: 410,
  body: {
    error: {
      code: "LEGACY_SETTLEMENT_DISABLED",
      message:
        "Client-authoritative settlement is disabled. Use the DuelArena contract lifecycle when it becomes available.",
    },
  },
} as const;
