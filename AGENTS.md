# CKB Escrow Frontend - Agent Guide

## Project Context

This repository contains the frontend and TypeScript application layer for CKB Escrow, a decentralized escrow app for goods and services on Nervos CKB.

The contract repository lives separately at:

```text
/home/bodo/work/ckb/ckb-escrow
```

Keep this frontend repo separate from the contract repo. Do not couple the UI package into the Rust contract workspace.

## Product We Are Building

The product is a standalone escrow app for known buyer, seller, and arbitrator parties.

It is not:

- a marketplace
- a storefront
- a product catalog
- a listings platform
- a reputation/reviews platform

Primary v1 journey:

1. buyer opens the app
2. buyer connects wallet
3. buyer creates and funds escrow for a known seller
4. seller connects wallet and marks delivered
5. buyer releases funds or disputes
6. arbitrator resolves if disputed

Wallet connection is registration in v1. Do not add email/password auth unless the product direction changes.

## Repository Responsibilities

This repo is responsible for:

- Next.js product UI
- wallet connection through CCC
- testnet/mainnet network selection
- escrow discovery by connected wallet role
- transaction building through app/SDK layers
- product-facing escrow flows
- `/studio` admin/protocol console
- polished Tailwind/shadcn-style UI

The Rust contract repo remains the source of truth for state transitions and validation.

## Package Structure

Expected layering:

```text
packages/escrow-sdk       # protocol types, serialization, escrow helpers
packages/ccc-adapter      # CCC wallet/client integration
packages/escrow-app       # app services, view models, workflows
packages/frontend         # Next.js UI app
```

Keep chain/protocol logic out of page components. Use SDK, adapter, and app-service layers instead.

## Routes

Expected product routes:

```text
/                       # landing/dashboard entry
/escrows/create         # buyer create flow
/escrows/[id]           # escrow detail and actions
/studio                 # admin/protocol/debug console
```

The default route should feel like a real escrow product, not an admin dashboard.

`/studio` must remain available, but it is secondary. It is for deployment profiles, escrow discovery, raw operation controls, transaction preview, and debugging.

## Wallet and Role Rules

The app should identify the connected wallet by CKB lock hash and full lock script where needed.

Roles:

- buyer
- seller
- arbitrator
- viewer

Role-aware behavior:

- buyer can create, release, dispute, cancel, or refund when valid
- seller can see relevant escrows and mark delivered when valid
- arbitrator can see disputes assigned to them and resolve when valid
- unrelated viewers can inspect public state but cannot perform actions

When a wallet connects or changes, fetch or filter escrows where the wallet is buyer, seller, or arbitrator.

Lock hash is useful for identity. Full lock script may be required for settlement outputs.

## Network Rules

Support testnet and mainnet structurally, but do not pretend a network is ready without a deployment profile.

Network selection must affect:

- CCC network
- address prefix
- RPC URL
- indexer URL
- deployment profile
- script deps

Testnet is the default development and demo path.

Mainnet must only be treated as operational when real mainnet deployment data exists.

## UI and UX Standards

Use Tailwind and shadcn-style primitives.

The UI should be polished, responsive, and customer-friendly.

Required UX qualities:

- strong landing page
- beautiful navbar with wallet connect visible at the top
- clean mobile hamburger navigation
- clear dashboard cards
- intuitive create escrow flow
- readable escrow detail timeline
- contextual action buttons
- helpful empty states
- obvious testnet/mainnet indicator
- studio that works without breaking the product experience

If Tailwind is not loading, fix the Tailwind/PostCSS/Next pipeline first. Do not patch around it with scattered inline styles.

Avoid generic-looking UI. The app should feel trustworthy, calm, and modern, with a green/white escrow-finance direction unless a stronger design direction is chosen.

### Technical Detail

Use popular libraries where they clearly reduce complexity, but keep the UI as simple as possible. Prefer elegant Tailwind and shadcn-style primitives over dependency-heavy abstractions unless the feature genuinely needs them.

Frontend defaults:

- use Tailwind for layout, spacing, color, responsiveness, and state styling
- use shadcn-style local primitives for buttons, cards, badges, forms, tables, and tabs
- avoid adding Radix/TanStack-style dependencies for simple tabs or history tables unless scale demands it
- keep active and past participant escrows clearly separated
- show cancelled, delivered, completed, refunded, and resolved participant escrows in wallet escrow history
- use active/past tabs on `/escrows` or a similarly clear pattern
- hide view-only escrows from the primary product escrow page by default
- keep view-only/public discovery in `/studio` unless product direction changes

## Contract Alignment

Never add a frontend action unless the contract and SDK support it.

When changing a flow, verify alignment with:

- contract state machine
- SDK action type
- transaction builder
- role detection
- CTA visibility
- studio controls
- tests

If a desired UI action is not yet supported by the contract, show it as unavailable or route to studio/debug context rather than pretending it works.

## Commands

Use the project Node version when available:

```bash
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run dev --workspace @ckb-escrow/frontend
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run typecheck --workspace @ckb-escrow/frontend
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run build --workspace @ckb-escrow/frontend
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run test --workspace @ckb-escrow/frontend
```

When touching shared packages, run relevant package checks too:

```bash
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run build --workspace @ckb-escrow/ccc-adapter
PATH=/home/ghost/.nvm/versions/node/v22.22.2/bin:$PATH npm run build --workspace @ckb-escrow/app
```

If the runtime path is mounted under `/home/bodo`, adapt only the filesystem path. Do not change documented user-facing repo paths unnecessarily.

## Testing Expectations

Frontend changes should include or preserve checks for:

- dashboard rendering seeded escrow cards
- create form using platform arbitrator by default
- custom arbitrator override toggle
- detail page CTA visibility by role and state
- `/studio` route rendering without runtime errors
- wallet/network state handling

At minimum, run typecheck and build after meaningful UI or integration changes.

## Agent Operating Rules

Read before changing. Do not rewrite the app blindly.

Keep the user learning. Explain what changed, why it matters, and how it connects to CKB escrow behavior.

Preserve the package layering. Do not put chain logic directly inside page components.

Do not remove studio capabilities while improving the product UI.

Do not revert user changes unless explicitly asked.

If unexpected changes appear in edited files, stop and ask how to proceed.

Commit only when requested or when the active workflow explicitly asks for a commit. Do not amend commits unless explicitly requested.

Never commit private keys, seed phrases, wallet exports, RPC secrets, or deployer credentials.

## Current Priorities

1. Make wallet connect real and reliable.
2. Support testnet/mainnet switching with honest deployment readiness.
3. Fetch escrows by connected wallet role.
4. Complete buyer, seller, and arbitrator action flows.
5. Keep product UI beautiful and easy to understand.
6. Keep `/studio` stable for protocol operations.
7. Keep frontend behavior aligned with the Rust contract.

## Coding standards

1. Use latest versions of libraries and idiomatic approaches as of today
2. Keep it simple - NEVER over-engineer, ALWAYS simplify, NO unnecessary defensive programming. No extra features - focus on simplicity.
3. Be concise. Keep README minimal. IMPORTANT: no emojis ever

