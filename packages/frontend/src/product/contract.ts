import type { EscrowAction, EscrowCellView, EscrowState } from "@ckb-escrow/sdk";

import type { EscrowListItem } from "../types";

export type ProductViewerRole = "buyer" | "seller" | "arbitrator" | "viewer";
export type ProductActionMode = "direct" | "studio";

export interface ProductActionView {
  action: EscrowAction;
  label: string;
  description: string;
  enabled: boolean;
  mode: ProductActionMode;
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
  timeline: Array<{
    label: string;
    note: string;
    status: "done" | "current" | "pending";
  }>;
  source: "seed" | "live";
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

export function getActionViews(
  escrow: Pick<EscrowCellView, "state" | "deadlineMs">,
  viewerRole: ProductViewerRole,
  nowMs = Date.now(),
): ProductActionView[] {
  const deadlineReached = BigInt(nowMs) >= escrow.deadlineMs;

  switch (escrow.state) {
    case "Funded":
      if (viewerRole === "buyer") {
        return [
          {
            action: "Cancel",
            label: "Cancel escrow",
            description: "Buyer can close a funded escrow before the seller advances it.",
            enabled: true,
            mode: "direct",
          },
          {
            action: "Refund",
            label: "Refund after deadline",
            description: deadlineReached
              ? "Refund is unlocked, but it still needs a reference header timestamp in the transaction."
              : "Refund only becomes valid once the escrow deadline has passed.",
            enabled: deadlineReached,
            mode: "studio",
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
            description:
              "Completing payout needs the seller's full recipient lock script, not just the on-chain lock hash.",
            enabled: true,
            mode: "studio",
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
            description:
              "Resolution needs the recipient's full lock script so the payout can be built correctly.",
            enabled: true,
            mode: "studio",
          },
          {
            action: "ResolveToSeller",
            label: "Resolve to seller",
            description:
              "Resolution needs the recipient's full lock script so the payout can be built correctly.",
            enabled: true,
            mode: "studio",
          },
        ];
      }
      return [];
    default:
      return [];
  }
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
    timeline: timelineForState(escrow.state),
    source: "seed",
  };
}

export function toLiveProductEscrow(
  escrow: EscrowListItem,
  connectedLockHash?: string | null,
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
    actions: getActionViews(escrow.decoded, viewerRole),
    timeline: timelineForState(escrow.decoded.state),
    source: "live",
  };
}
