import { describe, expect, it } from "vitest";

import { getEscrowDetailLoadState } from "./detail-load-state";

describe("escrow detail loading state", () => {
  it("keeps a previously loaded escrow in synchronization state during indexer lag", () => {
    expect(getEscrowDetailLoadState({
      hasRecord: false,
      hasLastKnownRecord: true,
      submittedTxHash: null,
      isFetchingEscrows: false,
      hasFetchedEscrows: true,
      isFetchingIndexedDetail: false,
      hasError: false,
    })).toBe("synchronizing");
  });

  it("shows transaction confirmation instead of not found after submission", () => {
    expect(getEscrowDetailLoadState({
      hasRecord: false,
      hasLastKnownRecord: false,
      submittedTxHash: `0x${"44".repeat(32)}`,
      isFetchingEscrows: false,
      hasFetchedEscrows: true,
      isFetchingIndexedDetail: false,
      hasError: false,
    })).toBe("confirming");
  });

  it("only reports not found after an initial lookup completes without history", () => {
    expect(getEscrowDetailLoadState({
      hasRecord: false,
      hasLastKnownRecord: false,
      submittedTxHash: null,
      isFetchingEscrows: false,
      hasFetchedEscrows: true,
      isFetchingIndexedDetail: false,
      hasError: false,
    })).toBe("not-found");
  });
});
