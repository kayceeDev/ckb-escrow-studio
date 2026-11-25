import { describe, expect, it } from "vitest";

import {
  expectedStateForTransactionAction,
  isIndexedLifecycleConfirmation,
  reduceTransactionLifecycle,
  transactionLifecycleCopy,
} from "./transaction-lifecycle";

describe("escrow transaction lifecycle", () => {
  it("maps every on-chain action to its expected escrow state", () => {
    expect(expectedStateForTransactionAction("Deliver")).toBe("Delivered");
    expect(expectedStateForTransactionAction("Dispute")).toBe("Disputed");
    expect(expectedStateForTransactionAction("Complete")).toBe("Completed");
    expect(expectedStateForTransactionAction("Cancel")).toBe("Cancelled");
    expect(expectedStateForTransactionAction("Refund")).toBe("Refunded");
    expect(expectedStateForTransactionAction("ResolveToBuyer")).toBe("Resolved");
    expect(expectedStateForTransactionAction("ResolveToSeller")).toBe("Resolved");
  });

  it("progresses from signing through canonical indexer confirmation", () => {
    const signing = reduceTransactionLifecycle(null, { type: "start", action: "Deliver" });
    const submitted = reduceTransactionLifecycle(signing, {
      type: "submitted",
      txHash: `0x${"11".repeat(32)}`,
    });
    const committed = reduceTransactionLifecycle(submitted, {
      type: "ckb-status",
      status: "committed",
    });
    const indexing = reduceTransactionLifecycle(committed, { type: "indexing" });
    const confirmed = reduceTransactionLifecycle(indexing, {
      type: "confirmed",
      state: "Delivered",
    });
    if (!confirmed) throw new Error("Expected a confirmed transaction lifecycle.");

    expect(signing?.stage).toBe("signing");
    expect(submitted?.stage).toBe("submitted");
    expect(committed?.stage).toBe("committed");
    expect(indexing?.stage).toBe("indexing");
    expect(confirmed).toMatchObject({ stage: "confirmed", confirmedState: "Delivered" });
    expect(transactionLifecycleCopy(confirmed)).toMatchObject({
      title: "Delivered confirmed",
      tone: "success",
    });
  });

  it("does not regress after CKB commitment", () => {
    const submitted = reduceTransactionLifecycle(
      reduceTransactionLifecycle(null, { type: "start", action: "Deliver" }),
      { type: "submitted", txHash: `0x${"22".repeat(32)}` },
    );
    const committed = reduceTransactionLifecycle(submitted, {
      type: "ckb-status",
      status: "committed",
    });

    expect(reduceTransactionLifecycle(committed, {
      type: "ckb-status",
      status: "pending",
    })).toEqual(committed);
  });

  it("records a rejected transaction without changing the confirmed escrow state", () => {
    const submitted = reduceTransactionLifecycle(
      reduceTransactionLifecycle(null, { type: "start", action: "Complete" }),
      { type: "submitted", txHash: `0x${"33".repeat(32)}` },
    );
    const failed = reduceTransactionLifecycle(submitted, {
      type: "ckb-status",
      status: "rejected",
      reason: "invalid transaction",
    });
    if (!failed) throw new Error("Expected a failed transaction lifecycle.");

    expect(failed).toMatchObject({
      stage: "failed",
      error: "invalid transaction",
      confirmedState: null,
    });
    expect(transactionLifecycleCopy(failed)).toMatchObject({
      title: "Transaction failed",
      tone: "destructive",
    });
    expect(reduceTransactionLifecycle(failed, {
      type: "confirmed",
      state: "Completed",
    })).toEqual(failed);
  });

  it("does not overwrite confirmation with a late polling failure", () => {
    const submitted = reduceTransactionLifecycle(
      reduceTransactionLifecycle(null, { type: "start", action: "Deliver" }),
      { type: "submitted", txHash: `0x${"44".repeat(32)}` },
    );
    const confirmed = reduceTransactionLifecycle(submitted, {
      type: "confirmed",
      state: "Delivered",
    });

    expect(reduceTransactionLifecycle(confirmed, {
      type: "failed",
      error: "late timeout",
    })).toEqual(confirmed);
    expect(reduceTransactionLifecycle(confirmed, {
      type: "ckb-status",
      status: "rejected",
      reason: "late stale response",
    })).toEqual(confirmed);
  });

  it("requires the submitted hash and expected state in indexed history", () => {
    const txHash = `0x${"55".repeat(32)}` as const;
    const submitted = reduceTransactionLifecycle(
      reduceTransactionLifecycle(null, { type: "start", action: "Deliver" }),
      { type: "submitted", txHash },
    );

    expect(isIndexedLifecycleConfirmation(submitted, "Delivered", {
      state: "Delivered",
      latestTxHash: txHash,
      events: [],
    })).toBe(true);
    expect(isIndexedLifecycleConfirmation(submitted, "Delivered", {
      state: "Funded",
      latestTxHash: txHash,
      events: [],
    })).toBe(false);
    expect(isIndexedLifecycleConfirmation(submitted, "Delivered", {
      state: "Delivered",
      latestTxHash: `0x${"66".repeat(32)}`,
      events: [],
    })).toBe(false);
  });
});
