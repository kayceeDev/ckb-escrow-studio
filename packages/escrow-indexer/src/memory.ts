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

function normalizeLockHash(value: string): string {
  return value.toLowerCase();
}

function isBuyerOrSeller(record: IndexedEscrowRecord, lockHash: string): boolean {
  const normalized = normalizeLockHash(lockHash);
  return record.buyerLockHash.toLowerCase() === normalized || record.sellerLockHash.toLowerCase() === normalized;
}

function isParticipant(record: IndexedEscrowRecord, lockHash: string): boolean {
  const normalized = normalizeLockHash(lockHash);
  return (
    record.buyerLockHash.toLowerCase() === normalized ||
    record.sellerLockHash.toLowerCase() === normalized ||
    record.arbitratorLockHash.toLowerCase() === normalized
  );
}

function isArbitrator(record: IndexedEscrowRecord, lockHash: string): boolean {
  return record.arbitratorLockHash.toLowerCase() === normalizeLockHash(lockHash);
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
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isBuyerOrSeller(escrow, input.openedByLockHash)) {
      throw new Error("Only the escrow buyer or seller can open a dispute case");
    }
    const record = createDisputeCaseRecord(input);
    this.disputeCases.set(caseKey(input.network, input.escrowId), record);
    return record;
  }

  async addDisputeEvidence(input: AddDisputeEvidenceInput): Promise<DisputeCaseRecord> {
    const existing = await this.getDisputeCase(input.network, input.escrowId);
    if (!existing) {
      throw new Error(`Dispute case not found for escrow ${input.escrowId}`);
    }
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isParticipant(escrow, input.submittedByLockHash)) {
      throw new Error("Only escrow participants can submit dispute evidence");
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
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isArbitrator(escrow, input.decidedByLockHash)) {
      throw new Error("Only the escrow arbitrator can save an arbitrator decision");
    }
    const updated = applyArbitratorDecision(existing, input);
    this.disputeCases.set(caseKey(input.network, input.escrowId), updated);
    return updated;
  }
}
