import {
  MemoryDisputeAuthNonceStore,
  PostgresDisputeAuthNonceStore,
  type DisputeAuthNonceStore,
} from "@ckb-escrow/indexer";

import { isProductionRuntime, resolveDatabaseUrl } from "./database-config";

declare global {
  var __ckbEscrowDisputeAuthStore: DisputeAuthNonceStore | undefined;
}

export class DisputeAuthUnavailableError extends Error {
  readonly status = 503;
  readonly code = "auth_storage_unavailable";
}

export function getDisputeAuthNonceStore(): DisputeAuthNonceStore {
  if (globalThis.__ckbEscrowDisputeAuthStore) {
    return globalThis.__ckbEscrowDisputeAuthStore;
  }

  const database = resolveDatabaseUrl();
  if (database.url) {
    globalThis.__ckbEscrowDisputeAuthStore = new PostgresDisputeAuthNonceStore({ connectionString: database.url });
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
