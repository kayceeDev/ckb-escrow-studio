import * as ccc from "@ckb-ccc/ccc";
import { encodeEscrowActionHex } from "@ckb-escrow/sdk";
import { beforeEach, describe, expect, it } from "vitest";

import { NETWORK_CLIENTS } from "../studio";
import {
  __resetDisputeAuthNoncesForTests,
  issueDisputeAuthNonce,
  verifyDisputeWriteAuth,
} from "./dispute-auth";
import { verifyDisputeTransactionHash } from "./dispute-tx-verifier";

const escrowId = `0x${"aa".repeat(32)}:0`;
const txHash = `0x${"bb".repeat(32)}` as const;
const currentTxHash = `0x${"cc".repeat(32)}` as const;

function witness(action: Parameters<typeof encodeEscrowActionHex>[0]): ccc.Hex {
  return ccc.hexFrom(ccc.WitnessArgs.from({ inputType: encodeEscrowActionHex(action) }).toBytes());
}

async function ckbProof(action: "create" | "addEvidence" | "decision" = "create") {
  const signer = new ccc.SignerCkbPrivateKey(
    NETWORK_CLIENTS.testnet,
    `0x${"11".repeat(32)}`,
  );
  const address = await signer.getRecommendedAddressObj();
  const lockHash = address.script.hash().toLowerCase() as `0x${string}`;
  const nonce = issueDisputeAuthNonce({ network: "testnet", escrowId, action, lockHash });
  return {
    lockHash,
    proof: {
      nonce: nonce.nonce,
      message: nonce.message,
      signature: await signer.signMessage(nonce.message),
      signerAddress: address.toString(),
      signerLockHash: lockHash,
    },
  };
}

function storage() {
  return {
    async getEscrow() {
      return {
        id: escrowId,
        network: "testnet",
        origin: { txHash: `0x${"aa".repeat(32)}`, index: "0" },
        current: { txHash: currentTxHash, index: "1" },
        latestTxHash: currentTxHash,
        settlementTxHash: null,
        state: "Disputed",
        buyerLockHash: `0x${"01".repeat(32)}`,
        sellerLockHash: `0x${"02".repeat(32)}`,
        arbitratorLockHash: `0x${"03".repeat(32)}`,
        amountShannons: "1000",
        deadlineMs: "1700000000000",
        description: "Website redesign",
        dataHex: "0x",
        createdAt: new Date(0).toISOString(),
        updatedAt: new Date(0).toISOString(),
        closedAt: null,
        events: [],
      };
    },
  };
}

function client(action: "Dispute" | "ResolveToBuyer" | "ResolveToSeller") {
  return {
    async getTransactionWithHeader() {
      return {
        transaction: {
          transaction: {
            inputs: [
              { previousOutput: { txHash: currentTxHash, index: 1n } },
            ],
            witnesses: [witness(action)],
          },
        },
      };
    },
  };
}

describe("dispute write auth", () => {
  beforeEach(() => __resetDisputeAuthNoncesForTests());

  it("rejects missing auth proof", async () => {
    await expect(
      verifyDisputeWriteAuth({
        network: "testnet",
        escrowId,
        action: "create",
        lockHash: `0x${"11".repeat(32)}`,
        proof: null,
      }),
    ).rejects.toThrow(/authorization is required/);
  });

  it("accepts a signed CKB nonce and rejects replay", async () => {
    const { lockHash, proof } = await ckbProof("addEvidence");

    await expect(
      verifyDisputeWriteAuth({ network: "testnet", escrowId, action: "addEvidence", lockHash, proof }),
    ).resolves.toBeUndefined();
    await expect(
      verifyDisputeWriteAuth({ network: "testnet", escrowId, action: "addEvidence", lockHash, proof }),
    ).rejects.toThrow(/already been used/);
  });

  it("rejects tampered messages", async () => {
    const { lockHash, proof } = await ckbProof("create");
    await expect(
      verifyDisputeWriteAuth({
        network: "testnet",
        escrowId,
        action: "create",
        lockHash,
        proof: { ...proof, message: `${proof.message}\ntampered=true` },
      }),
    ).rejects.toThrow(/message does not match/);
  });
});

describe("dispute tx verification", () => {
  it("accepts a tx consuming the current escrow cell with the expected action", async () => {
    await expect(
      verifyDisputeTransactionHash({
        network: "testnet",
        storage: storage() as never,
        escrowId,
        txHash,
        expectedAction: "Dispute",
        client: client("Dispute") as never,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects a tx whose witness action does not match", async () => {
    await expect(
      verifyDisputeTransactionHash({
        network: "testnet",
        storage: storage() as never,
        escrowId,
        txHash,
        expectedAction: "ResolveToBuyer",
        client: client("ResolveToSeller") as never,
      }),
    ).rejects.toThrow(/does not match ResolveToBuyer/);
  });
});
