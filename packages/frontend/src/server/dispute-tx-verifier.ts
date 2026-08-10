import * as ccc from "@ckb-ccc/ccc";
import { decodeEscrowAction, type EscrowAction } from "@ckb-escrow/sdk";
import type { EscrowIndexerStorage, IndexedEscrowNetwork } from "@ckb-escrow/indexer";

import { NETWORK_CLIENTS } from "../studio";

type TransactionClient = Pick<ccc.Client, "getTransactionWithHeader">;

function toIndex(value: ccc.NumLike): string {
  return String(value);
}

function outPointId(outPoint: { txHash: ccc.HexLike; index: ccc.NumLike }): string {
  return `${ccc.hexFrom(outPoint.txHash).toLowerCase()}:${toIndex(outPoint.index)}`;
}

export function decodeEscrowActionFromWitnesses(witnesses: ccc.HexLike[]): EscrowAction | null {
  for (const witness of witnesses) {
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

export async function verifyDisputeTransactionHash(input: {
  network: IndexedEscrowNetwork;
  storage: EscrowIndexerStorage;
  escrowId: string;
  txHash: `0x${string}`;
  expectedAction: EscrowAction;
  client?: TransactionClient;
}): Promise<void> {
  const client = input.client ?? NETWORK_CLIENTS[input.network];
  const record = await input.storage.getEscrow({ network: input.network, escrowId: input.escrowId });
  if (!record) {
    throw new Error("Escrow must be indexed before dispute transaction metadata can be stored");
  }

  if (record.events.some((event) => event.txHash.toLowerCase() === input.txHash && event.action === input.expectedAction)) {
    return;
  }

  const response = await client.getTransactionWithHeader(input.txHash);
  const tx = response?.transaction.transaction;
  if (!tx) {
    throw new Error("Submitted dispute transaction hash was not found on chain");
  }

  const action = decodeEscrowActionFromWitnesses(tx.witnesses ?? []);
  if (action !== input.expectedAction) {
    throw new Error(`Submitted transaction action ${action ?? "unknown"} does not match ${input.expectedAction}`);
  }

  const allowedInputs = new Set<string>();
  allowedInputs.add(`${record.origin.txHash.toLowerCase()}:${record.origin.index}`);
  if (record.current) {
    allowedInputs.add(`${record.current.txHash.toLowerCase()}:${record.current.index}`);
  }

  const touchesEscrow = tx.inputs.some((cellInput) => allowedInputs.has(outPointId(cellInput.previousOutput)));
  if (!touchesEscrow) {
    throw new Error("Submitted transaction does not consume the expected escrow cell");
  }
}
