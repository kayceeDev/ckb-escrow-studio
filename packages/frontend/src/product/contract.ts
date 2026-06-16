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
): ProductGuidance {
  const deadlineReached = BigInt(nowMs) >= escrow.deadlineMs;

  switch (escrow.state) {
    case "Funded":
      if (viewerRole === "buyer") {
        return {
          summary: deadlineReached ? "Refund is available now." : "Waiting for the seller to deliver.",
          nextStep: deadlineReached
            ? "Claim your refund now that the deadline has passed. The product will prepare the required timestamp proof automatically."
            : "Wait for the seller to mark the escrow as delivered, or cancel before work advances.",
          detail:
            "Buyer funds are already locked on chain in the escrow cell. The seller must mark delivery before release or dispute actions appear.",
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
          summary: "No arbitrator action yet.",
          nextStep: "Wait unless the escrow moves into a dispute.",
          detail:
            "Arbitrators only step in once a delivered escrow becomes disputed.",
        };
      }
      return {
        summary: "View-only funded escrow.",
        nextStep: "Connect the buyer, seller, or arbitrator wallet to unlock role-based actions.",
        detail:
          "This wallet does not match any participant lock hash stored in the escrow cell, so the page stays read-only.",
      };
    case "Delivered":
      if (viewerRole === "buyer") {
        return {
          summary: "Buyer decision required.",
          nextStep: "Release funds if delivery is acceptable, or open a dispute if something is wrong.",
          detail:
            "Delivered escrows stay open until the buyer explicitly releases funds to the seller or escalates to a dispute.",
          supportLabel: "Release needs the seller payout script saved on this device.",
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
          summary: "Stand by for dispute resolution.",
          nextStep: "No action is needed unless the buyer or seller opens a dispute.",
          detail:
            "Arbitrators only act after the escrow enters the Disputed state.",
        };
      }
      return {
        summary: "View-only delivered escrow.",
        nextStep: "Connect a participant wallet to continue from this state.",
        detail:
          "Only the buyer, seller, or arbitrator matching the on-chain lock hashes can act on this escrow.",
      };
    case "Disputed":
      if (viewerRole === "arbitrator") {
        return {
          summary: "Arbitrator decision required.",
          nextStep: "Resolve the dispute to the buyer or seller once the recipient lock script is available.",
          detail:
            "Disputed escrows can only be settled by the arbitrator. The payout path still needs the recipient's full lock script.",
          supportLabel: "Resolution stays limited until the recipient script is saved locally.",
        };
      }
      if (viewerRole === "buyer" || viewerRole === "seller") {
        return {
          summary: "Dispute is open.",
          nextStep: "Wait for the arbitrator to review and resolve the escrow.",
          detail:
            "The contract now restricts settlement authority to the arbitrator matching the escrow's stored lock hash.",
        };
      }
      return {
        summary: "View-only disputed escrow.",
        nextStep: "Connect the arbitrator or another participant wallet for more context.",
        detail:
          "This dispute can only move forward with the matching arbitrator wallet and recipient settlement details.",
        supportLabel: "Dispute resolution is participant-gated by lock hash.",
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
    guidance: guidanceForEscrow(escrow.decoded, viewerRole),
    timeline: timelineForState(escrow.decoded.state),
    source: "live",
  };
}
