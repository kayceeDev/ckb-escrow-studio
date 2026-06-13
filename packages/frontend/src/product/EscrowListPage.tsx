"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, RefreshCcw, Wallet } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { toLiveProductEscrow } from "./contract";
import { EscrowGrid, SectionHeader } from "./EscrowCollectionSections";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

export function EscrowListPage({ createdEscrowId }: { createdEscrowId?: string | null }) {
  const {
    network,
    walletState,
    deploymentReady,
    escrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    refreshEscrows,
    activeLockHash,
  } = useProductWorkspaceContext();

  const liveRecords = useMemo(
    () => escrows.map((escrow) => toLiveProductEscrow(escrow, activeLockHash)),
    [activeLockHash, escrows],
  );
  const actorEscrows = liveRecords.filter((escrow) => escrow.viewerRole !== "viewer");
  const viewerEscrows = liveRecords.filter((escrow) => escrow.viewerRole === "viewer");

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 md:px-6 md:py-10 2xl:px-8">
      <header className="mb-10 grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.5fr)]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">Escrow List</Badge>
              <Badge variant="secondary">Live records only</Badge>
              <Badge variant="outline" className="capitalize">{network}</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">All live escrows for this workspace</h1>
              <p className="max-w-[64ch] text-base leading-8 text-muted-foreground">
                This dedicated page keeps the same live escrow cards as the dashboard, but focuses only on browsing and reopening escrows after creation or refresh.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/escrows/create">
                  Create another escrow
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
              Current workspace
            </CardTitle>
            <CardDescription>
              The same wallet and network controls from the navbar apply here too.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-foreground">{walletState.activeSigner ? "Connected" : "Not connected"}</strong>
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.wallets.length} wallet(s)
                </Badge>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Network</p>
              <div className="flex items-center justify-between gap-3">
                <strong className="capitalize text-foreground">{network}</strong>
                <Badge variant={deploymentReady ? "success" : "destructive"}>
                  {deploymentReady ? "Deployment ready" : "Network unavailable"}
                </Badge>
              </div>
            </div>
            {createdEscrowId ? (
              <div className="rounded-[1.25rem] border border-primary/20 bg-primary/5 p-4 text-primary">
                Your newest escrow is highlighted below.
              </div>
            ) : null}
          </CardContent>
        </Card>
      </header>

      {!deploymentReady ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            {network} deployment metadata is unavailable in this build, so live escrows cannot be listed here yet.
          </CardContent>
        </Card>
      ) : escrowFetchError ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-lg font-semibold text-foreground">We could not load live escrows</p>
            <p className="text-sm text-muted-foreground">{escrowFetchError}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void refreshEscrows()} disabled={isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                {isFetchingEscrows ? "Retrying..." : "Retry fetch"}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : !walletState.activeSigner ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            Connect a wallet from the navbar to browse the live escrows your participant roles can act on.
          </CardContent>
        </Card>
      ) : !hasFetchedEscrows || isFetchingEscrows ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            Fetching live escrow cells for the selected network.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-10">
          <EscrowGrid
            title="Your live escrows"
            body="Escrows where your connected wallet matches the buyer, seller, or assigned arbitrator lock hash."
            records={actorEscrows}
            emptyMessage={`No live escrows were found for this wallet on ${network} yet.`}
            {...(createdEscrowId !== undefined ? { highlightedEscrowId: createdEscrowId } : {})}
          />
          <EscrowGrid
            title="Other live escrows on this network"
            body="Visible live escrow cells that do not currently match the connected participant wallet."
            records={viewerEscrows}
            emptyMessage="No additional live escrows are visible on this network right now."
            {...(createdEscrowId !== undefined ? { highlightedEscrowId: createdEscrowId } : {})}
          />
        </div>
      )}
    </div>
  );
}
