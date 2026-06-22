import * as ccc from "@ckb-ccc/ccc";
import { describe, expect, it } from "vitest";
import {
  decodeEscrowData,
  encodeEscrowActionHex,
  encodeEscrowDataHex,
  type EscrowState,
} from "@ckb-escrow/sdk";

import {
  MemoryEscrowIndexerStorage,
  createIndexedEscrow,
  escrowStatusForState,
  eventTypeForTransition,
  makeEscrowId,
  scanEscrowHistory,
  type EscrowScannerClient,
} from "./index.js";

const buyerLockHash = `0x${"11".repeat(32)}` as const;
const sellerLockHash = `0x${"22".repeat(32)}` as const;
const arbitratorLockHash = `0x${"33".repeat(32)}` as const;
const origin = { txHash: `0x${"aa".repeat(32)}` as const, index: "0" };
const typeScript = {
  codeHash: `0x${"99".repeat(32)}`,
  hashType: "data2" as const,
  args: "0x",
};

type FakeTx = {
  transaction: {
    transaction: {
      inputs: Array<{ previousOutput: { txHash: `0x${string}`; index: bigint } }>;
      outputs: Array<{ type?: ccc.ScriptLike | null }>;
      outputsData: `0x${string}`[];
      witnesses: `0x${string}`[];
    };
    blockNumber: bigint;
  };
  header: { timestamp: bigint };
};

type ScannerAction = "Deliver" | "Complete" | "Cancel" | "Refund" | "ResolveToBuyer" | "ResolveToSeller" | "Dispute";

function decoded(state: EscrowState) {
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

function witness(action: ScannerAction) {
  return ccc.hexFrom(ccc.WitnessArgs.from({ inputType: encodeEscrowActionHex(action) }).toBytes());
}

function txResponse(transaction: FakeTx["transaction"]["transaction"], timestamp: number): FakeTx {
  return {
    transaction: {
      transaction,
      blockNumber: BigInt(timestamp),
    },
    header: {
      timestamp: BigInt(timestamp),
    },
  };
}

function fakeClient(txs: Record<string, FakeTx>, order: string[]): EscrowScannerClient {
  const client = {
    async *findTransactionsByType() {
      for (const txHash of order) {
        yield { txHash: txHash as `0x${string}`, blockNumber: 1n, txIndex: 0n, cells: [] };
      }
    },
    async getTransactionWithHeader(txHash: ccc.HexLike) {
      return txs[String(txHash)];
    },
  };
  return client as unknown as EscrowScannerClient;
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

describe("escrow chain scanner", () => {
  it("indexes create, transition, and terminal settlement transactions", async () => {
    const storage = new MemoryEscrowIndexerStorage();
    const createHash = `0x${"10".repeat(32)}`;
    const deliverHash = `0x${"20".repeat(32)}`;
    const completeHash = `0x${"30".repeat(32)}`;
    const fundedData = encodeEscrowDataHex({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 100_000_000n,
      deadlineMs: 1_790_000_000_000n,
      state: "Funded",
      description: "Scanner lifecycle",
    });
    const deliveredData = encodeEscrowDataHex({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 100_000_000n,
      deadlineMs: 1_790_000_000_000n,
      state: "Delivered",
      description: "Scanner lifecycle",
    });
    const txs: Record<string, FakeTx> = {
      [createHash]: txResponse(
        {
          inputs: [],
          outputs: [{ type: typeScript }],
          outputsData: [fundedData],
          witnesses: [],
        },
        1_790_000_000_000,
      ),
      [deliverHash]: txResponse(
        {
          inputs: [{ previousOutput: { txHash: createHash as `0x${string}`, index: 0n } }],
          outputs: [{ type: typeScript }],
          outputsData: [deliveredData],
          witnesses: [witness("Deliver")],
        },
        1_790_000_100_000,
      ),
      [completeHash]: txResponse(
        {
          inputs: [{ previousOutput: { txHash: deliverHash as `0x${string}`, index: 0n } }],
          outputs: [{ type: null }],
          outputsData: ["0x"],
          witnesses: [witness("Complete")],
        },
        1_790_000_200_000,
      ),
    };

    const result = await scanEscrowHistory({
      network: "testnet",
      client: fakeClient(txs, [createHash, deliverHash, completeHash]),
      deployment: { typeScript },
      storage,
    });
    const indexed = await storage.getEscrow({ network: "testnet", escrowId: `${createHash}:0` });

    expect(result).toEqual({ scannedTransactions: 3, indexedEscrows: 3 });
    expect(indexed?.state).toBe("Completed");
    expect(indexed?.current).toBeNull();
    expect(indexed?.settlementTxHash).toBe(completeHash);
    expect(indexed?.events.map((event) => event.type)).toEqual(["Created", "Delivered", "Completed"]);
  });
});

describe("dispute evidence cases", () => {
  it("creates a dispute case with deterministic evidence bundle hash", async () => {
    const storage = new MemoryEscrowIndexerStorage();
    const disputeCase = await storage.createDisputeCase({
      network: "testnet",
      escrowId: `${origin.txHash}:0`,
      disputeTxHash: `0x${"55".repeat(32)}`,
      openedByLockHash: buyerLockHash,
      requestedOutcome: "buyer",
      reason: "Delivery does not match the agreed scope",
      evidence: [
        {
          type: "statement",
          label: "Buyer statement",
          value: "The delivered files are incomplete.",
          uri: null,
          mimeType: "text/plain",
          sizeBytes: 35,
          contentHash: `0x${"66".repeat(32)}`,
          submittedByLockHash: buyerLockHash,
        },
      ],
    });

    expect(disputeCase.status).toBe("open");
    expect(disputeCase.evidence).toHaveLength(1);
    expect(disputeCase.evidenceBundleHash).toMatch(/^0x[0-9a-f]{64}$/);
    await expect(storage.getDisputeCase("testnet", `${origin.txHash}:0`)).resolves.toEqual(disputeCase);
  });

  it("adds participant evidence and records arbitrator decision", async () => {
    const storage = new MemoryEscrowIndexerStorage();
    await storage.createDisputeCase({
      network: "testnet",
      escrowId: `${origin.txHash}:0`,
      disputeTxHash: `0x${"55".repeat(32)}`,
      openedByLockHash: buyerLockHash,
      requestedOutcome: "buyer",
      reason: "Delivery was disputed",
      evidence: [],
    });

    const withEvidence = await storage.addDisputeEvidence({
      network: "testnet",
      escrowId: `${origin.txHash}:0`,
      submittedByLockHash: sellerLockHash,
      evidence: [
        {
          type: "link",
          label: "Delivery proof",
          value: "https://example.com/proof",
          uri: "https://example.com/proof",
          mimeType: null,
          sizeBytes: null,
          contentHash: `0x${"77".repeat(32)}`,
        },
      ],
    });

    expect(withEvidence.evidence).toHaveLength(1);
    const resolved = await storage.saveArbitratorDecision({
      network: "testnet",
      escrowId: `${origin.txHash}:0`,
      outcome: "seller",
      decisionNote: "Seller provided sufficient delivery proof.",
      resolutionTxHash: `0x${"88".repeat(32)}`,
      decidedByLockHash: arbitratorLockHash,
    });

    expect(resolved.status).toBe("resolved");
    expect(resolved.decision?.outcome).toBe("seller");
    expect(resolved.decision?.evidenceBundleHash).toBe(resolved.evidenceBundleHash);
  });
});
