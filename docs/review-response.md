# CKBuilder Project Review Response

This response is prepared for [CKBuilder project issue #26](https://github.com/Nervos-Community-Catalyst/CKBuilder-projects/issues/26).

Thank you for the detailed review. The two reported security issues have been addressed, and the additional public-testnet safeguards have been implemented. Mainnet remains disabled while real-wallet acceptance and independent review are pending.

## Terminal Payout Validation

Resolved in contract commit `bbace18` (`fix: validate terminal settlement net payouts`).

The escrow script now validates the recipient's net capacity gain:

```text
recipient output capacity - recipient input capacity >= escrow amount
```

This prevents a recipient-owned input from satisfying the apparent payout while escrow capacity is redirected elsewhere. Regression tests cover the bypass, valid complete/cancel/refund/resolution settlements, and recipient fee inputs that still preserve the required net gain.

The reproducible contract build and checksums were refreshed in `d5cfee1`. The current testnet deployment is:

- Code hash: `0xfecca11f654402d119c2f2a88e33f86601715c7201d231c364b4960b63d74455`
- Hash type: `data2`
- CellDep transaction: `0x7b3704ef45b6619e94fefb4cdd405828b0f7343ffcea379d10f90fa7cac768ff`
- CellDep index: `0`
- Deployment block: `22272848`

## Dispute API Authorization

Resolved across the frontend/backend packages in `6205853` and strengthened by `4326b03`.

- Dispute metadata writes require a short-lived, single-use nonce.
- The participant signs the bound message with the connected wallet.
- The server verifies the signature, network address, derived lock script, stored participant role, nonce expiry, and atomic nonce consumption.
- Dispute and resolution transaction hashes must be committed on chain and must consume the expected escrow outpoint with the expected action.
- Unsupported signature families are rejected for dispute metadata instead of being accepted without identity binding.
- Production requires PostgreSQL for both nonce and escrow/indexer state. Missing or failed persistence returns `503`; it never falls back to process memory.
- Both `DATABASE_URL` and Vercel's `POSTGRES_URL` are supported as server-only variables.

## Indexer Recovery and Transaction Safety

The broader review recommendations were implemented in these commits:

- `376cf9c`: finalized checkpoints, confirmation depth, advisory locking, and scheduled sync.
- `c67b9c8`: atomic canonical snapshot replacement, deployment-block checkpoint normalization, event block hashes, and orphan reconciliation for dispute metadata.
- `06ad7d0`: pre-sign validation for live outpoints, network genesis, deployment CellDep, escrow cell contents, and recipient scripts.

During a reorganization, the scanner rebuilds chain-derived escrow state from deployment block `22272848` and replaces the snapshot and checkpoint atomically. Evidence remains available, while a dispute or decision whose transaction disappeared is marked orphaned and cannot be resolved until chain confirmation is restored.

## Verification Status

Automated contract, indexer, frontend, and production-build checks are recorded in `docs/testnet-acceptance.md`.

Still pending before public promotion:

- complete the listed buyer, seller, and arbitrator flows with three real testnet wallets
- record transaction hashes and explorer links
- observe the scheduled Postgres scanner and a recovery run in the deployed Vercel environment
- obtain an independent review of the hardening commits

Mainnet remains gated until those steps pass and there are no unresolved high-severity findings.
