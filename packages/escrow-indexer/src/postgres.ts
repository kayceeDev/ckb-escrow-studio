import { Pool, type PoolClient, type PoolConfig, type QueryResultRow } from "pg";

import { isEscrowInStatus } from "./model.js";
import type {
  EscrowIndexerStorage,
  IndexedEscrowDetailQuery,
  IndexedEscrowEvent,
  IndexedEscrowListQuery,
  IndexedEscrowNetwork,
  IndexedEscrowRecord,
  IndexedOutPoint,
  IndexerStatus,
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

  private async eventsFor(network: IndexedEscrowNetwork, escrowId: string): Promise<IndexedEscrowEvent[]> {
    const result = await this.pool.query<PostgresEventRow>(
      "select * from escrow_events where network = $1 and escrow_id = $2 order by created_at asc",
      [network, escrowId],
    );
    return result.rows.map(eventFromRow);
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
