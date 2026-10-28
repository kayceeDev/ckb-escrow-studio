import {
  MemoryDisputeAuthNonceStore,
  PostgresDisputeAuthNonceStore,
  type DisputeAuthNonceStore,
} from "@ckb-escrow/indexer";

import { isDatabaseRuntimeError, isProductionRuntime, resolveDatabaseUrl } from "./database-config";

declare global {
  var __ckbEscrowDisputeAuthStore: DisputeAuthNonceStore | undefined;
}

export class DisputeAuthUnavailableError extends Error {
  readonly status = 503;
  readonly code = "auth_storage_unavailable";
}

class ProductionDisputeAuthNonceStore implements DisputeAuthNonceStore {
  constructor(private readonly store: DisputeAuthNonceStore) {}

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (isDatabaseRuntimeError(error)) {
        throw new DisputeAuthUnavailableError(
          `PostgreSQL dispute authorization is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      throw error;
    }
  }

  issue(record: Parameters<DisputeAuthNonceStore["issue"]>[0]) {
    return this.run(() => this.store.issue(record));
  }
  get(nonce: Parameters<DisputeAuthNonceStore["get"]>[0]) {
    return this.run(() => this.store.get(nonce));
  }
  consume(nonce: Parameters<DisputeAuthNonceStore["consume"]>[0]) {
    return this.run(() => this.store.consume(nonce));
  }
}

export function __wrapDisputeAuthStoreForTests(store: DisputeAuthNonceStore): DisputeAuthNonceStore {
  return new ProductionDisputeAuthNonceStore(store);
}

export function getDisputeAuthNonceStore(): DisputeAuthNonceStore {
  if (globalThis.__ckbEscrowDisputeAuthStore) {
    return globalThis.__ckbEscrowDisputeAuthStore;
  }

  const database = resolveDatabaseUrl();
  if (database.url) {
    const postgresStore = new PostgresDisputeAuthNonceStore({ connectionString: database.url });
    globalThis.__ckbEscrowDisputeAuthStore = isProductionRuntime()
      ? new ProductionDisputeAuthNonceStore(postgresStore)
      : postgresStore;
    return globalThis.__ckbEscrowDisputeAuthStore;
  }

  if (isProductionRuntime()) {
    throw new DisputeAuthUnavailableError(
      database.error ?? "PostgreSQL is required for dispute authorization in production",
    );
  }

  globalThis.__ckbEscrowDisputeAuthStore = new MemoryDisputeAuthNonceStore();
  return globalThis.__ckbEscrowDisputeAuthStore;
}

export function __setDisputeAuthNonceStoreForTests(store: DisputeAuthNonceStore | undefined): void {
  globalThis.__ckbEscrowDisputeAuthStore = store;
}
