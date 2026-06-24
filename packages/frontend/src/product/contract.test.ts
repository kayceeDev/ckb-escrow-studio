import { describe, expect, it } from "vitest";

import {
  filterEscrowsByHistoryBucket,
  filterParticipantEscrows,
  findLiveEscrowForRoute,
  getActionViews,
  getEscrowHistoryBucket,
  getViewerRole,
  guidanceForEscrow,
  closeEscrowRecordForAction,
  mergeProductEscrowRecords,
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


  it("reproduces disabled detail actions when stable indexed route has a current live cell", () => {
    const originId = "0xorigin:0";
    const currentTxHash = `0x${"12".repeat(32)}`;
    const indexed: IndexedEscrowRecord = {
      id: originId,
      network: "testnet",
      origin: { txHash: "0xorigin" as `0x${string}`, index: "0" },
      current: { txHash: currentTxHash as `0x${string}`, index: "0" },
      latestTxHash: currentTxHash as `0x${string}`,
      settlementTxHash: null,
      state: "Delivered",
      buyerLockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      sellerLockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      arbitratorLockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      amountShannons: "100000000",
      deadlineMs: "1790000000000",
      description: "Delivered escrow",
      dataHex: "0x00",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      closedAt: null,
      events: [],
    };
    const live = {
      txHash: currentTxHash,
      index: "0",
      capacity: "100000000",
      lock: { codeHash: "0x", hashType: "type" as const, args: "0x" },
      decoded: {
        buyerLockHash: indexed.buyerLockHash,
        sellerLockHash: indexed.sellerLockHash,
        arbitratorLockHash: indexed.arbitratorLockHash,
        amountShannons: 100000000n,
        deadlineMs: 1790000000000n,
        state: "Delivered" as const,
        description: new TextEncoder().encode("Delivered escrow"),
        descriptionText: "Delivered escrow",
        dataHex: "0x00" as const,
      },
    };

    expect(findLiveEscrowForRoute([live], originId, [indexed])?.txHash).toBe(currentTxHash);
  });

  it("can render indexed past escrow details when the live cell is gone", () => {
    const escrowId = "0xfcf7e83ab33b6d9e825a331cbe3bac9f9b39a689c4a3fdc1ea41b278cb8cb0a8:0";
    const indexed: IndexedEscrowRecord = {
      id: escrowId,
      network: "testnet",
      origin: { txHash: "0xfcf7e83ab33b6d9e825a331cbe3bac9f9b39a689c4a3fdc1ea41b278cb8cb0a8", index: "0" },
      current: null,
      latestTxHash: `0x${"bb".repeat(32)}`,
      settlementTxHash: `0x${"cc".repeat(32)}`,
      state: "Completed",
      buyerLockHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
      sellerLockHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
      arbitratorLockHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
      amountShannons: "100000000",
      deadlineMs: "1790000000000",
      description: "Closed escrow receipt",
      dataHex: "0x00",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
      closedAt: "2026-04-02T00:00:00.000Z",
      events: [],
    };
    const liveRecords: ProductEscrowRecord[] = [];
    const indexedRecord = toIndexedProductEscrow(indexed, indexed.buyerLockHash);

    expect(liveRecords.find((item) => item.id === escrowId)).toBeUndefined();
    expect(indexedRecord.id).toBe(escrowId);
    expect(indexedRecord.source).toBe("indexed");
    expect(indexedRecord.state).toBe("Completed");
    expect(primaryActionLabel(indexedRecord)).toBe("View receipt");
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

  it("merges live and indexed records for homepage role statistics", () => {
    const live = record("Delivered", "buyer");
    const indexedBuyer = { ...record("Completed", "buyer"), id: "indexed-buyer", source: "indexed" as const };
    const indexedSeller = { ...record("Cancelled", "seller"), id: "indexed-seller", source: "indexed" as const };
    const indexedArbitrator = { ...record("Resolved", "arbitrator"), id: "indexed-arbitrator", source: "indexed" as const };
    const viewer = { ...record("Completed", "viewer"), id: "viewer-history", source: "indexed" as const };

    const statsRecords = filterParticipantEscrows(
      mergeProductEscrowRecords([indexedBuyer, indexedSeller, indexedArbitrator, viewer], [live]),
    );

    expect(statsRecords.filter((item) => item.viewerRole === "buyer")).toHaveLength(2);
    expect(statsRecords.filter((item) => item.viewerRole === "seller")).toHaveLength(1);
    expect(statsRecords.filter((item) => item.viewerRole === "arbitrator")).toHaveLength(1);
    expect(statsRecords.some((item) => item.viewerRole === "viewer")).toBe(false);
  });

  it("keeps needs-action statistics limited to actionable active escrows", () => {
    const actionableLive = {
      ...record("Delivered", "buyer"),
      id: "live-action",
      actions: [{ action: "Complete" as const, label: "Release funds", description: "release", enabled: true, mode: "direct" as const }],
    };
    const terminalHistory = { ...record("Completed", "buyer"), id: "closed-history", source: "indexed" as const };
    const merged = mergeProductEscrowRecords([terminalHistory], [actionableLive]);

    expect(merged.filter((item) => item.actions.some((action) => action.enabled)).map((item) => item.id)).toEqual([
      "live-action",
    ]);
  });



  it("deduplicates live current cell against indexed origin record", () => {
    const indexed = {
      ...record("Funded", "buyer"),
      id: "origin:0",
      stableId: "origin:0",
      currentId: "current:1",
      source: "indexed" as const,
    };
    const live = {
      ...record("Delivered", "buyer"),
      id: "current:1",
      currentId: "current:1",
      source: "live" as const,
    };

    expect(mergeProductEscrowRecords([indexed], [live])).toEqual([{ ...live, stableId: "origin:0" }]);
  });

  it("keeps terminal indexed record when live cell is gone", () => {
    const terminal = {
      ...record("Cancelled", "buyer"),
      id: "origin:0",
      stableId: "origin:0",
      currentId: null,
      source: "indexed" as const,
    };

    expect(mergeProductEscrowRecords([terminal], [])).toEqual([terminal]);
  });

  it("deduplicates live and indexed records by id while preferring live records", () => {
    const indexed = { ...record("Funded", "buyer"), id: "same-escrow", title: "Indexed copy", source: "indexed" as const };
    const live = { ...record("Delivered", "buyer"), id: "same-escrow", title: "Live copy", source: "live" as const };

    expect(mergeProductEscrowRecords([indexed], [live])).toEqual([live]);
  });

});
