# CKB Escrow Frontend

A standalone escrow product for known buyers, sellers, and arbitrators on CKB.

This repository contains the product frontend, wallet integration, transaction service layer, and indexer-backed history API used by the CKB escrow contract repository.

## What This App Does

The app is not a marketplace. It is a wallet-first escrow workflow for known parties:

1. Buyer connects a wallet.
2. Buyer creates and funds an escrow for a known seller.
3. Seller marks the escrow delivered.
4. Buyer releases funds, disputes, cancels, or refunds when allowed.
5. Arbitrator reviews disputed escrows and resolves to buyer or seller.

The product hides most protocol details from normal users. Studio remains available for deployment/debug workflows.

## Repository Structure

```text
packages/
  frontend/       Next.js product app and API routes
  escrow-sdk/     Protocol types, data encoding, state/action helpers
  ccc-adapter/    CCC transaction adapter layer
  escrow-app/     Application-facing escrow service facade
  escrow-indexer/ Escrow history model, scanner, memory/Postgres storage
```

## Main Routes

```text
/                 Product home/dashboard
/escrows          Wallet escrow ledger
/escrows/create   Buyer create flow
/escrows/[id]     Escrow deal room or read-only receipt
/studio           Admin/debug/protocol tooling
```

API routes:

```text
/api/escrows
/api/escrows/[id]
/api/escrows/[id]/dispute
/api/indexer/status
```

## Requirements

- Node.js 22+
- npm
- A CKB-compatible wallet discoverable through CCC, such as JoyID/OKX depending on your browser setup
- Hosted Postgres for production history, recommended: Neon through Vercel Marketplace

## Local Setup

Install dependencies from the repository root:

```bash
npm install
```

Run the frontend locally:

```bash
npm run dev --workspace @ckb-escrow/frontend
```

Run checks:

```bash
npm run typecheck
npm run test
npm run build
```

Frontend-only checks:

```bash
npm run typecheck --workspace @ckb-escrow/frontend
npm run test --workspace @ckb-escrow/frontend
npm run build --workspace @ckb-escrow/frontend
```

## Environment Variables

Public contract metadata is safe to expose because it points to deployed on-chain scripts.

Testnet defaults are currently hardcoded, but production deployments should still set them explicitly:

```bash
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_CODE_HASH=0x9a477688b4767d9cdbd0f526c25a9265171b63cdc72487452cd22fa92a255a8f
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_HASH_TYPE=data2
NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_ARGS=0x
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_TX_HASH=0x6a1bdcfd076a04bceb14cad8069952a04f17e57091d1ac27b32304127c3ffe28
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_INDEX=0
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_CODE_HASH=0x9a477688b4767d9cdbd0f526c25a9265171b63cdc72487452cd22fa92a255a8f
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_HASH_TYPE=data2
NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_ARGS=0x
NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEFAULT_ARBITRATOR=ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq93scsruacxnredg6waz09a7gj2urcs57uvdsqw3
```

Mainnet should remain empty until the contract is actually deployed on mainnet:

```bash
NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_CODE_HASH=
NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_HASH_TYPE=type
NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_ARGS=0x
NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEP_TX_HASH=
NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEP_INDEX=0
NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_CODE_HASH=
NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_HASH_TYPE=type
NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_ARGS=0x
NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEFAULT_ARBITRATOR=
```

Server-only variables:

```bash
DATABASE_URL=postgres://user:password@host/db?sslmode=require
CKB_ESCROW_INDEXER_SCAN_LIMIT=100
```

Do not prefix `DATABASE_URL` with `NEXT_PUBLIC_`. It contains credentials and must remain server-side.

## Vercel Deployment

Use the repo root as the Vercel root because the frontend depends on sibling workspace packages.

Recommended Vercel settings:

```text
Framework Preset: Next.js
Root Directory: ./
Install Command: npm install
Build Command: npm run build
Output Directory: packages/frontend/.next
```

The development command can stay default. If Vercel asks for one, use:

```bash
npm run dev --workspace @ckb-escrow/frontend
```

Production does not run `dev`; Vercel builds with `npm run build` and serves the generated Next.js output.

## Database / Indexer

The product recovers escrow history through an indexer-backed API. This is necessary because terminal escrows can be consumed on chain and will no longer appear as live cells.

For production, use hosted Postgres. Neon via Vercel Marketplace is the easiest option.

Local Docker URLs such as this will not work on Vercel:

```bash
postgres://root:secret@postgres:3356/escrow-db?sslmode=disable
```

Use the hosted provider connection string instead.

## Wallet and Network Notes

- Testnet uses `ckt1...` addresses.
- Mainnet uses `ckb1...` addresses.
- The connected wallet decides whether the viewer is buyer, seller, arbitrator, or read-only viewer.
- Product history shows participant escrows by connected wallet lock hash.
- Studio can still be used for broader debugging and deployment setup.

## Current Limitations

- The indexer currently syncs through API-triggered scanning, suitable for MVP/testnet but not ideal as a permanent production worker.
- Evidence is stored off-chain with hashes/metadata. The contract does not validate evidence content.
- Mainnet is gated until real mainnet contract metadata and arbitrator configuration are provided.
- Split payouts are out of scope for the current contract.

## Recommended Next Steps

- Deploy with testnet env vars and Neon Postgres.
- Run buyer, seller, and arbitrator testnet flows end to end.
- Move indexer scanning into a scheduled worker for production use.
- Add stronger monitoring around API/indexer failures.
