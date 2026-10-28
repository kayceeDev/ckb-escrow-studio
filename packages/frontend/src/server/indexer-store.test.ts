import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;
const ORIGINAL_POSTGRES_URL = process.env.POSTGRES_URL;
function restoreEnvironment(key: "DATABASE_URL" | "POSTGRES_URL", value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function resetIndexerGlobals() {
  globalThis.__ckbEscrowIndexerManagedStorage = undefined;
  globalThis.__ckbEscrowIndexerSyncs = undefined;
  globalThis.__ckbEscrowDisputeAuthStore = undefined;
}

afterEach(() => {
  restoreEnvironment("DATABASE_URL", ORIGINAL_DATABASE_URL);
  restoreEnvironment("POSTGRES_URL", ORIGINAL_POSTGRES_URL);
  vi.unstubAllEnvs();
  resetIndexerGlobals();
  vi.resetModules();
});

describe("indexer storage runtime selection", () => {
  it("uses a degraded memory store for an invalid database URL only in development", async () => {
    vi.stubEnv("NODE_ENV", "test");
    process.env.DATABASE_URL = "postgres://user:password@host:5432/dbname";
    delete process.env.POSTGRES_URL;
    const { getEscrowIndexerStorage, getIndexerStorageRuntimeStatus } = await import("./indexer-store");

    expect(getEscrowIndexerStorage().constructor.name).toBe("MemoryEscrowIndexerStorage");
    expect(getIndexerStorageRuntimeStatus()).toMatchObject({
      configuredStorage: "postgres",
      activeStorage: "memory",
      degraded: true,
    });
  });

  it("uses memory storage when no database is configured outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    const { getEscrowIndexerStorage, getIndexerStorageRuntimeStatus } = await import("./indexer-store");

    expect(getEscrowIndexerStorage().constructor.name).toBe("MemoryEscrowIndexerStorage");
    expect(getIndexerStorageRuntimeStatus()).toMatchObject({
      configuredStorage: "memory",
      activeStorage: "memory",
      degraded: false,
      error: null,
    });
  });

  it("uses Vercel POSTGRES_URL when DATABASE_URL is absent", async () => {
    vi.stubEnv("NODE_ENV", "test");
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://user:password@db.example.test:5432/escrow";
    const { getEscrowIndexerStorage, getIndexerStorageRuntimeStatus } = await import("./indexer-store");

    expect(getEscrowIndexerStorage().constructor.name).toBe("PostgresEscrowIndexerStorage");
    expect(getIndexerStorageRuntimeStatus()).toMatchObject({
      configuredStorage: "postgres",
      activeStorage: "postgres",
      degraded: false,
    });
  });

  it("fails closed when production has no persistent database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;
    delete process.env.POSTGRES_URL;
    const { getEscrowIndexerStorage, IndexerStorageUnavailableError } = await import("./indexer-store");

    expect(() => getEscrowIndexerStorage()).toThrow(IndexerStorageUnavailableError);
  });

  it("uses the same Vercel Postgres URL for production dispute nonces", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.DATABASE_URL;
    process.env.POSTGRES_URL = "postgres://user:password@db.example.test:5432/escrow";
    const { getDisputeAuthNonceStore } = await import("./dispute-auth-store");

    expect(getDisputeAuthNonceStore().constructor.name).toBe("PostgresDisputeAuthNonceStore");
  });
});
