import { NextResponse } from "next/server";
import { getEscrowFromStorage, parseNetwork } from "@ckb-escrow/indexer";

import { getEscrowIndexerStorage } from "../../../../src/server/indexer-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const url = new URL(request.url);
  const network = parseNetwork(url.searchParams.get("network"));
  const { id } = await params;
  const response = await getEscrowFromStorage(getEscrowIndexerStorage(), network, decodeURIComponent(id));

  return NextResponse.json(response);
}
