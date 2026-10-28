import { NextResponse } from "next/server";
import { parseNetwork } from "@ckb-escrow/indexer";

import {
  getEscrowIndexerStorage,
  getIndexerStorageRuntimeStatus,
  IndexerStorageUnavailableError,
  syncEscrowIndexer,
} from "../../../../src/server/indexer-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const network = parseNetwork(url.searchParams.get("network"));
    await syncEscrowIndexer(network);
    const status = await getEscrowIndexerStorage().getStatus(network);
    return NextResponse.json({
      ...status,
      runtime: getIndexerStorageRuntimeStatus(),
    });
  } catch (error) {
    if (error instanceof IndexerStorageUnavailableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
