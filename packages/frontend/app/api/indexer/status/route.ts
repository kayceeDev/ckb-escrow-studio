import { NextResponse } from "next/server";
import { parseNetwork } from "@ckb-escrow/indexer";

import {
  getEscrowIndexerStorage,
  getIndexerStorageRuntimeStatus,
  syncEscrowIndexer,
} from "../../../../src/server/indexer-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  await syncEscrowIndexer(network);
  const status = await getEscrowIndexerStorage().getStatus(network);

  return NextResponse.json({
    ...status,
    runtime: getIndexerStorageRuntimeStatus(),
  });
}
