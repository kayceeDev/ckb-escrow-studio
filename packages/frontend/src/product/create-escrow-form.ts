export const MINIMUM_DEADLINE_LEAD_MS = 5 * 60 * 1000;
export const CREATE_ESCROW_FEE_RESERVE_SHANNONS = 100_000_000n;

export function estimateCreateEscrowFundingShannons(escrowOutputCapacity: bigint): bigint {
  return escrowOutputCapacity + CREATE_ESCROW_FEE_RESERVE_SHANNONS;
}

export function hasInsufficientWalletBalance(
  walletBalanceShannons: bigint | null,
  estimatedFundingShannons: bigint | null,
): boolean {
  return walletBalanceShannons !== null
    && estimatedFundingShannons !== null
    && walletBalanceShannons < estimatedFundingShannons;
}

export function createEscrowReference(
  now = new Date(),
  randomId = globalThis.crypto.randomUUID(),
): string {
  const date = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const entropy = randomId.replaceAll("-", "").slice(0, 12).toUpperCase();
  return `CKB-${date}-${entropy}`;
}

export function minimumDeadlineInputValue(nowMs = Date.now()): string {
  const date = new Date(nowMs + MINIMUM_DEADLINE_LEAD_MS);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function validateEscrowDeadline(value: string, nowMs = Date.now()): string | null {
  if (!value) return "Choose a deadline.";
  const deadlineMs = new Date(value).getTime();
  if (!Number.isFinite(deadlineMs)) return "Choose a valid deadline.";
  if (deadlineMs < nowMs + MINIMUM_DEADLINE_LEAD_MS) {
    return "Deadline must be at least 5 minutes in the future.";
  }
  return null;
}

export function formatCkbBalance(shannons: bigint, maximumFractionDigits = 4): string {
  const divisor = 100_000_000n;
  const whole = shannons / divisor;
  const fraction = (shannons % divisor)
    .toString()
    .padStart(8, "0")
    .slice(0, maximumFractionDigits)
    .replace(/0+$/, "");
  const groupedWhole = whole.toLocaleString("en-US");
  return fraction ? `${groupedWhole}.${fraction}` : groupedWhole;
}
