import * as ccc from "@ckb-ccc/ccc";
import {
  decodeEscrowAction,
  decodeEscrowData,
  type EscrowAction,
  type EscrowCellView,
  type EscrowState,
  type Hex,
} from "@ckb-escrow/sdk";

import { createIndexedEscrow, eventTypeForTransition, makeEscrowId } from "./model.js";
import type {
  EscrowIndexerStorage,
  IndexedEscrowEvent,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
  IndexedOutPoint,
} from "./types.js";

export interface EscrowScannerDeployment {
  typeScript: ccc.ScriptLike;
}

export type EscrowScannerClient = Pick<ccc.Client, "findTransactionsByType" | "getTransactionWithHeader">;

export interface ScanEscrowHistoryInput {
  network: IndexedEscrowNetwork;
  client: EscrowScannerClient;
  deployment: EscrowScannerDeployment;
  storage: EscrowIndexerStorage;
  limit?: number;
}

interface DecodedOutput {
  outPoint: IndexedOutPoint;
  decoded: EscrowCellView;
}

interface DecodedInput {
  outPoint: IndexedOutPoint;
  decoded: EscrowCellView;
  origin: IndexedOutPoint;
  record: IndexedEscrowRecord | null;
}

function toIndex(value: ccc.NumLike): string {
  return String(value);
}

function toIsoFromTimestamp(timestamp: ccc.NumLike | null | undefined): string {
  if (timestamp == null) {
    return new Date().toISOString();
  }

  const date = new Date(Number(String(timestamp)));
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function scriptsEqual(left: ccc.ScriptLike | null | undefined, right: ccc.ScriptLike): boolean {
  if (!left) {
    return false;
  }
  return ccc.Script.from(left).hash() === ccc.Script.from(right).hash();
}

function decodeActionFromWitness(tx: { witnesses: Hex[] }): EscrowAction | null {
  for (const witness of tx.witnesses) {
    try {
      const args = ccc.WitnessArgs.fromBytes(witness);
      if (!args.inputType) {
        continue;
      }
      return decodeEscrowAction(args.inputType).action;
    } catch {
      // Wallet lock witnesses are not escrow action witnesses.
    }
  }

  return null;
}

function recipientForAction(action: EscrowAction | null): "buyer" | "seller" | null {
  switch (action) {
    case "Cancel":
    case "Refund":
    case "ResolveToBuyer":
      return "buyer";
    case "Complete":
    case "ResolveToSeller":
      return "seller";
    default:
      return null;
  }
}

function actorForAction(action: EscrowAction | null): IndexedEscrowEvent["actorRole"] {
  switch (action) {
    case "Deliver":
      return "seller";
    case "Complete":
    case "Cancel":
    case "Refund":
      return "buyer";
    case "Dispute":
      return "buyer_or_seller";
    case "ResolveToBuyer":
    case "ResolveToSeller":
      return "arbitrator";
    default:
      return null;
  }
}

function terminalStateForAction(action: EscrowAction | null, fallback: EscrowState): EscrowState {
  switch (action) {
    case "Cancel":
      return "Cancelled";
    case "Refund":
      return "Refunded";
    case "Complete":
      return "Completed";
    case "ResolveToBuyer":
    case "ResolveToSeller":
      return "Resolved";
    default:
      return fallback;
  }
}

async function findOrigin(
  storage: EscrowIndexerStorage,
  network: IndexedEscrowNetwork,
  outPoint: IndexedOutPoint,
): Promise<{ origin: IndexedOutPoint; record: IndexedEscrowRecord | null }> {
  const known = await storage.getEscrow({ network, escrowId: makeEscrowId(outPoint) });
  if (known) {
    return { origin: known.origin, record: known };
  }

  const all = await storage.listEscrows({ network, status: "all" });
  const matched = all.find(
    (record) => record.current?.txHash === outPoint.txHash && record.current.index === outPoint.index,
  );

  if (matched) {
    return { origin: matched.origin, record: matched };
  }

  return { origin: outPoint, record: null };
}

function makeEvent(input: {
  network: IndexedEscrowNetwork;
  escrowId: string;
  txHash: Hex;
  blockNumber: string | null;
  timestamp: string;
  fromState: EscrowState | null;
  toState: EscrowState;
  action: EscrowAction | null;
}): IndexedEscrowEvent {
  const type = eventTypeForTransition(input.fromState, input.toState, input.action);
  return {
    id: `${input.txHash}:${type}`,
    escrowId: input.escrowId,
    network: input.network,
    type,
    txHash: input.txHash,
    blockNumber: input.blockNumber,
    blockTimestamp: String(Date.parse(input.timestamp)),
    fromState: input.fromState,
    toState: input.toState,
    action: input.action,
    actorRole: actorForAction(input.action),
    recipientRole: recipientForAction(input.action),
    createdAt: input.timestamp,
  };
}

function mergeEvents(events: IndexedEscrowEvent[], event: IndexedEscrowEvent): IndexedEscrowEvent[] {
  const next = events.filter((item) => item.id !== event.id);
  next.push(event);
  return next.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export async function scanEscrowHistory({
  network,
  client,
  deployment,
  storage,
  limit = 100,
}: ScanEscrowHistoryInput): Promise<{ scannedTransactions: number; indexedEscrows: number }> {
  const typeScript = ccc.Script.from(deployment.typeScript);
  let scannedTransactions = 0;
  let indexedEscrows = 0;

  for await (const found of client.findTransactionsByType(typeScript, true, "asc", limit)) {
    const txHash = found.txHash;
    const response = await client.getTransactionWithHeader(txHash);
    const tx = response?.transaction.transaction;
    if (!tx) {
      continue;
    }

    scannedTransactions += 1;
    const blockNumber = response.transaction.blockNumber == null ? found.blockNumber : response.transaction.blockNumber;
    const timestamp = toIsoFromTimestamp(response.header?.timestamp);
    const decodedOutputs: DecodedOutput[] = [];

    for (let index = 0; index < tx.outputs.length; index += 1) {
      const output = tx.outputs[index];
      if (!scriptsEqual(output?.type, typeScript)) {
        continue;
      }

      try {
        decodedOutputs.push({
          outPoint: { txHash, index: String(index) },
          decoded: decodeEscrowData(tx.outputsData[index] ?? "0x"),
        });
      } catch {
        // Ignore cells that use the same type script but not this escrow data layout.
      }
    }

    const decodedInputs: DecodedInput[] = [];
    for (const input of tx.inputs) {
      const previous = input.previousOutput;
      const previousOutPoint = { txHash: previous.txHash, index: toIndex(previous.index) };
      const previousTx = await client.getTransactionWithHeader(previous.txHash);
      const previousOutputIndex = Number(previousOutPoint.index);
      const previousOutput = previousTx?.transaction.transaction.outputs[previousOutputIndex];
      if (!previousOutput || !scriptsEqual(previousOutput.type, typeScript)) {
        continue;
      }

      try {
        const decoded = decodeEscrowData(
          previousTx?.transaction.transaction.outputsData[previousOutputIndex] ?? "0x",
        );
        const { origin, record } = await findOrigin(storage, network, previousOutPoint);
        decodedInputs.push({ outPoint: previousOutPoint, decoded, origin, record });
      } catch {
        // Ignore historical cells that cannot be decoded as escrow data.
      }
    }

    const action = decodeActionFromWitness(tx);

    if (decodedInputs.length === 0) {
      for (const output of decodedOutputs) {
        const event = makeEvent({
          network,
          escrowId: makeEscrowId(output.outPoint),
          txHash,
          blockNumber: blockNumber == null ? null : String(blockNumber),
          timestamp,
          fromState: null,
          toState: output.decoded.state,
          action: null,
        });
        await storage.upsertEscrow(
          createIndexedEscrow({
            network,
            origin: output.outPoint,
            current: output.outPoint,
            latestTxHash: txHash,
            decoded: output.decoded,
            createdAt: timestamp,
            updatedAt: timestamp,
            events: [event],
          }),
        );
        indexedEscrows += 1;
      }
      continue;
    }

    for (const input of decodedInputs) {
      const nextOutput = decodedOutputs.find(
        (output) =>
          output.decoded.buyerLockHash === input.decoded.buyerLockHash &&
          output.decoded.sellerLockHash === input.decoded.sellerLockHash &&
          output.decoded.arbitratorLockHash === input.decoded.arbitratorLockHash &&
          output.decoded.amountShannons === input.decoded.amountShannons &&
          output.decoded.deadlineMs === input.decoded.deadlineMs,
      );
      const nextDecoded = nextOutput?.decoded ?? {
        ...input.decoded,
        state: terminalStateForAction(action, input.decoded.state),
      };
      const escrowId = makeEscrowId(input.origin);
      const event = makeEvent({
        network,
        escrowId,
        txHash,
        blockNumber: blockNumber == null ? null : String(blockNumber),
        timestamp,
        fromState: input.decoded.state,
        toState: nextDecoded.state,
        action,
      });

      await storage.upsertEscrow(
        createIndexedEscrow({
          network,
          origin: input.origin,
          current: nextOutput?.outPoint ?? null,
          latestTxHash: txHash,
          settlementTxHash: nextOutput ? null : txHash,
          decoded: nextDecoded,
          createdAt: input.record?.createdAt ?? timestamp,
          updatedAt: timestamp,
          closedAt: nextOutput ? null : timestamp,
          events: mergeEvents(input.record?.events ?? [], event),
        }),
      );
      indexedEscrows += 1;
    }
  }

  return { scannedTransactions, indexedEscrows };
}
