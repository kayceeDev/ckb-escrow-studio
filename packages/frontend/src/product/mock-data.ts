import type { ProductEscrowRecord } from "./contract";

export interface SeededEscrowRecord {
  id: string;
  title: string;
  state: ProductEscrowRecord["state"];
  amountLabel: string;
  deadlineLabel: string;
  buyerLabel: string;
  sellerLabel: string;
  arbitratorLabel: string;
  description: string;
  buyerLockHash: string;
  sellerLockHash: string;
  arbitratorLockHash: string;
}

const buyerLockHash = "0x1111111111111111111111111111111111111111111111111111111111111111";
const sellerLockHash = "0x2222222222222222222222222222222222222222222222222222222222222222";
const arbitratorLockHash = "0x3333333333333333333333333333333333333333333333333333333333333333";

export const productEscrows: SeededEscrowRecord[] = [
  {
    id: "escrow-website-redesign",
    title: "Website Redesign Milestone",
    state: "Funded",
    amountLabel: "350 CKB",
    deadlineLabel: "Apr 30, 2026",
    buyerLabel: "You",
    sellerLabel: "Ari Design Studio",
    arbitratorLabel: "Platform Arbitrator",
    description: "Landing page redesign and responsive polish for the first milestone.",
    buyerLockHash,
    sellerLockHash,
    arbitratorLockHash,
  },
  {
    id: "escrow-ui-audit",
    title: "UI Audit + Fixes",
    state: "Delivered",
    amountLabel: "140 CKB",
    deadlineLabel: "Apr 18, 2026",
    buyerLabel: "You",
    sellerLabel: "Northwind UX",
    arbitratorLabel: "Platform Arbitrator",
    description: "Audit of tablet/mobile UI and accessibility fixes for the checkout flow.",
    buyerLockHash,
    sellerLockHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
    arbitratorLockHash,
  },
  {
    id: "escrow-content-migration",
    title: "CMS Content Migration",
    state: "Disputed",
    amountLabel: "220 CKB",
    deadlineLabel: "Apr 10, 2026",
    buyerLabel: "You",
    sellerLabel: "Delta Migration Co.",
    arbitratorLabel: "Platform Arbitrator",
    description: "Bulk content migration with formatting preservation and QA signoff.",
    buyerLockHash,
    sellerLockHash: "0x5555555555555555555555555555555555555555555555555555555555555555",
    arbitratorLockHash,
  },
];

export function getEscrowById(id: string): SeededEscrowRecord | undefined {
  return productEscrows.find((escrow) => escrow.id === id);
}

export const buyerHighlights = [
  {
    title: "Know who holds the leverage",
    body: "Funds stay on-chain in escrow until the delivery path is satisfied, not in a private admin balance.",
  },
  {
    title: "Use a default arbitrator",
    body: "Start with a platform arbitrator for simpler disputes, then move to custom arbitrators later if your workflow needs it.",
  },
  {
    title: "See state clearly",
    body: "Funded, delivered, disputed, refunded, and resolved are presented as product states, not protocol jargon.",
  },
];
