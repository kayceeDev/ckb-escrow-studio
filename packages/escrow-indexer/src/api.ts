import type {
  EscrowIndexerStorage,
  IndexedEscrowListQuery,
  IndexedEscrowNetwork,
  IndexedEscrowStatus,
} from "./types.js";

export interface EscrowListResponse {
  escrows: Awaited<ReturnType<EscrowIndexerStorage["listEscrows"]>>;
}

export interface EscrowDetailResponse {
  escrow: Awaited<ReturnType<EscrowIndexerStorage["getEscrow"]>>;
}

export function parseNetwork(value: string | null | undefined): IndexedEscrowNetwork {
  return value === "mainnet" ? "mainnet" : "testnet";
}

export function parseStatus(value: string | null | undefined): IndexedEscrowStatus {
  if (value === "active" || value === "past" || value === "all") {
    return value;
  }
  return "all";
}

export async function listEscrowsFromStorage(
  storage: EscrowIndexerStorage,
  query: IndexedEscrowListQuery,
): Promise<EscrowListResponse> {
  return {
    escrows: await storage.listEscrows(query),
  };
}

export async function getEscrowFromStorage(
  storage: EscrowIndexerStorage,
  network: IndexedEscrowNetwork,
  escrowId: string,
): Promise<EscrowDetailResponse> {
  return {
    escrow: await storage.getEscrow({ network, escrowId }),
  };
}
