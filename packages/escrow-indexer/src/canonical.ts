import { Pool, type PoolConfig } from "pg";
import type * as ccc from "@ckb-ccc/ccc";

import { MemoryEscrowIndexerStorage } from "./memory.js";
import { scanEscrowHistory, type EscrowScannerClient, type EscrowScannerDeployment } from "./scanner.js";
import type { EscrowIndexerStorage, IndexedEscrowNetwork } from "./types.js";

export interface CanonicalCheckpoint {
  blockNumber: string;
  blockHash: `0x${string}`;
  lastSuccessAt: string | null;
  lastError: string | null;
  rebuildCount: number;
}

export interface IndexerCoordinator {
  withLock<T>(network: IndexedEscrowNetwork, task: () => Promise<T>): Promise<{ acquired: boolean; result?: T }>;
  getCheckpoint(network: IndexedEscrowNetwork): Promise<CanonicalCheckpoint | null>;
  saveCheckpoint(network: IndexedEscrowNetwork, checkpoint: CanonicalCheckpoint): Promise<void>;
  saveError(network: IndexedEscrowNetwork, message: string): Promise<void>;
}

export const CANONICAL_INDEXER_SCHEMA_SQL = `
alter table indexer_checkpoints add column if not exists last_processed_block_hash text;
alter table indexer_checkpoints add column if not exists last_success_at timestamptz;
alter table indexer_checkpoints add column if not exists last_error text;
alter table indexer_checkpoints add column if not exists rebuild_count integer not null default 0;
`;

export class MemoryIndexerCoordinator implements IndexerCoordinator {
  private readonly checkpoints = new Map<IndexedEscrowNetwork, CanonicalCheckpoint>();
  private readonly locks = new Set<IndexedEscrowNetwork>();
  async withLock<T>(network: IndexedEscrowNetwork, task: () => Promise<T>) {
    if (this.locks.has(network)) return { acquired: false };
    this.locks.add(network);
    try { return { acquired: true, result: await task() }; } finally { this.locks.delete(network); }
  }
  async getCheckpoint(network: IndexedEscrowNetwork) { return this.checkpoints.get(network) ?? null; }
  async saveCheckpoint(network: IndexedEscrowNetwork, checkpoint: CanonicalCheckpoint) { this.checkpoints.set(network, checkpoint); }
  async saveError(network: IndexedEscrowNetwork, message: string) {
    const current = this.checkpoints.get(network);
    if (current) this.checkpoints.set(network, { ...current, lastError: message });
  }
}

export interface PostgresIndexerCoordinatorOptions {
  connectionString?: string;
  pool?: Pool;
  poolConfig?: PoolConfig;
}

export class PostgresIndexerCoordinator implements IndexerCoordinator {
  private readonly pool: Pool;
  private migrated = false;
  constructor(options: PostgresIndexerCoordinatorOptions = {}) {
    this.pool = options.pool ?? new Pool({ connectionString: options.connectionString, ...options.poolConfig });
  }
  private async migrate() {
    if (this.migrated) return;
    await this.pool.query(CANONICAL_INDEXER_SCHEMA_SQL);
    this.migrated = true;
  }
  async withLock<T>(network: IndexedEscrowNetwork, task: () => Promise<T>) {
    await this.migrate();
    const client = await this.pool.connect();
    const key = `ckb-escrow-indexer:${network}`;
    try {
      const lock = await client.query<{ acquired: boolean }>("select pg_try_advisory_lock(hashtext($1)) as acquired", [key]);
      if (!lock.rows[0]?.acquired) return { acquired: false };
      try { return { acquired: true, result: await task() }; }
      finally { await client.query("select pg_advisory_unlock(hashtext($1))", [key]); }
    } finally { client.release(); }
  }
  async getCheckpoint(network: IndexedEscrowNetwork): Promise<CanonicalCheckpoint | null> {
    await this.migrate();
    const result = await this.pool.query(
      `select last_processed_block, last_processed_block_hash, last_success_at, last_error, rebuild_count
       from indexer_checkpoints where network = $1`, [network]);
    const row = result.rows[0];
    if (!row?.last_processed_block || !row.last_processed_block_hash) return null;
    return { blockNumber: String(row.last_processed_block), blockHash: row.last_processed_block_hash, lastSuccessAt: row.last_success_at?.toISOString?.() ?? row.last_success_at ?? null, lastError: row.last_error ?? null, rebuildCount: Number(row.rebuild_count ?? 0) };
  }
  async saveCheckpoint(network: IndexedEscrowNetwork, checkpoint: CanonicalCheckpoint) {
    await this.migrate();
    await this.pool.query(
      `insert into indexer_checkpoints (network, last_processed_block, last_processed_block_hash, last_success_at, last_error, rebuild_count, updated_at)
       values ($1, $2, $3, now(), null, $4, now())
       on conflict (network) do update set last_processed_block = excluded.last_processed_block,
       last_processed_block_hash = excluded.last_processed_block_hash, last_success_at = now(), last_error = null,
       rebuild_count = excluded.rebuild_count, updated_at = now()`,
      [network, checkpoint.blockNumber, checkpoint.blockHash, checkpoint.rebuildCount]);
  }
  async saveError(network: IndexedEscrowNetwork, message: string) {
    await this.migrate();
    await this.pool.query("update indexer_checkpoints set last_error = $2, updated_at = now() where network = $1", [network, message]);
  }
}

export type CanonicalScannerClient = EscrowScannerClient & Pick<ccc.Client, "getTip" | "getHeaderByNumberNoCache">;

export async function syncCanonicalEscrowHistory(input: {
  network: IndexedEscrowNetwork;
  client: CanonicalScannerClient;
  deployment: EscrowScannerDeployment;
  storage: EscrowIndexerStorage;
  coordinator: IndexerCoordinator;
  deploymentBlock: bigint;
  confirmations: bigint;
  pageSize?: number;
}): Promise<{ acquired: boolean; rebuilt: boolean; finalizedBlock: string | null }> {
  let rebuilt = false;
  let finalizedBlock: string | null = null;
  const locked = await input.coordinator.withLock(input.network, async () => {
    try {
      const tip = BigInt(input.client.getTip ? await input.client.getTip() : 0);
      if (tip < input.confirmations) return;
      const finalized = tip - input.confirmations;
      if (finalized < input.deploymentBlock) return;
      const finalizedHeader = await input.client.getHeaderByNumberNoCache(finalized);
      if (!finalizedHeader) throw new Error(`Finalized block ${finalized} was not found`);
      finalizedBlock = finalized.toString();

      let checkpoint = await input.coordinator.getCheckpoint(input.network);
      let invalidCheckpoint = checkpoint == null;
      if (checkpoint) {
        const checkpointBlock = BigInt(checkpoint.blockNumber);
        const canonical = checkpointBlock < input.deploymentBlock
          ? null
          : await input.client.getHeaderByNumberNoCache(checkpointBlock);
        invalidCheckpoint = !canonical || canonical.hash.toLowerCase() !== checkpoint.blockHash.toLowerCase();
      }

      if (invalidCheckpoint) {
        if (!input.storage.replaceCanonicalSnapshot) {
          throw new Error("Indexer storage does not support atomic canonical snapshot replacement");
        }
        const staging = new MemoryEscrowIndexerStorage();
        await scanEscrowHistory({
          network: input.network,
          client: input.client,
          deployment: input.deployment,
          storage: staging,
          limit: input.pageSize ?? 100,
          minimumBlock: input.deploymentBlock,
          maximumBlock: finalized,
        });
        const records = await staging.listEscrows({ network: input.network, status: "all" });
        const nextCheckpoint = {
          blockNumber: finalized.toString(),
          blockHash: finalizedHeader.hash,
          lastSuccessAt: new Date().toISOString(),
          lastError: null,
          rebuildCount: (checkpoint?.rebuildCount ?? 0) + 1,
        } satisfies CanonicalCheckpoint;
        await input.storage.replaceCanonicalSnapshot(input.network, records, nextCheckpoint);
        await input.coordinator.saveCheckpoint(input.network, nextCheckpoint);
        rebuilt = true;
        return;
      }

      const minimumBlock = checkpoint
        ? (BigInt(checkpoint.blockNumber) + 1n > input.deploymentBlock
            ? BigInt(checkpoint.blockNumber) + 1n
            : input.deploymentBlock)
        : input.deploymentBlock;
      if (minimumBlock <= finalized) {
        await scanEscrowHistory({ network: input.network, client: input.client, deployment: input.deployment, storage: input.storage, limit: input.pageSize ?? 100, minimumBlock, maximumBlock: finalized });
      }
      const rebuildCount = checkpoint?.rebuildCount ?? 0;
      await input.coordinator.saveCheckpoint(input.network, { blockNumber: finalized.toString(), blockHash: finalizedHeader.hash, lastSuccessAt: new Date().toISOString(), lastError: null, rebuildCount });
    } catch (error) {
      await input.coordinator.saveError(input.network, error instanceof Error ? error.message : String(error));
      throw error;
    }
  });
  return { acquired: locked.acquired, rebuilt, finalizedBlock };
}
