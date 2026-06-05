"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { decodeEscrowData } from "@ckb-escrow/sdk";
import {
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
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { createExplorerTxUrl } from "../studio";
import { ProductActionView, ProductEscrowRecord, makeLiveEscrowId, toLiveProductEscrow } from "./contract";
import { createEscrowInput } from "./utils";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function ActionBadge({ source }: { source: ProductEscrowRecord["source"] }) {
  return <Badge variant={source === "live" ? "success" : "outline"}>Live escrow</Badge>;
}

function canExecuteInProduct(
  action: ProductActionView,
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
    default:
      return false;
  }
}

function formatTimelineDateTime(value: bigint | number | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
    client,
  } = useProductWorkspaceContext();
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [timelineTimes, setTimelineTimes] = useState<Partial<Record<"Funded" | "Delivered" | "Disputed" | "Closed", string>>>({});

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

  useEffect(() => {
    async function loadTimelineTimes() {
      if (!liveItem) {
        setTimelineTimes({});
        return;
      }

      const nextTimelineTimes: Partial<Record<"Funded" | "Delivered" | "Disputed" | "Closed", string>> = {};
      let cursorTxHash = liveItem.txHash;
      let cursorIndex = liveItem.index;
      const visited = new Set<string>();

      while (cursorTxHash && !visited.has(`${cursorTxHash}:${cursorIndex}`)) {
        visited.add(`${cursorTxHash}:${cursorIndex}`);
        const response = await client.getTransactionWithHeader(cursorTxHash);
        if (!response?.transaction) {
          break;
        }

        const transaction = response.transaction as unknown as {
          inputs?: Array<{ previousOutput?: { txHash?: string; index?: bigint | number | string } }>;
          outputsData?: string[];
        };
        const outputIndex = Number(cursorIndex);
        const outputData = transaction.outputsData?.[outputIndex];
        if (!outputData) {
          break;
        }

        try {
          const decoded = decodeEscrowData(outputData as `0x${string}`);
          const timelineLabel =
            decoded.state === "Completed" || decoded.state === "Refunded" || decoded.state === "Cancelled" || decoded.state === "Resolved"
              ? "Closed"
              : decoded.state;
          const timestampLabel = formatTimelineDateTime(response.header?.timestamp);
          if (timestampLabel && !nextTimelineTimes[timelineLabel]) {
            nextTimelineTimes[timelineLabel] = timestampLabel;
          }

          if (decoded.state === "Funded") {
            break;
          }
        } catch {
          break;
        }

        const previousOutput = transaction.inputs?.[0]?.previousOutput;
        if (!previousOutput?.txHash || previousOutput.index == null) {
          break;
        }

        cursorTxHash = previousOutput.txHash;
        cursorIndex = String(previousOutput.index);
      }

      setTimelineTimes(nextTimelineTimes);
    }

    void loadTimelineTimes();
  }, [client, liveItem]);

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
        case "Complete":
        case "ResolveToBuyer":
        case "ResolveToSeller":
          throw new Error("This action is not available in the current product flow yet.");
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

        <Card className="self-start">
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

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>State progression stays aligned with the escrow state machine.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {record.timeline.map((step) => {
              const stepTimestamp = timelineTimes[step.label as keyof typeof timelineTimes] ?? null;
              return (
                <div key={step.label} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant={step.status === "done" ? "success" : step.status === "current" ? "secondary" : "outline"}>{step.status}</Badge>
                    <strong>{step.label}</strong>
                  </div>
                  <p className="text-sm text-muted-foreground">{step.note}</p>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">
                    {stepTimestamp
                      ? step.status === "current"
                        ? `Updated ${stepTimestamp}`
                        : `Recorded ${stepTimestamp}`
                      : step.status === "pending"
                        ? "Time appears after this step is confirmed."
                        : "Earlier in escrow history."}
                  </p>
                </div>
              );
            })}
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
                        {inProduct ? "Ready in product" : action.mode === "direct" ? "Needs signer context" : "Not available yet"}
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
                            ? "This action is not available in the current product flow yet."
                            : "Reconnect the correct participant wallet to enable this action in-product."}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}

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
