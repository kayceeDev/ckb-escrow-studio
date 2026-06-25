"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import {
  AlertTriangle,
  CalendarClock,
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
  const router = useRouter();
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
  const [sellerMatchesBuyer, setSellerMatchesBuyer] = useState(false);

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
        setSellerMatchesBuyer(false);
        return;
      }

      try {
        const buyerAddress = await walletState.activeSigner.getRecommendedAddressObj();
        const seller = await ccc.Address.fromString(sellerAddress, client);
        const buyerLockHash = ccc.Script.from(buyerAddress.script).hash().toLowerCase();
        const sellerLockHash = ccc.Script.from(seller.script).hash().toLowerCase();
        const isSelfEscrow = buyerLockHash === sellerLockHash;

        setSellerMatchesBuyer(isSelfEscrow);
        if (isSelfEscrow) {
          setAssignedArbitrator(null);
          return;
        }

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
        setSellerMatchesBuyer(false);
      }
    }

    void assignArbitrator();
  }, [arbitratorPool, client, hasAvailableArbitratorPool, network, referenceId, sellerAddress, walletState.activeSigner]);

  const formReady = useMemo(
    () =>
      Boolean(
        walletState.activeSigner &&
          sellerAddress &&
          amountCkb &&
          deadline &&
          description &&
          assignedArbitrator &&
          !sellerMatchesBuyer,
      ),
    [amountCkb, assignedArbitrator, deadline, description, sellerAddress, sellerMatchesBuyer, walletState.activeSigner],
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
    const buyerLockHash = ccc.Script.from(buyerAddress.script).hash().toLowerCase();
    const sellerLockHash = ccc.Script.from(seller.script).hash().toLowerCase();

    if (buyerLockHash === sellerLockHash) {
      throw new Error("Buyer and seller must be different wallets.");
    }

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
      const refreshedEscrows = await refreshEscrows();
      const createdEscrow = refreshedEscrows.live.find((escrow) => escrow.txHash === txHash);
      const nextEscrowId = createdEscrow ? createdEscrow.txHash : txHash;
      setLastTxHash(txHash);
      setLastEscrowId(nextEscrowId);
      setStatus(`Create escrow submitted on ${network} with ${assignedArbitratorLabel}. Redirecting to your escrow list...`);
      router.push(`/escrows?created=${encodeURIComponent(nextEscrowId)}`);
      return;
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] xl:items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create a New Escrow</CardTitle>
            <CardDescription>
              Create a protected payment for a known seller. The app keeps the buyer flow simple and assigns dispute review automatically.
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
                <p className="text-sm leading-6 text-muted-foreground">Default test environment for safe escrow trials.</p>
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`rounded-[1.25rem] border p-4 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                <p className="text-sm leading-6 text-muted-foreground">Mainnet remains gated until production setup is ready.</p>
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
                  {deploymentReady ? `${network} ready` : `${network} unavailable`}
                </Badge>
                <Badge variant={hasAvailableArbitratorPool ? "success" : "destructive"}>
                  {hasAvailableArbitratorPool ? "Arbitration ready" : "Arbitration unavailable"}
                </Badge>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Use the wallet control in the navbar to select the buyer wallet. Buyers do not need to manage technical setup in this flow.
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

            {sellerMatchesBuyer ? (
              <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
                Buyer and seller must be different wallets. Switch the seller address before creating this escrow.
              </div>
            ) : null}

            {!hasAvailableArbitratorPool ? (
              <div className="rounded-[1.25rem] border border-destructive/20 bg-destructive/5 p-4 text-sm leading-6 text-destructive">
                Escrow creation is unavailable on this network because dispute protection is not configured yet.
              </div>
            ) : null}

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
              Start with the buyer wallet, then seller and order details, then fund the escrow.
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
                <li>Funds stay protected by the escrow until the deal closes.</li>
                <li>Actions appear only for the wallet that belongs to the deal.</li>
                <li>A reviewer is assigned before the escrow is created.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-dashed border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" /><strong>Status</strong></div>
              <p>{status}</p>
              <p className="mt-2 text-xs">Workspace status: {workspaceStatus}</p>
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
                  {lastEscrowId ? (
                    <Button asChild variant="outline">
                      <Link href={`/escrows?created=${encodeURIComponent(lastEscrowId)}`}>
                        View escrow list
                      </Link>
                    </Button>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Waiting for live escrow discovery before opening the escrow list.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
