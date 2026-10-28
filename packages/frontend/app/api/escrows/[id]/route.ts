import { NextResponse } from "next/server";
import { getEscrowFromStorage, parseNetwork } from "@ckb-escrow/indexer";

import {
  getEscrowIndexerStorage,
  IndexerStorageUnavailableError,
  syncEscrowIndexer,
} from "../../../../src/server/indexer-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const url = new URL(request.url);
    const network = parseNetwork(url.searchParams.get("network"));
    const { id } = await params;
    await syncEscrowIndexer(network);
    const response = await getEscrowFromStorage(getEscrowIndexerStorage(), network, decodeURIComponent(id));
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof IndexerStorageUnavailableError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    throw error;
  }
}
