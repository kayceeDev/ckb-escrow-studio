import { describe, expect, it } from "vitest";

import {
  CREATE_ESCROW_FEE_RESERVE_SHANNONS,
  createEscrowReference,
  estimateCreateEscrowFundingShannons,
  formatCkbBalance,
  hasInsufficientWalletBalance,
  minimumDeadlineInputValue,
  validateEscrowDeadline,
} from "./create-escrow-form";

describe("create escrow form helpers", () => {
  it("generates a readable unique customer reference", () => {
    const date = new Date(2026, 10, 25, 12, 0, 0);
    expect(createEscrowReference(date, "12345678-1234-1234-1234-123456789abc"))
      .toBe("CKB-20261125-123456781234");
    expect(createEscrowReference(date, "abcdefab-cdef-abcd-efab-cdefabcdefab"))
      .not.toBe(createEscrowReference(date, "12345678-1234-1234-1234-123456789abc"));
  });

  it("rejects missing, invalid, past, and nearly-expired deadlines", () => {
    const now = new Date(2026, 10, 25, 12, 0, 0).getTime();
    expect(validateEscrowDeadline("", now)).toMatch(/Choose/);
    expect(validateEscrowDeadline("not-a-date", now)).toMatch(/valid/);
    expect(validateEscrowDeadline("2026-11-25T11:00", now)).toMatch(/5 minutes/);
    expect(validateEscrowDeadline("2026-11-25T12:04", now)).toMatch(/5 minutes/);
    expect(validateEscrowDeadline("2026-11-25T12:06", now)).toBeNull();
  });

  it("formats the earliest accepted local deadline and CKB balances", () => {
    const now = new Date(2026, 10, 25, 12, 0, 0).getTime();
    expect(new Date(minimumDeadlineInputValue(now)).getTime()).toBe(now + 5 * 60 * 1000);
    expect(formatCkbBalance(123_456_789_000n)).toBe("1,234.5678");
    expect(formatCkbBalance(100_000_000n)).toBe("1");
  });

  it("adds a one CKB fee reserve to the exact escrow output capacity", () => {
    expect(CREATE_ESCROW_FEE_RESERVE_SHANNONS).toBe(100_000_000n);
    expect(estimateCreateEscrowFundingShannons(35_000_000_000n)).toBe(35_100_000_000n);
  });

  it("only reports a known balance below the estimate as insufficient", () => {
    const requirement = 35_100_000_000n;

    expect(hasInsufficientWalletBalance(requirement, requirement)).toBe(false);
    expect(hasInsufficientWalletBalance(requirement - 1n, requirement)).toBe(true);
    expect(hasInsufficientWalletBalance(null, requirement)).toBe(false);
    expect(hasInsufficientWalletBalance(requirement, null)).toBe(false);
  });
});
