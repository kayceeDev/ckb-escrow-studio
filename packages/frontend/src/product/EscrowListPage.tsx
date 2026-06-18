"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, History, RefreshCcw, ShieldCheck, Wallet } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import {
  filterEscrowsByHistoryBucket,
  filterParticipantEscrows,
  toLiveProductEscrow,
  type ProductEscrowHistoryBucket,
} from "./contract";
import { EscrowHistoryTable, EscrowGrid, HistoryEmptyState } from "./EscrowCollectionSections";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

const HISTORY_TABS: Array<{ id: ProductEscrowHistoryBucket; label: string; description: string }> = [
  {
    id: "active",
    label: "Active Escrows",
    description: "Funded, delivered, and disputed escrows where this wallet is a participant.",
  },
  {
    id: "past",
    label: "Past Escrows",
    description: "Completed, cancelled, refunded, and resolved escrows for this wallet.",
  },
];

export function EscrowListPage({ createdEscrowId }: { createdEscrowId?: string | null }) {
  const {
    network,
    walletState,
    deploymentReady,
    escrows,
    archivedEscrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    refreshEscrows,
    activeLockHash,
    chainTipTimestampMs,
  } = useProductWorkspaceContext();
  const [activeTab, setActiveTab] = useState<ProductEscrowHistoryBucket>("active");

  const liveRecords = useMemo(
    () => escrows.map((escrow) => toLiveProductEscrow(escrow, activeLockHash, chainTipTimestampMs)),
    [activeLockHash, chainTipTimestampMs, escrows],
  );
  const archivedRecords = useMemo(
    () => archivedEscrows.map((escrow) => ({ ...escrow, source: "archived" as const })),
    [archivedEscrows],
  );
  const participantEscrows = useMemo(() => filterParticipantEscrows(liveRecords), [liveRecords]);
  const activeEscrows = useMemo(
    () => filterEscrowsByHistoryBucket(participantEscrows, "active"),
    [participantEscrows],
  );
  const pastEscrows = useMemo(() => {
    const merged = [...filterEscrowsByHistoryBucket(participantEscrows, "past"), ...archivedRecords];
    return Array.from(new Map(merged.map((escrow) => [escrow.id, escrow])).values());
  }, [archivedRecords, participantEscrows]);
  const visibleRecords = activeTab === "active" ? activeEscrows : pastEscrows;

  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 md:px-6 md:py-10 2xl:px-8">
      <header className="mb-10 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.55fr)]">
        <Card className="overflow-hidden border-primary/15 bg-[linear-gradient(135deg,rgba(255,252,244,0.96),rgba(236,248,239,0.92))]">
          <CardContent className="space-y-7 p-6 md:p-10">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success">Wallet History</Badge>
              <Badge variant="secondary">Participant escrows only</Badge>
              <Badge variant="outline" className="capitalize">{network}</Badge>
            </div>

            <div className="space-y-3">
              <h1 className="max-w-[12ch] font-serif text-4xl font-semibold leading-[0.98] tracking-tight text-foreground md:text-6xl">
                Escrow history that reads like a clean wallet ledger.
              </h1>
              <p className="max-w-[68ch] text-base leading-8 text-muted-foreground md:text-lg">
                Active deals stay separate from completed settlement history. This page only shows escrows where the connected wallet is buyer, seller, or arbitrator; public view-only discovery remains in Studio.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                { label: "Active", value: activeEscrows.length, body: "Open state machine work." },
                { label: "Past", value: pastEscrows.length, body: "Closed escrow receipts." },
                { label: "Matched", value: participantEscrows.length, body: "Wallet participant records." },
              ].map((item) => (
                <div key={item.label} className="rounded-[1.35rem] border border-border/80 bg-white/75 p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
                  <p className="mt-2 text-3xl font-semibold text-foreground">{item.value}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
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
              <Button variant="outline" size="lg" onClick={() => void refreshEscrows()} disabled={!deploymentReady || isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                {isFetchingEscrows ? "Refreshing" : "Refresh history"}
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
              Wallet and network controls in the navbar determine which participant history appears here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-[1.25rem] border border-border bg-white/80 p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Wallet</p>
              <div className="flex items-center justify-between gap-3">
                <strong className="text-foreground">{walletState.activeSigner ? "Connected" : "Not connected"}</strong>
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.wallets.length} wallet(s)
                </Badge>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/80 p-4 shadow-sm">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Network</p>
              <div className="flex items-center justify-between gap-3">
                <strong className="capitalize text-foreground">{network}</strong>
                <Badge variant={deploymentReady ? "success" : "destructive"}>
                  {deploymentReady ? "Deployment ready" : "Network unavailable"}
                </Badge>
              </div>
            </div>
            <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <strong className="text-foreground">Participant-first</strong>
              </div>
              <p className="leading-6">
                View-only escrows are intentionally excluded from this product page to keep wallet history focused.
              </p>
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
            {network} deployment metadata is unavailable in this build, so wallet escrow history cannot be listed yet.
          </CardContent>
        </Card>
      ) : escrowFetchError ? (
        <Card>
          <CardContent className="space-y-4 p-6">
            <p className="text-lg font-semibold text-foreground">We could not load escrow history</p>
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
            Connect a wallet from the navbar to browse active and past escrows where that wallet is a participant.
          </CardContent>
        </Card>
      ) : !hasFetchedEscrows || isFetchingEscrows ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            Fetching live escrow cells for the selected network.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="rounded-[1.5rem] border border-border bg-card/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur">
            <div className="grid gap-2 md:grid-cols-2">
              {HISTORY_TABS.map((tab) => {
                const selected = activeTab === tab.id;
                const count = tab.id === "active" ? activeEscrows.length : pastEscrows.length;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`rounded-[1.15rem] px-4 py-4 text-left transition ${
                      selected
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-semibold">{tab.label}</span>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${selected ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
                        {count}
                      </span>
                    </div>
                    <p className={`mt-1 text-sm leading-6 ${selected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                      {tab.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {activeTab === "active" ? (
            activeEscrows.length > 0 ? (
              <EscrowGrid
                title="Active Escrows"
                body="Open participant escrows that can still move through delivery, dispute, release, refund, or resolution."
                records={activeEscrows}
                {...(createdEscrowId !== undefined ? { highlightedEscrowId: createdEscrowId } : {})}
              />
            ) : (
              <HistoryEmptyState active />
            )
          ) : (
            <section className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Past Escrows</h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Closed wallet history for completed, cancelled, refunded, and resolved escrows.
                  </p>
                </div>
              </div>
              {pastEscrows.length > 0 ? (
                <EscrowHistoryTable
                  records={visibleRecords}
                  emptyMessage="No past escrows were found for this wallet yet."
                />
              ) : (
                <HistoryEmptyState active={false} />
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
