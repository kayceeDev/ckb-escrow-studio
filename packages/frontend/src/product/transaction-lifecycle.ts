import type { TransactionStatus } from "@ckb-ccc/ccc";
import type { EscrowAction, EscrowState } from "@ckb-escrow/sdk";
import type { IndexedEscrowRecord } from "@ckb-escrow/indexer";

export type TransactionLifecycleStage =
  | "signing"
  | "submitted"
  | "committed"
  | "indexing"
  | "confirmed"
  | "failed";

export interface TransactionLifecycle {
  action: EscrowAction;
  stage: TransactionLifecycleStage;
  txHash: string | null;
  confirmedState: EscrowState | null;
  error: string | null;
}

export type TransactionLifecycleEvent =
  | { type: "start"; action: EscrowAction }
  | { type: "submitted"; txHash: string }
  | { type: "ckb-status"; status: TransactionStatus; reason?: string }
  | { type: "indexing" }
  | { type: "confirmed"; state: EscrowState }
  | { type: "failed"; error: string };

const STAGE_RANK: Record<Exclude<TransactionLifecycleStage, "failed">, number> = {
  signing: 0,
  submitted: 1,
  committed: 2,
  indexing: 3,
  confirmed: 4,
};

export function expectedStateForTransactionAction(action: EscrowAction): EscrowState {
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
    case "ResolveToSeller":
      return "Resolved";
  }
}

function advance(
  current: TransactionLifecycle,
  stage: Exclude<TransactionLifecycleStage, "failed">,
): TransactionLifecycle {
  if (current.stage === "failed" || current.stage === "confirmed") return current;
  if (STAGE_RANK[stage] <= STAGE_RANK[current.stage]) return current;
  return { ...current, stage };
}

export function reduceTransactionLifecycle(
  current: TransactionLifecycle | null,
  event: TransactionLifecycleEvent,
): TransactionLifecycle | null {
  if (event.type === "start") {
    return {
      action: event.action,
      stage: "signing",
      txHash: null,
      confirmedState: null,
      error: null,
    };
  }
  if (!current) return null;
  if (current.stage === "confirmed" || current.stage === "failed") return current;

  switch (event.type) {
    case "submitted":
      return { ...advance(current, "submitted"), txHash: event.txHash };
    case "ckb-status":
      if (event.status === "rejected") {
        return {
          ...current,
          stage: "failed",
          error: event.reason ?? "CKB rejected this transaction.",
        };
      }
      return event.status === "committed" ? advance(current, "committed") : current;
    case "indexing":
      return advance(current, "indexing");
    case "confirmed":
      return {
        ...advance(current, "confirmed"),
        stage: "confirmed",
        confirmedState: event.state,
      };
    case "failed":
      return { ...current, stage: "failed", error: event.error };
  }
}

export function isIndexedLifecycleConfirmation(
  lifecycle: TransactionLifecycle | null,
  expectedState: EscrowState,
  indexedEscrow: Pick<IndexedEscrowRecord, "state" | "latestTxHash" | "events"> | null,
): boolean {
  if (
    !lifecycle?.txHash
    || lifecycle.stage === "confirmed"
    || lifecycle.stage === "failed"
    || !indexedEscrow
    || indexedEscrow.state !== expectedState
  ) return false;
  return indexedEscrow.latestTxHash === lifecycle.txHash
    || indexedEscrow.events.some((event) => event.txHash === lifecycle.txHash);
}

export function transactionLifecycleCopy(lifecycle: TransactionLifecycle): {
  title: string;
  detail: string;
  tone: "secondary" | "success" | "destructive";
} {
  switch (lifecycle.stage) {
    case "signing":
      return {
        title: `${lifecycle.action} awaiting signature`,
        detail: "Approve the transaction in your wallet. The confirmed escrow state remains unchanged until submission succeeds.",
        tone: "secondary",
      };
    case "submitted":
      return {
        title: `${lifecycle.action} submitted`,
        detail: "The transaction was sent to CKB and is waiting to be committed.",
        tone: "secondary",
      };
    case "committed":
      return {
        title: "Committed on CKB",
        detail: "The transaction is on-chain. The escrow indexer is verifying the replacement state.",
        tone: "secondary",
      };
    case "indexing":
      return {
        title: "Verifying escrow state",
        detail: "CKB committed the transaction. Waiting for the indexer to publish the canonical escrow state.",
        tone: "secondary",
      };
    case "confirmed":
      return {
        title: `${lifecycle.confirmedState ?? "Escrow"} confirmed`,
        detail: "The transaction and indexed escrow state now agree.",
        tone: "success",
      };
    case "failed":
      return {
        title: "Transaction failed",
        detail: lifecycle.error ?? "The transaction could not be completed. The last confirmed escrow state is still shown.",
        tone: "destructive",
      };
  }
}
