import * as ccc from "@ckb-ccc/ccc";
import {
  MemoryEscrowIndexerStorage,
  scanEscrowHistory,
  type EscrowScannerClient,
  type IndexedEscrowNetwork,
} from "@ckb-escrow/indexer";

import { resolveProductDeployment } from "../config/deployments";
import { isDeploymentReady, NETWORK_CLIENTS } from "../studio";

declare global {
  // Keep one dev storage instance across Next.js module reloads.
  var __ckbEscrowIndexerStorage: MemoryEscrowIndexerStorage | undefined;
  var __ckbEscrowIndexerSyncs: Partial<Record<IndexedEscrowNetwork, Promise<void>>> | undefined;
}

export function getEscrowIndexerStorage(): MemoryEscrowIndexerStorage {
  globalThis.__ckbEscrowIndexerStorage ??= new MemoryEscrowIndexerStorage();
  return globalThis.__ckbEscrowIndexerStorage;
}

function typeScriptForNetwork(network: IndexedEscrowNetwork): ccc.ScriptLike | null {
  const deployment = resolveProductDeployment(network);
  if (!isDeploymentReady(deployment)) {
    return null;
  }

  return {
    codeHash: deployment.codeHash,
    hashType: deployment.hashType,
    args: deployment.args || "0x",
  };
}

export async function syncEscrowIndexer(network: IndexedEscrowNetwork): Promise<void> {
  const typeScript = typeScriptForNetwork(network);
  if (!typeScript) {
    return;
  }

  globalThis.__ckbEscrowIndexerSyncs ??= {};
  const existing = globalThis.__ckbEscrowIndexerSyncs[network];
  if (existing) {
    await existing;
    return;
  }

  const sync = scanEscrowHistory({
    network,
    client: NETWORK_CLIENTS[network] as unknown as EscrowScannerClient,
    deployment: { typeScript },
    storage: getEscrowIndexerStorage(),
    limit: Number(process.env.CKB_ESCROW_INDEXER_SCAN_LIMIT ?? "100"),
  })
    .then(() => undefined)
    .finally(() => {
      if (globalThis.__ckbEscrowIndexerSyncs?.[network] === sync) {
        delete globalThis.__ckbEscrowIndexerSyncs?.[network];
      }
    });

  globalThis.__ckbEscrowIndexerSyncs[network] = sync;
  await sync;
}
