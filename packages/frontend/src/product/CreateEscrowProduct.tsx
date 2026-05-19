"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import {
  AlertTriangle,
  CalendarClock,
  FileText,
  Globe,
  Info,
  Scale,
  ShieldCheck,
  Store,
  UserRound,
  Vault,
  Wallet,
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

export function CreateEscrowProduct() {
  const {
    network,
    setNetwork,
    client,
    walletState,
    deploymentReady,
    service,
    status: workspaceStatus,
    saveParticipantScript,
  } = useProductWorkspaceContext();
  const [useCustomArbitrator, setUseCustomArbitrator] = useState(false);
  const [sellerAddress, setSellerAddress] = useState("");
  const [amountCkb, setAmountCkb] = useState("350");
  const [deadline, setDeadline] = useState("");
  const [referenceId, setReferenceId] = useState("INV-042");
  const [description, setDescription] = useState("Landing page redesign and responsive polish for the first milestone.");
  const [platformArbitratorAddress, setPlatformArbitratorAddress] = useState("");
  const [customArbitratorAddress, setCustomArbitratorAddress] = useState("");
  const [escrowLockCodeHash, setEscrowLockCodeHash] = useState("");
  const [escrowLockArgs, setEscrowLockArgs] = useState("0x");
  const [status, setStatus] = useState("Fill the form, connect a wallet, and save participant scripts before funding.");
  const [busy, setBusy] = useState(false);
  const [lastTxHash, setLastTxHash] = useState("");

  const activeArbitratorAddress = useCustomArbitrator ? customArbitratorAddress : platformArbitratorAddress;

  const formReady = useMemo(
    () =>
      Boolean(
        walletState.activeSigner &&
          sellerAddress &&
          amountCkb &&
          deadline &&
          description &&
          activeArbitratorAddress,
      ),
    [activeArbitratorAddress, amountCkb, deadline, description, sellerAddress, walletState.activeSigner],
  );

  async function resolveScripts() {
    if (!walletState.activeSigner) {
      throw new Error("Connect the buyer wallet first.");
    }

    const buyerAddress = await walletState.activeSigner.getRecommendedAddressObj();
    const seller = await ccc.Address.fromString(sellerAddress, client);
    const arbitrator = await ccc.Address.fromString(activeArbitratorAddress, client);

    return {
      buyerScript: buyerAddress.script,
      sellerScript: seller.script,
      arbitratorScript: arbitrator.script,
    };
  }

  async function saveParticipantScripts() {
    try {
      setBusy(true);
      const { buyerScript, sellerScript, arbitratorScript } = await resolveScripts();
      const buyerStored = storedScriptFromScriptLike(buyerScript, "Buyer");
      const sellerStored = storedScriptFromScriptLike(sellerScript, "Seller");
      const arbitratorStored = storedScriptFromScriptLike(arbitratorScript, useCustomArbitrator ? "Custom arbitrator" : "Platform arbitrator");
      saveParticipantScript(ccc.Script.from(buyerScript).hash(), buyerStored);
      saveParticipantScript(ccc.Script.from(sellerScript).hash(), sellerStored);
      saveParticipantScript(ccc.Script.from(arbitratorScript).hash(), arbitratorStored);
      setStatus("Participant scripts saved locally. Settlement flows can now reuse them later.");
    } catch (error) {
      const { detail, hint } = formatEscrowError(error);
      setStatus(hint ? `${detail} ${hint}` : detail);
    } finally {
      setBusy(false);
    }
  }

  async function createEscrow() {
    if (!service) {
      setStatus("Connect a wallet and load the correct deployment first.");
      return;
    }

    if (!escrowLockCodeHash) {
      setStatus("Escrow lock code hash is still required. Keep it aligned with the lock script your protocol expects.");
      return;
    }

    try {
      setBusy(true);
      const { sellerScript, arbitratorScript } = await resolveScripts();
      const amountShannons = parseCkbToShannons(amountCkb);
      const deadlineMs = BigInt(new Date(deadline).getTime());
      if (deadlineMs <= 0) {
        throw new Error("Deadline must be a valid future date/time.");
      }

      const fullDescription = referenceId ? `${referenceId}: ${description}` : description;

      const txHash = await service.sendCreateEscrow({
        sellerLock: sellerScript,
        arbitratorLock: arbitratorScript,
        escrowLock: {
          codeHash: escrowLockCodeHash,
          hashType: "type",
          args: escrowLockArgs || "0x",
        },
        amountShannons,
        deadlineMs,
        description: fullDescription,
      });

      await saveParticipantScripts();
      setLastTxHash(txHash);
      setStatus(`Create escrow submitted on ${network}.`);
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
              This flow now uses real participant addresses and a real connected buyer wallet. The product can submit create transactions once deployment and escrow-lock settings are available for the active network.
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
                <p className="text-sm text-muted-foreground">Use `ckt` participant addresses and your testnet deployment profile.</p>
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`rounded-[1.25rem] border p-4 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                <p className="text-sm text-muted-foreground">Use `ckb` participant addresses and a real mainnet deployment profile.</p>
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-primary/20 bg-primary/8 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Info className="h-4 w-4" />
                <span className="text-sm font-semibold">What happens next?</span>
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Once funded, the escrow stays in a <strong className="text-foreground">Funded</strong> state until the seller marks it delivered or the buyer chooses another valid action path.
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
              </div>
              <p className="text-sm leading-6 text-muted-foreground">
                Use the wallet control in the navbar to select the buyer signer. This form only funds the escrow after a signer and the active network deployment are ready.
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
                <CardTitle className="text-base">Arbitrator</CardTitle>
                <CardDescription>
                  The product still supports a platform-default arbitrator, but the address needs to be real for the active network.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><ShieldCheck className="h-4 w-4" />Platform Arbitrator Address</Label>
                  <Input value={platformArbitratorAddress} onChange={(event) => setPlatformArbitratorAddress(event.target.value)} placeholder={network === "testnet" ? "ckt1..." : "ckb1..."} />
                </div>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setUseCustomArbitrator((value) => !value)}
                >
                  {useCustomArbitrator ? "Use Platform Arbitrator" : "Use Custom Arbitrator"}
                </Button>

                {useCustomArbitrator ? (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><UserRound className="h-4 w-4" />Custom Arbitrator Address</Label>
                    <Input value={customArbitratorAddress} onChange={(event) => setCustomArbitratorAddress(event.target.value)} placeholder={network === "testnet" ? "ckt1..." : "ckb1..."} />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card className="border-dashed bg-secondary/40 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Escrow lock configuration</CardTitle>
                <CardDescription>
                  The create transaction still needs the escrow cell lock script. The type script enforces business rules, but this lock script must still be present and valid for your protocol.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><Wallet className="h-4 w-4" />Escrow Lock Code Hash</Label>
                  <Input value={escrowLockCodeHash} onChange={(event) => setEscrowLockCodeHash(event.target.value)} placeholder="0x..." />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]"><Wallet className="h-4 w-4" />Escrow Lock Args</Label>
                  <Input value={escrowLockArgs} onChange={(event) => setEscrowLockArgs(event.target.value)} placeholder="0x" />
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button size="lg" variant="outline" disabled={!formReady || busy} onClick={() => void saveParticipantScripts()}>
                Save Participant Scripts
              </Button>
              <Button size="lg" disabled={!formReady || !deploymentReady || busy} onClick={() => void createEscrow()}>
                Create & Fund Escrow
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/studio">Use Studio Instead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer Checklist</CardTitle>
            <CardDescription>
              Real wallet first, then real addresses, then contract-valid scripts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">Before you fund</p>
              <ul className="space-y-2">
                <li>Connect the buyer wallet that will fund the escrow.</li>
                <li>Use `ckt` addresses on testnet and `ckb` addresses on mainnet.</li>
                <li>Save participant scripts so later release and resolution flows can work in-product.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">Protocol constraints</p>
              <ul className="space-y-2">
                <li>The contract stores participant lock hashes in escrow data.</li>
                <li>The create flow still needs an escrow lock script for the escrow cell itself.</li>
                <li>Mainnet and testnet must use separate deployments and addresses.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-dashed border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary"><AlertTriangle className="h-4 w-4" /><strong>Status</strong></div>
              <p>{status}</p>
              <p className="mt-2 text-xs">Workspace: {workspaceStatus}</p>
              {lastTxHash ? <p className="mt-2 break-all text-xs">Last transaction: {lastTxHash}</p> : null}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
