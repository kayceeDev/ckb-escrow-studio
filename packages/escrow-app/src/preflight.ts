import * as ccc from "@ckb-ccc/ccc";
import type { EscrowDeployment } from "@ckb-escrow/ccc-adapter";

function scriptHash(script: ccc.ScriptLike | null | undefined): string | null {
  return script ? ccc.Script.from(script).hash().toLowerCase() : null;
}

export async function assertSignerNetwork(signer: ccc.Signer, expectedClient: ccc.Client): Promise<void> {
  const [signerGenesis, expectedGenesis] = await Promise.all([
    signer.client.getHeaderByNumberNoCache(0n),
    expectedClient.getHeaderByNumberNoCache(0n),
  ]);
  if (!signerGenesis || !expectedGenesis || signerGenesis.hash.toLowerCase() !== expectedGenesis.hash.toLowerCase()) {
    throw new Error("Wallet is connected to the wrong CKB network. Switch the wallet network and retry.");
  }
}

export async function assertDeploymentLive(client: ccc.Client, deployment: EscrowDeployment): Promise<void> {
  const cellDep = ccc.CellDep.from(deployment.cellDep);
  const codeCell = await client.getCellLive(cellDep.outPoint, true, true);
  if (!codeCell) {
    throw new Error("Escrow deployment cell is unavailable on this network.");
  }

  const script = ccc.Script.from(deployment.typeScript);
  if (script.hashType === "data" || script.hashType === "data1" || script.hashType === "data2") {
    const actual = ccc.hashCkb(codeCell.outputData).toLowerCase();
    if (actual !== script.codeHash.toLowerCase()) {
      throw new Error("Escrow deployment code hash does not match the live CellDep.");
    }
  } else if (scriptHash(codeCell.cellOutput.type) !== script.codeHash.toLowerCase()) {
    throw new Error("Escrow deployment type hash does not match the live CellDep.");
  }
}

export async function assertEscrowInputLive(client: ccc.Client, expectedLike: ccc.CellLike): Promise<void> {
  const expected = ccc.Cell.from(expectedLike);
  if (!expected.outPoint) throw new Error("Escrow input outpoint is missing.");
  const live = await client.getCellLive(expected.outPoint, true, true);
  if (!live) {
    throw new Error("This escrow has already changed or been consumed. Refresh the escrow before trying again.");
  }
  if (
    live.cellOutput.capacity !== expected.cellOutput.capacity ||
    scriptHash(live.cellOutput.lock) !== scriptHash(expected.cellOutput.lock) ||
    scriptHash(live.cellOutput.type) !== scriptHash(expected.cellOutput.type) ||
    ccc.hexFrom(live.outputData).toLowerCase() !== ccc.hexFrom(expected.outputData).toLowerCase()
  ) {
    throw new Error("The live escrow no longer matches the loaded deal. Refresh before signing.");
  }
}

export async function runEscrowPreflight(input: {
  signer: ccc.Signer;
  client: ccc.Client;
  deployment: EscrowDeployment;
  escrowInput?: ccc.CellLike;
}): Promise<void> {
  await assertSignerNetwork(input.signer, input.client);
  await assertDeploymentLive(input.client, input.deployment);
  if (input.escrowInput) await assertEscrowInputLive(input.client, input.escrowInput);
}
