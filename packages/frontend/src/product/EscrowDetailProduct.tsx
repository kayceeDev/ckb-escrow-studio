"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
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
import {
  ProductActionView,
  ProductEscrowRecord,
  makeLiveEscrowId,
  toLiveProductEscrow,
} from "./contract";
import { scriptHashFromStored, scriptLikeFromStored, storedScriptFromScriptLike } from "./registry";
import { createEscrowInput } from "./utils";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function ActionBadge({ source }: { source: ProductEscrowRecord["source"] }) {
  return <Badge variant={source === "live" ? "success" : "outline"}>Live escrow</Badge>;
}

function canExecuteInProduct(
  action: ProductActionView,
  hasService: boolean,
  isLive: boolean,
  scripts: { buyer: boolean; seller: boolean },
): boolean {
  if (!isLive || !hasService || !action.enabled) {
    return false;
  }

  switch (action.action) {
    case "Deliver":
    case "Dispute":
    case "Cancel":
    case "Refund":
      return true;
    case "Complete":
    case "ResolveToSeller":
      return scripts.seller;
    case "ResolveToBuyer":
      return scripts.buyer;
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

function recipientRequirementForAction(
  action: ProductActionView["action"],
  record: ProductEscrowRecord,
): { role: "buyer" | "seller"; lockHash: string; label: string } | null {
  switch (action) {
    case "Complete":
    case "ResolveToSeller":
      return { role: "seller", lockHash: record.sellerLockHash, label: "Seller payout script" };
    case "ResolveToBuyer":
      return { role: "buyer", lockHash: record.buyerLockHash, label: "Buyer refund script" };
    default:
      return null;
  }
}

function shortHash(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
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
    chainTipTimestampMs,
    service,
    client,
    participantScripts,
    saveParticipantScript,
  } = useProductWorkspaceContext();
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [recoveryAddress, setRecoveryAddress] = useState("");
  const [recoveryStatus, setRecoveryStatus] = useState("");
  const [recoveryBusy, setRecoveryBusy] = useState(false);
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
      return toLiveProductEscrow(liveItem, activeLockHash, chainTipTimestampMs);
    }
    return null;
  }, [activeLockHash, chainTipTimestampMs, liveItem]);
  const buyerStoredScript = useMemo(
    () => (record ? participantScripts[record.buyerLockHash] ?? null : null),
    [participantScripts, record],
  );
  const sellerStoredScript = useMemo(
    () => (record ? participantScripts[record.sellerLockHash] ?? null : null),
    [participantScripts, record],
  );
  const hasBuyerScript = buyerStoredScript != null;
  const hasSellerScript = sellerStoredScript != null;

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
        case "Refund": {
          const referenceHeader = await client.getTipHeader();
          txHash = await service.sendRefund({
            escrowInput: cell,
            referenceTimestampMs: BigInt(String(referenceHeader.timestamp)),
            headerDeps: [referenceHeader.hash],
          });
          break;
        }
        case "Complete":
          if (!sellerStoredScript) {
            throw new Error("Release funds is unavailable on this device because the seller payout script is missing.");
          }
          txHash = await service.sendComplete({
            escrowInput: cell,
            sellerLock: scriptLikeFromStored(sellerStoredScript),
          });
          break;
        case "ResolveToBuyer":
          if (!buyerStoredScript) {
            throw new Error("Resolve to buyer is unavailable on this device because the buyer payout script is missing.");
          }
          txHash = await service.sendResolveToBuyer({
            escrowInput: cell,
            recipientLock: scriptLikeFromStored(buyerStoredScript),
          });
          break;
        case "ResolveToSeller":
          if (!sellerStoredScript) {
            throw new Error("Resolve to seller is unavailable on this device because the seller payout script is missing.");
          }
          txHash = await service.sendResolveToSeller({
            escrowInput: cell,
            recipientLock: scriptLikeFromStored(sellerStoredScript),
          });
          break;
        default:
          throw new Error(`${action} still requires settlement support this week.`);
      }

      setLastTxHash(txHash);
      const isTerminalAction = ["Cancel", "Refund", "Complete", "ResolveToBuyer", "ResolveToSeller"].includes(action);
      setStatus(
        isTerminalAction
          ? `${action} submitted. Waiting for the escrow indexer to recover the closed history record.`
          : `${action} submitted.`,
      );
      await refreshEscrows();
    } catch (error) {
      const { detail, hint } = formatEscrowError(error);
      setStatus(hint ? `${detail} ${hint}` : detail);
    } finally {
      setBusyAction(null);
    }
  }

  async function saveRecipientScript(requirement: { role: "buyer" | "seller"; lockHash: string; label: string }) {
    try {
      setRecoveryBusy(true);
      setRecoveryStatus(`Checking ${requirement.role} address...`);
      const address = await ccc.Address.fromString(recoveryAddress.trim(), client);
      const stored = storedScriptFromScriptLike(address.script, requirement.label);
      const recoveredHash = scriptHashFromStored(stored).toLowerCase();
      const expectedHash = requirement.lockHash.toLowerCase();

      if (recoveredHash !== expectedHash) {
        throw new Error(
          `This address resolves to ${shortHash(recoveredHash)}, but the escrow expects ${shortHash(expectedHash)}.`,
        );
      }

      saveParticipantScript(requirement.lockHash, stored);
      setRecoveryAddress("");
      setRecoveryStatus(`${requirement.label} saved. The settlement action is now available.`);
    } catch (error) {
      setRecoveryStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setRecoveryBusy(false);
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_360px]">
        <div className="space-y-6">
          <Card>
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
                  const requirement = recipientRequirementForAction(action.action, record);
                  const hasRequiredRecipientScript = requirement
                    ? Boolean(participantScripts[requirement.lockHash])
                    : true;
                  const inProduct = canExecuteInProduct(
                    action,
                    Boolean(service),
                    record.source === "live",
                    { buyer: hasBuyerScript, seller: hasSellerScript },
                  );

                  return (
                    <div key={action.action} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{action.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{action.description}</p>
                        </div>
                        <Badge variant={inProduct ? "success" : action.mode === "direct" ? "secondary" : "outline"}>
                          {inProduct ? "Ready in product" : requirement && !hasRequiredRecipientScript ? "Needs payout script" : action.mode === "direct" ? "Needs signer context" : "Studio fallback"}
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
                            {requirement && !hasRequiredRecipientScript
                              ? `${requirement.label} is required before the app can build the payout transaction.`
                              : action.mode === "studio"
                                ? "Open Studio if you need raw debug controls for this action."
                                : "Reconnect the correct participant wallet to enable this action in-product."}
                          </p>
                        ) : null}
                      </div>
                      {requirement && !hasRequiredRecipientScript ? (
                        <div className="mt-4 rounded-[1rem] border border-dashed border-primary/35 bg-primary/5 p-4">
                          <p className="text-sm font-medium text-foreground">Recover {requirement.role} payout script</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            The contract stores participant lock hashes for authorization, but settlement outputs need the full recipient lock script. Paste the {requirement.role} testnet/mainnet address that matches {shortHash(requirement.lockHash)} and the app will verify it before saving.
                          </p>
                          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                            <input
                              value={recoveryAddress}
                              onChange={(event) => setRecoveryAddress(event.target.value)}
                              placeholder={`${requirement.role} CKB address`}
                              className="min-h-11 flex-1 rounded-full border border-border bg-white/80 px-4 text-sm outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                            />
                            <Button
                              type="button"
                              variant="outline"
                              disabled={recoveryBusy || recoveryAddress.trim().length === 0}
                              onClick={() => void saveRecipientScript(requirement)}
                            >
                              {recoveryBusy ? "Saving..." : "Save script"}
                            </Button>
                          </div>
                          {recoveryStatus ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{recoveryStatus}</p> : null}
                        </div>
                      ) : null}
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

        <div className="space-y-6 self-start xl:sticky xl:top-24">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Connected signer</CardTitle>
              <CardDescription>Use the navbar wallet control to switch signer or network.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.activeSigner ? "Signer selected" : "No signer"}
                </Badge>
                <Badge variant={record.viewerRole === "viewer" ? "outline" : "success"}>
                  {record.viewerRole}
                </Badge>
                <Badge variant="secondary">{network}</Badge>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="text-sm leading-6 text-muted-foreground">
                  The selected signer is matched against the buyer, seller, and assigned arbitrator lock hashes. Switch wallets from the top-right control if this page is read-only.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Each state change stays in escrow order, with on-chain date and time when it can be recovered.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {record.timeline.map((step, index) => {
                const stepTimestamp = timelineTimes[step.label as keyof typeof timelineTimes] ?? null;
                const statusLabel =
                  step.status === "done" ? "Done" : step.status === "current" ? "Current" : "Pending";
                const timeLabel = stepTimestamp
                  ? step.status === "current"
                    ? `Updated ${stepTimestamp}`
                    : `Recorded ${stepTimestamp}`
                  : step.status === "pending"
                    ? "Date and time appear after this step is confirmed."
                    : "On-chain time is not recoverable from the current history view.";

                return (
                  <div key={step.label} className="flex gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <span
                        className={`h-3 w-3 rounded-full border ${
                          step.status === "done"
                            ? "border-emerald-300 bg-emerald-500"
                            : step.status === "current"
                              ? "border-primary bg-primary"
                              : "border-border bg-background"
                        }`}
                      />
                      {index < record.timeline.length - 1 ? <span className="mt-2 h-full w-px bg-border" /> : null}
                    </div>
                    <div className={`min-w-0 flex-1 rounded-[1.25rem] border p-4 transition ${
                      step.status === "current"
                        ? "border-border bg-white/90"
                        : "border-border/70 bg-secondary/35 text-muted-foreground"
                    }`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-foreground">{step.label}</p>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.note}</p>
                        </div>
                        <Badge variant={step.status === "done" ? "success" : step.status === "current" ? "secondary" : "outline"}>
                          {statusLabel}
                        </Badge>
                      </div>
                      <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-secondary/55 px-3 py-1.5 text-xs leading-5 text-muted-foreground">
                        <CalendarClock className="h-3.5 w-3.5 shrink-0 text-primary" />
                        <span>{timeLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
