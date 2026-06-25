"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  RefreshCcw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { filterParticipantEscrows, mergeProductEscrowRecords, toIndexedProductEscrow, toLiveProductEscrow } from "./contract";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";
import { CompactEscrowCards, SectionHeader } from "./EscrowCollectionSections";

export function ProductHome() {
  const {
    network,
    walletState,
    deploymentReady,
    escrows,
    indexedEscrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    refreshEscrows,
    status,
    activeLockHash,
    chainTipTimestampMs,
  } = useProductWorkspaceContext();

  const liveRecords = escrows.map((escrow) => toLiveProductEscrow(escrow, activeLockHash, chainTipTimestampMs));
  const indexedRecords = indexedEscrows.map((escrow) => toIndexedProductEscrow(escrow, activeLockHash, chainTipTimestampMs));
  const actorEscrows = filterParticipantEscrows(mergeProductEscrowRecords(indexedRecords, liveRecords));
  const liveActorEscrows = filterParticipantEscrows(liveRecords);
  const buyerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "buyer");
  const sellerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "seller");
  const arbitratorEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "arbitrator");
  const needsAction = liveActorEscrows.filter((escrow) => escrow.actions.some((action) => action.enabled));

  const showEmptyForNoWallet = deploymentReady && !walletState.activeSigner;
  const showEmptyForNoRoleMatches = deploymentReady && walletState.activeSigner && hasFetchedEscrows && actorEscrows.length === 0 && !escrowFetchError;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 md:px-6 md:py-10 2xl:px-8">
      <header className="mb-10 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(255,252,244,0.98),rgba(234,248,238,0.94))]">
          <CardContent className="space-y-7 p-6 md:p-10 2xl:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">Protected payments</Badge>
              <Badge variant="secondary">Known buyer and seller</Badge>
              <Badge variant="outline" className="capitalize">{network}</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-[14ch] font-serif text-4xl font-semibold leading-[0.98] tracking-tight text-balance md:text-6xl xl:text-[4.8rem]">
                Escrow that feels calm from deposit to delivery.
              </h1>
              <p className="max-w-[60ch] text-base leading-8 text-muted-foreground md:text-lg xl:text-[1.15rem] xl:leading-9">
                Create a protected deal, invite the right wallet, and keep every next step obvious: deliver, release, dispute, refund, or close.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { title: "Fund safely", body: "Buyer deposits into escrow before work begins." },
                { title: "Act by role", body: "Only the buyer, seller, or arbitrator sees the right next step." },
                { title: "Close clearly", body: "Completed and cancelled escrows become receipts in your ledger." },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.5rem] border border-border bg-white/72 p-4 shadow-sm">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">{item.title}</p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/escrows/create">
                  Create escrow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/escrows">Open ledger</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Workspace
            </CardTitle>
            <CardDescription>
              One connected wallet controls what you can see and do.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="rounded-[1.25rem] border border-border bg-white/78 p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
                <div className="flex items-center justify-between gap-3">
                  <strong>{walletState.activeSigner ? "Connected" : "Not connected"}</strong>
                  <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                    {walletState.wallets.length} found
                  </Badge>
                </div>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/78 p-4 shadow-sm">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Network</p>
                <div className="flex items-center justify-between gap-3">
                  <strong className="capitalize">{network}</strong>
                  <Badge variant={deploymentReady ? "success" : "destructive"}>
                    {deploymentReady ? "Ready" : "Unavailable"}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-white/78 p-4 text-sm leading-6 text-muted-foreground">
              {status}
            </div>
            <Button variant="outline" className="w-full" onClick={() => void refreshEscrows()} disabled={!deploymentReady || isFetchingEscrows}>
              <RefreshCcw className="h-4 w-4" />
              {isFetchingEscrows ? "Refreshing" : "Refresh escrows"}
            </Button>
          </CardContent>
        </Card>
      </header>

      <section className="mb-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { title: "Needs action", value: String(needsAction.length), body: "Open escrows waiting for this wallet." },
          { title: "Buyer", value: String(buyerEscrows.length), body: "Deals funded or settled by this wallet." },
          { title: "Seller", value: String(sellerEscrows.length), body: "Deals this wallet is expected to fulfill." },
          { title: "Arbitrator", value: String(arbitratorEscrows.length), body: "Disputes assigned for final review." },
        ].map((item) => (
          <Card key={item.title} className="bg-white/78">
            <CardContent className="space-y-2 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.title}</p>
              <p className="text-3xl font-semibold text-foreground">{item.value}</p>
              <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-10 space-y-5">
        <SectionHeader
          title="Needs your attention"
          body="A short list of live escrows where this wallet can move the deal forward right now. Open the ledger for the complete active and past history."
        />

        {!deploymentReady ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">{network} is not ready for product actions</p>
                <p className="text-sm text-muted-foreground">Switch networks or use Studio for setup and debugging.</p>
              </div>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </CardContent>
          </Card>
        ) : escrowFetchError ? (
          <Card>
            <CardContent className="space-y-4 p-6">
              <p className="text-lg font-semibold text-foreground">We could not load escrows</p>
              <p className="text-sm text-muted-foreground">{escrowFetchError}</p>
              <Button onClick={() => void refreshEscrows()} disabled={isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : showEmptyForNoWallet ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">Connect a wallet to see your escrows</p>
              <p>The dashboard will show live deals where that wallet is buyer, seller, or arbitrator.</p>
            </CardContent>
          </Card>
        ) : showEmptyForNoRoleMatches ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">No escrows found for this wallet</p>
              <p>Create a new escrow or switch to a wallet that is part of an existing deal.</p>
            </CardContent>
          </Card>
        ) : !hasFetchedEscrows || isFetchingEscrows ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">Loading your escrow workspace</p>
              <p>Checking live deals and wallet history.</p>
            </CardContent>
          </Card>
        ) : (
          <CompactEscrowCards
            records={needsAction}
            emptyMessage="No live escrow is waiting on this wallet. Your full active and past ledger is still available."
          />
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
        <Card className="bg-white/78">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              How it works
            </CardTitle>
            <CardDescription>A simple flow for known parties.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            {[
              { title: "1. Fund", body: "The buyer creates the escrow and locks payment." },
              { title: "2. Deliver", body: "The seller marks the work or goods delivered." },
              { title: "3. Close", body: "The buyer releases funds, disputes, cancels, or refunds when allowed." },
            ].map((item) => (
              <div key={item.title} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-[linear-gradient(135deg,rgba(26,105,64,0.95),rgba(17,65,42,0.95))] text-primary-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <ShieldCheck className="h-5 w-5" />
              Ready for the full ledger?
            </CardTitle>
            <CardDescription className="text-primary-foreground/75">
              Active deals and closed receipts live together in your escrow history.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 rounded-[1.25rem] bg-white/10 p-4 text-sm leading-6 text-primary-foreground/82">
              <Clock3 className="h-5 w-5 shrink-0" />
              Use the ledger when you need more than the urgent items shown on the dashboard.
            </div>
            <Button asChild variant="secondary" className="w-full">
              <Link href="/escrows">
                Open escrow ledger
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
