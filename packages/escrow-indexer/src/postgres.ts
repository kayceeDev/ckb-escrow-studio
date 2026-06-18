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
  id text primary key,
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
