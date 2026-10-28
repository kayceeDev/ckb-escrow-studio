import { NextResponse } from "next/server";
import { parseNetwork, type IndexedEscrowRecord } from "@ckb-escrow/indexer";

import { issueDisputeAuthNonce, type DisputeWriteAction } from "../../../../src/server/dispute-auth";
import { DisputeAuthUnavailableError, getDisputeAuthNonceStore } from "../../../../src/server/dispute-auth-store";
import { getEscrowIndexerStorage, IndexerStorageUnavailableError } from "../../../../src/server/indexer-store";

function response(message: string, code: string, status: number) {
  return NextResponse.json({ error: message, code }, { status });
}

function action(value: unknown): DisputeWriteAction {
  if (value === "create" || value === "addEvidence" || value === "decision") return value;
  throw new Error("action must be create, addEvidence, or decision");
}

function lockHash(value: unknown): `0x${string}` {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("lockHash must be a 32-byte hex string");
  }
  return value.toLowerCase() as `0x${string}`;
}

function roleAllowed(actionValue: DisputeWriteAction, lock: string, escrow: IndexedEscrowRecord): boolean {
  const normalized = lock.toLowerCase();
  if (actionValue === "decision") return escrow.arbitratorLockHash.toLowerCase() === normalized;
  if (actionValue === "create") {
    return escrow.buyerLockHash.toLowerCase() === normalized || escrow.sellerLockHash.toLowerCase() === normalized;
  }
  return [escrow.buyerLockHash, escrow.sellerLockHash, escrow.arbitratorLockHash]
    .some((value) => value.toLowerCase() === normalized);
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const network = parseNetwork(typeof body.network === "string" ? body.network : null);
    const escrowId = typeof body.escrowId === "string" ? body.escrowId.trim() : "";
    if (!escrowId) return response("escrowId is required", "invalid_request", 422);

    const actionValue = action(body.action);
    const lock = lockHash(body.lockHash);
    const escrow = await getEscrowIndexerStorage().getEscrow({ network, escrowId });
    if (!escrow) return response("Escrow not found", "escrow_not_found", 404);
    if (!roleAllowed(actionValue, lock, escrow)) {
      return response("Wallet is not authorized for this dispute action", "wrong_role", 403);
    }

    return NextResponse.json(await issueDisputeAuthNonce(getDisputeAuthNonceStore(), {
      network,
      escrowId,
      action: actionValue,
      lockHash: lock,
    }));
  } catch (error) {
    if (error instanceof DisputeAuthUnavailableError) {
      return response(error.message, error.code, error.status);
    }
    if (error instanceof IndexerStorageUnavailableError) {
      return response(error.message, error.code, error.status);
    }
    return response(error instanceof Error ? error.message : String(error), "invalid_request", 422);
  }
}
