import { NextResponse } from "next/server";
import { parseNetwork } from "@ckb-escrow/indexer";

import { getEscrowIndexerStorage } from "../../../../src/server/indexer-store";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  const status = await getEscrowIndexerStorage().getStatus(network);

  return NextResponse.json(status);
}
