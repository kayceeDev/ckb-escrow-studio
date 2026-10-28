import { NextResponse } from "next/server";
import { listEscrowsFromStorage, parseNetwork, parseStatus } from "@ckb-escrow/indexer";

import {
  getEscrowIndexerStorage,
  IndexerStorageUnavailableError,
  syncEscrowIndexer,
} from "../../../src/server/indexer-store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const network = parseNetwork(url.searchParams.get("network"));
    const status = parseStatus(url.searchParams.get("status"));
    const lockHash = url.searchParams.get("lockHash");
    await syncEscrowIndexer(network);
    const response = await listEscrowsFromStorage(getEscrowIndexerStorage(), {
      network,
      status,
      lockHash,
    });
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof IndexerStorageUnavailableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
