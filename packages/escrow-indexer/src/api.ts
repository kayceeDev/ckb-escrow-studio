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

import type {
  AddDisputeEvidenceInput,
  CreateDisputeCaseInput,
  DisputeCaseRecord,
  SaveArbitratorDecisionInput,
} from "./types.js";

export interface DisputeCaseResponse {
  disputeCase: DisputeCaseRecord | null;
}

export async function getDisputeCaseFromStorage(
  storage: EscrowIndexerStorage,
  network: IndexedEscrowNetwork,
  escrowId: string,
): Promise<DisputeCaseResponse> {
  return {
    disputeCase: await storage.getDisputeCase(network, escrowId),
  };
}

export async function createDisputeCaseInStorage(
  storage: EscrowIndexerStorage,
  input: CreateDisputeCaseInput,
): Promise<DisputeCaseResponse> {
  return {
    disputeCase: await storage.createDisputeCase(input),
  };
}

export async function addDisputeEvidenceToStorage(
  storage: EscrowIndexerStorage,
  input: AddDisputeEvidenceInput,
): Promise<DisputeCaseResponse> {
  return {
    disputeCase: await storage.addDisputeEvidence(input),
  };
}

export async function saveArbitratorDecisionToStorage(
  storage: EscrowIndexerStorage,
  input: SaveArbitratorDecisionInput,
): Promise<DisputeCaseResponse> {
  return {
    disputeCase: await storage.saveArbitratorDecision(input),
  };
}
