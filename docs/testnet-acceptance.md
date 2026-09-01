# CKB Escrow Public Testnet Acceptance

## Deployment Under Test

- Network: CKB testnet
- Code hash: `0xfecca11f654402d119c2f2a88e33f86601715c7201d231c364b4960b63d74455`
- Hash type: `data2`
- CellDep transaction: `0x7b3704ef45b6619e94fefb4cdd405828b0f7343ffcea379d10f90fa7cac768ff`
- CellDep index: `0`
- Deployment block: `22272848`

The reproduced contract binary hash matches the deployed output data hash.

## Automated Verification

Completed on 2026-09-01:

- [x] Frontend monorepo typecheck
- [x] Frontend monorepo tests: 99 tests passed
- [x] Next.js production build
- [x] Contract unit tests: 26 passed
- [x] CKB-VM integration tests: 7 passed
- [x] Reproducible Docker build
- [x] Release binary checksum
- [x] Debug binary checksum
- [x] Terminal payout bypass regression
- [x] Persistent atomic dispute nonce tests
- [x] Canonical checkpoint and reorganization detection tests
- [x] Pre-sign network, CellDep, and live escrow tests

## Environment Gate

Before testing the deployed frontend, configure:

```bash
DATABASE_URL=postgres://...
CRON_SECRET=...
CKB_ESCROW_TESTNET_DEPLOYMENT_BLOCK=22272848
CKB_ESCROW_INDEXER_CONFIRMATIONS=12
CKB_ESCROW_INDEXER_PAGE_SIZE=100
```

Trigger `/api/cron/indexer` with `Authorization: Bearer $CRON_SECRET` once after deployment and confirm a successful testnet sync.

## Real-Wallet Acceptance

Record the transaction hash, wallet type, result, and explorer link for each flow.

| Flow | Buyer wallet | Seller wallet | Arbitrator wallet | Transaction hashes | Result |
| --- | --- | --- | --- | --- | --- |
| Create, deliver, complete | Pending | Pending | Pending | Pending | Pending |
| Create and cancel | Pending | N/A | Pending | Pending | Pending |
| Create and refund after deadline | Pending | Pending | Pending | Pending | Pending |
| Deliver, dispute, resolve to buyer | Pending | Pending | Pending | Pending | Pending |
| Deliver, dispute, resolve to seller | Pending | Pending | Pending | Pending | Pending |

Additional checks:

- [ ] Buyer reconnects in a fresh browser and sees active/history records
- [ ] Seller reconnects in a fresh browser and sees active/history records
- [ ] Arbitrator reconnects and sees assigned disputes
- [ ] Evidence authorization works with a supported CKB, EVM, or BTC signer
- [ ] Unsupported signers receive a clear evidence-authentication message
- [ ] Terminal receipts survive cleared browser storage
- [ ] Explorer links match submitted transactions
- [ ] Daily cron reports healthy PostgreSQL storage
- [ ] A simulated checkpoint hash mismatch triggers a successful rebuild

## Release Decision

Public testnet promotion requires every real-wallet row and additional check above to pass. Mainnet remains disabled until:

- real-wallet acceptance is complete
- indexer recovery has been observed in the deployed environment
- the security-hardening commits receive independent review
- no unresolved high-severity findings remain
