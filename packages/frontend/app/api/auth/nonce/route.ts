import { NextResponse } from "next/server";
import { parseNetwork } from "@ckb-escrow/indexer";

import { issueDisputeAuthNonce, type DisputeWriteAction } from "../../../../src/server/dispute-auth";

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function action(value: string | null): DisputeWriteAction {
  if (value === "create" || value === "addEvidence" || value === "decision") {
    return value;
  }
  throw new Error("action must be create, addEvidence, or decision");
}

function lockHash(value: string | null): `0x${string}` {
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("lockHash must be a 32-byte hex string");
  }
  return value.toLowerCase() as `0x${string}`;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const network = parseNetwork(url.searchParams.get("network"));
    const escrowId = url.searchParams.get("escrowId")?.trim();
    if (!escrowId) {
      throw new Error("escrowId is required");
    }

    return NextResponse.json(issueDisputeAuthNonce({
      network,
      escrowId,
      action: action(url.searchParams.get("action")),
      lockHash: lockHash(url.searchParams.get("lockHash")),
    }));
  } catch (error) {
    return badRequest(error instanceof Error ? error.message : String(error));
  }
}
