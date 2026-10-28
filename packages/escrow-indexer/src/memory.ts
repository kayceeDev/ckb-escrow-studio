import {
  appendDisputeEvidence,
  applyArbitratorDecision,
  createDisputeCaseRecord,
  isEscrowInStatus,
} from "./model.js";
import type {
  AddDisputeEvidenceInput,
  CanonicalSnapshotCheckpoint,
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
  private readonly checkpoints = new Map<IndexedEscrowNetwork, CanonicalSnapshotCheckpoint>();

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
    const checkpoint = this.checkpoints.get(network);
    return {
      network,
      ready: true,
      storage: "memory",
      lastProcessedBlock: checkpoint?.blockNumber ?? null,
      lastProcessedBlockHash: checkpoint?.blockHash ?? null,
      lastSuccessAt: null,
      lastError: null,
      rebuildCount: checkpoint?.rebuildCount ?? 0,
      updatedAt: new Date().toISOString(),
    };
  }

  async replaceCanonicalSnapshot(
    network: IndexedEscrowNetwork,
    records: IndexedEscrowRecord[],
    checkpoint: CanonicalSnapshotCheckpoint,
  ): Promise<void> {
    for (const key of Array.from(this.records.keys())) {
      if (key.startsWith(`${network}:`)) this.records.delete(key);
    }
    for (const record of records) {
      this.records.set(`${record.network}:${record.id}`, record);
    }
    this.checkpoints.set(network, checkpoint);

    const events = records.flatMap((record) => record.events);
    for (const [key, disputeCase] of this.disputeCases) {
      if (disputeCase.network !== network) continue;
      const disputeConfirmed = events.some(
        (event) => event.txHash.toLowerCase() === disputeCase.disputeTxHash.toLowerCase() && event.action === "Dispute",
      );
      const decisionConfirmed = disputeCase.decision
        ? events.some(
            (event) =>
              event.txHash.toLowerCase() === disputeCase.decision?.resolutionTxHash.toLowerCase() &&
              event.action === (disputeCase.decision.outcome === "buyer" ? "ResolveToBuyer" : "ResolveToSeller"),
          )
        : false;
      const orphanedAt = new Date().toISOString();
      this.disputeCases.set(key, {
        ...disputeCase,
        status: disputeConfirmed && decisionConfirmed ? "resolved" : "open",
        chainStatus: disputeConfirmed ? "confirmed" : "orphaned",
        orphanedAt: disputeConfirmed ? null : disputeCase.orphanedAt ?? orphanedAt,
        decision: disputeCase.decision
          ? {
              ...disputeCase.decision,
              chainStatus: decisionConfirmed ? "confirmed" : "orphaned",
              orphanedAt: decisionConfirmed ? null : disputeCase.decision.orphanedAt ?? orphanedAt,
            }
          : null,
      });
    }
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
