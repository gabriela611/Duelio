/** Only complete wallet identities may participate in account-scoped actions. */
export function normalizeAddress(value?: string): string | undefined {
  return value && /^0x[0-9a-f]{40}$/i.test(value) ? value.toLowerCase() : undefined;
}

export function canFollow(viewer?: string, subject?: string): boolean {
  const account = normalizeAddress(viewer);
  const target = normalizeAddress(subject);
  return Boolean(account && target && account !== target);
}

export function toggleFollow(current: boolean, viewer?: string, subject?: string): boolean {
  return canFollow(viewer, subject) ? !current : false;
}

export function formatNativeBalance(wei: bigint): string {
  if (wei < 0n) throw new RangeError("Balance cannot be negative");
  const unit = 10n ** 18n;
  const whole = (wei / unit).toLocaleString("en-US");
  const fraction = (wei % unit).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  if (wei > 0n && wei < 10n ** 14n) return "<0.0001";
  return fraction ? `${whole}.${fraction}` : whole;
}
