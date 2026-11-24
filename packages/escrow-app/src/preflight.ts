import * as ccc from "@ckb-ccc/ccc";
import type { EscrowDeployment } from "@ckb-escrow/ccc-adapter";
import { decodeEscrowAction, decodeEscrowData, type EscrowAction } from "@ckb-escrow/sdk";

type PreflightAction = "Create" | EscrowAction;

interface SettlementPreflight {
  action: Extract<
    EscrowAction,
    "Cancel" | "Refund" | "Complete" | "ResolveToBuyer" | "ResolveToSeller"
  >;
  recipientLock: ccc.ScriptLike;
}

function scriptHash(script: ccc.ScriptLike | null | undefined): string | null {
  return script ? ccc.Script.from(script).hash().toLowerCase() : null;
}

function outPointKey(outPointLike: ccc.OutPointLike): string {
  const outPoint = ccc.OutPoint.from(outPointLike);
  return `${outPoint.txHash.toLowerCase()}:${outPoint.index}`;
}

function expectedSettlementRecipientHash(
  action: SettlementPreflight["action"],
  escrowInput: ccc.Cell,
): string {
  const escrow = decodeEscrowData(escrowInput.outputData);
  return action === "Complete" || action === "ResolveToSeller"
    ? escrow.sellerLockHash.toLowerCase()
    : escrow.buyerLockHash.toLowerCase();
}

async function loadInputCell(client: ccc.Client, input: ccc.CellInput): Promise<ccc.Cell> {
  const live = await client.getCellLive(input.previousOutput, true, true);
  if (!live) {
    throw new Error("A transaction input has already been consumed. Refresh and rebuild the transaction.");
  }
  return live;
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

export async function assertFinalizedEscrowTransaction(input: {
  client: ccc.Client;
  deployment: EscrowDeployment;
  transaction: ccc.Transaction;
  action: PreflightAction;
  escrowInput?: ccc.CellLike;
  settlement?: SettlementPreflight;
}): Promise<void> {
  const expectedCellDep = ccc.CellDep.from(input.deployment.cellDep);
  if (!input.transaction.cellDeps.some((cellDep) => cellDep.eq(expectedCellDep))) {
    throw new Error("The finalized transaction is missing the configured escrow deployment CellDep.");
  }

  const escrowTypeHash = scriptHash(input.deployment.typeScript);
  if (input.action === "Create") {
    if (!input.transaction.outputs.some((output) => scriptHash(output.type) === escrowTypeHash)) {
      throw new Error("The finalized create transaction does not contain an escrow output.");
    }
    return;
  }

  if (!input.escrowInput) {
    throw new Error("Escrow input is required for this transaction preflight.");
  }

  const expectedEscrowInput = ccc.Cell.from(input.escrowInput);
  if (!expectedEscrowInput.outPoint) {
    throw new Error("Escrow input outpoint is missing.");
  }
  const expectedOutPoint = outPointKey(expectedEscrowInput.outPoint);
  const escrowInputIndex = input.transaction.inputs.findIndex(
    (transactionInput) => outPointKey(transactionInput.previousOutput) === expectedOutPoint,
  );
  if (escrowInputIndex < 0) {
    throw new Error("The finalized transaction no longer consumes the loaded escrow cell.");
  }

  const witness = input.transaction.witnesses[escrowInputIndex];
  try {
    const inputType = witness ? ccc.WitnessArgs.fromBytes(witness).inputType : undefined;
    if (!inputType || decodeEscrowAction(inputType).action !== input.action) {
      throw new Error("action mismatch");
    }
  } catch {
    throw new Error("The finalized transaction action does not match the requested escrow action.");
  }

  const isSettlement = input.settlement !== undefined;
  const hasEscrowOutput = input.transaction.outputs.some(
    (output) => scriptHash(output.type) === escrowTypeHash,
  );
  if (isSettlement && hasEscrowOutput) {
    throw new Error("A terminal escrow transaction must not recreate the escrow cell.");
  }
  if (!isSettlement && !hasEscrowOutput) {
    throw new Error("The finalized state-change transaction is missing its next escrow cell.");
  }

  if (!input.settlement) return;

  const recipientHash = scriptHash(input.settlement.recipientLock);
  const requiredRecipientHash = expectedSettlementRecipientHash(
    input.settlement.action,
    expectedEscrowInput,
  );
  if (!recipientHash || recipientHash !== requiredRecipientHash) {
    throw new Error("The settlement recipient wallet does not match the escrow payout target.");
  }

  let recipientOutputs = 0n;
  for (const output of input.transaction.outputs) {
    if (scriptHash(output.lock) === recipientHash) recipientOutputs += output.capacity;
  }

  const liveInputs = await Promise.all(
    input.transaction.inputs.map((transactionInput) => loadInputCell(input.client, transactionInput)),
  );
  let recipientInputs = 0n;
  for (const transactionInput of liveInputs) {
    if (scriptHash(transactionInput.cellOutput.lock) === recipientHash) {
      recipientInputs += transactionInput.cellOutput.capacity;
    }
  }

  const escrow = decodeEscrowData(expectedEscrowInput.outputData);
  if (recipientOutputs < recipientInputs + escrow.amountShannons) {
    throw new Error("The finalized settlement does not give the recipient the required net escrow amount.");
  }
}

export async function runEscrowPreflight(input: {
  signer: ccc.Signer;
  client: ccc.Client;
  deployment: EscrowDeployment;
  transaction: ccc.Transaction;
  action: PreflightAction;
  escrowInput?: ccc.CellLike;
  settlement?: SettlementPreflight;
}): Promise<void> {
  await assertSignerNetwork(input.signer, input.client);
  await assertDeploymentLive(input.client, input.deployment);
  if (input.escrowInput) await assertEscrowInputLive(input.client, input.escrowInput);
  await assertFinalizedEscrowTransaction(input);
}
