import { describe, expect, it } from "vitest";
import { decodeEscrowData, encodeEscrowDataHex } from "@ckb-escrow/sdk";

import {
  MemoryEscrowIndexerStorage,
  createIndexedEscrow,
  escrowStatusForState,
  eventTypeForTransition,
  makeEscrowId,
} from "./index.js";

const buyerLockHash = `0x${"11".repeat(32)}` as const;
const sellerLockHash = `0x${"22".repeat(32)}` as const;
const arbitratorLockHash = `0x${"33".repeat(32)}` as const;
const origin = { txHash: `0x${"aa".repeat(32)}` as const, index: "0" };

function decoded(state: "Funded" | "Delivered" | "Disputed" | "Completed" | "Cancelled" | "Refunded" | "Resolved") {
  return decodeEscrowData(
    encodeEscrowDataHex({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 100_000_000n,
      deadlineMs: 1_790_000_000_000n,
      state,
      description: "Index me across devices",
    }),
  );
}

describe("escrow indexer model", () => {
  it("uses the creation outpoint as stable escrow id", () => {
    expect(makeEscrowId(origin)).toBe(`${origin.txHash}:0`);
  });

  it("classifies active and past states", () => {
    expect(escrowStatusForState("Funded")).toBe("active");
    expect(escrowStatusForState("Delivered")).toBe("active");
    expect(escrowStatusForState("Disputed")).toBe("active");
    expect(escrowStatusForState("Completed")).toBe("past");
    expect(escrowStatusForState("Cancelled")).toBe("past");
    expect(escrowStatusForState("Refunded")).toBe("past");
    expect(escrowStatusForState("Resolved")).toBe("past");
  });

  it("maps terminal actions to history event types", () => {
    expect(eventTypeForTransition(null, "Funded", null)).toBe("Created");
    expect(eventTypeForTransition("Delivered", "Completed", "Complete")).toBe("Completed");
    expect(eventTypeForTransition("Funded", "Cancelled", "Cancel")).toBe("Cancelled");
    expect(eventTypeForTransition("Funded", "Refunded", "Refund")).toBe("Refunded");
    expect(eventTypeForTransition("Disputed", "Resolved", "ResolveToBuyer")).toBe("ResolvedToBuyer");
    expect(eventTypeForTransition("Disputed", "Resolved", "ResolveToSeller")).toBe("ResolvedToSeller");
  });

  it("filters indexed escrows by participant lock hash and status", async () => {
    const storage = new MemoryEscrowIndexerStorage();
    const funded = createIndexedEscrow({ network: "testnet", origin, decoded: decoded("Funded") });
    const completed = createIndexedEscrow({
      network: "testnet",
      origin: { txHash: `0x${"bb".repeat(32)}` as const, index: "0" },
      current: null,
      settlementTxHash: `0x${"cc".repeat(32)}` as const,
      decoded: decoded("Completed"),
    });

    await storage.upsertEscrow(funded);
    await storage.upsertEscrow(completed);

    await expect(storage.listEscrows({ network: "testnet", lockHash: sellerLockHash, status: "active" })).resolves.toHaveLength(1);
    await expect(storage.listEscrows({ network: "testnet", lockHash: buyerLockHash, status: "past" })).resolves.toEqual([
      completed,
    ]);
    await expect(storage.listEscrows({ network: "testnet", lockHash: `0x${"44".repeat(32)}`, status: "all" })).resolves.toEqual([]);
  });
});
