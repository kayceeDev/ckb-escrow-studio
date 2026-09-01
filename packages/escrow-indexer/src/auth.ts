import { createHash } from "node:crypto";
import { Pool, type PoolConfig, type QueryResultRow } from "pg";

import type { IndexedEscrowNetwork } from "./types.js";

export type DisputeAuthAction = "create" | "addEvidence" | "decision";

export interface DisputeAuthNonceRecord {
  nonce: string;
  network: IndexedEscrowNetwork;
  escrowId: string;
  action: DisputeAuthAction;
  lockHash: `0x${string}`;
  expiresAt: string;
  createdAt: string;
  consumedAt: string | null;
}

export interface DisputeAuthNonceStore {
  issue(record: DisputeAuthNonceRecord): Promise<void>;
  get(nonce: string): Promise<DisputeAuthNonceRecord | null>;
  consume(nonce: string): Promise<boolean>;
}

export const DISPUTE_AUTH_SCHEMA_SQL = `
create table if not exists dispute_auth_nonces (
  nonce_hash text primary key,
  network text not null,
  escrow_id text not null,
  action text not null,
  lock_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null,
  consumed_at timestamptz
);
create index if not exists dispute_auth_nonces_expiry_idx on dispute_auth_nonces (expires_at);
create index if not exists dispute_auth_nonces_scope_idx on dispute_auth_nonces (network, escrow_id, lock_hash);
`;

function nonceHash(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex");
}

export class MemoryDisputeAuthNonceStore implements DisputeAuthNonceStore {
  private readonly records = new Map<string, DisputeAuthNonceRecord>();

  async issue(record: DisputeAuthNonceRecord): Promise<void> {
    this.records.set(nonceHash(record.nonce), { ...record });
  }

  async get(nonce: string): Promise<DisputeAuthNonceRecord | null> {
    return this.records.get(nonceHash(nonce)) ?? null;
  }

  async consume(nonce: string): Promise<boolean> {
    const key = nonceHash(nonce);
    const record = this.records.get(key);
    if (!record || record.consumedAt || Date.parse(record.expiresAt) <= Date.now()) {
      return false;
    }
    this.records.set(key, { ...record, consumedAt: new Date().toISOString() });
    return true;
  }

  clear(): void {
    this.records.clear();
  }
}

interface NonceRow extends QueryResultRow {
  network: IndexedEscrowNetwork;
  escrow_id: string;
  action: DisputeAuthAction;
  lock_hash: `0x${string}`;
  expires_at: Date | string;
  created_at: Date | string;
  consumed_at: Date | string | null;
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export interface PostgresDisputeAuthNonceStoreOptions {
  connectionString?: string;
  pool?: Pool;
  poolConfig?: PoolConfig;
}

export class PostgresDisputeAuthNonceStore implements DisputeAuthNonceStore {
  private readonly pool: Pool;
  private migrated = false;

  constructor(options: PostgresDisputeAuthNonceStoreOptions = {}) {
    this.pool = options.pool ?? new Pool({ connectionString: options.connectionString, ...options.poolConfig });
  }

  private async migrate(): Promise<void> {
    if (this.migrated) return;
    await this.pool.query(DISPUTE_AUTH_SCHEMA_SQL);
    this.migrated = true;
  }

  async issue(record: DisputeAuthNonceRecord): Promise<void> {
    await this.migrate();
    await this.pool.query("delete from dispute_auth_nonces where expires_at <= now() or consumed_at < now() - interval '1 day'");
    await this.pool.query(
      `insert into dispute_auth_nonces
       (nonce_hash, network, escrow_id, action, lock_hash, expires_at, created_at, consumed_at)
       values ($1, $2, $3, $4, $5, $6, $7, null)`,
      [nonceHash(record.nonce), record.network, record.escrowId, record.action, record.lockHash, record.expiresAt, record.createdAt],
    );
  }

  async get(nonce: string): Promise<DisputeAuthNonceRecord | null> {
    await this.migrate();
    const result = await this.pool.query<NonceRow>(
      `select network, escrow_id, action, lock_hash, expires_at, created_at, consumed_at
       from dispute_auth_nonces where nonce_hash = $1 limit 1`,
      [nonceHash(nonce)],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      nonce,
      network: row.network,
      escrowId: row.escrow_id,
      action: row.action,
      lockHash: row.lock_hash.toLowerCase() as `0x${string}`,
      expiresAt: iso(row.expires_at),
      createdAt: iso(row.created_at),
      consumedAt: row.consumed_at ? iso(row.consumed_at) : null,
    };
  }

  async consume(nonce: string): Promise<boolean> {
    await this.migrate();
    const result = await this.pool.query(
      `update dispute_auth_nonces set consumed_at = now()
       where nonce_hash = $1 and consumed_at is null and expires_at > now()
       returning nonce_hash`,
      [nonceHash(nonce)],
    );
    return (result.rowCount ?? 0) === 1;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}
