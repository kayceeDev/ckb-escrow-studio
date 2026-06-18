import type { EscrowAction, EscrowCellView, EscrowState, Hex } from "@ckb-escrow/sdk";

export type IndexedEscrowNetwork = "testnet" | "mainnet";
export type IndexedEscrowStatus = "active" | "past" | "all";
export type IndexedEscrowRole = "buyer" | "seller" | "arbitrator";

export type IndexedEscrowEventType =
  | "Created"
  | "Delivered"
  | "Disputed"
  | "Completed"
  | "Cancelled"
  | "Refunded"
  | "ResolvedToBuyer"
  | "ResolvedToSeller";

export interface IndexedOutPoint {
  txHash: Hex;
  index: string;
}

export interface IndexedEscrowEvent {
  id: string;
  escrowId: string;
  network: IndexedEscrowNetwork;
  type: IndexedEscrowEventType;
  txHash: Hex;
  blockNumber: string | null;
  blockTimestamp: string | null;
  fromState: EscrowState | null;
  toState: EscrowState;
  action: EscrowAction | null;
  actorRole: IndexedEscrowRole | "buyer_or_seller" | null;
  recipientRole: "buyer" | "seller" | null;
  createdAt: string;
}

export interface IndexedEscrowRecord {
  id: string;
  network: IndexedEscrowNetwork;
  origin: IndexedOutPoint;
  current: IndexedOutPoint | null;
  latestTxHash: Hex;
  settlementTxHash: Hex | null;
  state: EscrowState;
  buyerLockHash: Hex;
  sellerLockHash: Hex;
  arbitratorLockHash: Hex;
  amountShannons: string;
  deadlineMs: string;
  description: string;
  dataHex: Hex;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  events: IndexedEscrowEvent[];
}

export interface IndexerStatus {
  network: IndexedEscrowNetwork;
  ready: boolean;
  storage: "memory" | "postgres";
  lastProcessedBlock: string | null;
  updatedAt: string;
}

export interface IndexedEscrowListQuery {
  network: IndexedEscrowNetwork;
  lockHash?: string | null;
  status?: IndexedEscrowStatus;
}

export interface IndexedEscrowDetailQuery {
  network: IndexedEscrowNetwork;
  escrowId: string;
}

export interface EscrowIndexerStorage {
  upsertEscrow(record: IndexedEscrowRecord): Promise<void>;
  getEscrow(query: IndexedEscrowDetailQuery): Promise<IndexedEscrowRecord | null>;
  listEscrows(query: IndexedEscrowListQuery): Promise<IndexedEscrowRecord[]>;
  getStatus(network: IndexedEscrowNetwork): Promise<IndexerStatus>;
}

export interface CreateIndexedEscrowInput {
  network: IndexedEscrowNetwork;
  origin: IndexedOutPoint;
  current?: IndexedOutPoint | null;
  latestTxHash?: Hex;
  settlementTxHash?: Hex | null;
  decoded: EscrowCellView;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string | null;
  events?: IndexedEscrowEvent[];
}
