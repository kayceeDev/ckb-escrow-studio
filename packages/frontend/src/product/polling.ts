import type { EscrowState } from "@ckb-escrow/sdk";

import type { ProductEscrowRecord } from "./contract";

export interface EscrowPollingSnapshot {
  records: ProductEscrowRecord[];
}

export type EscrowPollingResult =
  | { status: "updated"; record: ProductEscrowRecord }
  | { status: "timeout" };

export function findUpdatedEscrowRecord(input: {
  records: ProductEscrowRecord[];
  previousRecord: ProductEscrowRecord;
  submittedTxHash: string;
  expectedTerminal: boolean;
}): ProductEscrowRecord | null {
  const { records, previousRecord, submittedTxHash, expectedTerminal } = input;
  const previousKeys = new Set([previousRecord.stableId, previousRecord.currentId, previousRecord.id].filter(Boolean));
  const matchingRecords = records.filter((record) => {
    const keys = [record.stableId, record.currentId, record.id].filter(Boolean);
    return keys.some((key) => previousKeys.has(key));
  });

  const bySubmittedTx = matchingRecords.find((record) => record.id.includes(submittedTxHash) || record.currentId?.includes(submittedTxHash));
  if (bySubmittedTx) {
    return bySubmittedTx;
  }

  const changedState = matchingRecords.find((record) => record.state !== previousRecord.state);
  if (changedState) {
    return changedState;
  }

  if (expectedTerminal) {
    const terminal = matchingRecords.find((record) => record.source === "indexed" && record.currentId == null);
    if (terminal) {
      return terminal;
    }
  }

  return null;
}

export async function pollForEscrowUpdate(input: {
  previousRecord: ProductEscrowRecord;
  submittedTxHash: string;
  expectedTerminal: boolean;
  refresh: () => Promise<EscrowPollingSnapshot>;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<EscrowPollingResult> {
  const intervalMs = input.intervalMs ?? 2_000;
  const timeoutMs = input.timeoutMs ?? 60_000;
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const snapshot = await input.refresh();
    const updated = findUpdatedEscrowRecord({
      records: snapshot.records,
      previousRecord: input.previousRecord,
      submittedTxHash: input.submittedTxHash,
      expectedTerminal: input.expectedTerminal,
    });
    if (updated) {
      return { status: "updated", record: updated };
    }
  }

  return { status: "timeout" };
}

export function stateLabel(state: EscrowState): string {
  return state;
}
