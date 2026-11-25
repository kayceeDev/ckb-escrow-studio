import { describe, expect, it } from "vitest";

import { collectEscrowTransactionEvidence } from "./transaction-evidence";

describe("escrow transaction evidence", () => {
  it("keeps indexed transaction hashes available after a page refresh", () => {
    const createdTxHash = `0x${"11".repeat(32)}` as const;
    const deliveredTxHash = `0x${"22".repeat(32)}` as const;

    expect(collectEscrowTransactionEvidence({
      indexedEscrow: {
        latestTxHash: deliveredTxHash,
        events: [
          { type: "Created", txHash: createdTxHash },
          { type: "Delivered", txHash: deliveredTxHash },
        ],
      },
    })).toEqual([
      { label: "Delivered", txHash: deliveredTxHash },
      { label: "Created", txHash: createdTxHash },
    ]);
  });

  it("deduplicates the submitted, live, latest, and event transaction hashes", () => {
    const txHash = `0x${"33".repeat(32)}` as const;

    expect(collectEscrowTransactionEvidence({
      submittedTxHash: txHash,
      liveEscrow: { txHash },
      indexedEscrow: {
        latestTxHash: txHash,
        events: [{ type: "Delivered", txHash }],
      },
    })).toEqual([{ label: "Submitted transaction", txHash }]);
  });
});
