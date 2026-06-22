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

import { createHash } from "node:crypto";

import type {
  AddDisputeEvidenceInput,
  ArbitratorDecision,
  CreateDisputeCaseInput,
  DisputeCaseRecord,
  DisputeEvidenceItem,
  SaveArbitratorDecisionInput,
} from "./types.js";

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function hashDisputeContent(value: unknown): `0x${string}` {
  return `0x${createHash("sha256").update(stableJson(value)).digest("hex")}`;
}

export function makeDisputeCaseId(network: string, escrowId: string): string {
  return `${network}:${escrowId}`;
}

export function computeEvidenceBundleHash(
  evidence: DisputeEvidenceItem[],
  decision?: Pick<ArbitratorDecision, "outcome" | "decisionNote" | "resolutionTxHash" | "decidedByLockHash"> | null,
): `0x${string}` {
  return hashDisputeContent({
    evidence: evidence
      .map((item) => ({
        contentHash: item.contentHash.toLowerCase(),
        label: item.label,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        submittedByLockHash: item.submittedByLockHash.toLowerCase(),
        type: item.type,
        uri: item.uri,
        value: item.value,
      }))
      .sort((left, right) => `${left.submittedByLockHash}:${left.type}:${left.contentHash}`.localeCompare(`${right.submittedByLockHash}:${right.type}:${right.contentHash}`)),
    decision: decision
      ? {
          outcome: decision.outcome,
          decisionNote: decision.decisionNote,
          resolutionTxHash: decision.resolutionTxHash.toLowerCase(),
          decidedByLockHash: decision.decidedByLockHash.toLowerCase(),
        }
      : null,
  });
}

function makeEvidenceId(input: {
  network: string;
  escrowId: string;
  contentHash: string;
  submittedByLockHash: string;
  createdAt: string;
  index: number;
}): string {
  return hashDisputeContent(input);
}

export function createDisputeCaseRecord(input: CreateDisputeCaseInput): DisputeCaseRecord {
  const now = input.createdAt ?? new Date().toISOString();
  const caseId = makeDisputeCaseId(input.network, input.escrowId);
  const evidence: DisputeEvidenceItem[] = (input.evidence ?? []).map((item, index) => {
    const createdAt = item.createdAt ?? now;
    return {
      ...item,
      id: makeEvidenceId({
        network: input.network,
        escrowId: input.escrowId,
        contentHash: item.contentHash,
        submittedByLockHash: item.submittedByLockHash,
        createdAt,
        index,
      }),
      caseId,
      escrowId: input.escrowId,
      network: input.network,
      submittedByLockHash: item.submittedByLockHash.toLowerCase() as `0x${string}`,
      createdAt,
    };
  });

  return {
    id: caseId,
    escrowId: input.escrowId,
    network: input.network,
    disputeTxHash: input.disputeTxHash,
    openedByLockHash: input.openedByLockHash.toLowerCase() as `0x${string}`,
    requestedOutcome: input.requestedOutcome,
    reason: input.reason,
    status: "open",
    evidenceBundleHash: computeEvidenceBundleHash(evidence),
    createdAt: now,
    updatedAt: now,
    evidence,
    decision: null,
  };
}

export function appendDisputeEvidence(caseRecord: DisputeCaseRecord, input: AddDisputeEvidenceInput): DisputeCaseRecord {
  const now = new Date().toISOString();
  const nextEvidence = [
    ...caseRecord.evidence,
    ...input.evidence.map((item, index) => {
      const createdAt = item.createdAt ?? now;
      return {
        ...item,
        id: makeEvidenceId({
          network: input.network,
          escrowId: input.escrowId,
          contentHash: item.contentHash,
          submittedByLockHash: input.submittedByLockHash,
          createdAt,
          index: caseRecord.evidence.length + index,
        }),
        caseId: caseRecord.id,
        escrowId: input.escrowId,
        network: input.network,
        submittedByLockHash: input.submittedByLockHash.toLowerCase() as `0x${string}`,
        createdAt,
      } satisfies DisputeEvidenceItem;
    }),
  ];

  return {
    ...caseRecord,
    evidence: nextEvidence,
    evidenceBundleHash: computeEvidenceBundleHash(nextEvidence, caseRecord.decision),
    updatedAt: now,
  };
}

export function applyArbitratorDecision(caseRecord: DisputeCaseRecord, input: SaveArbitratorDecisionInput): DisputeCaseRecord {
  const now = input.createdAt ?? new Date().toISOString();
  const decisionBase = {
    outcome: input.outcome,
    decisionNote: input.decisionNote,
    resolutionTxHash: input.resolutionTxHash,
    decidedByLockHash: input.decidedByLockHash.toLowerCase() as `0x${string}`,
  };
  const evidenceBundleHash = computeEvidenceBundleHash(caseRecord.evidence, decisionBase);
  const decision: ArbitratorDecision = {
    id: hashDisputeContent({ caseId: caseRecord.id, resolutionTxHash: input.resolutionTxHash }),
    caseId: caseRecord.id,
    escrowId: input.escrowId,
    network: input.network,
    evidenceBundleHash,
    createdAt: now,
    ...decisionBase,
  };

  return {
    ...caseRecord,
    status: "resolved",
    evidenceBundleHash,
    updatedAt: now,
    decision,
  };
}
