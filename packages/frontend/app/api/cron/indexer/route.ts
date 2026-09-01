import { NextResponse } from "next/server";

import { getIndexerStorageRuntimeStatus, syncEscrowIndexer } from "../../../../src/server/indexer-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized", code: "cron_unauthorized" }, { status: 401 });
  }

  try {
    const startedAt = new Date().toISOString();
    await syncEscrowIndexer("testnet");
    return NextResponse.json({
      ok: true,
      network: "testnet",
      startedAt,
      completedAt: new Date().toISOString(),
      storage: getIndexerStorageRuntimeStatus(),
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : String(error),
      code: "indexer_sync_failed",
    }, { status: 500 });
  }
}
