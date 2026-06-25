import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CompactEscrowCards, EscrowLedgerTable } from "./EscrowCollectionSections";
import type { ProductEscrowRecord } from "./contract";

function record(input: Partial<ProductEscrowRecord> = {}): ProductEscrowRecord {
  return {
    id: "0xactive:0",
    title: "Website milestone",
    description: "Landing page delivery",
    state: "Delivered",
    amountLabel: "350 CKB",
    deadlineLabel: "May 16, 2026",
    buyerLabel: "Buyer wallet",
    sellerLabel: "Seller wallet",
    arbitratorLabel: "Reviewer wallet",
    buyerLockHash: "0x11",
    sellerLockHash: "0x22",
    arbitratorLockHash: "0x33",
    viewerRole: "buyer",
    actions: [
      {
        action: "Complete",
        label: "Release funds",
        description: "Release funds",
        enabled: true,
        mode: "direct",
      },
    ],
    guidance: {
      summary: "Buyer decision required.",
      nextStep: "Release funds or open a dispute.",
      detail: "",
    },
    timeline: [],
    source: "live",
    currentId: "0xactive:0",
    ...input,
  };
}

describe("escrow collection presentation", () => {
  it("renders active escrows in the reusable ledger table", () => {
    const html = renderToStaticMarkup(
      <EscrowLedgerTable records={[record()]} emptyMessage="No active escrows" />,
    );

    expect(html).toContain("Website milestone");
    expect(html).toContain("Release funds");
    expect(html).toContain("Counterparty");
    expect(html).toContain("/escrows/0xactive");
  });

  it("renders terminal escrows as read-only ledger rows", () => {
    const html = renderToStaticMarkup(
      <EscrowLedgerTable
        records={[
          record({
            id: "0xorigin:0",
            stableId: "0xorigin:0",
            currentId: null,
            source: "indexed",
            state: "Completed",
            actions: [],
          }),
        ]}
        emptyMessage="No past escrows"
      />,
    );

    expect(html).toContain("Completed");
    expect(html).toContain("View receipt");
    expect(html).toContain("/escrows/0xorigin%3A0");
  });

  it("renders compact homepage action cards without protocol copy", () => {
    const html = renderToStaticMarkup(
      <CompactEscrowCards records={[record()]} emptyMessage="Nothing urgent" />,
    );

    expect(html).toContain("Open deal");
    expect(html).not.toContain("lock hash");
    expect(html).not.toContain("script");
  });
});
