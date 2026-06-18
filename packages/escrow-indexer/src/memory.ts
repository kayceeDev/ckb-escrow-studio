import { isEscrowInStatus } from "./model.js";
import type {
  EscrowIndexerStorage,
  IndexedEscrowDetailQuery,
  IndexedEscrowListQuery,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
  IndexerStatus,
} from "./types.js";

function matchesLockHash(record: IndexedEscrowRecord, lockHash?: string | null): boolean {
  if (!lockHash) {
    return true;
  }

  const normalized = lockHash.toLowerCase();
  return (
    record.buyerLockHash.toLowerCase() === normalized ||
    record.sellerLockHash.toLowerCase() === normalized ||
    record.arbitratorLockHash.toLowerCase() === normalized
  );
}

export class MemoryEscrowIndexerStorage implements EscrowIndexerStorage {
  private readonly records = new Map<string, IndexedEscrowRecord>();
  private readonly checkpoints = new Map<IndexedEscrowNetwork, string>();

  async upsertEscrow(record: IndexedEscrowRecord): Promise<void> {
    this.records.set(`${record.network}:${record.id}`, record);
  }

  async getEscrow(query: IndexedEscrowDetailQuery): Promise<IndexedEscrowRecord | null> {
    return this.records.get(`${query.network}:${query.escrowId}`) ?? null;
  }

  async listEscrows(query: IndexedEscrowListQuery): Promise<IndexedEscrowRecord[]> {
    return Array.from(this.records.values())
      .filter((record) => record.network === query.network)
      .filter((record) => matchesLockHash(record, query.lockHash))
      .filter((record) => isEscrowInStatus(record.state, query.status ?? "all"))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async getStatus(network: IndexedEscrowNetwork): Promise<IndexerStatus> {
    return {
      network,
      ready: true,
      storage: "memory",
      lastProcessedBlock: this.checkpoints.get(network) ?? null,
      updatedAt: new Date().toISOString(),
    };
  }
}
