import * as ccc from "@ckb-ccc/ccc";
import type { DisputeAuthAction, DisputeAuthNonceRecord, DisputeAuthNonceStore } from "@ckb-escrow/indexer";
import { randomBytes } from "node:crypto";

import { NETWORK_CLIENTS } from "../studio";
import type { CkbNetwork } from "../types";

export type DisputeWriteAction = DisputeAuthAction;

export interface DisputeAuthNonceInput {
  network: CkbNetwork;
  escrowId: string;
  action: DisputeWriteAction;
  lockHash: `0x${string}`;
}

export interface DisputeAuthProof {
  nonce: string;
  message: string;
  signature: {
    signature: string;
    identity: string;
    signType: ccc.SignerSignType;
  };
  signerAddress: string;
  signerLockHash: `0x${string}`;
}

const NONCE_TTL_MS = 5 * 60 * 1000;

function nowMs(): number {
  return Date.now();
}

function normalizeHex(value: string): `0x${string}` {
  return value.toLowerCase() as `0x${string}`;
}

export function buildDisputeAuthMessage(record: DisputeAuthNonceRecord): string {
  return [
    "CKB Escrow dispute authorization",
    `network=${record.network}`,
    `escrowId=${record.escrowId}`,
    `action=${record.action}`,
    `lockHash=${record.lockHash}`,
    `nonce=${record.nonce}`,
    `expiresAt=${record.expiresAt}`,
  ].join("\n");
}

export async function issueDisputeAuthNonce(
  store: DisputeAuthNonceStore,
  input: DisputeAuthNonceInput,
): Promise<{ nonce: string; expiresAt: string; message: string }> {
  const nonce = `0x${randomBytes(16).toString("hex")}`;
  const createdAt = new Date(nowMs()).toISOString();
  const record: DisputeAuthNonceRecord = {
    ...input,
    lockHash: normalizeHex(input.lockHash),
    nonce,
    expiresAt: new Date(nowMs() + NONCE_TTL_MS).toISOString(),
    createdAt,
    consumedAt: null,
  };
  await store.issue(record);
  return { nonce, expiresAt: record.expiresAt, message: buildDisputeAuthMessage(record) };
}

async function getNonceRecord(
  store: DisputeAuthNonceStore,
  proof: DisputeAuthProof,
): Promise<DisputeAuthNonceRecord> {
  const record = await store.get(proof.nonce);
  if (!record) {
    throw new Error("Dispute authorization nonce was not issued by this server");
  }
  if (record.consumedAt) {
    throw new Error("Dispute authorization nonce has already been used");
  }
  if (Date.parse(record.expiresAt) < nowMs()) {
    throw new Error("Dispute authorization nonce has expired");
  }
  return record;
}

async function signerAddressMatchesLockHash(
  network: CkbNetwork,
  address: string,
  expectedLockHash: `0x${string}`,
): Promise<boolean> {
  const parsed = await ccc.Address.fromString(address, NETWORK_CLIENTS[network]);
  return parsed.script.hash().toLowerCase() === expectedLockHash;
}

async function identityLockHashes(network: CkbNetwork, proof: DisputeAuthProof): Promise<string[]> {
  const client = NETWORK_CLIENTS[network];
  const { identity, signType } = proof.signature;

  if (signType === ccc.SignerSignType.CkbSecp256k1) {
    try {
      const signer = new ccc.SignerCkbPublicKey(client, identity);
      return [(await signer.getAddressObjSecp256k1()).script.hash().toLowerCase()];
    } catch {
      return [];
    }
  }

  if (signType === ccc.SignerSignType.EvmPersonal) {
    try {
      const account = ccc.bytesFrom(identity);
      if (account.length !== 20) return [];
      const candidates = await Promise.all([
        ccc.Address.fromKnownScript(client, ccc.KnownScript.OmniLock, ccc.hexFrom([0x12, ...account, 0x00])),
        ccc.Address.fromKnownScript(client, ccc.KnownScript.OmniLock, ccc.hexFrom([0x01, ...account, 0x00])),
      ]);
      try {
        candidates.push(await ccc.Address.fromKnownScript(client, ccc.KnownScript.PWLock, ccc.hexFrom(account)));
      } catch {
        // PWLock is not deployed on every network.
      }
      return candidates.map(({ script }) => script.hash().toLowerCase());
    } catch {
      return [];
    }
  }

  if (signType === ccc.SignerSignType.BtcEcdsa) {
    try {
      const signer = new ccc.SignerBtcPublicKeyReadonly(client, "", identity);
      return (await signer.getAddressObjs()).map(({ script }) => script.hash().toLowerCase());
    } catch {
      return [];
    }
  }

  return [];
}

export function isSupportedDisputeSignType(signType: ccc.SignerSignType): boolean {
  return [
    ccc.SignerSignType.CkbSecp256k1,
    ccc.SignerSignType.EvmPersonal,
    ccc.SignerSignType.BtcEcdsa,
  ].includes(signType);
}

export async function verifyDisputeWriteAuth(input: {
  store: DisputeAuthNonceStore;
  network: CkbNetwork;
  escrowId: string;
  action: DisputeWriteAction;
  lockHash: `0x${string}`;
  proof: DisputeAuthProof | null | undefined;
}): Promise<void> {
  if (!input.proof) {
    throw new Error("Dispute write authorization is required");
  }
  if (!isSupportedDisputeSignType(input.proof.signature.signType)) {
    throw new Error(`Wallet signature type ${input.proof.signature.signType} is not supported for dispute evidence`);
  }

  const expectedLockHash = normalizeHex(input.lockHash);
  const record = await getNonceRecord(input.store, input.proof);
  if (
    record.network !== input.network ||
    record.escrowId !== input.escrowId ||
    record.action !== input.action ||
    record.lockHash !== expectedLockHash
  ) {
    throw new Error("Dispute authorization nonce does not match this request");
  }

  const expectedMessage = buildDisputeAuthMessage(record);
  if (input.proof.message !== expectedMessage) {
    throw new Error("Dispute authorization message does not match the issued nonce");
  }
  if (normalizeHex(input.proof.signerLockHash) !== expectedLockHash) {
    throw new Error("Dispute authorization signer lock hash does not match this request");
  }
  if (!(await ccc.Signer.verifyMessage(input.proof.message, input.proof.signature))) {
    throw new Error("Dispute authorization signature is invalid");
  }
  if (!(await signerAddressMatchesLockHash(input.network, input.proof.signerAddress, expectedLockHash))) {
    throw new Error("Dispute authorization signer address does not match the participant wallet");
  }
  if (!(await identityLockHashes(input.network, input.proof)).includes(expectedLockHash)) {
    throw new Error("Dispute authorization signature identity does not match the participant wallet");
  }
  if (!(await input.store.consume(record.nonce))) {
    throw new Error("Dispute authorization nonce has already been used");
  }
}
