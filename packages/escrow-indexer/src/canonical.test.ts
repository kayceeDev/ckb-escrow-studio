import { describe, expect, it } from "vitest";

import { MemoryIndexerCoordinator, syncCanonicalEscrowHistory } from "./canonical.js";
import type {
  CanonicalSnapshotCheckpoint,
  EscrowIndexerStorage,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
} from "./types.js";

const typeScript = { codeHash: `0x${"11".repeat(32)}`, hashType: "data2" as const, args: "0x" };

function storage() {
  const replacements: Array<{
    network: IndexedEscrowNetwork;
    records: IndexedEscrowRecord[];
    checkpoint: CanonicalSnapshotCheckpoint;
  }> = [];
  const value: EscrowIndexerStorage = {
    async upsertEscrow() {},
    async getEscrow() { return null; },
    async listEscrows() { return []; },
    async getStatus(network) {
      return {
        network,
        ready: true,
        storage: "memory",
        lastProcessedBlock: null,
        lastProcessedBlockHash: null,
        lastSuccessAt: null,
        lastError: null,
        rebuildCount: 0,
        updatedAt: new Date().toISOString(),
      };
    },
    async createDisputeCase() { throw new Error("unused"); },
    async addDisputeEvidence() { throw new Error("unused"); },
    async getDisputeCase() { return null; },
    async saveArbitratorDecision() { throw new Error("unused"); },
    async replaceCanonicalSnapshot(network, records, checkpoint) {
      replacements.push({ network, records, checkpoint });
    },
  };
  return { replacements, value };
}

function client(headers: Map<string, string>, requestedHeaders: string[] = []) {
  return {
    async getTip() { return 120n; },
    async getHeaderByNumberNoCache(number: bigint) {
      requestedHeaders.push(number.toString());
      const hash = headers.get(number.toString());
      return hash ? { number, hash } : undefined;
    },
    async *findTransactionsByType() {},
    async getTransactionWithHeader() { return undefined; },
  };
}

describe("canonical indexer synchronization", () => {
  it("atomically builds the first finalized snapshot and checkpoint", async () => {
    const coordinator = new MemoryIndexerCoordinator();
    const target = storage();
    const result = await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(new Map([["108", `0x${"aa".repeat(32)}`]])) as never,
      deployment: { typeScript },
      storage: target.value,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    expect(result).toEqual({ acquired: true, rebuilt: true, finalizedBlock: "108" });
    expect(target.replacements).toHaveLength(1);
    expect(target.replacements[0]?.checkpoint).toMatchObject({
      blockNumber: "108",
      blockHash: `0x${"aa".repeat(32)}`,
      rebuildCount: 1,
    });
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

  it("rebuilds from the deployment boundary when a checkpoint predates deployment", async () => {
    const coordinator = new MemoryIndexerCoordinator();
    await coordinator.saveCheckpoint("testnet", {
      blockNumber: "90",
      blockHash: `0x${"90".repeat(32)}`,
      lastSuccessAt: null,
      lastError: null,
      rebuildCount: 2,
    });
    const requestedHeaders: string[] = [];
    const target = storage();
    const result = await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(new Map([["108", `0x${"aa".repeat(32)}`]]), requestedHeaders) as never,
      deployment: { typeScript },
      storage: target.value,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    expect(result.rebuilt).toBe(true);
    expect(requestedHeaders).toEqual(["108"]);
    expect(target.replacements[0]?.checkpoint.rebuildCount).toBe(3);
  });

  it("replaces the canonical snapshot when the checkpoint hash changes", async () => {
    const coordinator = new MemoryIndexerCoordinator();
    await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(new Map([["108", `0x${"aa".repeat(32)}`]])) as never,
      deployment: { typeScript },
      storage: storage().value,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    const reorgTarget = storage();
    const result = await syncCanonicalEscrowHistory({
      network: "testnet",
      client: client(new Map([["108", `0x${"bb".repeat(32)}`]])) as never,
      deployment: { typeScript },
      storage: reorgTarget.value,
      coordinator,
      deploymentBlock: 100n,
      confirmations: 12n,
    });

    expect(result.rebuilt).toBe(true);
    expect(reorgTarget.replacements).toHaveLength(1);
    expect(reorgTarget.replacements[0]?.checkpoint.rebuildCount).toBe(2);
    expect((await coordinator.getCheckpoint("testnet"))?.blockHash).toBe(`0x${"bb".repeat(32)}`);
  });
});
