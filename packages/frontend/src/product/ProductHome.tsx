"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  LayoutPanelTop,
  RefreshCcw,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { createExplorerTxUrl } from "../studio";
import { buyerHighlights } from "./mock-data";
import { toLiveProductEscrow, type ProductEscrowRecord } from "./contract";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground md:text-base">{body}</p>
      </div>
    </div>
  );
}

function EscrowGrid({
  title,
  body,
  records,
}: {
  title: string;
  body: string;
  records: ProductEscrowRecord[];
}) {
  if (records.length === 0) {
    return null;
  }

  return (
    <section className="space-y-5">
      <SectionHeader title={title} body={body} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
        {records.map((escrow) => (
          <Card key={escrow.id} className="flex h-full flex-col overflow-hidden">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <CardTitle className="text-lg leading-7">{escrow.title}</CardTitle>
                <Badge
                  variant={
                    escrow.state === "Disputed"
                      ? "destructive"
                      : escrow.state === "Delivered"
                        ? "secondary"
                        : "success"
                  }
                >
                  {escrow.state}
                </Badge>
              </div>
              <CardDescription>{escrow.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex h-full flex-col space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{escrow.viewerRole}</Badge>
                <Badge variant="outline">{escrow.actions.length} action path(s)</Badge>
              </div>

              <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Next step</p>
                <p className="font-medium text-foreground">{escrow.guidance.summary}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{escrow.guidance.nextStep}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-white/75 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</p>
                  <p className="font-semibold">{escrow.amountLabel}</p>
                </div>
                <div className="rounded-2xl border border-border bg-white/75 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
                  <p className="font-semibold">{escrow.deadlineLabel}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                <p>
                  <strong className="text-foreground">Seller:</strong> {escrow.sellerLabel}
                </p>
                <p>
                  <strong className="text-foreground">Arbitrator:</strong> {escrow.arbitratorLabel}
                </p>
                {escrow.guidance.supportLabel ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border bg-secondary/55 px-3 py-2 text-xs leading-5">
                    {escrow.guidance.supportLabel}
                  </p>
                ) : null}
              </div>

              <div className="mt-auto pt-1">
                <Button asChild className="w-full">
                  <Link href={`/escrows/${encodeURIComponent(escrow.id)}`}>
                    Open Escrow
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function ProductHome() {
  const {
    network,
    walletState,
    deploymentReady,
    escrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    refreshEscrows,
    status,
    activeLockHash,
  } = useProductWorkspaceContext();

  const liveRecords = escrows.map((escrow) => toLiveProductEscrow(escrow, activeLockHash));
  const actorEscrows = liveRecords.filter((escrow) => escrow.viewerRole !== "viewer");
  const needsAction = actorEscrows.filter((escrow) => escrow.actions.some((action) => action.enabled));
  const buyerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "buyer");
  const sellerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "seller");
  const arbitratorEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "arbitrator");

  const networkResources = {
    faucet:
      network === "testnet"
        ? "https://faucet.nervos.org"
        : "https://www.nervos.org",
    explorer:
      network === "mainnet"
        ? "https://explorer.nervos.org"
        : createExplorerTxUrl("0x0", "testnet").replace(/\/transaction\/0x0\?network=testnet$/, ""),
  };

  const showEmptyForNoWallet = deploymentReady && !walletState.activeSigner;
  const showEmptyForNoRoleMatches = deploymentReady && walletState.activeSigner && hasFetchedEscrows && actorEscrows.length === 0 && !escrowFetchError;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 md:px-6 md:py-10 2xl:px-8">
      <header className="mb-12 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.5fr)] 2xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,0.48fr)]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-7 p-6 md:p-10 2xl:p-14">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success" className="w-fit">Standalone Escrow</Badge>
              <Badge variant="secondary" className="w-fit">Known parties only</Badge>
              <Badge variant="outline" className="w-fit capitalize">{network}</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-[14ch] font-serif text-4xl font-semibold leading-[0.98] tracking-tight text-balance md:text-6xl xl:max-w-[14ch] xl:text-[4.8rem] 2xl:text-[5.4rem]">
                Live CKB escrow with platform-assigned dispute protection.
              </h1>
              <p className="max-w-[58ch] text-base leading-8 text-muted-foreground md:text-lg xl:text-[1.2rem] xl:leading-9">
                Connect once from the navbar, stay on the right network, and discover only the live escrows your wallet can act on as buyer, seller, or assigned arbitrator.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {buyerHighlights.map((item) => (
                <div key={item.title} className="rounded-[1.5rem] border border-border bg-white/70 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/escrows/create">
                  Create Escrow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => void refreshEscrows()} disabled={!deploymentReady || isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                {isFetchingEscrows ? "Refreshing live escrows" : "Refresh live escrows"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Workspace Status
            </CardTitle>
            <CardDescription>
              Wallet and network controls live in the navbar so every page shares the same signer context.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Network</p>
                <div className="flex items-center justify-between gap-3">
                  <strong className="capitalize">{network}</strong>
                  <Badge variant={deploymentReady ? "success" : "destructive"}>
                    {deploymentReady ? "Deployment ready" : "Network unavailable"}
                  </Badge>
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
                <div className="flex items-center justify-between gap-3">
                  <strong>{walletState.activeSigner ? "Connected" : "Not connected"}</strong>
                  <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                    {walletState.wallets.length} wallet(s)
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
              {status}
            </div>
            <div className="grid gap-3">
              <Button asChild variant="outline">
                <Link href="/escrows/create">
                  <LayoutPanelTop className="h-4 w-4" />
                  Start buyer flow
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/studio">
                  <LayoutPanelTop className="h-4 w-4" />
                  Open Studio
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="mb-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Needs your action", value: String(needsAction.length), body: "Escrows where your connected role can act right now." },
          { title: "As buyer", value: String(buyerEscrows.length), body: "Escrows where your wallet is the buyer." },
          { title: "As seller", value: String(sellerEscrows.length), body: "Escrows where your wallet is the seller." },
          { title: "As arbitrator", value: String(arbitratorEscrows.length), body: "Disputes your assigned arbitrator wallet can resolve." },
        ].map((item) => (
          <Card key={item.title}>
            <CardContent className="space-y-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.title}</p>
              <p className="text-3xl font-semibold text-foreground">{item.value}</p>
              <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-12 space-y-5">
        <SectionHeader
          title="Live escrows for your connected wallet"
          body="These lists are filtered by the same participant lock hashes the contract enforces on chain. No seeded previews are mixed into this dashboard, and arbitrator discovery is based on the assigned arbitrator lock hash stored at create time."
        />

        {!deploymentReady ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">{network} escrow deployment is unavailable</p>
                <p className="text-sm text-muted-foreground">
                  This build does not include complete escrow deployment metadata for {network} yet. Switch networks or add deployment metadata before trying to create or discover live escrows.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href="/studio">Open Studio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : escrowFetchError ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-lg font-semibold text-foreground">We could not load live escrows</p>
              <p className="text-sm text-muted-foreground">
                {escrowFetchError}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void refreshEscrows()} disabled={isFetchingEscrows}>
                  <RefreshCcw className="h-4 w-4" />
                  {isFetchingEscrows ? "Retrying..." : "Retry fetch"}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : showEmptyForNoWallet ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">Connect a wallet to discover live escrows</p>
              <p>
                Once a signer is connected from the navbar, this dashboard will group live escrows by whether your wallet is the buyer, seller, or platform-assigned arbitrator.
              </p>
            </CardContent>
          </Card>
        ) : showEmptyForNoRoleMatches ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">No live escrows were found for this wallet on {network}</p>
              <p>
                Your connected signer is active, but none of the fetched escrow cells match this wallet's participant lock hash yet. Try another participant wallet or create a new escrow.
              </p>
            </CardContent>
          </Card>
        ) : !hasFetchedEscrows || isFetchingEscrows ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">Loading live escrows</p>
              <p>
                Fetching real escrow cells for the selected network before grouping them by role.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-10">
            <EscrowGrid
              title="Needs your action"
              body="Escrows where your connected role can move the state forward right now."
              records={needsAction}
            />
            <EscrowGrid
              title="As buyer"
              body="Escrows funded by your connected buyer wallet."
              records={buyerEscrows}
            />
            <EscrowGrid
              title="As seller"
              body="Escrows where your connected wallet is the seller."
              records={sellerEscrows}
            />
            <EscrowGrid
              title="As arbitrator"
              body="Disputes your connected assigned-arbitrator wallet can help resolve."
              records={arbitratorEscrows}
            />
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="h-5 w-5 text-primary" />
              MVP FAQ
            </CardTitle>
            <CardDescription>
              Short product guidance for this week’s buyer-first testnet release.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {[
              {
                title: "How does the buyer create an escrow?",
                body: "Connect the buyer wallet, fill seller, amount, deadline, and description, then let the app assign a platform arbitrator automatically before you submit.",
              },
              {
                title: "How does the seller move it forward?",
                body: "Once funded, the seller connects their wallet and marks the escrow as delivered from the live detail page.",
              },
              {
                title: "How does the buyer release or dispute?",
                body: "After delivery, the buyer can release funds when the seller script is known, or open a dispute directly in product.",
              },
              {
                title: "How does the arbitrator resolve?",
                body: "The assigned arbitrator wallet sees disputed escrows under the arbitrator view and can resolve them once the recipient lock script is available.",
              },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Network resources
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>
                Testnet is the default buyer-facing network until mainnet deployment metadata and active production arbitrators are fully ready.
              </p>
              <div className="flex flex-col gap-3">
                <Button asChild variant="outline" className="justify-between">
                  <Link href={networkResources.faucet} target="_blank" rel="noreferrer">
                    {network === "testnet" ? "Open testnet faucet" : "Nervos network resources"}
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-between">
                  <Link href={networkResources.explorer} target="_blank" rel="noreferrer">
                    Open {network} explorer
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <section className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            {[
              {
                title: "For Buyers",
                body: "Funds live in escrow cells on chain until the state machine allows release, cancellation, refund, or dispute. Arbitration is assigned by the platform before create.",
                icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
              },
              {
                title: "For Sellers",
                body: "Role discovery happens by lock hash, so the correct seller wallet must be connected before delivery becomes available.",
                icon: <Store className="h-5 w-5 text-primary" />,
              },
              {
                title: "For Arbitrators",
                body: "Assigned arbitrators are fixed in escrow data at creation time, then discovered later through the same on-chain lock-hash matching used for buyers and sellers.",
                icon: <ShieldCheck className="h-5 w-5 text-primary" />,
              },
            ].map((item) => (
              <Card key={item.title}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">{item.icon}{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </CardContent>
              </Card>
            ))}
          </section>
        </div>
      </section>
    </div>
  );
}
