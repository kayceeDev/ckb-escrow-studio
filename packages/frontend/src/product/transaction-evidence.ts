import type { IndexedEscrowEventType, IndexedEscrowRecord } from "@ckb-escrow/indexer";

export interface EscrowTransactionEvidence {
  label: string;
  txHash: string;
}

interface EscrowTransactionEvidenceInput {
  submittedTxHash?: string | null;
  liveEscrow?: { txHash: string } | null;
  indexedEscrow?: {
    latestTxHash: IndexedEscrowRecord["latestTxHash"];
    events: Array<Pick<IndexedEscrowRecord["events"][number], "type" | "txHash">>;
  } | null;
}

function eventLabel(type: IndexedEscrowEventType): string {
  return type.replace(/([a-z])([A-Z])/g, "$1 $2");
}

export function collectEscrowTransactionEvidence(
  input: EscrowTransactionEvidenceInput,
): EscrowTransactionEvidence[] {
  const evidence: EscrowTransactionEvidence[] = [];
  const seen = new Set<string>();
  const add = (label: string, txHash: string | null | undefined) => {
    if (!txHash || seen.has(txHash)) return;
    seen.add(txHash);
    evidence.push({ label, txHash });
  };

  add("Submitted transaction", input.submittedTxHash);
  for (const event of [...(input.indexedEscrow?.events ?? [])].reverse()) {
    add(eventLabel(event.type), event.txHash);
  }
  add("Current state", input.liveEscrow?.txHash);
  add("Latest indexed transaction", input.indexedEscrow?.latestTxHash);

  return evidence;
}
