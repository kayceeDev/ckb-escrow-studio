import * as ccc from "@ckb-ccc/ccc";
import { encodeEscrowActionHex, encodeEscrowDataHex } from "@ckb-escrow/sdk";
import { describe, expect, it } from "vitest";

import {
  assertDeploymentLive,
  assertEscrowInputLive,
  assertFinalizedEscrowTransaction,
  assertSignerNetwork,
} from "./preflight.js";

const lock = { codeHash: `0x${"11".repeat(32)}`, hashType: "type" as const, args: "0x" };
const type = { codeHash: `0x${"22".repeat(32)}`, hashType: "type" as const, args: "0x" };
const outPoint = { txHash: `0x${"33".repeat(32)}`, index: 0n };
const codeOutPoint = { txHash: `0x${"44".repeat(32)}`, index: 0n };
const codeData = "0x010203" as const;
const buyerLock = { codeHash: `0x${"55".repeat(32)}`, hashType: "type" as const, args: "0x01" };
const sellerLock = { codeHash: `0x${"66".repeat(32)}`, hashType: "type" as const, args: "0x02" };
const arbitratorLock = { codeHash: `0x${"77".repeat(32)}`, hashType: "type" as const, args: "0x03" };
const deployment = {
  typeScript: type,
  cellDep: { outPoint: codeOutPoint, depType: "code" as const },
};

function cell(data = "0xabcd"): ccc.CellLike {
  return {
    outPoint,
    cellOutput: { capacity: 10_000_000_000n, lock, type },
    outputData: data,
  };
}

function fakeClient(input: {
  genesis?: string;
  escrow?: ccc.CellLike;
  code?: ccc.CellLike;
  cells?: ccc.CellLike[];
}) {
  const cells = new Map(
    [input.escrow, input.code, ...(input.cells ?? [])]
      .filter((candidate): candidate is ccc.CellLike => Boolean(candidate))
      .map((candidate) => {
        const normalized = ccc.Cell.from(candidate);
        if (!normalized.outPoint) throw new Error("Test cell outpoint is required");
        return [`${normalized.outPoint.txHash}:${normalized.outPoint.index}`, normalized] as const;
      }),
  );
  return {
    async getHeaderByNumberNoCache() {
      return { hash: input.genesis ?? `0x${"aa".repeat(32)}` };
    },
    async getCellLive(point: ccc.OutPointLike) {
      const normalized = ccc.OutPoint.from(point);
      return cells.get(`${normalized.txHash}:${normalized.index}`);
    },
  };
}

function codeCell(): ccc.CellLike {
  return {
    outPoint: codeOutPoint,
    cellOutput: { capacity: 10_000_000_000n, lock, type: null },
    outputData: codeData,
  };
}

function settlementEscrowCell(): ccc.CellLike {
  return {
    outPoint,
    cellOutput: { capacity: 2_000n, lock, type },
    outputData: encodeEscrowDataHex({
      buyerLockHash: ccc.Script.from(buyerLock).hash(),
      sellerLockHash: ccc.Script.from(sellerLock).hash(),
      arbitratorLockHash: ccc.Script.from(arbitratorLock).hash(),
      amountShannons: 1_000n,
      deadlineMs: 1_700_000_000_000n,
      state: "Delivered",
      description: "preflight settlement",
    }),
  };
}

function participantCell(index: number, participantLock: ccc.ScriptLike, capacity: bigint): ccc.CellLike {
  return {
    outPoint: { txHash: `0x${index.toString(16).padStart(64, "0")}`, index: 0n },
    cellOutput: { capacity, lock: participantLock, type: null },
    outputData: "0x",
  };
}

function settlementTransaction(input: {
  escrow?: ccc.CellLike;
  recipientLock?: ccc.ScriptLike;
  recipientCapacity?: bigint;
  recipientInput?: ccc.CellLike;
  includeDep?: boolean;
} = {}): ccc.Transaction {
  const tx = ccc.Transaction.default();
  if (input.includeDep !== false) tx.cellDeps.push(ccc.CellDep.from(deployment.cellDep));
  const escrow = input.escrow ?? settlementEscrowCell();
  tx.addInput(escrow);
  if (input.recipientInput) tx.addInput(input.recipientInput);
  tx.addOutput({
    capacity: input.recipientCapacity ?? 1_000n,
    lock: input.recipientLock ?? sellerLock,
  }, "0x");
  tx.witnesses[0] = ccc.hexFrom(ccc.WitnessArgs.from({
    inputType: encodeEscrowActionHex("Complete"),
  }).toBytes());
  return tx;
}

describe("escrow preflight", () => {
  it("rejects a signer connected to another genesis block", async () => {
    const signerClient = fakeClient({ genesis: `0x${"aa".repeat(32)}` });
    const expectedClient = fakeClient({ genesis: `0x${"bb".repeat(32)}` });
    await expect(assertSignerNetwork({ client: signerClient } as never, expectedClient as never))
      .rejects.toThrow(/wrong CKB network/);
  });

  it("rejects a missing deployment cell", async () => {
    const client = fakeClient({});
    await expect(assertDeploymentLive(client as never, {
      typeScript: { codeHash: ccc.hashCkb(codeData), hashType: "data2", args: "0x" },
      cellDep: { outPoint: codeOutPoint, depType: "code" },
    })).rejects.toThrow(/deployment cell is unavailable/);
  });

  it("rejects a deployment data hash mismatch", async () => {
    const client = fakeClient({ code: codeCell() });
    await expect(assertDeploymentLive(client as never, {
      typeScript: { codeHash: `0x${"ff".repeat(32)}`, hashType: "data2", args: "0x" },
      cellDep: { outPoint: codeOutPoint, depType: "code" },
    })).rejects.toThrow(/code hash does not match/);
  });

  it("rejects a consumed or changed escrow input", async () => {
    await expect(assertEscrowInputLive(fakeClient({}) as never, cell()))
      .rejects.toThrow(/already changed or been consumed/);
    await expect(assertEscrowInputLive(fakeClient({ escrow: cell("0xeeee") }) as never, cell()))
      .rejects.toThrow(/no longer matches/);
  });

  it("accepts matching live deployment and escrow cells", async () => {
    const client = fakeClient({ code: codeCell(), escrow: cell() });
    await expect(assertDeploymentLive(client as never, {
      typeScript: { codeHash: ccc.hashCkb(codeData), hashType: "data2", args: "0x" },
      cellDep: { outPoint: codeOutPoint, depType: "code" },
    })).resolves.toBeUndefined();
    await expect(assertEscrowInputLive(client as never, cell())).resolves.toBeUndefined();
  });

  it("rejects a finalized transaction without the configured CellDep or escrow input", async () => {
    const escrow = settlementEscrowCell();
    const client = fakeClient({ escrow });
    await expect(assertFinalizedEscrowTransaction({
      client: client as never,
      deployment,
      transaction: settlementTransaction({ includeDep: false }),
      action: "Complete",
      escrowInput: escrow,
      settlement: { action: "Complete", recipientLock: sellerLock },
    })).rejects.toThrow(/missing the configured escrow deployment CellDep/);

    const tx = settlementTransaction();
    tx.inputs = [];
    await expect(assertFinalizedEscrowTransaction({
      client: client as never,
      deployment,
      transaction: tx,
      action: "Complete",
      escrowInput: escrow,
      settlement: { action: "Complete", recipientLock: sellerLock },
    })).rejects.toThrow(/no longer consumes the loaded escrow cell/);
  });

  it("rejects a finalized settlement whose recipient is not the contract payout target", async () => {
    const escrow = settlementEscrowCell();
    await expect(assertFinalizedEscrowTransaction({
      client: fakeClient({ escrow }) as never,
      deployment,
      transaction: settlementTransaction({ recipientLock: buyerLock }),
      action: "Complete",
      escrowInput: escrow,
      settlement: { action: "Complete", recipientLock: buyerLock },
    })).rejects.toThrow(/does not match the escrow payout target/);
  });

  it("rejects gross recipient output funded by the recipient's own input", async () => {
    const escrow = settlementEscrowCell();
    const recipientInput = participantCell(8, sellerLock, 500n);
    await expect(assertFinalizedEscrowTransaction({
      client: fakeClient({ escrow, cells: [recipientInput] }) as never,
      deployment,
      transaction: settlementTransaction({ recipientInput, recipientCapacity: 1_000n }),
      action: "Complete",
      escrowInput: escrow,
      settlement: { action: "Complete", recipientLock: sellerLock },
    })).rejects.toThrow(/required net escrow amount/);
  });

  it("accepts a recipient fee input when the finalized net gain still covers the escrow amount", async () => {
    const escrow = settlementEscrowCell();
    const recipientInput = participantCell(9, sellerLock, 500n);
    await expect(assertFinalizedEscrowTransaction({
      client: fakeClient({ escrow, cells: [recipientInput] }) as never,
      deployment,
      transaction: settlementTransaction({ recipientInput, recipientCapacity: 1_500n }),
      action: "Complete",
      escrowInput: escrow,
      settlement: { action: "Complete", recipientLock: sellerLock },
    })).resolves.toBeUndefined();
  });
});
