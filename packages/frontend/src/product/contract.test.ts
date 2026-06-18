import { describe, expect, it } from "vitest";

import {
  filterEscrowsByHistoryBucket,
  filterParticipantEscrows,
  getActionViews,
  getEscrowHistoryBucket,
  getViewerRole,
  guidanceForEscrow,
  closeEscrowRecordForAction,
  primaryActionLabel,
  toIndexedProductEscrow,
  type ProductEscrowRecord,
} from "./contract";
import type { IndexedEscrowRecord } from "@ckb-escrow/indexer";
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

  it("does not enable refund from browser time when chain time is still before deadline", () => {
    const deadlineMs = 1_700_000_000_000n;
    const actions = getActionViews(
      { ...escrow, deadlineMs },
      "buyer",
      Number(deadlineMs) + 1_000,
      Number(deadlineMs) - 1_000,
    );

    expect(actions.find((action) => action.action === "Refund")).toMatchObject({
      enabled: false,
    });
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


describe("escrow history grouping", () => {
  function record(state: ProductEscrowRecord["state"], viewerRole: ProductEscrowRecord["viewerRole"]): ProductEscrowRecord {
    return {
      id: `${state}-${viewerRole}`,
      title: `${state} escrow`,
      description: "test escrow",
      state,
      amountLabel: "1 CKB",
      deadlineLabel: "Apr 25, 2026",
      buyerLabel: "Buyer 0x1111",
      sellerLabel: "Seller 0x2222",
      arbitratorLabel: "Arbitrator 0x3333",
      buyerLockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      sellerLockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      arbitratorLockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      viewerRole,
      actions: [],
      guidance: {
        summary: "summary",
        nextStep: "next",
        detail: "detail",
      },
      timeline: [],
      source: "live",
    };
  }

  it("separates active and past escrow states", () => {
    expect(["Funded", "Delivered", "Disputed"].map((state) => getEscrowHistoryBucket(state as ProductEscrowRecord["state"]))).toEqual([
      "active",
      "active",
      "active",
    ]);
    expect(["Completed", "Cancelled", "Refunded", "Resolved"].map((state) => getEscrowHistoryBucket(state as ProductEscrowRecord["state"]))).toEqual([
      "past",
      "past",
      "past",
      "past",
    ]);
  });

  it("hides view-only escrows from participant wallet history", () => {
    const records = [record("Funded", "buyer"), record("Delivered", "viewer"), record("Resolved", "arbitrator")];

    expect(filterParticipantEscrows(records).map((item) => item.viewerRole)).toEqual(["buyer", "arbitrator"]);
  });

  it("reproduces missing past history when terminal escrows disappear from live cells", () => {
    const liveRecords: ProductEscrowRecord[] = [];

    expect(filterEscrowsByHistoryBucket(filterParticipantEscrows(liveRecords), "past")).toEqual([]);
  });

  it("derives terminal records before the indexer confirms closed history", () => {
    const completed = closeEscrowRecordForAction(record("Delivered", "buyer"), "Complete");
    const cancelled = closeEscrowRecordForAction(record("Funded", "buyer"), "Cancel");
    const refunded = closeEscrowRecordForAction(record("Funded", "buyer"), "Refund");
    const resolved = closeEscrowRecordForAction(record("Disputed", "arbitrator"), "ResolveToSeller");

    expect([completed?.state, cancelled?.state, refunded?.state, resolved?.state]).toEqual([
      "Completed",
      "Cancelled",
      "Refunded",
      "Resolved",
    ]);
    expect([completed, cancelled, refunded, resolved].every((item) => item?.source === "indexed")).toBe(true);
  });

  it("keeps derived terminal escrows in past history when no live cells remain", () => {
    const derived = closeEscrowRecordForAction(record("Delivered", "buyer"), "Complete");

    expect(filterEscrowsByHistoryBucket(derived ? [derived] : [], "past").map((item) => item.state)).toEqual([
      "Completed",
    ]);
  });

  it("keeps indexer-backed terminal escrows in past history without browser storage", () => {
    const indexed: IndexedEscrowRecord = {
      id: "0xabc:0",
      network: "testnet",
      origin: { txHash: `0x${"aa".repeat(32)}`, index: "0" },
      current: null,
      latestTxHash: `0x${"bb".repeat(32)}`,
      settlementTxHash: `0x${"cc".repeat(32)}`,
      state: "Completed",
      buyerLockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      sellerLockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      arbitratorLockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      amountShannons: "100000000",
      deadlineMs: "1790000000000",
      description: "Recovered from indexer",
      dataHex: "0x00",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      closedAt: "2026-04-02T00:00:00.000Z",
      events: [],
    };

    const indexedRecord = toIndexedProductEscrow(indexed, indexed.buyerLockHash);

    expect(indexedRecord.source).toBe("indexed");
    expect(indexedRecord.viewerRole).toBe("buyer");
    expect(filterEscrowsByHistoryBucket([indexedRecord], "past").map((item) => item.title)).toEqual([
      "Recovered from indexer",
    ]);
  });

  it("keeps terminal participant escrows in past history", () => {
    const records = [
      record("Funded", "buyer"),
      record("Completed", "seller"),
      record("Cancelled", "buyer"),
      record("Refunded", "buyer"),
      record("Resolved", "arbitrator"),
    ];

    expect(filterEscrowsByHistoryBucket(records, "active").map((item) => item.state)).toEqual(["Funded"]);
    expect(filterEscrowsByHistoryBucket(records, "past").map((item) => item.state)).toEqual([
      "Completed",
      "Cancelled",
      "Refunded",
      "Resolved",
    ]);
  });

  it("uses receipt copy when terminal escrows have no direct action", () => {
    expect(primaryActionLabel(record("Completed", "buyer"))).toBe("View receipt");
  });
});
