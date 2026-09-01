import { describe, expect, it } from "vitest";

import {
  DISPUTE_AUTH_SCHEMA_SQL,
  MemoryDisputeAuthNonceStore,
  PostgresDisputeAuthNonceStore,
  type DisputeAuthNonceRecord,
} from "./auth.js";

const record: DisputeAuthNonceRecord = {
  nonce: "0x1234",
  network: "testnet",
  escrowId: "0xescrow:0",
  action: "addEvidence",
  lockHash: `0x${"11".repeat(32)}`,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  createdAt: new Date().toISOString(),
  consumedAt: null,
};

class FakePool {
  readonly queries: string[] = [];
  consumeCount = 1;

  async query(text: string) {
    this.queries.push(text);
    return { rows: [], rowCount: text.includes("update dispute_auth_nonces") ? this.consumeCount : 0 };
  }

  async end() {}
}

describe("dispute auth nonce storage", () => {
  it("allows exactly one concurrent in-memory consumer", async () => {
    const store = new MemoryDisputeAuthNonceStore();
    await store.issue(record);
    const results = await Promise.all([store.consume(record.nonce), store.consume(record.nonce)]);
    expect(results.sort()).toEqual([false, true]);
  });

  it("uses an atomic unconsumed and unexpired predicate in PostgreSQL", async () => {
    const pool = new FakePool();
    const store = new PostgresDisputeAuthNonceStore({ pool: pool as never });

    await expect(store.consume(record.nonce)).resolves.toBe(true);

    const consumeSql = pool.queries.find((query) => query.includes("update dispute_auth_nonces"));
    expect(DISPUTE_AUTH_SCHEMA_SQL).toContain("nonce_hash text primary key");
    expect(consumeSql).toContain("consumed_at is null");
    expect(consumeSql).toContain("expires_at > now()");
    expect(consumeSql).toContain("returning nonce_hash");
  });
});
