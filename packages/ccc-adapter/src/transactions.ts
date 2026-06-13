import * as ccc from "@ckb-ccc/ccc";
import {
  createEscrowRecord,
  decodeEscrowData,
  planCreateEscrow,
  planEscrowAction,
} from "@ckb-escrow/sdk";

import { applyEscrowDeployment, getEscrowTypeScript } from "./deployment.js";
import type {
  EscrowCreateTxParams,
  EscrowDeployment,
  EscrowSettlementAction,
  EscrowSettlementFinalizationContext,
  EscrowSettlementTxParams,
  EscrowTransitionTxParams,
} from "./types.js";

function toCapacity(value: bigint | number | string | undefined, fallback: bigint): bigint {
  return value === undefined ? fallback : BigInt(value);
}

function occupiedCapacity(cellOutput: ccc.CellOutputLike, outputData: ccc.HexLike): bigint {
  return ccc.CellOutput.from({ ...cellOutput, capacity: 0n }, outputData).capacity;
}

function createWitness(inputTypeHex: ccc.HexLike): ccc.Hex {
  return ccc.hexFrom(
    ccc.WitnessArgs.from({
      inputType: inputTypeHex,
    }).toBytes(),
  );
}

function createEmptyWitness(): ccc.Hex {
  return ccc.hexFrom(ccc.WitnessArgs.from({}).toBytes());
}

function setEscrowActionWitness(tx: ccc.Transaction, witness: ccc.Hex): void {
  tx.witnesses[0] = witness;
  while (tx.witnesses.length < tx.inputs.length) {
    tx.witnesses.push(createEmptyWitness());
  }
}

function decodeEscrowCell(cellLike: ccc.CellLike) {
  const cell = ccc.Cell.from(cellLike);
  return decodeEscrowData(cell.outputData);
}

function addSignerInput(tx: ccc.Transaction, signerInput?: ccc.CellInputLike): void {
  if (signerInput) {
    tx.addInput(signerInput);
  }
}

function addHeaderDeps(tx: ccc.Transaction, headerDeps?: ccc.HexLike[]): void {
  if (!headerDeps) {
    return;
  }

  for (const headerDep of headerDeps) {
    tx.headerDeps.push(ccc.hexFrom(headerDep));
  }
}

function scriptHash(scriptLike: ccc.ScriptLike): string {
  return ccc.Script.from(scriptLike).hash().toLowerCase();
}

function settlementRecipientHash(
  action: EscrowSettlementAction,
  escrow: ReturnType<typeof decodeEscrowCell>,
): string {
  if (action === "Complete" || action === "ResolveToSeller") {
    return escrow.sellerLockHash.toLowerCase();
  }
  return escrow.buyerLockHash.toLowerCase();
}

function ensureRecipientMatchesSettlement(
  action: EscrowSettlementAction,
  escrow: ReturnType<typeof decodeEscrowCell>,
  recipientLock: ccc.ScriptLike,
): void {
  const expected = settlementRecipientHash(action, escrow);
  const actual = scriptHash(recipientLock);

  if (actual !== expected) {
    throw new Error(
      `Settlement recipient lock does not match ${action} contract payout target.`,
    );
  }
}

export function buildCreateEscrowTransaction(
  deployment: EscrowDeployment,
  params: EscrowCreateTxParams,
): ccc.Transaction {
  const record = createEscrowRecord({
    buyerLockHash: ccc.Script.from(params.buyerLock).hash(),
    sellerLockHash: ccc.Script.from(params.sellerLock).hash(),
    arbitratorLockHash: ccc.Script.from(params.arbitratorLock).hash(),
    amountShannons: params.amountShannons,
    deadlineMs: params.deadlineMs,
    state: "Funded",
    description: params.description,
  });

  const plan = planCreateEscrow(record);
  if (plan.kind !== "create") {
    throw new Error("Create escrow planning must return a create plan");
  }
  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  const escrowOutput = {
    lock: params.escrowLock,
    type: getEscrowTypeScript(deployment),
  };
  const minimumEscrowCapacity = record.amountShannons + occupiedCapacity(escrowOutput, plan.outputDataHex);

  tx.addOutput(
    {
      ...escrowOutput,
      capacity: toCapacity(params.capacity, minimumEscrowCapacity),
    },
    plan.outputDataHex,
  );

  return tx;
}

export function buildDeliverTransaction(
  deployment: EscrowDeployment,
  params: EscrowTransitionTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  const plan = planEscrowAction(escrow, "Deliver");

  if (plan.kind !== "transition") {
    throw new Error("Deliver action must produce a transition plan");
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.escrowLock,
      type: getEscrowTypeScript(deployment),
      capacity: toCapacity(params.capacity, ccc.Cell.from(params.escrowInput).cellOutput.capacity),
    },
    plan.outputDataHex,
  );
  setEscrowActionWitness(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export function buildDisputeTransaction(
  deployment: EscrowDeployment,
  params: EscrowTransitionTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  const plan = planEscrowAction(escrow, "Dispute");

  if (plan.kind !== "transition") {
    throw new Error("Dispute action must produce a transition plan");
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.escrowLock,
      type: getEscrowTypeScript(deployment),
      capacity: toCapacity(params.capacity, ccc.Cell.from(params.escrowInput).cellOutput.capacity),
    },
    plan.outputDataHex,
  );
  setEscrowActionWitness(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export function buildSettlementTransaction(
  deployment: EscrowDeployment,
  action: EscrowSettlementAction,
  params: EscrowSettlementTxParams,
): ccc.Transaction {
  const escrow = decodeEscrowCell(params.escrowInput);
  ensureRecipientMatchesSettlement(action, escrow, params.recipientLock);
  const plan = planEscrowAction(
    escrow,
    action,
    params.referenceTimestampMs === undefined
      ? undefined
      : { referenceTimestampMs: params.referenceTimestampMs },
  );

  if (plan.kind !== "settlement") {
    throw new Error(`${action} must produce a settlement plan`);
  }

  const tx = applyEscrowDeployment(ccc.Transaction.default(), deployment);
  tx.addInput(params.escrowInput);
  addSignerInput(tx, params.signerInput);
  tx.addOutput(
    {
      lock: params.recipientLock,
      capacity: toCapacity(
        params.recipientCapacity,
        ccc.Cell.from(params.escrowInput).cellOutput.capacity,
      ),
    },
    "0x",
  );
  addHeaderDeps(tx, params.headerDeps);
  setEscrowActionWitness(tx, createWitness(plan.witness.payloadHex));

  return tx;
}

export async function completeFeeBySigner(
  tx: ccc.Transaction,
  signer: ccc.Signer,
  options?: {
    feeRate?: ccc.NumLike;
  },
): Promise<ccc.Transaction> {
  await tx.completeFeeBy(signer, options?.feeRate);
  return tx;
}

export async function completeSettlementFeeBySigner(
  tx: ccc.Transaction,
  signer: ccc.Signer,
  context: EscrowSettlementFinalizationContext,
  options?: {
    feeRate?: ccc.NumLike;
  },
): Promise<ccc.Transaction> {
  const escrow = decodeEscrowCell(context.escrowInput);
  ensureRecipientMatchesSettlement(context.action, escrow, context.recipientLock);

  const signerLock = (await signer.getRecommendedAddressObj()).script;
  const signerIsRecipient = scriptHash(signerLock) === scriptHash(context.recipientLock);

  if (signerIsRecipient) {
    await tx.completeFeeChangeToOutput(
      signer,
      context.recipientOutputIndex ?? 0,
      options?.feeRate,
    );
    return tx;
  }

  await tx.completeFeeBy(signer, options?.feeRate);
  return tx;
}
