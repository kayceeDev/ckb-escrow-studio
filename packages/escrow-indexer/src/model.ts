import type { EscrowAction, EscrowState } from "@ckb-escrow/sdk";

import type {
  CreateIndexedEscrowInput,
  IndexedEscrowEventType,
  IndexedEscrowRecord,
  IndexedEscrowStatus,
} from "./types.js";

const ACTIVE_STATES = new Set<EscrowState>(["Funded", "Delivered", "Disputed"]);
const PAST_STATES = new Set<EscrowState>(["Completed", "Cancelled", "Refunded", "Resolved"]);

export function makeEscrowId(origin: { txHash: string; index: string }): string {
  return `${origin.txHash}:${origin.index}`;
}

export function escrowStatusForState(state: EscrowState): Exclude<IndexedEscrowStatus, "all"> {
  return ACTIVE_STATES.has(state) ? "active" : "past";
}

export function isEscrowInStatus(state: EscrowState, status: IndexedEscrowStatus = "all"): boolean {
  if (status === "all") {
    return true;
  }
  if (status === "active") {
    return ACTIVE_STATES.has(state);
  }
  return PAST_STATES.has(state);
}

export function eventTypeForTransition(
  fromState: EscrowState | null,
  toState: EscrowState,
  action: EscrowAction | null,
): IndexedEscrowEventType {
  if (!fromState && toState === "Funded") {
    return "Created";
  }

  switch (action) {
    case "Deliver":
      return "Delivered";
    case "Dispute":
      return "Disputed";
    case "Complete":
      return "Completed";
    case "Cancel":
      return "Cancelled";
    case "Refund":
      return "Refunded";
    case "ResolveToBuyer":
      return "ResolvedToBuyer";
    case "ResolveToSeller":
      return "ResolvedToSeller";
    default:
      if (toState === "Delivered") {
        return "Delivered";
      }
      if (toState === "Disputed") {
        return "Disputed";
      }
      if (toState === "Completed") {
        return "Completed";
      }
      if (toState === "Cancelled") {
        return "Cancelled";
      }
      if (toState === "Refunded") {
        return "Refunded";
      }
      if (toState === "Resolved") {
        return "ResolvedToSeller";
      }
      return "Created";
  }
}

export function createIndexedEscrow(input: CreateIndexedEscrowInput): IndexedEscrowRecord {
  const now = new Date().toISOString();
  const id = makeEscrowId(input.origin);

  return {
    id,
    network: input.network,
    origin: input.origin,
    current: input.current === undefined ? input.origin : input.current,
    latestTxHash: input.latestTxHash ?? input.origin.txHash,
    settlementTxHash: input.settlementTxHash ?? null,
    state: input.decoded.state,
    buyerLockHash: input.decoded.buyerLockHash,
    sellerLockHash: input.decoded.sellerLockHash,
    arbitratorLockHash: input.decoded.arbitratorLockHash,
    amountShannons: input.decoded.amountShannons.toString(),
    deadlineMs: input.decoded.deadlineMs.toString(),
    description: input.decoded.descriptionText,
    dataHex: input.decoded.dataHex,
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? now,
    closedAt: input.closedAt ?? (ACTIVE_STATES.has(input.decoded.state) ? null : now),
    events: input.events ?? [],
  };
}
