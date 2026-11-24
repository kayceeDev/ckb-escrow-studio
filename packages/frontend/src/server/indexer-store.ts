import * as ccc from "@ckb-ccc/ccc";
import {
  MemoryEscrowIndexerStorage,
  MemoryIndexerCoordinator,
  IndexerCoordinatorStorageError,
  PostgresEscrowIndexerStorage,
  PostgresIndexerCoordinator,
  syncCanonicalEscrowHistory,
  type EscrowIndexerStorage,
  type CanonicalScannerClient,
  type IndexerCoordinator,
  type IndexedEscrowNetwork,
} from "@ckb-escrow/indexer";

import { resolveProductDeployment } from "../config/deployments";
import { isDeploymentReady, NETWORK_CLIENTS } from "../studio";
import { isDatabaseRuntimeError, isProductionRuntime, resolveDatabaseUrl } from "./database-config";

export interface IndexerStorageRuntimeStatus {
  configuredStorage: "memory" | "postgres";
  activeStorage: "memory" | "postgres";
  degraded: boolean;
  error: string | null;
}

export class IndexerStorageUnavailableError extends Error {
  readonly status = 503;
  readonly code = "indexer_storage_unavailable";

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "IndexerStorageUnavailableError";
  }
}

interface ManagedIndexerStorage {
  storage: EscrowIndexerStorage;
  coordinator: IndexerCoordinator;
  status: IndexerStorageRuntimeStatus;
}

class ProductionEscrowIndexerStorage implements EscrowIndexerStorage {
  constructor(private readonly storage: EscrowIndexerStorage) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isDatabaseRuntimeError(error)) {
        throw new IndexerStorageUnavailableError(
          `Postgres indexer storage is unavailable: ${error instanceof Error ? error.message : String(error)}`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  upsertEscrow(record: Parameters<EscrowIndexerStorage["upsertEscrow"]>[0]) {
    return this.run(() => this.storage.upsertEscrow(record));
  }
  getEscrow(query: Parameters<EscrowIndexerStorage["getEscrow"]>[0]) {
    return this.run(() => this.storage.getEscrow(query));
  }
  listEscrows(query: Parameters<EscrowIndexerStorage["listEscrows"]>[0]) {
    return this.run(() => this.storage.listEscrows(query));
  }
  getStatus(network: Parameters<EscrowIndexerStorage["getStatus"]>[0]) {
    return this.run(() => this.storage.getStatus(network));
  }
  createDisputeCase(input: Parameters<EscrowIndexerStorage["createDisputeCase"]>[0]) {
    return this.run(() => this.storage.createDisputeCase(input));
  }
  addDisputeEvidence(input: Parameters<EscrowIndexerStorage["addDisputeEvidence"]>[0]) {
    return this.run(() => this.storage.addDisputeEvidence(input));
  }
  getDisputeCase(
    network: Parameters<EscrowIndexerStorage["getDisputeCase"]>[0],
    escrowId: Parameters<EscrowIndexerStorage["getDisputeCase"]>[1],
  ) {
    return this.run(() => this.storage.getDisputeCase(network, escrowId));
  }
  saveArbitratorDecision(input: Parameters<EscrowIndexerStorage["saveArbitratorDecision"]>[0]) {
    return this.run(() => this.storage.saveArbitratorDecision(input));
  }
  replaceCanonicalSnapshot(
    network: IndexedEscrowNetwork,
    records: Parameters<NonNullable<EscrowIndexerStorage["replaceCanonicalSnapshot"]>>[1],
    checkpoint: Parameters<NonNullable<EscrowIndexerStorage["replaceCanonicalSnapshot"]>>[2],
  ) {
    if (!this.storage.replaceCanonicalSnapshot) {
      return Promise.reject(new Error("Indexer storage does not support canonical snapshot replacement"));
    }
    return this.run(() => this.storage.replaceCanonicalSnapshot!(network, records, checkpoint));
  }
  reconcileDisputeChainStatus(network: IndexedEscrowNetwork) {
    if (!this.storage.reconcileDisputeChainStatus) return Promise.resolve();
    return this.run(() => this.storage.reconcileDisputeChainStatus!(network));
  }
}

class ProductionIndexerCoordinator implements IndexerCoordinator {
  constructor(private readonly coordinator: IndexerCoordinator) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof IndexerCoordinatorStorageError) {
        throw new IndexerStorageUnavailableError(error.message, { cause: error });
      }
      throw error;
    }
  }

  withLock<T>(network: IndexedEscrowNetwork, task: () => Promise<T>) {
    return this.run(() => this.coordinator.withLock(network, task));
  }
  getCheckpoint(network: IndexedEscrowNetwork) {
    return this.run(() => this.coordinator.getCheckpoint(network));
  }
  saveCheckpoint(network: IndexedEscrowNetwork, checkpoint: Parameters<IndexerCoordinator["saveCheckpoint"]>[1]) {
    return this.run(() => this.coordinator.saveCheckpoint(network, checkpoint));
  }
  saveError(network: IndexedEscrowNetwork, message: string) {
    return this.run(() => this.coordinator.saveError(network, message));
  }
}

export function __wrapIndexerStorageForTests(storage: EscrowIndexerStorage): EscrowIndexerStorage {
  return new ProductionEscrowIndexerStorage(storage);
}

export function __wrapIndexerCoordinatorForTests(coordinator: IndexerCoordinator): IndexerCoordinator {
  return new ProductionIndexerCoordinator(coordinator);
}

declare global {
  var __ckbEscrowIndexerManagedStorage: ManagedIndexerStorage | undefined;
  var __ckbEscrowIndexerSyncs: Partial<Record<IndexedEscrowNetwork, Promise<void>>> | undefined;
}

function createManagedStorage(): ManagedIndexerStorage {
  const database = resolveDatabaseUrl();
  if (!database.url) {
    const message = database.error ?? "PostgreSQL is required for persistent escrow history in production.";
    if (isProductionRuntime()) {
      throw new IndexerStorageUnavailableError(message);
    }
    return {
      storage: new MemoryEscrowIndexerStorage(),
      coordinator: new MemoryIndexerCoordinator(),
      status: {
        configuredStorage: database.configured ? "postgres" : "memory",
        activeStorage: "memory",
        degraded: database.configured,
        error: database.error,
      },
    };
  }

  const postgresStorage = new PostgresEscrowIndexerStorage({ connectionString: database.url });
  const postgresCoordinator = new PostgresIndexerCoordinator({ connectionString: database.url });
  return {
    storage: isProductionRuntime() ? new ProductionEscrowIndexerStorage(postgresStorage) : postgresStorage,
    coordinator: isProductionRuntime() ? new ProductionIndexerCoordinator(postgresCoordinator) : postgresCoordinator,
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
  const managed = getManagedStorage();
  await syncCanonicalEscrowHistory({
    network,
    client: NETWORK_CLIENTS[network] as unknown as CanonicalScannerClient,
    deployment: { typeScript },
    storage: managed.storage,
    coordinator: managed.coordinator,
    deploymentBlock: BigInt(process.env.CKB_ESCROW_TESTNET_DEPLOYMENT_BLOCK ?? "22272848"),
    confirmations: BigInt(process.env.CKB_ESCROW_INDEXER_CONFIRMATIONS ?? "12"),
    pageSize: Number(process.env.CKB_ESCROW_INDEXER_PAGE_SIZE ?? "100"),
  });
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
