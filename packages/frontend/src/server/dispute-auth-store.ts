import {
  MemoryDisputeAuthNonceStore,
  PostgresDisputeAuthNonceStore,
  type DisputeAuthNonceStore,
} from "@ckb-escrow/indexer";

declare global {
  var __ckbEscrowDisputeAuthStore: DisputeAuthNonceStore | undefined;
}

export class DisputeAuthUnavailableError extends Error {
  readonly status = 503;
  readonly code = "auth_storage_unavailable";
}

function hasPlaceholderHost(value: string): boolean {
  try {
    return new URL(value).hostname === "host";
  } catch {
    return true;
  }
}

export function getDisputeAuthNonceStore(): DisputeAuthNonceStore {
  if (globalThis.__ckbEscrowDisputeAuthStore) {
    return globalThis.__ckbEscrowDisputeAuthStore;
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (databaseUrl && !hasPlaceholderHost(databaseUrl)) {
    globalThis.__ckbEscrowDisputeAuthStore = new PostgresDisputeAuthNonceStore({ connectionString: databaseUrl });
    return globalThis.__ckbEscrowDisputeAuthStore;
  }

  if (process.env.NODE_ENV === "production") {
    throw new DisputeAuthUnavailableError("PostgreSQL is required for dispute authorization in production");
  }

  globalThis.__ckbEscrowDisputeAuthStore = new MemoryDisputeAuthNonceStore();
  return globalThis.__ckbEscrowDisputeAuthStore;
}

export function __setDisputeAuthNonceStoreForTests(store: DisputeAuthNonceStore | undefined): void {
  globalThis.__ckbEscrowDisputeAuthStore = store;
}
