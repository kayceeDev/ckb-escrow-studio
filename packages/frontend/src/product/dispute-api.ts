import type * as ccc from "@ckb-ccc/ccc";
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

export type ProductDisputeAuthAction = "create" | "addEvidence" | "decision";

export interface ProductDisputeAuthProof {
  nonce: string;
  message: string;
  signature: {
    signature: string;
    identity: string;
    signType: string;
  };
  signerAddress: string;
  signerLockHash: `0x${string}`;
}

interface DisputeCaseResponse {
  disputeCase: DisputeCaseRecord | null;
}

interface NonceResponse {
  nonce: string;
  expiresAt: string;
  message: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? `Dispute API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function hashEvidenceText(value: string): Promise<`0x${string}`> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const hex = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  return `0x${hex}`;
}

export interface ProductDisputeClient {
  getDisputeCase(input: { network: CkbNetwork; escrowId: string }): Promise<DisputeCaseRecord | null>;
  createAuthProof(input: {
    network: CkbNetwork;
    escrowId: string;
    action: ProductDisputeAuthAction;
    lockHash: `0x${string}`;
    signer: ccc.Signer;
  }): Promise<ProductDisputeAuthProof>;
  createDisputeCase(input: {
    network: CkbNetwork;
    escrowId: string;
    disputeTxHash: `0x${string}`;
    openedByLockHash: `0x${string}`;
    requestedOutcome: DisputeRequestedOutcome;
    reason: string;
    evidence: DraftEvidenceItem[];
    auth: ProductDisputeAuthProof;
  }): Promise<DisputeCaseRecord | null>;
  addEvidence(input: {
    network: CkbNetwork;
    escrowId: string;
    submittedByLockHash: `0x${string}`;
    evidence: Omit<DraftEvidenceItem, "submittedByLockHash">[];
    auth: ProductDisputeAuthProof;
  }): Promise<DisputeCaseRecord | null>;
  saveDecision(input: {
    network: CkbNetwork;
    escrowId: string;
    outcome: DisputeRequestedOutcome;
    decisionNote: string;
    resolutionTxHash: `0x${string}`;
    decidedByLockHash: `0x${string}`;
    auth: ProductDisputeAuthProof;
  }): Promise<DisputeCaseRecord | null>;
}

export function createProductDisputeClient(baseUrl = ""): ProductDisputeClient {
  function disputeUrl(network: CkbNetwork, escrowId: string): string {
    const params = new URLSearchParams({ network });
    return `${baseUrl}/api/escrows/${encodeURIComponent(escrowId)}/dispute?${params.toString()}`;
  }

  function nonceUrl(input: {
    network: CkbNetwork;
    escrowId: string;
    action: ProductDisputeAuthAction;
    lockHash: `0x${string}`;
  }): string {
    const params = new URLSearchParams({
      network: input.network,
      escrowId: input.escrowId,
      action: input.action,
      lockHash: input.lockHash,
    });
    return `${baseUrl}/api/auth/nonce?${params.toString()}`;
  }

  return {
    async getDisputeCase({ network, escrowId }) {
      const payload = await fetchJson<DisputeCaseResponse>(disputeUrl(network, escrowId));
      return payload.disputeCase;
    },
    async createAuthProof(input) {
      const payload = await fetchJson<NonceResponse>(nonceUrl(input));
      const signature = await input.signer.signMessage(payload.message);
      const signerAddress = await input.signer.getRecommendedAddress();
      return {
        nonce: payload.nonce,
        message: payload.message,
        signature,
        signerAddress,
        signerLockHash: input.lockHash,
      };
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
