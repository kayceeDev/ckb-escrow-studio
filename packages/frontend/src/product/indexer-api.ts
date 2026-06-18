import type { IndexedEscrowRecord, IndexedEscrowStatus, IndexerStatus } from "@ckb-escrow/indexer";

import type { CkbNetwork } from "../types";

interface EscrowListResponse {
  escrows: IndexedEscrowRecord[];
}

interface EscrowDetailResponse {
  escrow: IndexedEscrowRecord | null;
}

export interface ProductIndexerClient {
  listEscrows(input: {
    network: CkbNetwork;
    lockHash?: string | null;
    status?: IndexedEscrowStatus;
  }): Promise<IndexedEscrowRecord[]>;
  getEscrow(input: { network: CkbNetwork; escrowId: string }): Promise<IndexedEscrowRecord | null>;
  getStatus(network: CkbNetwork): Promise<IndexerStatus>;
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Indexer API request failed with ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function appendOptional(params: URLSearchParams, key: string, value: string | null | undefined): void {
  if (value) {
    params.set(key, value);
  }
}

export function createProductIndexerClient(baseUrl = ""): ProductIndexerClient {
  return {
    async listEscrows({ network, lockHash, status = "all" }) {
      const params = new URLSearchParams({ network, status });
      appendOptional(params, "lockHash", lockHash);
      const payload = await fetchJson<EscrowListResponse>(`${baseUrl}/api/escrows?${params.toString()}`);
      return payload.escrows;
    },
    async getEscrow({ network, escrowId }) {
      const params = new URLSearchParams({ network });
      const payload = await fetchJson<EscrowDetailResponse>(
        `${baseUrl}/api/escrows/${encodeURIComponent(escrowId)}?${params.toString()}`,
      );
      return payload.escrow;
    },
    async getStatus(network) {
      const params = new URLSearchParams({ network });
      return fetchJson<IndexerStatus>(`${baseUrl}/api/indexer/status?${params.toString()}`);
    },
  };
}

export const productIndexerClient = createProductIndexerClient();
