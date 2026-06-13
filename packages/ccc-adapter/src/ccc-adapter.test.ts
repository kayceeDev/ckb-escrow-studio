import { describe, expect, it } from "vitest";
import * as ccc from "@ckb-ccc/ccc";

import {
  buildCreateEscrowTransaction,
  buildDisputeTransaction,
  buildSettlementTransaction,
  completeFeeBySigner,
  completeSettlementFeeBySigner,
} from "./index.js";

const deployment = {
  typeScript: {
    codeHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    hashType: "type" as const,
    args: "0x",
  },
  cellDep: {
    outPoint: {
      txHash: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      index: 0,
    },
    depType: "code" as const,
  },
};

const buyerLock = {
  codeHash: "0x1111111111111111111111111111111111111111111111111111111111111111",
  hashType: "type" as const,
  args: "0x01",
};
const sellerLock = {
  codeHash: "0x2222222222222222222222222222222222222222222222222222222222222222",
  hashType: "type" as const,
  args: "0x02",
};
const arbitratorLock = {
  codeHash: "0x3333333333333333333333333333333333333333333333333333333333333333",
  hashType: "type" as const,
  args: "0x03",
};
const escrowLock = {
  codeHash: "0x4444444444444444444444444444444444444444444444444444444444444444",
  hashType: "type" as const,
  args: "0x04",
};

function escrowCell(stateCode: string): ccc.CellLike {
  return escrowCellWithCapacity(stateCode, 2_000n);
}

function escrowCellWithCapacity(stateCode: string, capacity: bigint): ccc.CellLike {
  return {
    outPoint: {
      txHash: "0x9999999999999999999999999999999999999999999999999999999999999999",
      index: 0,
    },
    cellOutput: {
      capacity,
      lock: escrowLock,
      type: deployment.typeScript,
    },
    outputData:
      `0x${ccc.Script.from(buyerLock).hash().slice(2)}${ccc.Script.from(sellerLock).hash().slice(2)}${ccc.Script.from(arbitratorLock).hash().slice(2)}00000000000003e80000018bcfe56800${stateCode}00107765627369746520726564657369676e` as `0x${string}`,
  };
}

function inputCell(
  lock: ccc.ScriptLike,
  capacity: bigint,
  index: number,
): ccc.CellInputLike {
  return {
    previousOutput: {
      txHash: `0x${String(index).padStart(64, "0")}`,
      index: 0,
    },
    cellOutput: {
      capacity,
      lock,
    },
    outputData: "0x",
  };
}

function capacityForLock(tx: ccc.Transaction, lock: ccc.ScriptLike): bigint {
  const lockHash = ccc.Script.from(lock).hash().toLowerCase();
  return tx.outputs.reduce(
    (total, output) => (output.lock.hash().toLowerCase() === lockHash ? total + output.capacity : total),
    0n,
  );
}

function mockSigner(lock: ccc.ScriptLike, feeInputCapacity = 10_000_000_000n): ccc.Signer {
  const address = ccc.Address.from({
    script: lock,
    prefix: "ckt",
  });

  return {
    client: {
      async getFeeRate() {
        return 1n;
      },
      async getKnownScript() {
        return {
          codeHash: "0x82d76d1b75fe2fd9a27dfbaa65a039221a380d76c926f378d3f81cf3e7e13f2e",
          hashType: "type",
          cellDeps: [],
        };
      },
    },
    async getRecommendedAddressObj() {
      return address;
    },
    async prepareTransaction(_tx: ccc.Transaction) {
      return;
    },
    async *findCells() {
      yield ccc.Cell.from({
        outPoint: {
          txHash: "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
          index: 0,
        },
        cellOutput: {
          capacity: feeInputCapacity,
          lock,
        },
        outputData: "0x",
      });
    },
  } as unknown as ccc.Signer;
}

describe("ccc adapter", () => {
  it("builds a create transaction with deployment cell dep", () => {
    const tx = buildCreateEscrowTransaction(deployment, {
      buyerLock,
      sellerLock,
      arbitratorLock,
      escrowLock,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      description: "website redesign",
    });

    expect(tx.cellDeps).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputsData).toHaveLength(1);
  });

  it("adds occupied capacity on top of the escrow amount", () => {
    const tx = buildCreateEscrowTransaction(deployment, {
      buyerLock,
      sellerLock,
      arbitratorLock,
      escrowLock,
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      description: "website redesign",
    });

    const firstOutput = tx.outputs[0]!;
    const firstOutputData = tx.outputsData[0]!;

    expect(firstOutput.capacity).toBeGreaterThan(1_000n);
    const occupied = ccc.CellOutput.from(
      {
        capacity: 0n,
        lock: firstOutput.lock,
        ...(firstOutput.type ? { type: firstOutput.type } : {}),
      },
      firstOutputData,
    ).capacity;

    expect(firstOutput.capacity).toBe(1_000n + occupied);
  });

  it("builds a dispute transaction with a dispute witness", () => {
    const tx = buildDisputeTransaction(deployment, {
      escrowInput: escrowCell("01"),
      signerInput: {
        previousOutput: {
          txHash: "0x7777777777777777777777777777777777777777777777777777777777777777",
          index: 1,
        },
      },
      escrowLock,
    });

    expect(tx.inputs).toHaveLength(2);
    expect(tx.witnesses[0]).toBeDefined();
    expect(tx.outputsData[0]).toContain("03");
  });

  it("prefills wallet witness slots for signer inputs", () => {
    const tx = buildDisputeTransaction(deployment, {
      escrowInput: escrowCell("01"),
      signerInput: inputCell(buyerLock, 500n, 4),
      escrowLock,
    });

    expect(tx.inputs).toHaveLength(2);
    expect(tx.witnesses).toHaveLength(2);
    expect(tx.witnesses[0]).toBeDefined();
    expect(tx.witnesses[1]).toBeDefined();
  });

  it("builds a resolution settlement transaction for seller", () => {
    const tx = buildSettlementTransaction(deployment, "ResolveToSeller", {
      escrowInput: escrowCell("03"),
      recipientLock: sellerLock,
      headerDeps: [
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
    });

    expect(tx.inputs).toHaveLength(1);
    expect(tx.outputs).toHaveLength(1);
    expect(tx.headerDeps).toHaveLength(1);
  });

  it("builds signer-aware settlement transactions for complete and refund", () => {
    const completeTx = buildSettlementTransaction(deployment, "Complete", {
      escrowInput: escrowCell("01"),
      signerInput: inputCell(buyerLock, 500n, 9),
      recipientLock: sellerLock,
    });
    const refundTx = buildSettlementTransaction(deployment, "Refund", {
      escrowInput: escrowCell("00"),
      signerInput: inputCell(buyerLock, 700n, 10),
      recipientLock: buyerLock,
      referenceTimestampMs: 1_700_000_000_001n,
      headerDeps: [
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
    });

    expect(completeTx.inputs).toHaveLength(2);
    expect(completeTx.witnesses).toHaveLength(2);
    expect(refundTx.inputs).toHaveLength(2);
    expect(refundTx.witnesses).toHaveLength(2);
  });

  it("defaults settlement payout capacity to the full escrow cell capacity", () => {
    const tx = buildSettlementTransaction(deployment, "Cancel", {
      escrowInput: escrowCell("00"),
      recipientLock: buyerLock,
    });

    expect(tx.outputs).toHaveLength(1);
    expect(tx.outputs[0]?.capacity).toBe(2_000n);
  });

  it("lets signer-recipient cancel pay fees with signer inputs", async () => {
    const tx = buildSettlementTransaction(deployment, "Cancel", {
      escrowInput: escrowCell("00"),
      recipientLock: buyerLock,
    });
    tx.addInput(inputCell(buyerLock, 500n, 1));

    await completeSettlementFeeBySigner(
      tx,
      mockSigner(buyerLock),
      {
        action: "Cancel",
        escrowInput: escrowCell("00"),
        recipientLock: buyerLock,
      },
      { feeRate: 1n },
    );

    expect(capacityForLock(tx, buyerLock)).toBeGreaterThanOrEqual(2_000n);
    expect(await tx.getFee(mockSigner(buyerLock).client)).toBeGreaterThan(0n);
  });

  it("lets signer-recipient refund pay fees with signer inputs", async () => {
    const tx = buildSettlementTransaction(deployment, "Refund", {
      escrowInput: escrowCell("00"),
      recipientLock: buyerLock,
      referenceTimestampMs: 1_700_000_000_001n,
      headerDeps: [
        "0x5555555555555555555555555555555555555555555555555555555555555555",
      ],
    });
    tx.addInput(inputCell(buyerLock, 900n, 2));

    await completeSettlementFeeBySigner(
      tx,
      mockSigner(buyerLock),
      {
        action: "Refund",
        escrowInput: escrowCell("00"),
        recipientLock: buyerLock,
      },
      { feeRate: 1n },
    );

    expect(capacityForLock(tx, buyerLock)).toBeGreaterThanOrEqual(2_000n);
    expect(await tx.getFee(mockSigner(buyerLock).client)).toBeGreaterThan(0n);
  });

  it("does not over-top-up seller completion when seller has no inputs", async () => {
    const tx = buildSettlementTransaction(deployment, "Complete", {
      escrowInput: escrowCell("01"),
      recipientLock: sellerLock,
    });

    await completeSettlementFeeBySigner(
      tx,
      mockSigner(buyerLock),
      {
        action: "Complete",
        escrowInput: escrowCell("01"),
        recipientLock: sellerLock,
      },
      { feeRate: 1n },
    );

    expect(capacityForLock(tx, sellerLock)).toBeGreaterThanOrEqual(1_000n);
    expect(capacityForLock(tx, sellerLock)).toBeLessThanOrEqual(2_000n);
  });

  it("uses the correct recipient for dispute resolutions", async () => {
    const resolveToSeller = buildSettlementTransaction(deployment, "ResolveToSeller", {
      escrowInput: escrowCell("03"),
      recipientLock: sellerLock,
    });
    const resolveToBuyer = buildSettlementTransaction(deployment, "ResolveToBuyer", {
      escrowInput: escrowCell("03"),
      recipientLock: buyerLock,
    });
    resolveToBuyer.addInput(inputCell(buyerLock, 700n, 3));

    await completeSettlementFeeBySigner(
      resolveToSeller,
      mockSigner(arbitratorLock),
      {
        action: "ResolveToSeller",
        escrowInput: escrowCell("03"),
        recipientLock: sellerLock,
      },
      { feeRate: 1n },
    );
    await completeSettlementFeeBySigner(
      resolveToBuyer,
      mockSigner(arbitratorLock),
      {
        action: "ResolveToBuyer",
        escrowInput: escrowCell("03"),
        recipientLock: buyerLock,
      },
      { feeRate: 1n },
    );

    expect(capacityForLock(resolveToSeller, sellerLock)).toBeGreaterThanOrEqual(1_000n);
    expect(capacityForLock(resolveToSeller, sellerLock)).toBeLessThanOrEqual(2_000n);
    expect(capacityForLock(resolveToBuyer, buyerLock)).toBeGreaterThanOrEqual(2_000n);
  });

  it("generic fee completion still works for non-settlement transactions", async () => {
    const tx = buildDisputeTransaction(deployment, {
      escrowInput: escrowCell("01"),
      escrowLock,
    });

    await completeFeeBySigner(tx, mockSigner(buyerLock, 5_000_000_000n), { feeRate: 1n });

    expect(tx.outputs).toHaveLength(2);
    expect(tx.witnesses[0]).toBeDefined();
  });

  it("leaves settlement wallet witness slots for the signer after fee completion", async () => {
    const tx = buildSettlementTransaction(deployment, "Cancel", {
      escrowInput: escrowCell("00"),
      recipientLock: buyerLock,
    });

    expect(tx.witnesses).toHaveLength(1);

    await completeSettlementFeeBySigner(
      tx,
      mockSigner(buyerLock, 5_000_000_000n),
      {
        action: "Cancel",
        escrowInput: escrowCell("00"),
        recipientLock: buyerLock,
      },
      { feeRate: 1n },
    );

    expect(tx.witnesses).toHaveLength(1);
    expect(tx.witnesses[0]).toBeDefined();
  });
});
