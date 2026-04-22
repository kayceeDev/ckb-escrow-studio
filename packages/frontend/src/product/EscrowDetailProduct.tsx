"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CalendarClock, CircleHelp, RefreshCcw, Scale, ShieldCheck, Store, Wallet } from "lucide-react";

import { formatEscrowError } from "../error-format";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { getEscrowById, productEscrows } from "./mock-data";
import { ProductEscrowRecord, toLiveProductEscrow, toSeedProductEscrow } from "./contract";
import { createEscrowInput } from "./utils";
import { useProductWorkspace } from "./useProductWorkspace";

function ActionBadge({ source }: { source: ProductEscrowRecord["source"] }) {
  return <Badge variant={source === "live" ? "success" : "outline"}>{source === "live" ? "Live escrow" : "Preview escrow"}</Badge>;
}

export function EscrowDetailProduct({ escrowId }: { escrowId: string }) {
  const {
    walletState,
    setActiveSigner,
    deployment,
    deploymentReady,
    escrows,
    refreshEscrows,
    isFetchingEscrows,
    activeLockHash,
    service,
  } = useProductWorkspace();
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string>("");

  const seeded = getEscrowById(escrowId);
  const liveItem = escrows.find((escrow) => `${escrow.txHash}:${escrow.index}` === escrowId);
  const record = useMemo(() => {
    if (liveItem) {
      return toLiveProductEscrow(liveItem, activeLockHash);
    }
    if (seeded) {
      return toSeedProductEscrow(seeded, activeLockHash);
    }
    return null;
  }, [activeLockHash, liveItem, seeded]);

  async function runDirectAction(action: "Deliver" | "Dispute" | "Cancel") {
    if (!service || !liveItem) {
      return;
    }

    try {
      setBusyAction(action);
      setStatus(`${action} in progress...`);
      const cell = createEscrowInput(liveItem, deployment);
      const txHash =
        action === "Deliver"
          ? await service.sendDeliver(cell)
          : action === "Dispute"
            ? await service.sendDispute(cell)
            : await service.sendCancel(cell);

      setLastTxHash(txHash);
      setStatus(`${action} submitted.`);
      await refreshEscrows();
    } catch (error) {
      const { detail, hint } = formatEscrowError(error);
      setStatus(hint ? `${detail} ${hint}` : detail);
    } finally {
      setBusyAction(null);
    }
  }

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Escrow not found</p>
            <p className="text-sm text-muted-foreground">
              This route does not match a seeded preview escrow and no fetched live escrow with that transaction reference is loaded yet.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild><Link href="/">Back home</Link></Button>
              <Button asChild variant="outline"><Link href="/studio">Open Studio</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant={record.state === "Disputed" ? "destructive" : "success"}>{record.state}</Badge>
        <Badge variant="secondary">{record.viewerRole}</Badge>
        <ActionBadge source={record.source} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{record.title}</CardTitle>
              <CardDescription>{record.description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => void refreshEscrows()} disabled={!deploymentReady || isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                Refresh state
              </Button>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary"><Scale className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</span></div>
                <strong>{record.amountLabel}</strong>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary"><CalendarClock className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deadline</span></div>
                <strong>{record.deadlineLabel}</strong>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary"><Store className="h-4 w-4" /><span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Seller</span></div>
                <strong>{record.sellerLabel}</strong>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-border bg-secondary/55 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-primary"><CircleHelp className="h-4 w-4" /><strong>Your role</strong></div>
                <p>
                  {record.viewerRole === "viewer"
                    ? "This wallet is not a participant in the escrow, so the page stays read-only."
                    : `The connected wallet matches the escrow's ${record.viewerRole} lock hash, so the actions shown here follow that role.`}
                </p>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-secondary/55 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><strong>Contract alignment</strong></div>
                <p>
                  These actions mirror the current contract: seller can deliver from Funded, buyer can cancel/refund, buyer or seller can dispute from Delivered, and arbitrator resolves Disputed escrows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Wallets</CardTitle>
            <CardDescription>Select the signer whose lock hash should be matched against this escrow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
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
                        size="sm"
                        variant={walletState.activeSigner === signerInfo.signer ? "default" : "outline"}
                        onClick={() => setActiveSigner(signerInfo.signer)}
                      >
                        <Wallet className="h-4 w-4" />
                        {signerInfo.name}
                      </Button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>State progression stays aligned with the escrow state machine.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.timeline.map((step) => (
              <div key={step.label} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant={step.status === "done" ? "success" : step.status === "current" ? "secondary" : "outline"}>{step.status}</Badge>
                  <strong>{step.label}</strong>
                </div>
                <p className="text-sm text-muted-foreground">{step.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relevant actions</CardTitle>
            <CardDescription>
              Only actions allowed by the current contract state and connected role are shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.actions.length === 0 ? (
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                No actions are available for this wallet in the current escrow state.
              </div>
            ) : (
              record.actions.map((action) => (
                <div key={action.action} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{action.label}</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
                    </div>
                    <Badge variant={action.mode === "direct" ? "success" : "outline"}>{action.mode === "direct" ? "In product" : "Studio"}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {record.source === "live" && service && action.mode === "direct" && (action.action === "Deliver" || action.action === "Dispute" || action.action === "Cancel") ? (
                      <Button disabled={busyAction !== null || !action.enabled} onClick={() => {
                          if (action.action === "Deliver" || action.action === "Dispute" || action.action === "Cancel") {
                            void runDirectAction(action.action);
                          }
                        }}>
                        {busyAction === action.action ? "Submitting..." : action.label}
                      </Button>
                    ) : null}
                    <Button asChild variant="outline">
                      <Link href="/studio">
                        {action.mode === "studio" ? "Open in Studio" : "Advanced controls"}
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}

            <div className="rounded-[1.25rem] border border-dashed border-primary/25 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" /><strong>Why some actions still open Studio</strong></div>
              <p>
                The contract stores participant <strong className="text-foreground">lock hashes</strong> on chain. Settlement actions like release, refund, and dispute resolution sometimes still need full recipient lock scripts or reference header data off chain, so the product links you to Studio instead of pretending it can finish that flow blindly.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Status</p>
              <p className="mt-2">{status}</p>
              {lastTxHash ? <p className="mt-2 break-all text-xs">Last transaction: {lastTxHash}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
