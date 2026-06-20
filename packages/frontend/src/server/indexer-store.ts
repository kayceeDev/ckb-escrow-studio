import * as ccc from "@ckb-ccc/ccc";
import {
  MemoryEscrowIndexerStorage,
  PostgresEscrowIndexerStorage,
  scanEscrowHistory,
  type EscrowIndexerStorage,
  type EscrowScannerClient,
  type IndexedEscrowNetwork,
} from "@ckb-escrow/indexer";

import { resolveProductDeployment } from "../config/deployments";
import { isDeploymentReady, NETWORK_CLIENTS } from "../studio";

export interface IndexerStorageRuntimeStatus {
  configuredStorage: "memory" | "postgres";
  activeStorage: "memory" | "postgres";
  degraded: boolean;
  error: string | null;
}

interface ManagedIndexerStorage {
  storage: EscrowIndexerStorage;
  status: IndexerStorageRuntimeStatus;
}

declare global {
  var __ckbEscrowIndexerManagedStorage: ManagedIndexerStorage | undefined;
  var __ckbEscrowIndexerSyncs: Partial<Record<IndexedEscrowNetwork, Promise<void>>> | undefined;
}

function hasPlaceholderDatabaseHost(databaseUrl: string): boolean {
  try {
    return new URL(databaseUrl).hostname === "host";
  } catch {
    return false;
  }
}

function createManagedStorage(): ManagedIndexerStorage {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    return {
      storage: new MemoryEscrowIndexerStorage(),
      status: {
        configuredStorage: "memory",
        activeStorage: "memory",
        degraded: false,
        error: null,
      },
    };
  }

  if (hasPlaceholderDatabaseHost(databaseUrl)) {
    return {
      storage: new MemoryEscrowIndexerStorage(),
      status: {
        configuredStorage: "postgres",
        activeStorage: "memory",
        degraded: true,
        error: "DATABASE_URL still uses the placeholder hostname 'host'. Replace it with your real Postgres hostname.",
      },
    };
  }

  return {
    storage: new PostgresEscrowIndexerStorage({ connectionString: databaseUrl }),
    status: {
      configuredStorage: "postgres",
      activeStorage: "postgres",
      degraded: false,
      error: null,
    },
  };
}

function getManagedStorage(): ManagedIndexerStorage {
  globalThis.__ckbEscrowIndexerManagedStorage ??= createManagedStorage();
  return globalThis.__ckbEscrowIndexerManagedStorage;
}

function degradeToMemory(error: unknown): EscrowIndexerStorage {
  const message = error instanceof Error ? error.message : String(error);
  const managed = getManagedStorage();

  managed.storage = new MemoryEscrowIndexerStorage();
  managed.status = {
    configuredStorage: managed.status.configuredStorage,
    activeStorage: "memory",
    degraded: true,
    error: `Postgres indexer storage is unavailable, using memory fallback: ${message}`,
  };

  return managed.storage;
}

export function getEscrowIndexerStorage(): EscrowIndexerStorage {
  return getManagedStorage().storage;
}

export function getIndexerStorageRuntimeStatus(): IndexerStorageRuntimeStatus {
  return getManagedStorage().status;
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

async function scanWithStorage(network: IndexedEscrowNetwork, typeScript: ccc.ScriptLike): Promise<void> {
  try {
    await scanEscrowHistory({
      network,
      client: NETWORK_CLIENTS[network] as unknown as EscrowScannerClient,
      deployment: { typeScript },
      storage: getEscrowIndexerStorage(),
      limit: Number(process.env.CKB_ESCROW_INDEXER_SCAN_LIMIT ?? "100"),
    });
  } catch (error) {
    const fallbackStorage = degradeToMemory(error);
    await scanEscrowHistory({
      network,
      client: NETWORK_CLIENTS[network] as unknown as EscrowScannerClient,
      deployment: { typeScript },
      storage: fallbackStorage,
      limit: Number(process.env.CKB_ESCROW_INDEXER_SCAN_LIMIT ?? "100"),
    });
  }
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

  const sync = scanWithStorage(network, typeScript).finally(() => {
    if (globalThis.__ckbEscrowIndexerSyncs?.[network] === sync) {
      delete globalThis.__ckbEscrowIndexerSyncs?.[network];
    }
  });

  globalThis.__ckbEscrowIndexerSyncs[network] = sync;
  await sync;
}
