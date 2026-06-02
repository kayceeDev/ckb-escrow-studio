"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CircleHelp,
  ExternalLink,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { formatEscrowError } from "../error-format";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Label } from "../components/ui";
import { createExplorerTxUrl } from "../studio";
import { ProductActionView, ProductEscrowRecord, makeLiveEscrowId, toLiveProductEscrow } from "./contract";
import { type StoredParticipantScript } from "./registry";
import { createEscrowInput } from "./utils";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function ActionBadge({ source }: { source: ProductEscrowRecord["source"] }) {
  return <Badge variant={source === "live" ? "success" : "outline"}>Live escrow</Badge>;
}

function ParticipantScriptEditor({
  title,
  lockHash,
  storedScript,
  onSave,
}: {
  title: string;
  lockHash: string;
  storedScript: StoredParticipantScript | undefined;
  onSave: (lockHash: string, script: StoredParticipantScript) => void;
}) {
  const [codeHash, setCodeHash] = useState(storedScript?.codeHash ?? "");
  const [args, setArgs] = useState(storedScript?.args ?? "0x");
  const [hashType, setHashType] = useState<StoredParticipantScript["hashType"]>(storedScript?.hashType ?? "type");

  return (
    <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-medium text-foreground">{title}</p>
          <p className="break-all text-xs text-muted-foreground">{lockHash}</p>
        </div>
        <Badge variant={storedScript ? "success" : "outline"}>{storedScript ? "Script saved" : "Script missing"}</Badge>
      </div>

      <div className="grid gap-3">
        <div className="space-y-2">
          <Label>Code hash</Label>
          <Input value={codeHash} onChange={(event) => setCodeHash(event.target.value)} placeholder="0x..." />
        </div>
        <div className="space-y-2">
          <Label>Hash type</Label>
          <select
            value={hashType}
            onChange={(event) => setHashType(event.target.value as StoredParticipantScript["hashType"])}
            className="flex h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none ring-0 transition focus:border-primary/40"
          >
            <option value="type">type</option>
            <option value="data">data</option>
            <option value="data1">data1</option>
            <option value="data2">data2</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Args</Label>
          <Input value={args} onChange={(event) => setArgs(event.target.value)} placeholder="0x..." />
        </div>
        <Button
          variant="outline"
          onClick={() => onSave(lockHash, { codeHash, hashType, args, label: title })}
          disabled={!codeHash || !args}
        >
          Save {title} script
        </Button>
      </div>
    </div>
  );
}

function canExecuteInProduct(
  action: ProductActionView,
  record: ProductEscrowRecord,
  participantScripts: Record<string, StoredParticipantScript>,
  hasService: boolean,
  isLive: boolean,
): boolean {
  if (!isLive || !hasService || !action.enabled) {
    return false;
  }

  switch (action.action) {
    case "Deliver":
    case "Dispute":
    case "Cancel":
      return true;
    case "Complete":
    case "ResolveToSeller":
      return Boolean(participantScripts[record.sellerLockHash]);
    case "ResolveToBuyer":
      return Boolean(participantScripts[record.buyerLockHash]);
    default:
      return false;
  }
}

export function EscrowDetailProduct({ escrowId }: { escrowId: string }) {
  const {
    network,
    walletState,
    deployment,
    deploymentReady,
    escrows,
    refreshEscrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    activeLockHash,
    service,
    participantScripts,
    saveParticipantScript,
  } = useProductWorkspaceContext();
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [showScripts, setShowScripts] = useState(false);

  useEffect(() => {
    if (!deploymentReady || isFetchingEscrows || hasFetchedEscrows) {
      return;
    }

    void refreshEscrows();
  }, [deploymentReady, hasFetchedEscrows, isFetchingEscrows, refreshEscrows]);

  const [routeTxHash] = escrowId.split(":");
  const liveItem = useMemo(() => {
    const exactMatch = escrows.find((escrow) => makeLiveEscrowId(escrow.txHash, escrow.index) === escrowId);
    if (exactMatch) {
      return exactMatch;
    }

    const txHashMatches = escrows.filter((escrow) => escrow.txHash === routeTxHash);
    if (txHashMatches.length === 1) {
      return txHashMatches[0] ?? null;
    }

    return null;
  }, [escrowId, escrows, routeTxHash]);
  const record = useMemo(() => {
    if (liveItem) {
      return toLiveProductEscrow(liveItem, activeLockHash);
    }
    return null;
  }, [activeLockHash, liveItem]);

  async function runAction(action: ProductActionView["action"]) {
    if (!service || !liveItem || !record) {
      return;
    }

    try {
      setBusyAction(action);
      setStatus(`${action} in progress...`);
      const cell = createEscrowInput(liveItem, deployment);
      let txHash = "";

      switch (action) {
        case "Deliver":
          txHash = await service.sendDeliver(cell);
          break;
        case "Dispute":
          txHash = await service.sendDispute(cell);
          break;
        case "Cancel":
          txHash = await service.sendCancel(cell);
          break;
        case "Complete": {
          const sellerLock = participantScripts[record.sellerLockHash];
          if (!sellerLock) {
            throw new Error("Seller lock script is missing. Save it below before releasing funds.");
          }
          txHash = await service.sendComplete({ escrowInput: cell, sellerLock });
          break;
        }
        case "ResolveToBuyer": {
          const buyerLock = participantScripts[record.buyerLockHash];
          if (!buyerLock) {
            throw new Error("Buyer lock script is missing. Save it below before resolving to the buyer.");
          }
          txHash = await service.sendResolveToBuyer({ escrowInput: cell, recipientLock: buyerLock });
          break;
        }
        case "ResolveToSeller": {
          const sellerLock = participantScripts[record.sellerLockHash];
          if (!sellerLock) {
            throw new Error("Seller lock script is missing. Save it below before resolving to the seller.");
          }
          txHash = await service.sendResolveToSeller({ escrowInput: cell, recipientLock: sellerLock });
          break;
        }
        default:
          throw new Error(`${action} still requires settlement support this week.`);
      }

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

  if (!deploymentReady) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">{network} deployment is unavailable</p>
            <p className="text-sm text-muted-foreground">
              This detail route needs complete deployment metadata for the selected network before live escrow data can be resolved.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record && (isFetchingEscrows || !hasFetchedEscrows)) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Loading live escrow</p>
            <p className="text-sm text-muted-foreground">
              Fetching live escrow cells for the current network before deciding whether this route exists.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record && escrowFetchError) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Could not load this escrow yet</p>
            <p className="text-sm text-muted-foreground">{escrowFetchError}</p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void refreshEscrows()} disabled={isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                {isFetchingEscrows ? "Retrying..." : "Retry fetch"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Escrow not found on this network</p>
            <p className="text-sm text-muted-foreground">
              We refreshed live escrows for {network}, but this `txHash:index` route was not present in the fetched result set. Confirm the network and retry discovery before assuming the escrow is missing.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void refreshEscrows()} disabled={isFetchingEscrows}>
                <RefreshCcw className="h-4 w-4" />
                {isFetchingEscrows ? "Refreshing..." : "Refresh escrows"}
              </Button>
              <Button asChild variant="outline">
                <Link href="/">Back home</Link>
              </Button>
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
              {lastTxHash ? (
                <Button asChild variant="outline">
                  <Link href={createExplorerTxUrl(lastTxHash, network)} target="_blank" rel="noreferrer">
                    View transaction
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              ) : null}
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

            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
              <p>
                <strong className="text-foreground">Assigned arbitrator:</strong> {record.arbitratorLabel}
              </p>
              <p className="mt-2 leading-6">
                The platform assigned this arbitrator when the escrow was created, and that lock hash is now fixed in the on-chain escrow data.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.25rem] border border-primary/20 bg-primary/6 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-primary"><CircleHelp className="h-4 w-4" /><strong>What happens next</strong></div>
                <p className="font-medium text-foreground">{record.guidance.summary}</p>
                <p className="mt-2 leading-6">{record.guidance.nextStep}</p>
                <p className="mt-2 text-xs leading-5">{record.guidance.detail}</p>
                {record.guidance.supportLabel ? (
                  <p className="mt-3 rounded-xl border border-dashed border-border bg-white/70 px-3 py-2 text-xs leading-5">
                    {record.guidance.supportLabel}
                  </p>
                ) : null}
              </div>
              <div className="rounded-[1.25rem] border border-border bg-secondary/55 p-4 text-sm text-muted-foreground">
                <div className="mb-2 flex items-center gap-2 text-primary"><ShieldCheck className="h-4 w-4" /><strong>Your role</strong></div>
                <p>
                  {record.viewerRole === "viewer"
                    ? "This wallet does not match a participant lock hash, so the detail page stays read-only until you switch wallets."
                    : `The connected wallet matches the escrow's ${record.viewerRole} lock hash, so the actions shown here follow that role.`}
                </p>
                <p className="mt-3 text-xs leading-5">
                  Roles are discovered from on-chain lock hashes, not from usernames or off-chain accounts.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Connected signer</CardTitle>
            <CardDescription>Use the navbar wallet control to switch signer or network.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.activeSigner ? "Signer selected" : "No signer"}
                </Badge>
                <Badge variant={record.viewerRole === "viewer" ? "outline" : "success"}>
                  {record.viewerRole}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                The selected signer is matched against the buyer, seller, and assigned arbitrator lock hashes. Switch wallets from the top-right control if this page is read-only.
              </p>
            </div>
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
            <CardTitle>Available actions</CardTitle>
            <CardDescription>
              Direct actions come first. Advanced settlement paths stay visible with clear limitations instead of failing silently.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {record.actions.length === 0 ? (
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                No actions are available for this wallet in the current escrow state.
              </div>
            ) : (
              record.actions.map((action) => {
                const inProduct = canExecuteInProduct(
                  action,
                  record,
                  participantScripts,
                  Boolean(service),
                  record.source === "live",
                );

                return (
                  <div key={action.action} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-foreground">{action.label}</p>
                        <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
                      </div>
                      <Badge variant={inProduct ? "success" : action.mode === "direct" ? "secondary" : "outline"}>
                        {inProduct ? "Ready in product" : action.mode === "direct" ? "Needs signer context" : "Settlement support needed"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        disabled={!inProduct || busyAction !== null || !action.enabled}
                        onClick={() => void runAction(action.action)}
                      >
                        {busyAction === action.action ? "Submitting..." : action.label}
                      </Button>
                      {!inProduct ? (
                        <p className="self-center text-xs leading-5 text-muted-foreground">
                          {action.mode === "studio"
                            ? "This action still needs recipient script or settlement context before we can run it directly here."
                            : "Reconnect the correct participant wallet to enable this action in-product."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}

            <div className="rounded-[1.25rem] border border-dashed border-primary/25 bg-primary/5 p-4 text-sm leading-6 text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" /><strong>Why lock scripts matter</strong></div>
              <p>
                The contract stores participant <strong className="text-foreground">lock hashes</strong> on chain. Settlement actions like release, refund, and dispute resolution still need the recipient's full lock script off chain, so the product keeps a local registry of those scripts instead of guessing.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Status</p>
              <p className="mt-2">{status}</p>
              {lastTxHash ? <p className="mt-2 break-all text-xs">Last transaction: {lastTxHash}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Participant lock scripts</CardTitle>
              <CardDescription>
                Save the full buyer, seller, or assigned arbitrator lock script here so settlement actions can be built directly from the product surface.
              </CardDescription>
            </div>
            <Button variant="outline" onClick={() => setShowScripts((value) => !value)}>
              {showScripts ? "Hide script editor" : "Show script editor"}
              <ArrowRight className={`h-4 w-4 transition-transform ${showScripts ? "rotate-90" : ""}`} />
            </Button>
          </CardHeader>
          {showScripts ? (
            <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <ParticipantScriptEditor
                title={record.buyerLabel}
                lockHash={record.buyerLockHash}
                storedScript={participantScripts[record.buyerLockHash]}
                onSave={saveParticipantScript}
              />
              <ParticipantScriptEditor
                title={record.sellerLabel}
                lockHash={record.sellerLockHash}
                storedScript={participantScripts[record.sellerLockHash]}
                onSave={saveParticipantScript}
              />
              <ParticipantScriptEditor
                title={record.arbitratorLabel}
                lockHash={record.arbitratorLockHash}
                storedScript={participantScripts[record.arbitratorLockHash]}
                onSave={saveParticipantScript}
              />
            </CardContent>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
