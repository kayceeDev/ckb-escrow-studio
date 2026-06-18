import type { CkbNetwork } from "../types";
import type { ProductEscrowRecord } from "./contract";

export interface ArchivedProductEscrowRecord extends ProductEscrowRecord {
  archivedAt: string;
  settlementTxHash: string;
  network: CkbNetwork;
}

export type EscrowHistoryRegistry = Partial<Record<CkbNetwork, ArchivedProductEscrowRecord[]>>;

export const ESCROW_HISTORY_STORAGE_KEY = "ckb-escrow:closed-history";

function loadRegistry(): EscrowHistoryRegistry {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(ESCROW_HISTORY_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as EscrowHistoryRegistry;
  } catch {
    return {};
  }
}

function persistRegistry(registry: EscrowHistoryRegistry): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(ESCROW_HISTORY_STORAGE_KEY, JSON.stringify(registry));
}

export function loadArchivedEscrows(network: CkbNetwork): ArchivedProductEscrowRecord[] {
  return loadRegistry()[network] ?? [];
}

export function persistArchivedEscrow(
  network: CkbNetwork,
  record: ProductEscrowRecord,
  settlementTxHash: string,
): ArchivedProductEscrowRecord[] {
  const registry = loadRegistry();
  const archived: ArchivedProductEscrowRecord = {
    ...record,
    network,
    settlementTxHash,
    archivedAt: new Date().toISOString(),
  };
  const existing = registry[network] ?? [];
  const withoutDuplicate = existing.filter((item) => item.id !== archived.id);
  const next = [archived, ...withoutDuplicate].slice(0, 100);

  persistRegistry({
    ...registry,
    [network]: next,
  });

  return next;
}
