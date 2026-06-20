import { afterEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_DATABASE_URL = process.env.DATABASE_URL;

function resetIndexerGlobals() {
  globalThis.__ckbEscrowIndexerManagedStorage = undefined;
  globalThis.__ckbEscrowIndexerSyncs = undefined;
}

afterEach(() => {
  process.env.DATABASE_URL = ORIGINAL_DATABASE_URL;
  resetIndexerGlobals();
  vi.resetModules();
});

describe("indexer storage runtime selection", () => {
  it("falls back to memory when DATABASE_URL uses the placeholder host", async () => {
    process.env.DATABASE_URL = "postgres://user:password@host:5432/dbname";
    resetIndexerGlobals();
    const { getEscrowIndexerStorage, getIndexerStorageRuntimeStatus } = await import("./indexer-store");

    const storage = getEscrowIndexerStorage();
    const status = getIndexerStorageRuntimeStatus();

    expect(storage.constructor.name).toBe("MemoryEscrowIndexerStorage");
    expect(status).toMatchObject({
      configuredStorage: "postgres",
      activeStorage: "memory",
      degraded: true,
    });
    expect(status.error).toContain("placeholder hostname 'host'");
  });

  it("uses memory storage when DATABASE_URL is not configured", async () => {
    delete process.env.DATABASE_URL;
    resetIndexerGlobals();
    const { getEscrowIndexerStorage, getIndexerStorageRuntimeStatus } = await import("./indexer-store");

    expect(getEscrowIndexerStorage().constructor.name).toBe("MemoryEscrowIndexerStorage");
    expect(getIndexerStorageRuntimeStatus()).toMatchObject({
      configuredStorage: "memory",
      activeStorage: "memory",
      degraded: false,
      error: null,
    });
  });
});
