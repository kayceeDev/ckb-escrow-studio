import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

import {
  appendDisputeEvidence,
  applyArbitratorDecision,
  createDisputeCaseRecord,
  isEscrowInStatus,
} from "./model.js";
import type {
  AddDisputeEvidenceInput,
  ArbitratorDecision,
  CreateDisputeCaseInput,
  DisputeCaseRecord,
  DisputeEvidenceItem,
  EscrowIndexerStorage,
  IndexedEscrowDetailQuery,
  IndexedEscrowEvent,
  IndexedEscrowListQuery,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
  IndexedOutPoint,
  IndexerStatus,
  SaveArbitratorDecisionInput,
} from "./types.js";

export const POSTGRES_SCHEMA_SQL = `
create table if not exists escrows (
  id text not null,
  network text not null,
  origin_tx_hash text not null,
  origin_index text not null,
  current_tx_hash text,
  current_index text,
  latest_tx_hash text not null,
  settlement_tx_hash text,
  state text not null,
  buyer_lock_hash text not null,
  seller_lock_hash text not null,
  arbitrator_lock_hash text not null,
  amount_shannons numeric(40, 0) not null,
  deadline_ms numeric(20, 0) not null,
  description text not null,
  data_hex text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  closed_at timestamptz,
  primary key (network, id)
);

create index if not exists escrows_buyer_history_idx on escrows (network, buyer_lock_hash, updated_at desc);
create index if not exists escrows_seller_history_idx on escrows (network, seller_lock_hash, updated_at desc);
create index if not exists escrows_arbitrator_history_idx on escrows (network, arbitrator_lock_hash, updated_at desc);
create index if not exists escrows_state_idx on escrows (network, state, updated_at desc);

create table if not exists escrow_events (
  id text not null,
  escrow_id text not null,
  network text not null,
  type text not null,
  tx_hash text not null,
  block_number numeric(40, 0),
  block_timestamp numeric(20, 0),
  from_state text,
  to_state text not null,
  action text,
  actor_role text,
  recipient_role text,
  created_at timestamptz not null,
  primary key (network, id),
  foreign key (network, escrow_id) references escrows (network, id) on delete cascade
);

create index if not exists escrow_events_escrow_idx on escrow_events (network, escrow_id, created_at asc);
create index if not exists escrow_events_tx_idx on escrow_events (network, tx_hash);

create table if not exists dispute_cases (
  id text not null,
  escrow_id text not null,
  network text not null,
  dispute_tx_hash text not null,
  opened_by_lock_hash text not null,
  requested_outcome text not null,
  reason text not null,
  status text not null,
  evidence_bundle_hash text not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  primary key (network, id)
);

create unique index if not exists dispute_cases_escrow_idx on dispute_cases (network, escrow_id);
create index if not exists dispute_cases_status_idx on dispute_cases (network, status, updated_at desc);

create table if not exists dispute_evidence (
  id text not null,
  case_id text not null,
  escrow_id text not null,
  network text not null,
  type text not null,
  label text not null,
  value text not null,
  uri text,
  mime_type text,
  size_bytes integer,
  content_hash text not null,
  submitted_by_lock_hash text not null,
  created_at timestamptz not null,
  primary key (network, id),
  foreign key (network, case_id) references dispute_cases (network, id) on delete cascade
);

create index if not exists dispute_evidence_case_idx on dispute_evidence (network, case_id, created_at asc);
create index if not exists dispute_evidence_submitter_idx on dispute_evidence (network, submitted_by_lock_hash, created_at desc);

create table if not exists arbitrator_decisions (
  id text not null,
  case_id text not null,
  escrow_id text not null,
  network text not null,
  outcome text not null,
  decision_note text not null,
  evidence_bundle_hash text not null,
  resolution_tx_hash text not null,
  decided_by_lock_hash text not null,
  created_at timestamptz not null,
  primary key (network, id),
  foreign key (network, case_id) references dispute_cases (network, id) on delete cascade
);

create unique index if not exists arbitrator_decisions_case_idx on arbitrator_decisions (network, case_id);

create table if not exists indexer_checkpoints (
  network text primary key,
  last_processed_block numeric(40, 0),
  last_processed_tx_hash text,
  updated_at timestamptz not null
);
`;

interface PostgresEscrowRow extends QueryResultRow {
  id: string;
  network: IndexedEscrowNetwork;
  origin_tx_hash: string;
  origin_index: string;
  current_tx_hash: string | null;
  current_index: string | null;
  latest_tx_hash: string;
  settlement_tx_hash: string | null;
  state: IndexedEscrowRecord["state"];
  buyer_lock_hash: string;
  seller_lock_hash: string;
  arbitrator_lock_hash: string;
  amount_shannons: string;
  deadline_ms: string;
  description: string;
  data_hex: string;
  created_at: Date | string;
  updated_at: Date | string;
  closed_at: Date | string | null;
}

interface PostgresEventRow extends QueryResultRow {
  id: string;
  escrow_id: string;
  network: IndexedEscrowNetwork;
  type: IndexedEscrowEvent["type"];
  tx_hash: string;
  block_number: string | null;
  block_timestamp: string | null;
  from_state: IndexedEscrowEvent["fromState"];
  to_state: IndexedEscrowEvent["toState"];
  action: IndexedEscrowEvent["action"];
  actor_role: IndexedEscrowEvent["actorRole"];
  recipient_role: IndexedEscrowEvent["recipientRole"];
  created_at: Date | string;
}

interface DisputeCaseRow extends QueryResultRow {
  id: string;
  escrow_id: string;
  network: IndexedEscrowNetwork;
  dispute_tx_hash: string;
  opened_by_lock_hash: string;
  requested_outcome: DisputeCaseRecord["requestedOutcome"];
  reason: string;
  status: DisputeCaseRecord["status"];
  evidence_bundle_hash: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface DisputeEvidenceRow extends QueryResultRow {
  id: string;
  case_id: string;
  escrow_id: string;
  network: IndexedEscrowNetwork;
  type: DisputeEvidenceItem["type"];
  label: string;
  value: string;
  uri: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  content_hash: string;
  submitted_by_lock_hash: string;
  created_at: Date | string;
}

interface ArbitratorDecisionRow extends QueryResultRow {
  id: string;
  case_id: string;
  escrow_id: string;
  network: IndexedEscrowNetwork;
  outcome: ArbitratorDecision["outcome"];
  decision_note: string;
  evidence_bundle_hash: string;
  resolution_tx_hash: string;
  decided_by_lock_hash: string;
  created_at: Date | string;
}

interface CheckpointRow extends QueryResultRow {
  last_processed_block: string | null;
  updated_at: Date | string;
}

function toIso(value: Date | string | null): string | null {
  if (value == null) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function outPoint(txHash: string | null, index: string | null): IndexedOutPoint | null {
  return txHash && index != null ? { txHash: txHash as `0x${string}`, index } : null;
}

function eventFromRow(row: PostgresEventRow): IndexedEscrowEvent {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    network: row.network,
    type: row.type,
    txHash: row.tx_hash as `0x${string}`,
    blockNumber: row.block_number,
    blockTimestamp: row.block_timestamp,
    fromState: row.from_state,
    toState: row.to_state,
    action: row.action,
    actorRole: row.actor_role,
    recipientRole: row.recipient_role,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function evidenceFromRow(row: DisputeEvidenceRow): DisputeEvidenceItem {
  return {
    id: row.id,
    caseId: row.case_id,
    escrowId: row.escrow_id,
    network: row.network,
    type: row.type,
    label: row.label,
    value: row.value,
    uri: row.uri,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    contentHash: row.content_hash as `0x${string}`,
    submittedByLockHash: row.submitted_by_lock_hash as `0x${string}`,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function decisionFromRow(row: ArbitratorDecisionRow | undefined): ArbitratorDecision | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    caseId: row.case_id,
    escrowId: row.escrow_id,
    network: row.network,
    outcome: row.outcome,
    decisionNote: row.decision_note,
    evidenceBundleHash: row.evidence_bundle_hash as `0x${string}`,
    resolutionTxHash: row.resolution_tx_hash as `0x${string}`,
    decidedByLockHash: row.decided_by_lock_hash as `0x${string}`,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
  };
}

function disputeCaseFromRow(
  row: DisputeCaseRow,
  evidence: DisputeEvidenceItem[],
  decision: ArbitratorDecision | null,
): DisputeCaseRecord {
  return {
    id: row.id,
    escrowId: row.escrow_id,
    network: row.network,
    disputeTxHash: row.dispute_tx_hash as `0x${string}`,
    openedByLockHash: row.opened_by_lock_hash as `0x${string}`,
    requestedOutcome: row.requested_outcome,
    reason: row.reason,
    status: row.status,
    evidenceBundleHash: row.evidence_bundle_hash as `0x${string}`,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    evidence,
    decision,
  };
}

function recordFromRow(row: PostgresEscrowRow, events: IndexedEscrowEvent[]): IndexedEscrowRecord {
  return {
    id: row.id,
    network: row.network,
    origin: { txHash: row.origin_tx_hash as `0x${string}`, index: row.origin_index },
    current: outPoint(row.current_tx_hash, row.current_index),
    latestTxHash: row.latest_tx_hash as `0x${string}`,
    settlementTxHash: row.settlement_tx_hash as `0x${string}` | null,
    state: row.state,
    buyerLockHash: row.buyer_lock_hash as `0x${string}`,
    sellerLockHash: row.seller_lock_hash as `0x${string}`,
    arbitratorLockHash: row.arbitrator_lock_hash as `0x${string}`,
    amountShannons: row.amount_shannons,
    deadlineMs: row.deadline_ms,
    description: row.description,
    dataHex: row.data_hex as `0x${string}`,
    createdAt: toIso(row.created_at) ?? new Date().toISOString(),
    updatedAt: toIso(row.updated_at) ?? new Date().toISOString(),
    closedAt: toIso(row.closed_at),
    events,
  };
}

function participantWhere(lockHash?: string | null): { sql: string; values: string[] } {
  if (!lockHash) {
    return { sql: "", values: [] };
  }

  return {
    sql: "and (buyer_lock_hash = $2 or seller_lock_hash = $2 or arbitrator_lock_hash = $2)",
    values: [lockHash.toLowerCase()],
  };
}

function statusWhere(status: IndexedEscrowListQuery["status"]): string {
  if (status === "active") {
    return "and state in ('Funded', 'Delivered', 'Disputed')";
  }
  if (status === "past") {
    return "and state in ('Completed', 'Cancelled', 'Refunded', 'Resolved')";
  }
  return "";
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

export interface PostgresEscrowIndexerStorageOptions {
  connectionString?: string;
  pool?: Pool;
  poolConfig?: PoolConfig;
  autoMigrate?: boolean;
}

export class PostgresEscrowIndexerStorage implements EscrowIndexerStorage {
  readonly pool: Pool;
  readonly storage = "postgres" as const;
  private readonly autoMigrate: boolean;
  private migrated = false;

  constructor(options: PostgresEscrowIndexerStorageOptions = {}) {
    this.pool = options.pool ?? new Pool({
      connectionString: options.connectionString,
      ...options.poolConfig,
    });
    this.autoMigrate = options.autoMigrate ?? true;
  }

  async migrate(): Promise<void> {
    await this.pool.query(POSTGRES_SCHEMA_SQL);
    this.migrated = true;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async ensureMigrated(): Promise<void> {
    if (this.migrated || !this.autoMigrate) {
      return;
    }
    await this.migrate();
  }

  async upsertEscrow(record: IndexedEscrowRecord): Promise<void> {
    await this.ensureMigrated();
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await client.query(
        `insert into escrows (
          id, network, origin_tx_hash, origin_index, current_tx_hash, current_index,
          latest_tx_hash, settlement_tx_hash, state, buyer_lock_hash, seller_lock_hash,
          arbitrator_lock_hash, amount_shannons, deadline_ms, description, data_hex,
          created_at, updated_at, closed_at
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        on conflict (network, id) do update set
          current_tx_hash = excluded.current_tx_hash,
          current_index = excluded.current_index,
          latest_tx_hash = excluded.latest_tx_hash,
          settlement_tx_hash = excluded.settlement_tx_hash,
          state = excluded.state,
          buyer_lock_hash = excluded.buyer_lock_hash,
          seller_lock_hash = excluded.seller_lock_hash,
          arbitrator_lock_hash = excluded.arbitrator_lock_hash,
          amount_shannons = excluded.amount_shannons,
          deadline_ms = excluded.deadline_ms,
          description = excluded.description,
          data_hex = excluded.data_hex,
          updated_at = excluded.updated_at,
          closed_at = excluded.closed_at`,
        [
          record.id,
          record.network,
          record.origin.txHash,
          record.origin.index,
          record.current?.txHash ?? null,
          record.current?.index ?? null,
          record.latestTxHash,
          record.settlementTxHash,
          record.state,
          record.buyerLockHash.toLowerCase(),
          record.sellerLockHash.toLowerCase(),
          record.arbitratorLockHash.toLowerCase(),
          record.amountShannons,
          record.deadlineMs,
          record.description,
          record.dataHex,
          record.createdAt,
          record.updatedAt,
          record.closedAt,
        ],
      );

      for (const event of record.events) {
        await client.query(
          `insert into escrow_events (
            id, escrow_id, network, type, tx_hash, block_number, block_timestamp,
            from_state, to_state, action, actor_role, recipient_role, created_at
          ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          on conflict (network, id) do update set
            type = excluded.type,
            tx_hash = excluded.tx_hash,
            block_number = excluded.block_number,
            block_timestamp = excluded.block_timestamp,
            from_state = excluded.from_state,
            to_state = excluded.to_state,
            action = excluded.action,
            actor_role = excluded.actor_role,
            recipient_role = excluded.recipient_role,
            created_at = excluded.created_at`,
          [
            event.id,
            event.escrowId,
            event.network,
            event.type,
            event.txHash,
            event.blockNumber,
            event.blockTimestamp,
            event.fromState,
            event.toState,
            event.action,
            event.actorRole,
            event.recipientRole,
            event.createdAt,
          ],
        );
      }

      await this.upsertCheckpoint(client, record.network, record.events.at(-1)?.blockNumber ?? null, record.latestTxHash);
      await client.query("commit");
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getEscrow(query: IndexedEscrowDetailQuery): Promise<IndexedEscrowRecord | null> {
    await this.ensureMigrated();
    const result = await this.pool.query<PostgresEscrowRow>(
      "select * from escrows where network = $1 and id = $2 limit 1",
      [query.network, query.escrowId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    return recordFromRow(row, await this.eventsFor(row.network, row.id));
  }

  async listEscrows(query: IndexedEscrowListQuery): Promise<IndexedEscrowRecord[]> {
    await this.ensureMigrated();
    const participant = participantWhere(query.lockHash);
    const values = [query.network, ...participant.values];
    const result = await this.pool.query<PostgresEscrowRow>(
      `select * from escrows
       where network = $1 ${participant.sql} ${statusWhere(query.status)}
       order by updated_at desc
       limit 250`,
      values,
    );

    return Promise.all(
      result.rows
        .filter((row) => isEscrowInStatus(row.state, query.status ?? "all"))
        .map(async (row) => recordFromRow(row, await this.eventsFor(row.network, row.id))),
    );
  }

  async getStatus(network: IndexedEscrowNetwork): Promise<IndexerStatus> {
    await this.ensureMigrated();
    const result = await this.pool.query<CheckpointRow>(
      "select last_processed_block, updated_at from indexer_checkpoints where network = $1 limit 1",
      [network],
    );
    const row = result.rows[0];

    return {
      network,
      ready: true,
      storage: "postgres",
      lastProcessedBlock: row?.last_processed_block ?? null,
      updatedAt: toIso(row?.updated_at ?? null) ?? new Date().toISOString(),
    };
  }

  async createDisputeCase(input: CreateDisputeCaseInput): Promise<DisputeCaseRecord> {
    await this.ensureMigrated();
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isBuyerOrSeller(escrow, input.openedByLockHash)) {
      throw new Error("Only the escrow buyer or seller can open a dispute case");
    }
    const record = createDisputeCaseRecord(input);
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.upsertDisputeCase(client, record);
      for (const item of record.evidence) {
        await this.upsertEvidence(client, item);
      }
      await client.query("commit");
      return record;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async addDisputeEvidence(input: AddDisputeEvidenceInput): Promise<DisputeCaseRecord> {
    await this.ensureMigrated();
    const existing = await this.getDisputeCase(input.network, input.escrowId);
    if (!existing) {
      throw new Error(`Dispute case not found for escrow ${input.escrowId}`);
    }
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isParticipant(escrow, input.submittedByLockHash)) {
      throw new Error("Only escrow participants can submit dispute evidence");
    }
    const updated = appendDisputeEvidence(existing, input);
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.upsertDisputeCase(client, updated);
      for (const item of updated.evidence) {
        await this.upsertEvidence(client, item);
      }
      await client.query("commit");
      return updated;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async getDisputeCase(network: IndexedEscrowNetwork, escrowId: string): Promise<DisputeCaseRecord | null> {
    await this.ensureMigrated();
    const result = await this.pool.query<DisputeCaseRow>(
      "select * from dispute_cases where network = $1 and escrow_id = $2 limit 1",
      [network, escrowId],
    );
    const row = result.rows[0];
    if (!row) {
      return null;
    }

    const evidence = await this.evidenceFor(row.network, row.id);
    const decision = await this.decisionFor(row.network, row.id);
    return disputeCaseFromRow(row, evidence, decision);
  }

  async saveArbitratorDecision(input: SaveArbitratorDecisionInput): Promise<DisputeCaseRecord> {
    await this.ensureMigrated();
    const existing = await this.getDisputeCase(input.network, input.escrowId);
    if (!existing) {
      throw new Error(`Dispute case not found for escrow ${input.escrowId}`);
    }
    const escrow = await this.getEscrow({ network: input.network, escrowId: input.escrowId });
    if (!escrow || !isArbitrator(escrow, input.decidedByLockHash)) {
      throw new Error("Only the escrow arbitrator can save an arbitrator decision");
    }
    const updated = applyArbitratorDecision(existing, input);
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      await this.upsertDisputeCase(client, updated);
      if (updated.decision) {
        await this.upsertDecision(client, updated.decision);
      }
      await client.query("commit");
      return updated;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  private async eventsFor(network: IndexedEscrowNetwork, escrowId: string): Promise<IndexedEscrowEvent[]> {
    const result = await this.pool.query<PostgresEventRow>(
      "select * from escrow_events where network = $1 and escrow_id = $2 order by created_at asc",
      [network, escrowId],
    );
    return result.rows.map(eventFromRow);
  }

  private async evidenceFor(network: IndexedEscrowNetwork, caseId: string): Promise<DisputeEvidenceItem[]> {
    const result = await this.pool.query<DisputeEvidenceRow>(
      "select * from dispute_evidence where network = $1 and case_id = $2 order by created_at asc",
      [network, caseId],
    );
    return result.rows.map(evidenceFromRow);
  }

  private async decisionFor(network: IndexedEscrowNetwork, caseId: string): Promise<ArbitratorDecision | null> {
    const result = await this.pool.query<ArbitratorDecisionRow>(
      "select * from arbitrator_decisions where network = $1 and case_id = $2 limit 1",
      [network, caseId],
    );
    return decisionFromRow(result.rows[0]);
  }

  private async upsertDisputeCase(client: PoolClient, record: DisputeCaseRecord): Promise<void> {
    await client.query(
      `insert into dispute_cases (
        id, escrow_id, network, dispute_tx_hash, opened_by_lock_hash, requested_outcome,
        reason, status, evidence_bundle_hash, created_at, updated_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      on conflict (network, id) do update set
        dispute_tx_hash = excluded.dispute_tx_hash,
        opened_by_lock_hash = excluded.opened_by_lock_hash,
        requested_outcome = excluded.requested_outcome,
        reason = excluded.reason,
        status = excluded.status,
        evidence_bundle_hash = excluded.evidence_bundle_hash,
        updated_at = excluded.updated_at`,
      [
        record.id,
        record.escrowId,
        record.network,
        record.disputeTxHash,
        record.openedByLockHash.toLowerCase(),
        record.requestedOutcome,
        record.reason,
        record.status,
        record.evidenceBundleHash,
        record.createdAt,
        record.updatedAt,
      ],
    );
  }

  private async upsertEvidence(client: PoolClient, item: DisputeEvidenceItem): Promise<void> {
    await client.query(
      `insert into dispute_evidence (
        id, case_id, escrow_id, network, type, label, value, uri, mime_type,
        size_bytes, content_hash, submitted_by_lock_hash, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      on conflict (network, id) do update set
        label = excluded.label,
        value = excluded.value,
        uri = excluded.uri,
        mime_type = excluded.mime_type,
        size_bytes = excluded.size_bytes,
        content_hash = excluded.content_hash,
        submitted_by_lock_hash = excluded.submitted_by_lock_hash`,
      [
        item.id,
        item.caseId,
        item.escrowId,
        item.network,
        item.type,
        item.label,
        item.value,
        item.uri,
        item.mimeType,
        item.sizeBytes,
        item.contentHash,
        item.submittedByLockHash.toLowerCase(),
        item.createdAt,
      ],
    );
  }

  private async upsertDecision(client: PoolClient, decision: ArbitratorDecision): Promise<void> {
    await client.query(
      `insert into arbitrator_decisions (
        id, case_id, escrow_id, network, outcome, decision_note, evidence_bundle_hash,
        resolution_tx_hash, decided_by_lock_hash, created_at
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      on conflict (network, id) do update set
        outcome = excluded.outcome,
        decision_note = excluded.decision_note,
        evidence_bundle_hash = excluded.evidence_bundle_hash,
        resolution_tx_hash = excluded.resolution_tx_hash,
        decided_by_lock_hash = excluded.decided_by_lock_hash`,
      [
        decision.id,
        decision.caseId,
        decision.escrowId,
        decision.network,
        decision.outcome,
        decision.decisionNote,
        decision.evidenceBundleHash,
        decision.resolutionTxHash,
        decision.decidedByLockHash.toLowerCase(),
        decision.createdAt,
      ],
    );
  }

  private async upsertCheckpoint(
    client: PoolClient,
    network: IndexedEscrowNetwork,
    blockNumber: string | null,
    txHash: string,
  ): Promise<void> {
    await client.query(
      `insert into indexer_checkpoints (network, last_processed_block, last_processed_tx_hash, updated_at)
       values ($1, $2, $3, now())
       on conflict (network) do update set
         last_processed_block = coalesce(excluded.last_processed_block, indexer_checkpoints.last_processed_block),
         last_processed_tx_hash = excluded.last_processed_tx_hash,
         updated_at = excluded.updated_at`,
      [network, blockNumber, txHash],
    );
  }
}
