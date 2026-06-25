"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import { decodeEscrowData } from "@ckb-escrow/sdk";
import type { DisputeCaseRecord, DisputeRequestedOutcome, IndexedEscrowRecord } from "@ckb-escrow/indexer";
import {
  CalendarClock,
  CircleHelp,
  ExternalLink,
  FileText,
  Link2,
  MessageSquareWarning,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Store,
  Wallet,
} from "lucide-react";

import { formatEscrowError } from "../error-format";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { createExplorerTxUrl } from "../studio";
import type { EscrowListItem } from "../types";
import {
  ProductActionView,
  ProductEscrowRecord,
  findLiveEscrowForRoute,
  getIndexedCurrentOutPointForRoute,
  indexedEscrowReceiptRouteId,
  mergeProductEscrowRecords,
  toIndexedProductEscrow,
  toLiveProductEscrow,
} from "./contract";
import { DraftEvidenceItem, hashEvidenceText, productDisputeClient } from "./dispute-api";
import { productIndexerClient } from "./indexer-api";
import { findUpdatedEscrowRecord, pollForEscrowUpdate } from "./polling";
import { scriptHashFromStored, scriptLikeFromStored, storedScriptFromScriptLike } from "./registry";
import { createEscrowInput } from "./utils";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function ActionBadge({ source }: { source: ProductEscrowRecord["source"] }) {
  return <Badge variant={source === "live" ? "success" : "outline"}>{source === "live" ? "Live escrow" : "Indexed receipt"}</Badge>;
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

interface FileEvidenceDraft {
  name: string;
  size: number;
  type: string;
  lastModified: number;
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function buildEvidenceItems(input: {
  statement: string;
  links: string;
  files: FileEvidenceDraft[];
  submittedByLockHash: `0x${string}`;
}): Promise<DraftEvidenceItem[]> {
  const evidence: DraftEvidenceItem[] = [];
  const statement = input.statement.trim();
  if (statement) {
    evidence.push({
      type: "statement",
      label: "Participant statement",
      value: statement,
      uri: null,
      mimeType: "text/plain",
      sizeBytes: statement.length,
      contentHash: await hashEvidenceText(statement),
      submittedByLockHash: input.submittedByLockHash,
    });
  }

  for (const [index, uri] of splitLines(input.links).entries()) {
    evidence.push({
      type: "link",
      label: `Evidence link ${index + 1}`,
      value: uri,
      uri,
      mimeType: null,
      sizeBytes: null,
      contentHash: await hashEvidenceText(uri),
      submittedByLockHash: input.submittedByLockHash,
    });
  }

  for (const file of input.files) {
    const value = `${file.name}:${file.size}:${file.type}:${file.lastModified}`;
    evidence.push({
      type: "file",
      label: file.name,
      value,
      uri: null,
      mimeType: file.type || null,
      sizeBytes: file.size,
      contentHash: await hashEvidenceText(value),
      submittedByLockHash: input.submittedByLockHash,
    });
  }

  return evidence;
}


export function EscrowDetailProduct({ escrowId }: { escrowId: string }) {
  const router = useRouter();
  const {
    network,
    walletState,
    deployment,
    deploymentReady,
    escrows,
    indexedEscrows,
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
  const [indexedDetail, setIndexedDetail] = useState<IndexedEscrowRecord | null>(null);
  const [isFetchingIndexedDetail, setIsFetchingIndexedDetail] = useState(false);
  const [indexedDetailError, setIndexedDetailError] = useState<string | null>(null);
  const [timelineTimes, setTimelineTimes] = useState<Partial<Record<"Funded" | "Delivered" | "Disputed" | "Closed", string>>>({});
  const [disputeCase, setDisputeCase] = useState<DisputeCaseRecord | null>(null);
  const [isFetchingDisputeCase, setIsFetchingDisputeCase] = useState(false);
  const [disputePanelOpen, setDisputePanelOpen] = useState(false);
  const [disputeReason, setDisputeReason] = useState("");
  const [disputeOutcome, setDisputeOutcome] = useState<DisputeRequestedOutcome>("buyer");
  const [disputeStatement, setDisputeStatement] = useState("");
  const [disputeLinks, setDisputeLinks] = useState("");
  const [disputeFiles, setDisputeFiles] = useState<FileEvidenceDraft[]>([]);
  const [responseStatement, setResponseStatement] = useState("");
  const [responseLinks, setResponseLinks] = useState("");
  const [responseFiles, setResponseFiles] = useState<FileEvidenceDraft[]>([]);
  const [decisionNote, setDecisionNote] = useState("");
  const [exactLiveItem, setExactLiveItem] = useState<EscrowListItem | null>(null);

  useEffect(() => {
    if (!deploymentReady || isFetchingEscrows || hasFetchedEscrows) {
      return;
    }

    void refreshEscrows();
  }, [deploymentReady, hasFetchedEscrows, isFetchingEscrows, refreshEscrows]);

  const indexedRouteCandidates = useMemo(() => {
    if (!indexedDetail || indexedEscrows.some((escrow) => escrow.id === indexedDetail.id)) {
      return indexedEscrows;
    }

    return [...indexedEscrows, indexedDetail];
  }, [indexedDetail, indexedEscrows]);
  const discoveredLiveItem = useMemo(
    () => findLiveEscrowForRoute(escrows, escrowId, indexedRouteCandidates),
    [escrowId, escrows, indexedRouteCandidates],
  );
  const indexedCurrentOutPoint = useMemo(
    () => getIndexedCurrentOutPointForRoute(indexedRouteCandidates, escrowId),
    [escrowId, indexedRouteCandidates],
  );
  const liveItem = discoveredLiveItem ?? exactLiveItem;
  const indexedItem = useMemo(
    () => indexedEscrows.find((escrow) => escrow.id === escrowId) ?? indexedDetail,
    [escrowId, indexedDetail, indexedEscrows],
  );
  const record = useMemo(() => {
    if (liveItem) {
      return toLiveProductEscrow(liveItem, activeLockHash, chainTipTimestampMs);
    }
    if (indexedItem) {
      return toIndexedProductEscrow(indexedItem, activeLockHash, chainTipTimestampMs);
    }
    return null;
  }, [activeLockHash, chainTipTimestampMs, indexedItem, liveItem]);
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
    setIndexedDetail(null);
    setIndexedDetailError(null);
    setExactLiveItem(null);
  }, [escrowId, network]);

  useEffect(() => {
    async function loadExactLiveItem() {
      if (!deploymentReady || discoveredLiveItem || !indexedCurrentOutPoint) {
        if (discoveredLiveItem) {
          setExactLiveItem(null);
        }
        return;
      }

      try {
        const cell = await client.getCellLiveNoCache(
          {
            txHash: indexedCurrentOutPoint.txHash,
            index: BigInt(indexedCurrentOutPoint.index),
          },
          true,
          false,
        );
        if (!cell) {
          setExactLiveItem(null);
          return;
        }

        setExactLiveItem({
          txHash: cell.outPoint.txHash,
          index: cell.outPoint.index.toString(),
          capacity: cell.cellOutput.capacity.toString(),
          lock: cell.cellOutput.lock,
          decoded: decodeEscrowData(cell.outputData),
        });
      } catch {
        setExactLiveItem(null);
      }
    }

    void loadExactLiveItem();
  }, [client, deploymentReady, discoveredLiveItem, indexedCurrentOutPoint]);

  useEffect(() => {
    async function loadDisputeCase() {
      try {
        setIsFetchingDisputeCase(true);
        setDisputeCase(await productDisputeClient.getDisputeCase({ network, escrowId }));
      } catch {
        setDisputeCase(null);
      } finally {
        setIsFetchingDisputeCase(false);
      }
    }

    void loadDisputeCase();
  }, [escrowId, network]);

  useEffect(() => {
    async function loadIndexedDetail() {
      if (!deploymentReady || liveItem || indexedItem || isFetchingEscrows || !hasFetchedEscrows) {
        return;
      }

      try {
        setIsFetchingIndexedDetail(true);
        setIndexedDetailError(null);
        const fetched = await productIndexerClient.getEscrow({ network, escrowId });
        setIndexedDetail(fetched);
      } catch (error) {
        setIndexedDetailError(error instanceof Error ? error.message : String(error));
      } finally {
        setIsFetchingIndexedDetail(false);
      }
    }

    void loadIndexedDetail();
  }, [deploymentReady, escrowId, hasFetchedEscrows, indexedItem, isFetchingEscrows, liveItem, network]);

  useEffect(() => {
    async function loadTimelineTimes() {
      if (indexedItem) {
        const nextTimelineTimes: Partial<Record<"Funded" | "Delivered" | "Disputed" | "Closed", string>> = {};
        for (const event of indexedItem.events) {
          const timelineLabel =
            event.toState === "Completed" || event.toState === "Refunded" || event.toState === "Cancelled" || event.toState === "Resolved"
              ? "Closed"
              : event.toState;
          const timestampLabel = formatTimelineDateTime(event.blockTimestamp ?? event.createdAt);
          if (timestampLabel && !nextTimelineTimes[timelineLabel]) {
            nextTimelineTimes[timelineLabel] = timestampLabel;
          }
        }
        setTimelineTimes(nextTimelineTimes);
        return;
      }

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
  }, [client, indexedItem, liveItem]);

  async function openDisputeWithEvidence() {
    if (!service || !liveItem || !record || !activeLockHash) {
      return;
    }
    if (!disputeReason.trim()) {
      setStatus("Add a dispute reason before opening arbitration.");
      return;
    }
    const evidence = await buildEvidenceItems({
      statement: disputeStatement,
      links: disputeLinks,
      files: disputeFiles,
      submittedByLockHash: activeLockHash as `0x${string}`,
    });
    if (evidence.length === 0) {
      setStatus("Add at least one statement, link, or file metadata item before opening a dispute.");
      return;
    }

    try {
      setBusyAction("Dispute");
      setStatus("Submitting dispute transaction...");
      const txHash = await service.sendDispute(createEscrowInput(liveItem, deployment));
      setLastTxHash(txHash);
      const saved = await productDisputeClient.createDisputeCase({
        network,
        escrowId,
        disputeTxHash: txHash as `0x${string}`,
        openedByLockHash: activeLockHash as `0x${string}`,
        requestedOutcome: disputeOutcome,
        reason: disputeReason,
        evidence,
      });
      setDisputeCase(saved);
      setDisputePanelOpen(false);
      setStatus("Dispute submitted with evidence packet. Waiting for indexer confirmation.");
      await pollAfterAction({ txHash, previousRecord: record, expectedTerminal: false });
    } catch (error) {
      const { detail, hint } = formatEscrowError(error);
      setStatus(hint ? `${detail} ${hint}` : detail);
    } finally {
      setBusyAction(null);
    }
  }

  async function submitEvidenceResponse() {
    if (!activeLockHash) {
      setStatus("Connect a participant wallet before submitting evidence.");
      return;
    }
    const evidence = await buildEvidenceItems({
      statement: responseStatement,
      links: responseLinks,
      files: responseFiles,
      submittedByLockHash: activeLockHash as `0x${string}`,
    });
    if (evidence.length === 0) {
      setStatus("Add a response statement, link, or file metadata item first.");
      return;
    }
    try {
      setBusyAction("Dispute");
      const saved = await productDisputeClient.addEvidence({
        network,
        escrowId,
        submittedByLockHash: activeLockHash as `0x${string}`,
        evidence: evidence.map(({ submittedByLockHash: _submittedByLockHash, ...item }) => item),
      });
      setDisputeCase(saved);
      setResponseStatement("");
      setResponseLinks("");
      setResponseFiles([]);
      setStatus("Evidence response saved to the dispute case.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : String(error));
    } finally {
      setBusyAction(null);
    }
  }

  async function pollAfterAction(input: {
    txHash: string;
    previousRecord: ProductEscrowRecord;
    expectedTerminal: boolean;
  }) {
    setStatus("Transaction submitted, waiting for CKB/indexer confirmation...");
    const result = await pollForEscrowUpdate({
      previousRecord: input.previousRecord,
      submittedTxHash: input.txHash,
      expectedTerminal: input.expectedTerminal,
      refresh: async () => {
        const refreshed = await refreshEscrows();
        const liveRecords = refreshed.live.map((escrow) => toLiveProductEscrow(escrow, activeLockHash, chainTipTimestampMs));
        const indexedRecords = refreshed.indexed.map((escrow) => toIndexedProductEscrow(escrow, activeLockHash, chainTipTimestampMs));
        return { records: mergeProductEscrowRecords(indexedRecords, liveRecords) };
      },
    });

    if (result.status === "updated") {
      const receiptRouteId = input.expectedTerminal ? indexedEscrowReceiptRouteId(result.record) : null;
      if (receiptRouteId) {
        setStatus(`Escrow closed as ${result.record.state}. Opening indexed read-only receipt...`);
        router.replace(`/escrows/${encodeURIComponent(receiptRouteId)}`);
        return;
      }

      setStatus(`Escrow updated to ${result.record.state}.`);
      return;
    }

    setStatus("Still waiting for the new escrow state. You can refresh manually.");
  }

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
          if (!disputeCase) {
            throw new Error("Create or load the dispute evidence case before resolving in the product UI. Use Studio for raw protocol fallback.");
          }
          if (!decisionNote.trim()) {
            throw new Error("Add an arbitrator decision note before resolving this dispute.");
          }
          if (!buyerStoredScript) {
            throw new Error("Resolve to buyer is unavailable on this device because the buyer payout script is missing.");
          }
          txHash = await service.sendResolveToBuyer({
            escrowInput: cell,
            recipientLock: scriptLikeFromStored(buyerStoredScript),
          });
          await productDisputeClient.saveDecision({
            network,
            escrowId,
            outcome: "buyer",
            decisionNote,
            resolutionTxHash: txHash as `0x${string}`,
            decidedByLockHash: activeLockHash as `0x${string}`,
          }).then(setDisputeCase);
          break;
        case "ResolveToSeller":
          if (!disputeCase) {
            throw new Error("Create or load the dispute evidence case before resolving in the product UI. Use Studio for raw protocol fallback.");
          }
          if (!decisionNote.trim()) {
            throw new Error("Add an arbitrator decision note before resolving this dispute.");
          }
          if (!sellerStoredScript) {
            throw new Error("Resolve to seller is unavailable on this device because the seller payout script is missing.");
          }
          txHash = await service.sendResolveToSeller({
            escrowInput: cell,
            recipientLock: scriptLikeFromStored(sellerStoredScript),
          });
          await productDisputeClient.saveDecision({
            network,
            escrowId,
            outcome: "seller",
            decisionNote,
            resolutionTxHash: txHash as `0x${string}`,
            decidedByLockHash: activeLockHash as `0x${string}`,
          }).then(setDisputeCase);
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
      await pollAfterAction({ txHash, previousRecord: record, expectedTerminal: isTerminalAction });
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

  if (!record && (isFetchingEscrows || !hasFetchedEscrows || isFetchingIndexedDetail)) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Loading escrow</p>
            <p className="text-sm text-muted-foreground">
              Fetching live cells first, then checking the indexer for closed escrow history.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!record && (escrowFetchError || indexedDetailError)) {
    return (
      <div className="mx-auto w-full max-w-[960px] px-4 py-10 md:px-6">
        <Card>
          <CardContent className="space-y-4 p-8">
            <p className="text-lg font-semibold">Could not load this escrow yet</p>
            <p className="text-sm text-muted-foreground">{escrowFetchError ?? indexedDetailError}</p>
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
              We refreshed live escrows and checked the indexer for {network}, but this `txHash:index` route was not present. Confirm the network and retry discovery before assuming the escrow is missing.
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
              <CardTitle className="flex items-center gap-2"><MessageSquareWarning className="h-5 w-5 text-primary" />Dispute evidence</CardTitle>
              <CardDescription>Evidence stays off-chain for v1, but every item is hashed and linked to the escrow dispute case.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isFetchingDisputeCase ? (
                <p className="text-sm text-muted-foreground">Checking dispute case...</p>
              ) : disputeCase ? (
                <div className="space-y-4">
                  <div className="rounded-[1.25rem] border border-primary/20 bg-primary/6 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={disputeCase.status === "resolved" ? "success" : "destructive"}>{disputeCase.status}</Badge>
                      <Badge variant="outline">Requested: {disputeCase.requestedOutcome}</Badge>
                    </div>
                    <p className="mt-3 font-medium text-foreground">{disputeCase.reason}</p>
                    <p className="mt-2 break-all text-xs text-muted-foreground">Bundle hash: {disputeCase.evidenceBundleHash}</p>
                  </div>

                  <div className="space-y-3">
                    {disputeCase.evidence.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No evidence has been submitted yet.</p>
                    ) : (
                      disputeCase.evidence.map((item) => (
                        <div key={item.id} className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">{item.type}</Badge>
                            <span className="text-sm font-medium text-foreground">{item.label}</span>
                          </div>
                          <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.value}</p>
                          {item.uri ? (
                            <Link href={item.uri} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-medium text-primary">
                              <Link2 className="h-4 w-4" /> Open evidence link
                            </Link>
                          ) : null}
                          <p className="mt-2 break-all text-xs text-muted-foreground">Hash: {item.contentHash}</p>
                          <p className="mt-1 text-xs text-muted-foreground">Submitted by {shortHash(item.submittedByLockHash)}</p>
                        </div>
                      ))
                    )}
                  </div>

                  {record.state === "Disputed" && (record.viewerRole === "buyer" || record.viewerRole === "seller") ? (
                    <div className="rounded-[1.25rem] border border-dashed border-border bg-secondary/45 p-4">
                      <p className="font-medium text-foreground">Submit a response</p>
                      <textarea value={responseStatement} onChange={(event) => setResponseStatement(event.target.value)} placeholder="Add your response for the arbitrator" className="mt-3 min-h-28 w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                      <textarea value={responseLinks} onChange={(event) => setResponseLinks(event.target.value)} placeholder="Evidence links, one per line" className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                      <input type="file" multiple className="mt-3 block w-full text-sm text-muted-foreground" onChange={(event) => setResponseFiles(Array.from(event.target.files ?? []).map((file) => ({ name: file.name, size: file.size, type: file.type, lastModified: file.lastModified })))} />
                      <Button className="mt-3" disabled={busyAction !== null} onClick={() => void submitEvidenceResponse()}>Save response evidence</Button>
                    </div>
                  ) : null}

                  {record.state === "Disputed" && record.viewerRole === "arbitrator" ? (
                    <div className="rounded-[1.25rem] border border-primary/20 bg-white/80 p-4">
                      <p className="font-medium text-foreground">Arbitrator decision note</p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">The product blocks direct resolution until this note is written. Studio remains available for raw protocol debugging.</p>
                      <textarea value={decisionNote} onChange={(event) => setDecisionNote(event.target.value)} placeholder="Explain the decision before resolving to buyer or seller" className="mt-3 min-h-28 w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                      {disputeCase.decision ? <p className="mt-3 text-sm text-muted-foreground">Decision already recorded: {disputeCase.decision.decisionNote}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : disputePanelOpen ? (
                <div className="rounded-[1.25rem] border border-primary/20 bg-primary/6 p-4">
                  <p className="font-medium text-foreground">Open an arbitration case</p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-medium text-muted-foreground">Requested outcome
                      <select value={disputeOutcome} onChange={(event) => setDisputeOutcome(event.target.value as DisputeRequestedOutcome)} className="mt-2 h-11 w-full rounded-full border border-border bg-white/80 px-4 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10">
                        <option value="buyer">Refund buyer</option>
                        <option value="seller">Pay seller</option>
                      </select>
                    </label>
                    <label className="text-sm font-medium text-muted-foreground">Reason
                      <input value={disputeReason} onChange={(event) => setDisputeReason(event.target.value)} placeholder="What went wrong?" className="mt-2 h-11 w-full rounded-full border border-border bg-white/80 px-4 text-sm text-foreground outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                    </label>
                  </div>
                  <textarea value={disputeStatement} onChange={(event) => setDisputeStatement(event.target.value)} placeholder="Write your evidence statement" className="mt-3 min-h-28 w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <textarea value={disputeLinks} onChange={(event) => setDisputeLinks(event.target.value)} placeholder="Evidence links, one per line" className="mt-3 min-h-20 w-full rounded-2xl border border-border bg-white/80 px-4 py-3 text-sm outline-none focus:border-primary focus:ring-4 focus:ring-primary/10" />
                  <input type="file" multiple className="mt-3 block w-full text-sm text-muted-foreground" onChange={(event) => setDisputeFiles(Array.from(event.target.files ?? []).map((file) => ({ name: file.name, size: file.size, type: file.type, lastModified: file.lastModified })))} />
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button disabled={busyAction !== null} onClick={() => void openDisputeWithEvidence()}>{busyAction === "Dispute" ? "Submitting..." : "Submit dispute with evidence"}</Button>
                    <Button variant="outline" onClick={() => setDisputePanelOpen(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-[1.25rem] border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                  <FileText className="mb-3 h-5 w-5 text-primary" />
                  No dispute case is recorded for this escrow yet. If a participant opens a dispute, the product will collect the reason and evidence before submitting the on-chain state change.
                </div>
              )}
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
                          onClick={() => {
                            if (action.action === "Dispute") {
                              setDisputePanelOpen(true);
                              return;
                            }
                            void runAction(action.action);
                          }}
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
