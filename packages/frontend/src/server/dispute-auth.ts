import * as ccc from "@ckb-ccc/ccc";
import { randomBytes } from "node:crypto";

import { NETWORK_CLIENTS } from "../studio";
import type { CkbNetwork } from "../types";

export type DisputeWriteAction = "create" | "addEvidence" | "decision";

export interface DisputeAuthNonceInput {
  network: CkbNetwork;
  escrowId: string;
  action: DisputeWriteAction;
  lockHash: `0x${string}`;
}

export interface DisputeAuthNonceRecord extends DisputeAuthNonceInput {
  nonce: string;
  expiresAt: string;
  used: boolean;
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
const nonceStore = new Map<string, DisputeAuthNonceRecord>();

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

export function issueDisputeAuthNonce(input: DisputeAuthNonceInput): { nonce: string; expiresAt: string; message: string } {
  const nonce = `0x${randomBytes(16).toString("hex")}`;
  const record: DisputeAuthNonceRecord = {
    ...input,
    lockHash: normalizeHex(input.lockHash),
    nonce,
    expiresAt: new Date(nowMs() + NONCE_TTL_MS).toISOString(),
    used: false,
  };
  nonceStore.set(nonce, record);
  return { nonce, expiresAt: record.expiresAt, message: buildDisputeAuthMessage(record) };
}

function getNonceRecord(proof: DisputeAuthProof): DisputeAuthNonceRecord {
  const record = nonceStore.get(proof.nonce);
  if (!record) {
    throw new Error("Dispute authorization nonce was not issued by this server");
  }
  if (record.used) {
    throw new Error("Dispute authorization nonce has already been used");
  }
  if (Date.parse(record.expiresAt) < nowMs()) {
    throw new Error("Dispute authorization nonce has expired");
  }
  return record;
}

async function ckbSecpIdentityMatchesLockHash(
  network: CkbNetwork,
  identity: string,
  expectedLockHash: `0x${string}`,
): Promise<boolean> {
  try {
    const signer = new ccc.SignerCkbPublicKey(NETWORK_CLIENTS[network], identity);
    const address = await signer.getAddressObjSecp256k1();
    return address.script.hash().toLowerCase() === expectedLockHash;
  } catch {
    return false;
  }
}

async function signerAddressMatchesLockHash(
  network: CkbNetwork,
  address: string,
  expectedLockHash: `0x${string}`,
): Promise<boolean> {
  const parsed = await ccc.Address.fromString(address, NETWORK_CLIENTS[network]);
  return parsed.script.hash().toLowerCase() === expectedLockHash;
}

async function signatureIdentityMatchesLockHash(input: {
  network: CkbNetwork;
  proof: DisputeAuthProof;
  expectedLockHash: `0x${string}`;
}): Promise<boolean> {
  if (input.proof.signature.signType === ccc.SignerSignType.CkbSecp256k1) {
    return ckbSecpIdentityMatchesLockHash(input.network, input.proof.signature.identity, input.expectedLockHash);
  }

  // For JoyID/EVM/BTC signers, CCC verifies the signature identity while address parsing verifies the CKB lock hash.
  // Different signer families encode identity differently, so the on-chain tx verification remains mandatory for state-changing metadata.
  return signerAddressMatchesLockHash(input.network, input.proof.signerAddress, input.expectedLockHash);
}

export async function verifyDisputeWriteAuth(input: {
  network: CkbNetwork;
  escrowId: string;
  action: DisputeWriteAction;
  lockHash: `0x${string}`;
  proof: DisputeAuthProof | null | undefined;
}): Promise<void> {
  if (!input.proof) {
    throw new Error("Dispute write authorization is required");
  }

  const expectedLockHash = normalizeHex(input.lockHash);
  const record = getNonceRecord(input.proof);
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

  if (!(await signatureIdentityMatchesLockHash({ network: input.network, proof: input.proof, expectedLockHash }))) {
    throw new Error("Dispute authorization signature identity does not match the participant wallet");
  }

  record.used = true;
  nonceStore.set(record.nonce, record);
}

export function __resetDisputeAuthNoncesForTests(): void {
  nonceStore.clear();
}
