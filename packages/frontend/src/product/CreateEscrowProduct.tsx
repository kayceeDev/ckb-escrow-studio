"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import {
  AlertTriangle,
  CalendarClock,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Scale,
  ShieldCheck,
  Store,
  Vault,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "../components/ui";
import { formatEscrowError } from "../error-format";
import {
  hasActiveArbitratorPool,
  resolveArbitratorPool,
  selectAssignedArbitrator,
  type ProductArbitratorConfig,
} from "../config/deployments";
import { createExplorerTxUrl, makeEscrowLock } from "../studio";
import { makeLiveEscrowId } from "./contract";
import { storedScriptFromScriptLike } from "./registry";
import { useProductWorkspaceContext } from "./ProductWorkspaceContext";

function parseCkbToShannons(value: string): bigint {
  const normalized = value.trim();
  if (!/^\d+(\.\d{0,8})?$/.test(normalized)) {
    throw new Error("Amount must be a valid CKB value with up to 8 decimal places.");
  }

  const parts = normalized.split(".");
  const whole = parts[0] ?? "0";
  const fraction = parts[1] ?? "";
  return BigInt(whole) * 100_000_000n + BigInt((fraction + "00000000").slice(0, 8));
}

function useAssignedArbitratorLabel(arbitrator: ProductArbitratorConfig | null): string {
  if (!arbitrator) {
    return "No arbitrator assigned";
  }

  return arbitrator.label || "Platform arbitrator assigned";
}

export function CreateEscrowProduct() {
  const {
    network,
    setNetwork,
    client,
    walletState,
    deployment,
    deploymentReady,
    service,
    status: workspaceStatus,
    saveParticipantScript,
    refreshEscrows,
  } = useProductWorkspaceContext();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sellerAddress, setSellerAddress] = useState("");
  const [amountCkb, setAmountCkb] = useState("350");
  const [deadline, setDeadline] = useState("");
  const [referenceId, setReferenceId] = useState("INV-042");
  const [description, setDescription] = useState("Landing page redesign and responsive polish for the first milestone.");
  const [status, setStatus] = useState("Fill the form, connect a buyer wallet, and submit a live escrow on testnet.");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");
  const [lastEscrowId, setLastEscrowId] = useState("");
  const [assignedArbitrator, setAssignedArbitrator] = useState<ProductArbitratorConfig | null>(null);

  const arbitratorPool = useMemo(() => resolveArbitratorPool(network), [network]);
  const hasAvailableArbitratorPool = useMemo(
    () => hasActiveArbitratorPool(network, arbitratorPool),
    [arbitratorPool, network],
  );
  const assignedArbitratorLabel = useAssignedArbitratorLabel(assignedArbitrator);

  useEffect(() => {
    async function assignArbitrator() {
      if (!walletState.activeSigner || !sellerAddress.trim() || !hasAvailableArbitratorPool) {
        setAssignedArbitrator(null);
        return;
      }

      try {
        const buyerAddress = await walletState.activeSigner.getRecommendedAddressObj();
        const selection = selectAssignedArbitrator({
          network,
          buyerLockHash: ccc.Script.from(buyerAddress.script).hash(),
          sellerAddress,
          referenceId,
          pool: arbitratorPool,
        });
        setAssignedArbitrator(selection);
      } catch {
        setAssignedArbitrator(null);
      }
    }

    void assignArbitrator();
  }, [arbitratorPool, hasAvailableArbitratorPool, network, referenceId, sellerAddress, walletState.activeSigner]);

  const formReady = useMemo(
    () =>
      Boolean(
        walletState.activeSigner &&
          sellerAddress &&
          amountCkb &&
          deadline &&
          description &&
          assignedArbitrator,
      ),
    [amountCkb, assignedArbitrator, deadline, description, sellerAddress, walletState.activeSigner],
  );

  async function resolveScripts() {
    if (!walletState.activeSigner) {
      throw new Error("Connect the buyer wallet first.");
    }

    if (!assignedArbitrator) {
      throw new Error("No active arbitrator is available for this network.");
    }

    const buyerAddress = await walletState.activeSigner.getRecommendedAddressObj();
    const seller = await ccc.Address.fromString(sellerAddress, client);
    const arbitrator = await ccc.Address.fromString(assignedArbitrator.address, client);

    return {
      buyerScript: buyerAddress.script,
      sellerScript: seller.script,
      arbitratorScript: arbitrator.script,
    };
  }

  async function saveParticipantScripts() {
    const { buyerScript, sellerScript, arbitratorScript } = await resolveScripts();
    const buyerStored = storedScriptFromScriptLike(buyerScript, "Buyer");
    const sellerStored = storedScriptFromScriptLike(sellerScript, "Seller");
    const arbitratorStored = storedScriptFromScriptLike(
      arbitratorScript,
      assignedArbitrator?.label || "Platform arbitrator",
    );
    saveParticipantScript(ccc.Script.from(buyerScript).hash(), buyerStored);
    saveParticipantScript(ccc.Script.from(sellerScript).hash(), sellerStored);
    saveParticipantScript(ccc.Script.from(arbitratorScript).hash(), arbitratorStored);
  }

  async function createEscrow() {
    if (!service) {
      setStatus(`Connect a buyer wallet. If this persists, ${network} escrow deployment is not configured for this app yet.`);
      return;
    }

    if (!deploymentReady) {
      setStatus(`${network} escrow deployment is unavailable in this app build.`);
      return;
    }

    if (!hasAvailableArbitratorPool || !assignedArbitrator) {
      setStatus(`Arbitration unavailable on ${network}. Add at least one active platform arbitrator before creating escrows.`);
      return;
    }

    try {
      setBusy(true);
      const { sellerScript, arbitratorScript } = await resolveScripts();
      const amountShannons = parseCkbToShannons(amountCkb);
      const deadlineMs = BigInt(new Date(deadline).getTime());
      if (deadlineMs <= BigInt(Date.now())) {
        throw new Error("Deadline must be a valid future date/time.");
      }

      const fullDescription = referenceId ? `${referenceId}: ${description}` : description;

      const txHash = await service.sendCreateEscrow({
        sellerLock: sellerScript,
        arbitratorLock: arbitratorScript,
        escrowLock: makeEscrowLock(deployment),
        amountShannons,
        deadlineMs,
        description: fullDescription,
      });

      await saveParticipantScripts();
      await refreshEscrows();
      setLastTxHash(txHash);
      setLastEscrowId(makeLiveEscrowId(txHash, "0"));
      setStatus(`Create escrow submitted on ${network} with ${assignedArbitratorLabel}. The dashboard can now refresh against live cells.`);
    } catch (error) {
      const { detail, hint } = formatEscrowError(error);
      setStatus(hint ? `${detail} ${hint}` : detail);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant="success">Create Escrow</Badge>
        <Badge variant="secondary">Buyer journey</Badge>
        <Badge variant="outline" className="capitalize">{network}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create a New Escrow</CardTitle>
            <CardDescription>
              This is the standalone buyer flow: real participant addresses, a connected buyer wallet, deployment metadata provided by the app, and automatic platform arbitrator assignment for the active network.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setNetwork("testnet")}
                className={`rounded-[1.25rem] border p-4 text-left transition ${network === "testnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Testnet</span></div>
                <p className="text-sm text-muted-foreground">Default buyer-facing network with live deployment metadata and platform-managed arbitration.</p>
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`rounded-[1.25rem] border p-4 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                <p className="text-sm text-muted-foreground">Structurally supported, but it stays gated until complete production deployment metadata and active arbitrators are ready.</p>
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-primary/20 bg-primary/8 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                <span className="text-sm font-semibold">What happens next?</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Once funded, the escrow stays in a <strong className="text-foreground">Funded</strong> state until the seller marks it delivered or the buyer chooses another valid action path. The app assigns a platform arbitrator automatically before create.
              </p>
            </div>

            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.activeSigner ? "Buyer wallet connected" : "Connect buyer wallet"}
                </Badge>
                <Badge variant={deploymentReady ? "success" : "destructive"}>
                  {deploymentReady ? `${network} deployment ready` : `No ${network} deployment`}
                </Badge>
                <Badge variant={hasAvailableArbitratorPool ? "success" : "destructive"}>
                  {hasAvailableArbitratorPool ? "Arbitration ready" : "Arbitration unavailable"}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Use the wallet control in the navbar to select the buyer signer. Buyers never enter protocol metadata or choose arbitrators manually in this flow.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><Store className="h-4 w-4" />Seller Wallet / Address</Label>
                <Input value={sellerAddress} onChange={(event) => setSellerAddress(event.target.value)} placeholder={network === "testnet" ? "ckt1..." : "ckb1..."} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><Scale className="h-4 w-4" />Amount (CKB)</Label>
                <Input value={amountCkb} onChange={(event) => setAmountCkb(event.target.value)} placeholder="350" />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><CalendarClock className="h-4 w-4" />Deadline</Label>
                <Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><Vault className="h-4 w-4" />Reference / Order ID</Label>
                <Input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} placeholder="INV-042" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><FileText className="h-4 w-4" />Description</Label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe the service, milestone, or goods being escrowed." />
            </div>

            <Card className="border-dashed bg-secondary/50 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Platform arbitrator assignment</CardTitle>
                <CardDescription>
                  Buyers do not pick arbitrators here. The product automatically selects one active platform arbitrator for the current network using deterministic rotation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.25rem] border border-border bg-white/80 p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Assigned arbitrator</p>
                  <p className="font-medium text-foreground">{assignedArbitratorLabel}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {assignedArbitrator
                      ? `${assignedArbitrator.address} will be committed into escrow data at creation time.`
                      : `No active arbitrator is currently configured for ${network}.`}
                  </p>
                </div>
                {!hasAvailableArbitratorPool ? (
                  <p className="text-sm text-destructive">
                    Arbitration unavailable on this network. Add at least one active arbitrator before creating new escrows.
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setShowAdvanced((value) => !value)}
              >
                <div>
                  <p className="font-medium text-foreground">Advanced deployment details</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Buyers usually do not need this. The product reads escrow lock metadata from typed frontend config.
                  </p>
                </div>
                <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
              </button>
              {showAdvanced ? (
                <div className="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                  <div className="rounded-[1.25rem] border border-border bg-secondary/40 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Escrow lock</p>
                    <p className="break-all text-foreground">{deployment.escrowLockCodeHash || "Not configured"}</p>
                    <p className="mt-2 break-all">Args: {deployment.escrowLockArgs || "0x"}</p>
                  </div>
                  {!deploymentReady ? (
                    <p className="text-destructive">
                      {network} escrow deployment is not configured for this app build yet.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" disabled={!formReady || !deploymentReady || !hasAvailableArbitratorPool || busy} onClick={() => void createEscrow()}>
                {busy ? "Submitting escrow..." : "Create & Fund Escrow"}
              </Button>
              <Button size="lg" variant="outline" onClick={() => void refreshEscrows()} disabled={!deploymentReady || busy}>
                Refresh dashboard
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer Checklist</CardTitle>
            <CardDescription>
              Real buyer wallet first, then seller and order details, then a live escrow with a platform-assigned arbitrator.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">Before you fund</p>
              <ul className="space-y-2">
                <li>Connect the buyer wallet that will fund the escrow.</li>
                <li>Use `ckt` addresses on testnet and `ckb` addresses on mainnet.</li>
                <li>The app assigns a vetted platform arbitrator automatically for the selected network.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">MVP help</p>
              <ul className="space-y-2">
                <li>Funds live inside escrow cells on CKB, not in an admin balance.</li>
                <li>Participant roles are matched by lock hash from the connected wallet.</li>
                <li>The arbitrator is fixed at creation time, so the platform assigns one before the transaction is built.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-dashed border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" /><strong>Status</strong></div>
              <p>{status}</p>
              <p className="mt-2 text-xs">Workspace: {workspaceStatus}</p>
              {lastTxHash ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="break-all text-xs">Last transaction: {lastTxHash}</p>
                  <p className="text-xs">Assigned arbitrator: {assignedArbitratorLabel}</p>
                  <Button asChild variant="outline" className="justify-between">
                    <Link href={createExplorerTxUrl(lastTxHash, network)} target="_blank" rel="noreferrer">
                      View on explorer
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href={`/escrows/${encodeURIComponent(lastEscrowId)}`}>
                      Open escrow detail
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
