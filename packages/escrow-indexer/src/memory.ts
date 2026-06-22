import {
  appendDisputeEvidence,
  applyArbitratorDecision,
  createDisputeCaseRecord,
  isEscrowInStatus,
} from "./model.js";
import type {
  AddDisputeEvidenceInput,
  CreateDisputeCaseInput,
  DisputeCaseRecord,
  EscrowIndexerStorage,
  IndexedEscrowDetailQuery,
  IndexedEscrowListQuery,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
  IndexerStatus,
  SaveArbitratorDecisionInput,
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

function caseKey(network: IndexedEscrowNetwork, escrowId: string): string {
  return `${network}:${escrowId}`;
}

export class MemoryEscrowIndexerStorage implements EscrowIndexerStorage {
  private readonly records = new Map<string, IndexedEscrowRecord>();
  private readonly disputeCases = new Map<string, DisputeCaseRecord>();
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

  async createDisputeCase(input: CreateDisputeCaseInput): Promise<DisputeCaseRecord> {
    const record = createDisputeCaseRecord(input);
    this.disputeCases.set(caseKey(input.network, input.escrowId), record);
    return record;
  }

  async addDisputeEvidence(input: AddDisputeEvidenceInput): Promise<DisputeCaseRecord> {
    const existing = await this.getDisputeCase(input.network, input.escrowId);
    if (!existing) {
      throw new Error(`Dispute case not found for escrow ${input.escrowId}`);
    }
    const updated = appendDisputeEvidence(existing, input);
    this.disputeCases.set(caseKey(input.network, input.escrowId), updated);
    return updated;
  }

  async getDisputeCase(network: IndexedEscrowNetwork, escrowId: string): Promise<DisputeCaseRecord | null> {
    return this.disputeCases.get(caseKey(network, escrowId)) ?? null;
  }

  async saveArbitratorDecision(input: SaveArbitratorDecisionInput): Promise<DisputeCaseRecord> {
    const existing = await this.getDisputeCase(input.network, input.escrowId);
    if (!existing) {
      throw new Error(`Dispute case not found for escrow ${input.escrowId}`);
    }
    const updated = applyArbitratorDecision(existing, input);
    this.disputeCases.set(caseKey(input.network, input.escrowId), updated);
    return updated;
  }
}
