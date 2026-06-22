import { NextResponse } from "next/server";
import {
  addDisputeEvidenceToStorage,
  createDisputeCaseInStorage,
  getDisputeCaseFromStorage,
  parseNetwork,
  saveArbitratorDecisionToStorage,
  type AddDisputeEvidenceInput,
  type CreateDisputeCaseInput,
  type SaveArbitratorDecisionInput,
} from "@ckb-escrow/indexer";

import { getEscrowIndexerStorage } from "../../../../../src/server/indexer-store";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function isHex(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[0-9a-fA-F]*$/.test(value);
}

function requiredHex(value: unknown, label: string): `0x${string}` {
  if (!isHex(value)) {
    throw new Error(`${label} must be a hex string`);
  }
  return value.toLowerCase() as `0x${string}`;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} is required`);
  }
  return value.trim();
}

function requestedOutcome(value: unknown): "buyer" | "seller" {
  if (value === "buyer" || value === "seller") {
    return value;
  }
  throw new Error("requestedOutcome must be buyer or seller");
}

function evidenceItems(value: unknown): NonNullable<CreateDisputeCaseInput["evidence"]> {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("evidence must be an array");
  }
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("evidence items must be objects");
    }
    const candidate = item as Record<string, unknown>;
    const type = candidate.type;
    if (type !== "statement" && type !== "link" && type !== "file") {
      throw new Error("evidence type must be statement, link, or file");
    }
    return {
      type,
      label: requiredString(candidate.label, "evidence label"),
      value: requiredString(candidate.value, "evidence value"),
      uri: typeof candidate.uri === "string" && candidate.uri.trim() ? candidate.uri.trim() : null,
      mimeType: typeof candidate.mimeType === "string" && candidate.mimeType.trim() ? candidate.mimeType.trim() : null,
      sizeBytes: typeof candidate.sizeBytes === "number" && Number.isFinite(candidate.sizeBytes) ? candidate.sizeBytes : null,
      contentHash: requiredHex(candidate.contentHash, "evidence contentHash"),
      submittedByLockHash: requiredHex(candidate.submittedByLockHash, "evidence submittedByLockHash"),
    };
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  const { id } = await params;
  const response = await getDisputeCaseFromStorage(getEscrowIndexerStorage(), network, decodeURIComponent(id));
  return NextResponse.json(response);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const url = new URL(request.url);
    const network = parseNetwork(url.searchParams.get("network"));
    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const action = body.action;

    if (action === "create") {
      const input: CreateDisputeCaseInput = {
        escrowId: decodeURIComponent(id),
        network,
        disputeTxHash: requiredHex(body.disputeTxHash, "disputeTxHash"),
        openedByLockHash: requiredHex(body.openedByLockHash, "openedByLockHash"),
        requestedOutcome: requestedOutcome(body.requestedOutcome),
        reason: requiredString(body.reason, "reason"),
        evidence: evidenceItems(body.evidence),
      };
      return NextResponse.json(await createDisputeCaseInStorage(getEscrowIndexerStorage(), input));
    }

    if (action === "addEvidence") {
      const submittedByLockHash = requiredHex(body.submittedByLockHash, "submittedByLockHash");
      const input: AddDisputeEvidenceInput = {
        escrowId: decodeURIComponent(id),
        network,
        submittedByLockHash,
        evidence: evidenceItems(body.evidence).map((item) => ({
          type: item.type,
          label: item.label,
          value: item.value,
          uri: item.uri,
          mimeType: item.mimeType,
          sizeBytes: item.sizeBytes,
          contentHash: item.contentHash,
        })),
      };
      return NextResponse.json(await addDisputeEvidenceToStorage(getEscrowIndexerStorage(), input));
    }

    if (action === "decision") {
      const input: SaveArbitratorDecisionInput = {
        escrowId: decodeURIComponent(id),
        network,
        outcome: requestedOutcome(body.outcome),
        decisionNote: requiredString(body.decisionNote, "decisionNote"),
        resolutionTxHash: requiredHex(body.resolutionTxHash, "resolutionTxHash"),
        decidedByLockHash: requiredHex(body.decidedByLockHash, "decidedByLockHash"),
      };
      return NextResponse.json(await saveArbitratorDecisionToStorage(getEscrowIndexerStorage(), input));
    }

    return badRequest("Unknown dispute action");
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }
}
