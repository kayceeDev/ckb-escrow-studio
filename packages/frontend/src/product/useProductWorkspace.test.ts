import { describe, expect, it } from "vitest";
import type * as ccc from "@ckb-ccc/ccc";

import {
  getProductSignerOptions,
  selectActiveSignerAfterWalletRefresh,
  shouldReconnectActiveSigner,
  signerStorageKey,
} from "./useProductWorkspace";
import type { WalletState } from "../types";

function signer(label: string): ccc.Signer {
  return { label } as unknown as ccc.Signer;
}

function wallets(input: Array<{ walletName: string; signers: Array<{ name: string; signer: ccc.Signer }> }>): WalletState["wallets"] {
  return input.map((wallet) => ({
    name: wallet.walletName,
    icon: "",
    signers: wallet.signers,
  }));
}

describe("product wallet lifecycle helpers", () => {
  it("flattens wallet signer options with wallet and signer names", () => {
    const joyId = signer("joyid");
    const okx = signer("okx");

    expect(
      getProductSignerOptions(
        wallets([
          { walletName: "JoyID", signers: [{ name: "CKB", signer: joyId }] },
          { walletName: "OKX Wallet", signers: [{ name: "EVM", signer: okx }] },
        ]),
      ),
    ).toEqual([
      { walletName: "JoyID", signerName: "CKB", signer: joyId },
      { walletName: "OKX Wallet", signerName: "EVM", signer: okx },
    ]);
  });

  it("preserves the current signer after wallet refresh when it is still discovered", () => {
    const active = signer("active");
    const fallback = signer("fallback");
    const discoveredWallets = wallets([
      {
        walletName: "JoyID",
        signers: [
          { name: "CKB", signer: active },
          { name: "BTC", signer: fallback },
        ],
      },
    ]);

    expect(
      selectActiveSignerAfterWalletRefresh({
        wallets: discoveredWallets,
        currentActiveSigner: active,
        storedSigner: {
          network: "testnet",
          walletName: "JoyID",
          signerName: "BTC",
        },
        network: "testnet",
      }),
    ).toBe(active);
  });

  it("restores the stored signer only for the matching network", () => {
    const testnetSigner = signer("testnet");
    const discoveredWallets = wallets([
      { walletName: "JoyID", signers: [{ name: "CKB", signer: testnetSigner }] },
    ]);

    expect(
      selectActiveSignerAfterWalletRefresh({
        wallets: discoveredWallets,
        currentActiveSigner: null,
        storedSigner: {
          network: "testnet",
          walletName: "JoyID",
          signerName: "CKB",
        },
        network: "testnet",
      }),
    ).toBe(testnetSigner);

    expect(
      selectActiveSignerAfterWalletRefresh({
        wallets: discoveredWallets,
        currentActiveSigner: null,
        storedSigner: {
          network: "mainnet",
          walletName: "JoyID",
          signerName: "CKB",
        },
        network: "testnet",
      }),
    ).toBeNull();
  });

  it("forces reconnect when wallet refresh invalidates the restored signer key", () => {
    const active = signer("active");
    const activeOption = {
      walletName: "JoyID",
      signerName: "CKB",
      signer: active,
    };

    expect(
      shouldReconnectActiveSigner({
        activeOption,
        restoredSignerKey: signerStorageKey("JoyID", "CKB"),
      }),
    ).toBe(false);

    expect(
      shouldReconnectActiveSigner({
        activeOption,
        restoredSignerKey: null,
      }),
    ).toBe(true);
  });
});
