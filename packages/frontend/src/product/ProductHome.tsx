"use client";

import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  LayoutPanelTop,
  RefreshCcw,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { buyerHighlights, productEscrows } from "./mock-data";
import { toLiveProductEscrow, toSeedProductEscrow } from "./contract";
import { useProductWorkspace } from "./useProductWorkspace";

function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground md:text-base">{body}</p>
      </div>
    </div>
  );
}

export function ProductHome() {
  const {
    walletState,
    setActiveSigner,
    refreshWallets,
    deploymentReady,
    escrows,
    isFetchingEscrows,
    refreshEscrows,
    status,
    activeLockHash,
  } = useProductWorkspace();

  const seededRecords = productEscrows.map((escrow) => toSeedProductEscrow(escrow, activeLockHash));
  const liveRecords = escrows.map((escrow) => toLiveProductEscrow(escrow, activeLockHash));
  const actorEscrows = liveRecords.filter((escrow) => escrow.viewerRole !== "viewer");
  const needsAction = actorEscrows.filter((escrow) => escrow.actions.some((action) => action.enabled));
  const buyerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "buyer");
  const sellerEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "seller");
  const arbitratorEscrows = actorEscrows.filter((escrow) => escrow.viewerRole === "arbitrator");

  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 md:py-12">
      <header className="mb-12 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-8 md:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success" className="w-fit">Standalone Escrow</Badge>
              <Badge variant="secondary" className="w-fit">Known parties only</Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-balance md:text-7xl">
                Discover the escrows you belong to, connect the right wallet, and take the exact action the contract allows.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                Buyers, sellers, and arbitrators should all see the same escrow from their own role. The product dashboard now follows the contract state machine instead of assuming the buyer is the only actor.
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
              <Button asChild variant="outline" size="lg">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet & Discovery
            </CardTitle>
            <CardDescription>
              Connect a signer to classify escrows as buyer, seller, or arbitrator. Without a signer, the dashboard stays public and read-only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                {walletState.activeSigner ? "Wallet connected" : "No signer selected"}
              </Badge>
              <Badge variant={deploymentReady ? "success" : "destructive"}>
                {deploymentReady ? "Deployment ready" : "Load deployment in Studio"}
              </Badge>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
              {status}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void refreshWallets()}>
                <RefreshCcw className="h-4 w-4" />
                Refresh wallets
              </Button>
              <Button
                variant="outline"
                onClick={() => void refreshEscrows()}
                disabled={!deploymentReady || isFetchingEscrows}
              >
                <LayoutPanelTop className="h-4 w-4" />
                {isFetchingEscrows ? "Refreshing escrows" : "Refresh escrows"}
              </Button>
            </div>
            <div className="space-y-3">
              {walletState.wallets.length === 0 ? (
                <p className="text-sm text-muted-foreground">No wallets discovered yet.</p>
              ) : (
                walletState.wallets.map((wallet) => (
                  <div key={wallet.name} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                    <strong>{wallet.name}</strong>
                    <p className="mb-3 mt-1 text-sm text-muted-foreground">{wallet.signers.length} signer(s)</p>
                    <div className="flex flex-wrap gap-2">
                      {wallet.signers.map((signerInfo) => (
                        <Button
                          key={`${wallet.name}-${signerInfo.name}`}
                          variant={walletState.activeSigner === signerInfo.signer ? "default" : "outline"}
                          size="sm"
                          onClick={() => setActiveSigner(signerInfo.signer)}
                        >
                          {signerInfo.name}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="mb-12 grid gap-4 md:grid-cols-4">
        {[
          { title: "Needs your action", value: String(needsAction.length), body: "Escrows where your connected role can act right now." },
          { title: "As buyer", value: String(buyerEscrows.length), body: "Escrows where your wallet is the buyer." },
          { title: "As seller", value: String(sellerEscrows.length), body: "Escrows where your wallet is the seller." },
          { title: "As arbitrator", value: String(arbitratorEscrows.length), body: "Disputes your wallet can resolve." },
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
          title="Escrows that involve your connected wallet"
          body="These lists are filtered by the same participant lock hashes the contract enforces on chain."
        />

        {!deploymentReady ? (
          <Card>
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-lg font-semibold">Load a deployment profile first</p>
                <p className="text-sm text-muted-foreground">
                  The product dashboard can discover real escrows only after the escrow type script is loaded in Studio.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </CardContent>
          </Card>
        ) : actorEscrows.length === 0 ? (
          <Card>
            <CardContent className="space-y-3 p-6 text-sm text-muted-foreground">
              <p className="text-lg font-semibold text-foreground">No connected-role escrows yet</p>
              <p>
                If you already selected a wallet, it does not match any of the fetched escrow participant hashes yet. Buyers, sellers, and arbitrators will each see their own role here once the lock hashes line up.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {actorEscrows.map((escrow) => (
              <Card key={escrow.id} className="overflow-hidden">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg">{escrow.title}</CardTitle>
                    <Badge variant={escrow.state === "Disputed" ? "destructive" : escrow.state === "Delivered" ? "secondary" : "success"}>
                      {escrow.state}
                    </Badge>
                  </div>
                  <CardDescription>{escrow.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{escrow.viewerRole}</Badge>
                    <Badge variant="outline">{escrow.actions.length} action path(s)</Badge>
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
                    <p><strong className="text-foreground">Seller:</strong> {escrow.sellerLabel}</p>
                    <p><strong className="text-foreground">Arbitrator:</strong> {escrow.arbitratorLabel}</p>
                  </div>
                  <Button asChild className="w-full">
                    <Link href={`/escrows/${encodeURIComponent(escrow.id)}`}>Open Escrow</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-5">
        <SectionHeader
          title="Seeded preview escrows"
          body="These stay in the product so the UX remains understandable even before a live deployment is loaded."
        />

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {seededRecords.map((escrow) => (
            <Card key={escrow.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">{escrow.title}</CardTitle>
                  <Badge variant={escrow.state === "Disputed" ? "destructive" : escrow.state === "Delivered" ? "secondary" : "success"}>
                    {escrow.state}
                  </Badge>
                </div>
                <CardDescription>{escrow.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{escrow.viewerRole}</Badge>
                  <Badge variant="outline">Preview</Badge>
                </div>
                <div className="rounded-2xl border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Seller:</strong> {escrow.sellerLabel}</p>
                  <p><strong className="text-foreground">Arbitrator:</strong> {escrow.arbitratorLabel}</p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/escrows/${encodeURIComponent(escrow.id)}`}>Open Preview</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "For Buyers",
            body: "Discover escrows you funded, then see whether the current state lets you cancel, refund, complete, or dispute.",
            icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
          },
          {
            title: "For Sellers",
            body: "Sellers can finally discover their own escrows and mark delivery from the same product surface instead of relying only on studio tools.",
            icon: <Store className="h-5 w-5 text-primary" />,
          },
          {
            title: "For Arbitrators",
            body: "Arbitrators see disputed escrows they belong to and can identify which resolutions still need recipient lock details.",
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
  );
}
