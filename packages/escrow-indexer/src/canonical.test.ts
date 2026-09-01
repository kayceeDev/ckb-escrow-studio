import { describe, expect, it } from "vitest";

import { MemoryIndexerCoordinator, syncCanonicalEscrowHistory } from "./canonical.js";

const typeScript = { codeHash: `0x${"11".repeat(32)}`, hashType: "data2" as const, args: "0x" };

function storage() {
  return {
    async upsertEscrow() {},
    async getEscrow() { return null; },
    async listEscrows() { return []; },
    async getStatus() { return { network: "testnet", ready: true, storage: "memory", lastProcessedBlock: null, updatedAt: new Date().toISOString() }; },
    async createDisputeCase() { throw new Error("unused"); },
    async addDisputeEvidence() { throw new Error("unused"); },
    async getDisputeCase() { return null; },
    async saveArbitratorDecision() { throw new Error("unused"); },
  };
}

function client(headers: Map<string, string>) {
  return {
    async getTip() { return 120n; },
    async getHeaderByNumberNoCache(number: bigint) {
      const hash = headers.get(number.toString());
      return hash ? { number, hash } : undefined;
    },
    async *findTransactionsByType() {},
    async getTransactionWithHeader() { return undefined; },
  };
}

describe("canonical indexer synchronization", () => {
  it("checkpoints only the finalized block", async () => {
    const headers = new Map([["108", `0x${"aa".repeat(32)}`]]);
    const coordinator = new MemoryIndexerCoordinator();
    const result = await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(headers) as never,
      deployment: { typeScript },
      storage: storage() as never,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    expect(result.finalizedBlock).toBe("108");
    expect((await coordinator.getCheckpoint("testnet"))?.blockHash).toBe(`0x${"aa".repeat(32)}`);
  });

  it("allows only one concurrent synchronization lock", async () => {
    const coordinator = new MemoryIndexerCoordinator();
    let release: (() => void) | undefined;
    const waiting = new Promise<void>((resolve) => { release = resolve; });
    const first = coordinator.withLock("testnet", async () => waiting);
    const second = await coordinator.withLock("testnet", async () => undefined);
    expect(second.acquired).toBe(false);
    release?.();
    await first;
  });

  it("detects an orphaned checkpoint and rebuilds chain state", async () => {
    let resets = 0;
    const coordinator = new MemoryIndexerCoordinator(async () => { resets += 1; });
    const originalHeaders = new Map([["108", `0x${"aa".repeat(32)}`]]);
    await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(originalHeaders) as never,
      deployment: { typeScript },
      storage: storage() as never,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    const reorgHeaders = new Map([["108", `0x${"bb".repeat(32)}`]]);
    const result = await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(reorgHeaders) as never,
      deployment: { typeScript },
      storage: storage() as never,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    expect(result.rebuilt).toBe(true);
    expect(resets).toBe(1);
    expect((await coordinator.getCheckpoint("testnet"))?.blockHash).toBe(`0x${"bb".repeat(32)}`);
  });
});
