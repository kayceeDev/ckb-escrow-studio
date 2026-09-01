import { afterEach, describe, expect, it, vi } from "vitest";

const TEST_CODE_HASH = `0x${"ab".repeat(32)}`;
const TEST_DEP_TX_HASH = `0x${"cd".repeat(32)}`;
const TEST_ARBITRATOR = "ckt1qtestarbitrator";

function setTestnetDeploymentEnv(): void {
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_CODE_HASH", TEST_CODE_HASH);
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_HASH_TYPE", "data2");
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_ARGS", "0x");
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_TX_HASH", TEST_DEP_TX_HASH);
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_INDEX", "2");
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_CODE_HASH", TEST_CODE_HASH);
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_HASH_TYPE", "data2");
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_ARGS", "0x1234");
  vi.stubEnv("NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEFAULT_ARBITRATOR", TEST_ARBITRATOR);
}

describe("product deployment environment", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses explicit public testnet variables for Vercel builds", async () => {
    setTestnetDeploymentEnv();
    vi.resetModules();

    const { resolveDefaultArbitrator, resolveProductDeployment } = await import("./deployments");

    expect(resolveProductDeployment("testnet")).toEqual({
      codeHash: TEST_CODE_HASH,
      hashType: "data2",
      args: "0x",
      depTxHash: TEST_DEP_TX_HASH,
      depIndex: "2",
      escrowLockCodeHash: TEST_CODE_HASH,
      escrowLockHashType: "data2",
      escrowLockArgs: "0x1234",
    });
    expect(resolveDefaultArbitrator("testnet")).toBe(TEST_ARBITRATOR);
  });

  it("keeps mainnet unavailable when it has no deployment variables", async () => {
    vi.resetModules();

    const { hasConfiguredProductDeployment } = await import("./deployments");

    expect(hasConfiguredProductDeployment("mainnet")).toBe(false);
  });
});
