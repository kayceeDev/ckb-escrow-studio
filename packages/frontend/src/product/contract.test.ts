import { describe, expect, it } from "vitest";

import { getActionViews, getViewerRole } from "./contract";

describe("product contract helpers", () => {
  const escrow = {
    buyerLockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
    sellerLockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
    arbitratorLockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
    state: "Funded",
    deadlineMs: BigInt(Date.now() - 1000),
  } as const;

  it("detects buyer, seller, arbitrator, and viewer roles from participant hashes", () => {
    expect(getViewerRole(escrow, escrow.buyerLockHash)).toBe("buyer");
    expect(getViewerRole(escrow, escrow.sellerLockHash)).toBe("seller");
    expect(getViewerRole(escrow, escrow.arbitratorLockHash)).toBe("arbitrator");
    expect(getViewerRole(escrow, "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")).toBe("viewer");
  });

  it("returns contract-aligned actions for funded buyers and sellers", () => {
    expect(getActionViews(escrow, "buyer").map((action) => action.action)).toEqual([
      "Cancel",
      "Refund",
    ]);
    expect(getActionViews(escrow, "seller").map((action) => action.action)).toEqual([
      "Deliver",
    ]);
  });

  it("returns dispute resolution actions only for arbitrators on disputed escrows", () => {
    const disputed = { ...escrow, state: "Disputed" as const };
    expect(getActionViews(disputed, "arbitrator").map((action) => action.action)).toEqual([
      "ResolveToBuyer",
      "ResolveToSeller",
    ]);
    expect(getActionViews(disputed, "buyer")).toHaveLength(0);
  });
});
