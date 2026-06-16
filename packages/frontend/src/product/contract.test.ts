import { describe, expect, it } from "vitest";

import { getActionViews, getViewerRole, guidanceForEscrow } from "./contract";
import { hasActiveArbitratorPool, selectAssignedArbitrator, type ProductArbitratorConfig } from "../config/deployments";

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

  it("returns direct dispute resolution actions only for arbitrators on disputed escrows", () => {
    const disputed = { ...escrow, state: "Disputed" as const };
    const actions = getActionViews(disputed, "arbitrator");

    expect(actions.map((action) => action.action)).toEqual([
      "ResolveToBuyer",
      "ResolveToSeller",
    ]);
    expect(actions.every((action) => action.mode === "direct" && action.enabled)).toBe(true);
    expect(getActionViews(disputed, "buyer")).toHaveLength(0);
  });

  it("turns delivered buyer release into a direct product action", () => {
    const deliveredActions = getActionViews({ ...escrow, state: "Delivered" as const }, "buyer");
    expect(deliveredActions.map((action) => action.action)).toEqual(["Complete", "Dispute"]);
    expect(deliveredActions[0]).toMatchObject({
      action: "Complete",
      mode: "direct",
      enabled: true,
    });
  });

  it("adds buyer-first guidance for funded and delivered escrows", () => {
    const fundedGuidance = guidanceForEscrow(escrow, "buyer");
    expect(fundedGuidance.summary).toContain("Refund is available");
    expect(fundedGuidance.nextStep).toContain("Claim your refund");
    expect(fundedGuidance.nextStep).toContain("automatically");

    const deliveredGuidance = guidanceForEscrow({ ...escrow, state: "Delivered" as const }, "buyer");
    expect(deliveredGuidance.summary).toContain("Buyer decision");
    expect(deliveredGuidance.nextStep).toContain("Release funds");
    expect(deliveredGuidance.detail).toContain("explicitly releases funds");
    expect(deliveredGuidance.supportLabel).toContain("seller payout script");
  });
});

describe("product arbitrator assignment", () => {
  const pool: ProductArbitratorConfig[] = [
    {
      id: "arb-1",
      label: "Arbitrator One",
      address: "ckt1qyqszqgpqyqszqgpqyqszqgpqyqszqgp5x9l5u",
      active: true,
    },
    {
      id: "arb-2",
      label: "Arbitrator Two",
      address: "ckt1qyqgqqqqqqqqqqqqqqqqqqqqqqqqqqqqq7d4d9",
      active: true,
    },
    {
      id: "arb-3",
      label: "Inactive Arbitrator",
      address: "ckt1qyq0qqqqqqqqqqqqqqqqqqqqqqqqqqqqqj4k4n",
      active: false,
    },
  ];

  it("returns an active arbitrator for deterministic assignment", () => {
    const selection = selectAssignedArbitrator({
      network: "testnet",
      buyerLockHash: "0xabc123",
      sellerAddress: "ckt1qexample",
      referenceId: "INV-001",
      pool,
    });

    expect(selection).not.toBeNull();
    expect(selection?.active).toBe(true);
    expect(selection?.id).not.toBe("arb-3");
  });

  it("returns the same arbitrator for the same deterministic inputs", () => {
    const first = selectAssignedArbitrator({
      network: "testnet",
      buyerLockHash: "0xabc123",
      sellerAddress: "ckt1qexample",
      referenceId: "INV-001",
      pool,
    });
    const second = selectAssignedArbitrator({
      network: "testnet",
      buyerLockHash: "0xabc123",
      sellerAddress: "ckt1qexample",
      referenceId: "INV-001",
      pool,
    });

    expect(first?.id).toBe(second?.id);
  });

  it("can rotate assignment when deterministic inputs change", () => {
    const first = selectAssignedArbitrator({
      network: "testnet",
      buyerLockHash: "0xabc123",
      sellerAddress: "ckt1qexample",
      referenceId: "INV-001",
      pool,
    });
    const second = selectAssignedArbitrator({
      network: "testnet",
      buyerLockHash: "0xabc123",
      sellerAddress: "ckt1qexample",
      referenceId: "INV-002",
      pool,
    });

    expect([first?.id, second?.id].every(Boolean)).toBe(true);
  });

  it("reports missing active pool correctly", () => {
    expect(hasActiveArbitratorPool("testnet", pool)).toBe(true);
    expect(
      hasActiveArbitratorPool("testnet", [
        {
          id: "arb-off",
          label: "Offline Arbitrator",
          address: "ckt1qinactive",
          active: false,
        },
      ]),
    ).toBe(false);
  });
});
