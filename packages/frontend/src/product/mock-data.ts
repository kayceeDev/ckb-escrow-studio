export interface ProductEscrowRecord {
  id: string;
  title: string;
  role: "buyer" | "seller" | "arbitrator";
  state: "Funded" | "Delivered" | "Disputed" | "Resolved" | "Refunded";
  amount: string;
  deadline: string;
  seller: string;
  arbitrator: string;
  description: string;
  timeline: Array<{
    label: string;
    note: string;
    status: "done" | "current" | "pending";
  }>;
}

export const productEscrows: ProductEscrowRecord[] = [
  {
    id: "escrow-website-redesign",
    title: "Website Redesign Milestone",
    role: "buyer",
    state: "Funded",
    amount: "350 CKB",
    deadline: "2026-04-30",
    seller: "Ari Design Studio",
    arbitrator: "Platform Arbitrator",
    description: "Landing page redesign and responsive polish for the first milestone.",
    timeline: [
      { label: "Created", note: "Escrow funded by buyer.", status: "done" },
      { label: "Delivered", note: "Waiting for seller to mark delivered.", status: "current" },
      { label: "Released", note: "Buyer releases payment after review.", status: "pending" },
    ],
  },
  {
    id: "escrow-ui-audit",
    title: "UI Audit + Fixes",
    role: "buyer",
    state: "Delivered",
    amount: "140 CKB",
    deadline: "2026-04-18",
    seller: "Northwind UX",
    arbitrator: "Platform Arbitrator",
    description: "Audit of tablet/mobile UI and accessibility fixes for the checkout flow.",
    timeline: [
      { label: "Created", note: "Escrow funded by buyer.", status: "done" },
      { label: "Delivered", note: "Seller marked delivered.", status: "done" },
      { label: "Review", note: "Buyer can release or dispute.", status: "current" },
    ],
  },
  {
    id: "escrow-content-migration",
    title: "CMS Content Migration",
    role: "buyer",
    state: "Disputed",
    amount: "220 CKB",
    deadline: "2026-04-10",
    seller: "Delta Migration Co.",
    arbitrator: "Platform Arbitrator",
    description: "Bulk content migration with formatting preservation and QA signoff.",
    timeline: [
      { label: "Created", note: "Escrow funded by buyer.", status: "done" },
      { label: "Delivered", note: "Seller marked delivered.", status: "done" },
      { label: "Disputed", note: "Waiting for arbitrator decision.", status: "current" },
      { label: "Resolved", note: "Arbitrator resolves payout.", status: "pending" },
    ],
  },
];

export function getEscrowById(id: string): ProductEscrowRecord | undefined {
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
