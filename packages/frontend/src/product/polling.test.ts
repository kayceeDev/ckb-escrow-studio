import { describe, expect, it, vi } from "vitest";

import {
  findUpdatedEscrowRecord,
  pollForEscrowUpdate,
  startVisibleEscrowPolling,
} from "./polling";
import type { ProductEscrowRecord } from "./contract";

function record(input: Partial<ProductEscrowRecord> = {}): ProductEscrowRecord {
  return {
    id: "origin:0",
    title: "Escrow",
    description: "Escrow",
    state: "Funded",
    amountLabel: "1 CKB",
    deadlineLabel: "Apr 25, 2026",
    buyerLabel: "Buyer",
    sellerLabel: "Seller",
    arbitratorLabel: "Arb",
    buyerLockHash: "0x11",
    sellerLockHash: "0x22",
    arbitratorLockHash: "0x33",
    viewerRole: "buyer",
    actions: [],
    guidance: { summary: "", nextStep: "", detail: "" },
    timeline: [],
    source: "indexed",
    stableId: "origin:0",
    currentId: "current:0",
    ...input,
  };
}

describe("escrow update polling", () => {
  it("detects changed state for the same stable escrow", () => {
    const updated = record({ id: "new-current:0", state: "Delivered", source: "live", stableId: "origin:0", currentId: "new-current:0" });

    expect(findUpdatedEscrowRecord({
      records: [updated],
      previousRecord: record(),
      submittedTxHash: "new-current",
      expectedTerminal: false,
    })).toEqual(updated);
  });

  it("detects the submitted live cell before the indexer links its stable escrow id", () => {
    const submittedTxHash = `0x${"44".repeat(32)}`;
    const { stableId: _previousStableId, ...previous } = record({
      id: `0x${"11".repeat(32)}:0`,
      source: "live",
      currentId: `0x${"11".repeat(32)}:0`,
    });
    const { stableId: _deliveredStableId, ...delivered } = record({
      id: `${submittedTxHash}:0`,
      state: "Delivered",
      source: "live",
      currentId: `${submittedTxHash}:0`,
    });

    expect(findUpdatedEscrowRecord({
      records: [delivered],
      previousRecord: previous,
      submittedTxHash,
      expectedTerminal: false,
    })).toEqual(delivered);
  });

  it("detects terminal indexed history when live cell disappears", () => {
    const terminal = record({ state: "Cancelled", source: "indexed", currentId: null });

    expect(findUpdatedEscrowRecord({
      records: [terminal],
      previousRecord: record(),
      submittedTxHash: "cancel-tx",
      expectedTerminal: true,
    })).toEqual(terminal);
  });

  it("times out when refreshes never expose the updated record", async () => {
    vi.useFakeTimers();
    const promise = pollForEscrowUpdate({
      previousRecord: record(),
      submittedTxHash: "missing-tx",
      expectedTerminal: false,
      refresh: async () => ({ records: [record()] }),
      intervalMs: 10,
      timeoutMs: 25,
    });

    await vi.advanceTimersByTimeAsync(40);
    await expect(promise).resolves.toEqual({ status: "timeout" });
    vi.useRealTimers();
  });

  it("polls escrow state only while the page is visible and cleans up", async () => {
    let visibility: "visible" | "hidden" = "visible";
    let intervalCallback: () => void = () => undefined;
    let visibilityCallback: () => void = () => undefined;
    const refresh = vi.fn(async () => undefined);
    const clearInterval = vi.fn();
    const unsubscribe = vi.fn();

    const stop = startVisibleEscrowPolling({
      refresh,
      intervalMs: 10_000,
      getVisibilityState: () => visibility,
      setInterval: (callback) => {
        intervalCallback = callback;
        return 7;
      },
      clearInterval,
      subscribeVisibility: (callback) => {
        visibilityCallback = callback;
        return unsubscribe;
      },
    });

    intervalCallback();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    visibility = "hidden";
    intervalCallback();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(1);

    visibility = "visible";
    visibilityCallback();
    await Promise.resolve();
    expect(refresh).toHaveBeenCalledTimes(2);

    stop();
    expect(clearInterval).toHaveBeenCalledWith(7);
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
