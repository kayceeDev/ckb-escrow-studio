import { describe, expect, it } from "vitest";
import { decodeEscrowData, encodeEscrowDataHex } from "@ckb-escrow/sdk";

import { PostgresEscrowIndexerStorage, POSTGRES_SCHEMA_SQL } from "./postgres.js";
import { createIndexedEscrow } from "./model.js";
import type { IndexedEscrowRecord } from "./types.js";

const buyerLockHash = `0x${"11".repeat(32)}` as const;
const sellerLockHash = `0x${"22".repeat(32)}` as const;
const arbitratorLockHash = `0x${"33".repeat(32)}` as const;

function record(state: IndexedEscrowRecord["state"]): IndexedEscrowRecord {
  const decoded = decodeEscrowData(
    encodeEscrowDataHex({
      buyerLockHash,
      sellerLockHash,
      arbitratorLockHash,
      amountShannons: 100_000_000n,
      deadlineMs: 1_790_000_000_000n,
      state,
      description: "Postgres history",
    }),
  );

  return createIndexedEscrow({
    network: "testnet",
    origin: { txHash: `0x${"aa".repeat(32)}`, index: "0" },
    current: state === "Completed" ? null : { txHash: `0x${"bb".repeat(32)}`, index: "0" },
    latestTxHash: `0x${"cc".repeat(32)}`,
    settlementTxHash: state === "Completed" ? `0x${"dd".repeat(32)}` : null,
    decoded,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    closedAt: state === "Completed" ? "2026-04-02T00:00:00.000Z" : null,
    events: [
      {
        id: `0x${"cc".repeat(32)}:Completed`,
        escrowId: `0x${"aa".repeat(32)}:0`,
        network: "testnet",
        type: "Completed",
        txHash: `0x${"cc".repeat(32)}`,
        blockNumber: "123",
        blockTimestamp: "1775088000000",
        fromState: "Delivered",
        toState: state,
        action: "Complete",
        actorRole: "buyer",
        recipientRole: "seller",
        createdAt: "2026-04-02T00:00:00.000Z",
      },
    ],
  });
}

interface CapturedQuery {
  text: string;
  values: unknown[] | undefined;
}

class FakeClient {
  readonly queries: CapturedQuery[] = [];

  async query(text: string, values?: unknown[]) {
    this.queries.push({ text, values });
    return { rows: [] };
  }

  release() {}
}

class FakePool {
  readonly client = new FakeClient();
  readonly queries: CapturedQuery[] = [];

  async query(text: string, values?: unknown[]) {
    this.queries.push({ text, values });
    return { rows: [] };
  }

  async connect() {
    return this.client;
  }

  async end() {}
}

describe("postgres escrow indexer storage", () => {
  it("exposes schema for production persistence", () => {
    expect(POSTGRES_SCHEMA_SQL).toContain("create table if not exists escrows");
    expect(POSTGRES_SCHEMA_SQL).toContain("create table if not exists escrow_events");
    expect(POSTGRES_SCHEMA_SQL).toContain("create table if not exists indexer_checkpoints");
  });

  it("migrates before writing and upserts escrow, events, and checkpoint", async () => {
    const pool = new FakePool();
    const storage = new PostgresEscrowIndexerStorage({ pool: pool as never });

    await storage.upsertEscrow(record("Completed"));

    expect(pool.queries[0]?.text).toBe(POSTGRES_SCHEMA_SQL);
    expect(pool.client.queries.some((query) => query.text.includes("insert into escrows"))).toBe(true);
    expect(pool.client.queries.some((query) => query.text.includes("insert into escrow_events"))).toBe(true);
    expect(pool.client.queries.some((query) => query.text.includes("insert into indexer_checkpoints"))).toBe(true);
  });
});
