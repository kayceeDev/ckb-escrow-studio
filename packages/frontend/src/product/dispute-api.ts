import type {
  DisputeCaseRecord,
  DisputeEvidenceItem,
  DisputeRequestedOutcome,
} from "@ckb-escrow/indexer";

import type { CkbNetwork } from "../types";

export type DraftEvidenceItem = Pick<
  DisputeEvidenceItem,
  "type" | "label" | "value" | "uri" | "mimeType" | "sizeBytes" | "contentHash" | "submittedByLockHash"
>;

interface DisputeCaseResponse {
  disputeCase: DisputeCaseRecord | null;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Dispute API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function hashEvidenceText(value: string): `0x${string}` {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `0x${(hash >>> 0).toString(16).padStart(64, "0")}`;
}

export interface ProductDisputeClient {
  getDisputeCase(input: { network: CkbNetwork; escrowId: string }): Promise<DisputeCaseRecord | null>;
  createDisputeCase(input: {
    network: CkbNetwork;
    escrowId: string;
    disputeTxHash: `0x${string}`;
    openedByLockHash: `0x${string}`;
    requestedOutcome: DisputeRequestedOutcome;
    reason: string;
    evidence: DraftEvidenceItem[];
  }): Promise<DisputeCaseRecord | null>;
  addEvidence(input: {
    network: CkbNetwork;
    escrowId: string;
    submittedByLockHash: `0x${string}`;
    evidence: Omit<DraftEvidenceItem, "submittedByLockHash">[];
  }): Promise<DisputeCaseRecord | null>;
  saveDecision(input: {
    network: CkbNetwork;
    escrowId: string;
    outcome: DisputeRequestedOutcome;
    decisionNote: string;
    resolutionTxHash: `0x${string}`;
    decidedByLockHash: `0x${string}`;
  }): Promise<DisputeCaseRecord | null>;
}

export function createProductDisputeClient(baseUrl = ""): ProductDisputeClient {
  function disputeUrl(network: CkbNetwork, escrowId: string): string {
    const params = new URLSearchParams({ network });
    return `${baseUrl}/api/escrows/${encodeURIComponent(escrowId)}/dispute?${params.toString()}`;
  }

  return {
    async getDisputeCase({ network, escrowId }) {
      const payload = await fetchJson<DisputeCaseResponse>(disputeUrl(network, escrowId));
      return payload.disputeCase;
    },
    async createDisputeCase(input) {
      const payload = await fetchJson<DisputeCaseResponse>(disputeUrl(input.network, input.escrowId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "create", ...input }),
      });
      return payload.disputeCase;
    },
    async addEvidence(input) {
      const payload = await fetchJson<DisputeCaseResponse>(disputeUrl(input.network, input.escrowId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "addEvidence", ...input }),
      });
      return payload.disputeCase;
    },
    async saveDecision(input) {
      const payload = await fetchJson<DisputeCaseResponse>(disputeUrl(input.network, input.escrowId), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "decision", ...input }),
      });
      return payload.disputeCase;
    },
  };
}

export const productDisputeClient = createProductDisputeClient();
