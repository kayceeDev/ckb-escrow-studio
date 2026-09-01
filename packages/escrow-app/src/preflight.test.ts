import * as ccc from "@ckb-ccc/ccc";
import { describe, expect, it } from "vitest";

import { assertDeploymentLive, assertEscrowInputLive, assertSignerNetwork } from "./preflight.js";

const lock = { codeHash: `0x${"11".repeat(32)}`, hashType: "type" as const, args: "0x" };
const type = { codeHash: `0x${"22".repeat(32)}`, hashType: "type" as const, args: "0x" };
const outPoint = { txHash: `0x${"33".repeat(32)}`, index: 0n };
const codeOutPoint = { txHash: `0x${"44".repeat(32)}`, index: 0n };
const codeData = "0x010203" as const;

function cell(data = "0xabcd") {
  return ccc.Cell.from({
    outPoint,
    cellOutput: { capacity: 10_000_000_000n, lock, type },
    outputData: data,
  });
}

function fakeClient(input: {
  genesis?: string;
  escrow?: ccc.Cell;
  code?: ccc.Cell;
}) {
  return {
    async getHeaderByNumberNoCache() {
      return { hash: input.genesis ?? `0x${"aa".repeat(32)}` };
    },
    async getCellLive(point: ccc.OutPointLike) {
      const normalized = ccc.OutPoint.from(point);
      if (normalized.txHash === codeOutPoint.txHash) return input.code;
      if (normalized.txHash === outPoint.txHash) return input.escrow;
      return undefined;
    },
  };
}

function codeCell() {
  return ccc.Cell.from({
    outPoint: codeOutPoint,
    cellOutput: { capacity: 10_000_000_000n, lock, type: null },
    outputData: codeData,
  });
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
});
