"use client";

import Link from "next/link";
import { ChevronDown, Globe, LayoutPanelTop, PlugZap, RefreshCcw, ShieldCheck, Wallet } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useProductWorkspaceContext } from "../product/ProductWorkspaceContext";
import { cn } from "../lib/utils";
import { Badge, Button, Card, CardContent } from "./ui";

export function ProductNavbarWallet() {
  const {
    network,
    setNetwork,
    walletState,
    connectSigner,
    disconnectSigner,
    refreshWallets,
    deploymentReady,
    isFetchingEscrows,
    activeLockHash,
  } = useProductWorkspaceContext();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const signerOptions = useMemo(
    () =>
      walletState.wallets.flatMap((wallet) =>
        wallet.signers.map((signerInfo) => ({
          walletName: wallet.name,
          signerName: signerInfo.name,
          signer: signerInfo.signer,
        })),
      ),
    [walletState.wallets],
  );

  const activeSignerLabel = signerOptions.find((option) => option.signer === walletState.activeSigner);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      window.addEventListener("mousedown", onPointerDown);
    }

    return () => window.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  return (
    <div ref={panelRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "group flex items-center gap-3 rounded-full border border-border/80 bg-white/90 px-3 py-2 shadow-sm backdrop-blur transition hover:border-primary/25 hover:shadow-md",
          open && "border-primary/30 shadow-md",
        )}
        aria-expanded={open}
        aria-label="Open wallet controls"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </div>

        <div className="hidden min-w-[10rem] text-left lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {network}
          </p>
          <p className="truncate text-sm font-medium text-foreground">
            {activeSignerLabel ? activeSignerLabel.signerName : "Connect wallet"}
          </p>
        </div>

        <div className="hidden items-center gap-2 xl:flex">
          <Badge variant={deploymentReady ? "success" : "destructive"}>
            {deploymentReady ? "Deployment ready" : "Deployment missing"}
          </Badge>
          <Badge variant={walletState.activeSigner ? "success" : "outline"}>
            {walletState.activeSigner ? "Connected" : "No wallet"}
          </Badge>
        </div>

        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[24rem]">
          <Card className="overflow-hidden border-border/80 bg-[rgba(252,255,252,0.97)] shadow-[0_32px_80px_-30px_rgba(18,51,28,0.35)] backdrop-blur-xl">
            <CardContent className="space-y-5 p-4">
              <div className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-white/80 p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="success">Wallet controls</Badge>
                    <Badge variant="outline" className="capitalize">{network}</Badge>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {activeSignerLabel ? activeSignerLabel.signerName : "No active signer"}
                    </p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      {activeSignerLabel ? `${activeSignerLabel.walletName}` : "Connect a signer to unlock role-aware escrow actions."}
                    </p>
                  </div>
                </div>
                <div className="rounded-full bg-primary/10 p-2 text-primary">
                  <ShieldCheck className="h-4 w-4" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setNetwork("testnet")}
                  className={`rounded-[1.1rem] border p-3 text-left transition ${network === "testnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
                >
                  <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Testnet</span></div>
                  <p className="text-xs text-muted-foreground">Use `ckt` addresses and test deployment.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNetwork("mainnet")}
                  className={`rounded-[1.1rem] border p-3 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
                >
                  <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                  <p className="text-xs text-muted-foreground">Use `ckb` addresses and main deployment.</p>
                </button>
              </div>

              <div className="rounded-[1.25rem] border border-border/70 bg-white/80 p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Connection</p>
                    <p className="text-xs text-muted-foreground">
                      {walletState.activeSigner
                        ? "This signer is now shared across the product dashboard, create flow, and escrow detail pages."
                        : "Pick a signer from a discovered wallet below."}
                    </p>
                  </div>
                  <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                    {walletState.activeSigner ? "Connected" : "Not connected"}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => void refreshWallets()}>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh
                  </Button>
                  {walletState.activeSigner ? (
                    <Button variant="outline" size="sm" onClick={() => void disconnectSigner()}>
                      Disconnect
                    </Button>
                  ) : null}
                </div>

                {activeLockHash ? (
                  <p className="mt-3 break-all text-[11px] leading-5 text-muted-foreground">
                    Active lock hash: {activeLockHash}
                  </p>
                ) : null}
              </div>

              <div className="space-y-3">
                {signerOptions.length === 0 ? (
                  <div className="rounded-[1.25rem] border border-dashed border-border bg-white/75 p-4 text-sm text-muted-foreground">
                    No wallet signers discovered yet. Refresh the wallet list or install a CCC-compatible wallet.
                  </div>
                ) : (
                  signerOptions.map((option) => {
                    const connected = walletState.activeSigner === option.signer;
                    return (
                      <div key={`${option.walletName}-${option.signerName}`} className="rounded-[1.25rem] border border-border/70 bg-white/80 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{option.signerName}</p>
                            <p className="text-xs text-muted-foreground">{option.walletName}</p>
                          </div>
                          <Badge variant={connected ? "success" : "outline"}>
                            {connected ? "Active" : "Available"}
                          </Badge>
                        </div>
                        <Button
                          variant={connected ? "default" : "outline"}
                          size="sm"
                          className="w-full justify-center"
                          onClick={() => void connectSigner(option.signer)}
                        >
                          <PlugZap className="h-4 w-4" />
                          {connected ? "Connected" : "Connect signer"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild variant="outline" className="justify-center">
                  <Link href="/">
                    <LayoutPanelTop className="h-4 w-4" />
                    My escrows
                  </Link>
                </Button>
                <Button asChild variant="outline" className="justify-center">
                  <Link href="/studio">Open Studio</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
