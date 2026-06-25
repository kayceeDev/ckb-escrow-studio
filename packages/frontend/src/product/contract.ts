import type { EscrowAction, EscrowCellView, EscrowState } from "@ckb-escrow/sdk";
import type { IndexedEscrowRecord } from "@ckb-escrow/indexer";

import type { EscrowListItem } from "../types";

export type ProductViewerRole = "buyer" | "seller" | "arbitrator" | "viewer";
export type ProductActionMode = "direct" | "studio";
export type ProductEscrowHistoryBucket = "active" | "past";

export interface ProductActionView {
  action: EscrowAction;
  label: string;
  description: string;
  enabled: boolean;
  mode: ProductActionMode;
}

export interface ProductGuidance {
  summary: string;
  nextStep: string;
  detail: string;
  supportLabel?: string;
}

export interface ProductEscrowRecord {
  id: string;
  title: string;
  description: string;
  state: EscrowState;
  amountLabel: string;
  deadlineLabel: string;
  buyerLabel: string;
  sellerLabel: string;
  arbitratorLabel: string;
  buyerLockHash: string;
  sellerLockHash: string;
  arbitratorLockHash: string;
  viewerRole: ProductViewerRole;
  actions: ProductActionView[];
  guidance: ProductGuidance;
  timeline: Array<{
    label: string;
    note: string;
    status: "done" | "current" | "pending";
  }>;
  source: "seed" | "live" | "indexed";
  stableId?: string;
  currentId?: string | null;
}

export function makeLiveEscrowId(txHash: string, index: string): string {
  return `${txHash}:${index}`;
}

export function getViewerRole(
  escrow: { buyerLockHash: string; sellerLockHash: string; arbitratorLockHash: string },
  connectedLockHash?: string | null,
): ProductViewerRole {
  if (!connectedLockHash) {
    return "viewer";
  }

  const normalized = connectedLockHash.toLowerCase();
  if (normalized === escrow.buyerLockHash.toLowerCase()) {
    return "buyer";
  }
  if (normalized === escrow.sellerLockHash.toLowerCase()) {
    return "seller";
  }
  if (normalized === escrow.arbitratorLockHash.toLowerCase()) {
    return "arbitrator";
  }
  return "viewer";
}

function shortenHash(value: string): string {
  if (value.length <= 14) {
    return value;
  }
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatAmount(amountShannons: bigint): string {
  const whole = Number(amountShannons) / 100_000_000;
  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: whole >= 100 ? 0 : 2,
  }).format(whole)} CKB`;
}

function formatDeadline(deadlineMs: bigint): string {
  const date = new Date(Number(deadlineMs));
  if (Number.isNaN(date.getTime())) {
    return deadlineMs.toString();
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function timelineForState(state: EscrowState): ProductEscrowRecord["timeline"] {
  const steps = [
    { label: "Funded", note: "Buyer locked funds into escrow." },
    { label: "Delivered", note: "Seller can mark the escrow as delivered." },
    { label: "Disputed", note: "Disputes stay open until the arbitrator resolves them." },
    { label: "Closed", note: "Escrow closes through release, refund, cancellation, or resolution." },
  ];

  const currentByState: Record<EscrowState, number> = {
    Funded: 0,
    Delivered: 1,
    Disputed: 2,
    Completed: 3,
    Refunded: 3,
    Cancelled: 3,
    Resolved: 3,
  };

  return steps.map((step, index) => ({
    ...step,
    status:
      index < currentByState[state]
        ? "done"
        : index === currentByState[state]
          ? "current"
          : "pending",
  }));
}

const ACTIVE_ESCROW_STATES = new Set<EscrowState>(["Funded", "Delivered", "Disputed"]);
const PAST_ESCROW_STATES = new Set<EscrowState>(["Completed", "Cancelled", "Refunded", "Resolved"]);

export function getEscrowHistoryBucket(state: EscrowState): ProductEscrowHistoryBucket {
  return ACTIVE_ESCROW_STATES.has(state) ? "active" : "past";
}

export function isParticipantEscrow(record: Pick<ProductEscrowRecord, "viewerRole">): boolean {
  return record.viewerRole !== "viewer";
}

export function filterParticipantEscrows(records: ProductEscrowRecord[]): ProductEscrowRecord[] {
  return records.filter(isParticipantEscrow);
}

export function filterEscrowsByHistoryBucket(
  records: ProductEscrowRecord[],
  bucket: ProductEscrowHistoryBucket,
): ProductEscrowRecord[] {
  return records.filter((record) => getEscrowHistoryBucket(record.state) === bucket);
}


function mergeKey(record: ProductEscrowRecord): string {
  return record.stableId ?? record.currentId ?? record.id;
}

function liveRecordMatchesIndexed(live: ProductEscrowRecord, indexed: ProductEscrowRecord): boolean {
  if (indexed.currentId && live.currentId && indexed.currentId === live.currentId) {
    return true;
  }

  return Boolean(live.stableId && indexed.stableId && live.stableId === indexed.stableId);
}

export function mergeProductEscrowRecords(
  indexedRecords: ProductEscrowRecord[],
  liveRecords: ProductEscrowRecord[],
): ProductEscrowRecord[] {
  const merged = new Map<string, ProductEscrowRecord>();

  for (const record of indexedRecords) {
    merged.set(mergeKey(record), record);
  }

  for (const live of liveRecords) {
    const matchingIndexed = Array.from(merged.entries()).find(([, indexed]) => liveRecordMatchesIndexed(live, indexed));
    if (matchingIndexed) {
      const stableId = matchingIndexed[1].stableId ?? live.stableId;
      merged.delete(matchingIndexed[0]);
      merged.set(matchingIndexed[0], stableId ? { ...live, stableId } : live);
    } else {
      merged.set(mergeKey(live), live);
    }
  }

  return Array.from(merged.values());
}

function liveRouteTxHash(value: string): string {
  return value.split(":")[0] ?? value;
}

export function productEscrowRouteId(escrow: ProductEscrowRecord): string {
  if (escrow.source === "live") {
    return liveRouteTxHash(escrow.currentId ?? escrow.id);
  }

  return escrow.stableId ?? escrow.id;
}

export function indexedEscrowReceiptRouteId(escrow: ProductEscrowRecord): string | null {
  if (escrow.source !== "indexed") {
    return null;
  }

  return escrow.stableId ?? escrow.id;
}

export function primaryActionLabel(record: Pick<ProductEscrowRecord, "actions" | "state">): string {
  const enabledAction = record.actions.find((action) => action.enabled);
  if (enabledAction) {
    return enabledAction.label;
  }

  return PAST_ESCROW_STATES.has(record.state) ? "View receipt" : "Open details";
}

export function getActionViews(
  escrow: Pick<EscrowCellView, "state" | "deadlineMs">,
  viewerRole: ProductViewerRole,
  nowMs = Date.now(),
  chainTipTimestampMs?: number | bigint | null,
): ProductActionView[] {
  const effectiveNowMs = chainTipTimestampMs == null ? BigInt(nowMs) : BigInt(chainTipTimestampMs);
  const deadlineReached = effectiveNowMs >= escrow.deadlineMs;

  switch (escrow.state) {
    case "Funded":
      if (viewerRole === "buyer") {
        return [
          {
            action: "Cancel",
            label: "Cancel escrow",
            description: deadlineReached
              ? "Cancel is replaced by refund once the escrow deadline has passed."
              : "Buyer can close a funded escrow before the seller advances it.",
            enabled: !deadlineReached,
            mode: "direct",
          },
          {
            action: "Refund",
            label: deadlineReached ? "Claim refund now" : "Refund after deadline",
            description: deadlineReached
              ? "The deadline has passed, so refund is ready now with the required proof prepared automatically."
              : "Refund becomes available once the escrow deadline has passed.",
            enabled: deadlineReached,
            mode: "direct",
          },
        ];
      }
      if (viewerRole === "seller") {
        return [
          {
            action: "Deliver",
            label: "Mark delivered",
            description: "Seller advances the escrow from Funded to Delivered.",
            enabled: true,
            mode: "direct",
          },
        ];
      }
      return [];
    case "Delivered":
      if (viewerRole === "buyer") {
        return [
          {
            action: "Complete",
            label: "Release funds",
            description: "Buyer releases escrow funds to the seller and closes the escrow.",
            enabled: true,
            mode: "direct",
          },
          {
            action: "Dispute",
            label: "Open dispute",
            description: "Buyer escalates the escrow into the Disputed state.",
            enabled: true,
            mode: "direct",
          },
        ];
      }
      if (viewerRole === "seller") {
        return [
          {
            action: "Dispute",
            label: "Open dispute",
            description: "Seller can dispute instead of waiting indefinitely for release.",
            enabled: true,
            mode: "direct",
          },
        ];
      }
      return [];
    case "Disputed":
      if (viewerRole === "arbitrator") {
        return [
          {
            action: "ResolveToBuyer",
            label: "Resolve to buyer",
            description: "Arbitrator closes the dispute and routes escrow funds back to the buyer.",
            enabled: true,
            mode: "direct",
          },
          {
            action: "ResolveToSeller",
            label: "Resolve to seller",
            description: "Arbitrator closes the dispute and routes escrow funds to the seller.",
            enabled: true,
            mode: "direct",
          },
        ];
      }
      return [];
    default:
      return [];
  }
}

export function guidanceForEscrow(
  escrow: Pick<EscrowCellView, "state" | "deadlineMs">,
  viewerRole: ProductViewerRole,
  nowMs = Date.now(),
  chainTipTimestampMs?: number | bigint | null,
): ProductGuidance {
  const effectiveNowMs = chainTipTimestampMs == null ? BigInt(nowMs) : BigInt(chainTipTimestampMs);
  const deadlineReached = effectiveNowMs >= escrow.deadlineMs;

  switch (escrow.state) {
    case "Funded":
      if (viewerRole === "buyer") {
        return {
          summary: deadlineReached ? "Refund is available now." : "Waiting for the seller to deliver.",
          nextStep: deadlineReached
            ? "Claim your refund now that the deadline has passed. The product will prepare the required timestamp proof automatically."
            : "Wait for the seller to mark the escrow as delivered, or cancel before work advances.",
          detail:
            "Buyer funds are already held in escrow. The seller must mark delivery before release or dispute actions appear.",
        };
      }
      if (viewerRole === "seller") {
        return {
          summary: "Ready for seller delivery.",
          nextStep: "Mark the escrow as delivered once the goods or services are complete.",
          detail:
            "The buyer already funded this escrow. Advancing it to Delivered unlocks buyer release or either-party dispute handling.",
        };
      }
      if (viewerRole === "arbitrator") {
        return {
          summary: "No reviewer action yet.",
          nextStep: "Wait unless the escrow moves into a dispute.",
          detail:
            "Reviewers only step in once a delivered escrow becomes disputed.",
        };
      }
      return {
        summary: "View-only funded escrow.",
        nextStep: "Connect the buyer, seller, or arbitrator wallet to unlock role-based actions.",
        detail:
          "This wallet is not part of the deal, so the page stays read-only.",
      };
    case "Delivered":
      if (viewerRole === "buyer") {
        return {
          summary: "Buyer decision required.",
          nextStep: "Release funds if delivery is acceptable, or open a dispute if something is wrong.",
          detail:
            "Delivered escrows stay open until the buyer explicitly releases funds to the seller or escalates to a dispute.",
          supportLabel: "Release needs the seller wallet address saved on this device.",
        };
      }
      if (viewerRole === "seller") {
        return {
          summary: "Waiting for buyer release or dispute.",
          nextStep: "Monitor this escrow and open a dispute if the buyer stops responding.",
          detail:
            "Delivered means the buyer now decides whether to release funds or escalate to the arbitrator path.",
        };
      }
      if (viewerRole === "arbitrator") {
        return {
          summary: "Stand by for dispute review.",
          nextStep: "No action is needed unless the buyer or seller opens a dispute.",
          detail:
            "Reviewers only act after the escrow enters the Disputed state.",
        };
      }
      return {
        summary: "View-only delivered escrow.",
        nextStep: "Connect a participant wallet to continue from this state.",
        detail:
          "Only the buyer, seller, or reviewer wallet can act on this escrow.",
      };
    case "Disputed":
      if (viewerRole === "arbitrator") {
        return {
          summary: "Arbitrator decision required.",
          nextStep: "Resolve the dispute to the buyer or seller once the recipient wallet address is available.",
          detail:
            "Disputed escrows can only be settled by the reviewer. Closing the dispute still needs the recipient wallet address.",
          supportLabel: "Resolution stays limited until the recipient wallet address is saved.",
        };
      }
      if (viewerRole === "buyer" || viewerRole === "seller") {
        return {
          summary: "Dispute is open.",
          nextStep: "Wait for the arbitrator to review and resolve the escrow.",
          detail:
            "The reviewer now decides the final outcome.",
        };
      }
      return {
        summary: "View-only disputed escrow.",
        nextStep: "Connect the arbitrator or another participant wallet for more context.",
        detail:
          "This dispute can only move forward with the matching arbitrator wallet and recipient settlement details.",
        supportLabel: "Dispute resolution is limited to the assigned reviewer.",
      };
    case "Completed":
      return {
        summary: "Escrow completed.",
        nextStep: "Funds were released and the escrow is now closed.",
        detail: "Completed escrows have already paid the seller and no further product actions are needed.",
      };
    case "Refunded":
      return {
        summary: "Escrow refunded.",
        nextStep: "The buyer recovery flow has already closed this escrow.",
        detail: "Refunded escrows have already returned funds to the buyer and are now closed.",
      };
    case "Cancelled":
      return {
        summary: "Escrow cancelled.",
        nextStep: "The buyer cancelled before fulfillment, so the escrow is closed.",
        detail: "Cancelled escrows no longer require participant action.",
      };
    case "Resolved":
      return {
        summary: "Escrow resolved.",
        nextStep: "The arbitrator has already determined the payout path for this escrow.",
        detail: "Resolved escrows are closed from the product perspective.",
      };
    default:
      return {
        summary: "Escrow state available.",
        nextStep: "Refresh the escrow if you expect a newer on-chain state.",
        detail: "This record was decoded successfully, but the product does not yet have custom wording for the current state.",
      };
  }
}


export function terminalStateForAction(action: EscrowAction): EscrowState | null {
  switch (action) {
    case "Cancel":
      return "Cancelled";
    case "Refund":
      return "Refunded";
    case "Complete":
      return "Completed";
    case "ResolveToBuyer":
    case "ResolveToSeller":
      return "Resolved";
    default:
      return null;
  }
}

export function closeEscrowRecordForAction(
  record: ProductEscrowRecord,
  action: EscrowAction,
): ProductEscrowRecord | null {
  const terminalState = terminalStateForAction(action);
  if (!terminalState) {
    return null;
  }

  return {
    ...record,
    state: terminalState,
    actions: [],
    guidance: guidanceForEscrow({ state: terminalState, deadlineMs: 0n }, record.viewerRole),
    timeline: timelineForState(terminalState),
    source: "indexed",
    stableId: record.stableId ?? record.id,
    currentId: null,
  };
}

export function toSeedProductEscrow(
  escrow: {
    id: string;
    title: string;
    description: string;
    state: EscrowState;
    amountLabel: string;
    deadlineLabel: string;
    buyerLabel: string;
    sellerLabel: string;
    arbitratorLabel: string;
    buyerLockHash: string;
    sellerLockHash: string;
    arbitratorLockHash: string;
  },
  connectedLockHash?: string | null,
): ProductEscrowRecord {
  const viewerRole = getViewerRole(escrow, connectedLockHash);

  return {
    ...escrow,
    viewerRole,
    actions: getActionViews(
      { state: escrow.state, deadlineMs: BigInt(Date.now() + 60_000) },
      viewerRole,
    ),
    guidance: guidanceForEscrow(
      { state: escrow.state, deadlineMs: BigInt(Date.now() + 60_000) },
      viewerRole,
    ),
    timeline: timelineForState(escrow.state),
    source: "seed",
    stableId: escrow.id,
    currentId: escrow.id,
  };
}


export function getIndexedCurrentOutPointForRoute(
  indexedEscrows: IndexedEscrowRecord[],
  routeEscrowId: string,
): IndexedEscrowRecord["current"] | null {
  const indexedMatch = indexedEscrows.find((escrow) => {
    if (escrow.id === routeEscrowId) {
      return true;
    }

    return escrow.current ? makeLiveEscrowId(escrow.current.txHash, escrow.current.index) === routeEscrowId : false;
  });

  return indexedMatch?.current ?? null;
}

export function findLiveEscrowForRoute(
  liveEscrows: EscrowListItem[],
  routeEscrowId: string,
  indexedEscrows: IndexedEscrowRecord[] = [],
): EscrowListItem | null {
  const exactMatch = liveEscrows.find((escrow) => makeLiveEscrowId(escrow.txHash, escrow.index) === routeEscrowId);
  if (exactMatch) {
    return exactMatch;
  }

  const indexedMatch = indexedEscrows.find((escrow) => escrow.id === routeEscrowId);
  if (indexedMatch?.current) {
    const currentMatch = liveEscrows.find(
      (escrow) => escrow.txHash === indexedMatch.current?.txHash && escrow.index === indexedMatch.current.index,
    );
    if (currentMatch) {
      return currentMatch;
    }
  }

  const [routeTxHash] = routeEscrowId.split(":");
  const txHashMatches = liveEscrows.filter((escrow) => escrow.txHash === routeTxHash);
  return txHashMatches.length === 1 ? txHashMatches[0] ?? null : null;
}

export function toLiveProductEscrow(
  escrow: EscrowListItem,
  connectedLockHash?: string | null,
  chainTipTimestampMs?: number | bigint | null,
): ProductEscrowRecord {
  const viewerRole = getViewerRole(escrow.decoded, connectedLockHash);
  const txLabel = shortenHash(escrow.txHash);
  const description = escrow.decoded.descriptionText || `Escrow ${txLabel}`;

  return {
    id: makeLiveEscrowId(escrow.txHash, escrow.index),
    title: description,
    description,
    state: escrow.decoded.state,
    amountLabel: formatAmount(escrow.decoded.amountShannons),
    deadlineLabel: formatDeadline(escrow.decoded.deadlineMs),
    buyerLabel: `Buyer ${shortenHash(escrow.decoded.buyerLockHash)}`,
    sellerLabel: `Seller ${shortenHash(escrow.decoded.sellerLockHash)}`,
    arbitratorLabel: `Arbitrator ${shortenHash(escrow.decoded.arbitratorLockHash)}`,
    buyerLockHash: escrow.decoded.buyerLockHash,
    sellerLockHash: escrow.decoded.sellerLockHash,
    arbitratorLockHash: escrow.decoded.arbitratorLockHash,
    viewerRole,
    actions: getActionViews(escrow.decoded, viewerRole, Date.now(), chainTipTimestampMs),
    guidance: guidanceForEscrow(escrow.decoded, viewerRole, Date.now(), chainTipTimestampMs),
    timeline: timelineForState(escrow.decoded.state),
    source: "live",
    currentId: makeLiveEscrowId(escrow.txHash, escrow.index),
  };
}

export function toIndexedProductEscrow(
  escrow: IndexedEscrowRecord,
  connectedLockHash?: string | null,
  chainTipTimestampMs?: number | bigint | null,
): ProductEscrowRecord {
  const decoded: EscrowCellView = {
    buyerLockHash: escrow.buyerLockHash,
    sellerLockHash: escrow.sellerLockHash,
    arbitratorLockHash: escrow.arbitratorLockHash,
    amountShannons: BigInt(escrow.amountShannons),
    deadlineMs: BigInt(escrow.deadlineMs),
    state: escrow.state,
    description: new TextEncoder().encode(escrow.description),
    descriptionText: escrow.description,
    dataHex: escrow.dataHex,
  };
  const viewerRole = getViewerRole(decoded, connectedLockHash);
  const description = escrow.description || `Escrow ${shortenHash(escrow.id)}`;

  return {
    id: escrow.id,
    title: description,
    description,
    state: escrow.state,
    amountLabel: formatAmount(decoded.amountShannons),
    deadlineLabel: formatDeadline(decoded.deadlineMs),
    buyerLabel: `Buyer ${shortenHash(escrow.buyerLockHash)}`,
    sellerLabel: `Seller ${shortenHash(escrow.sellerLockHash)}`,
    arbitratorLabel: `Arbitrator ${shortenHash(escrow.arbitratorLockHash)}`,
    buyerLockHash: escrow.buyerLockHash,
    sellerLockHash: escrow.sellerLockHash,
    arbitratorLockHash: escrow.arbitratorLockHash,
    viewerRole,
    actions: getActionViews(decoded, viewerRole, Date.now(), chainTipTimestampMs),
    guidance: guidanceForEscrow(decoded, viewerRole, Date.now(), chainTipTimestampMs),
    timeline: timelineForState(escrow.state),
    source: "indexed",
    stableId: escrow.id,
    currentId: escrow.current ? makeLiveEscrowId(escrow.current.txHash, escrow.current.index) : null,
  };
}
