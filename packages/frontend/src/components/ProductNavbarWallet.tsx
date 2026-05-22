"use client";

import Link from "next/link";
import {
  Check,
  ChevronDown,
  Globe,
  LayoutPanelTop,
  PlugZap,
  RefreshCcw,
  ShieldCheck,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useProductWorkspaceContext } from "../product/ProductWorkspaceContext";
import { cn } from "../lib/utils";
import { Badge, Button } from "./ui";

function shortHash(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-6)}` : value;
}

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
  const connected = Boolean(walletState.activeSigner);

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
          "group flex h-12 items-center gap-2.5 rounded-full border border-border/80 bg-white/92 px-3 shadow-sm backdrop-blur transition hover:border-primary/25 hover:shadow-md lg:gap-3 lg:px-4 lg:p-6",
          open && "border-primary/35 shadow-[0_18px_45px_-28px_rgba(18,51,28,0.45)]",
        )}
        aria-expanded={open}
        aria-label="Open wallet controls"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Wallet className="h-4 w-4" />
        </div>

        <div className="min-w-0 text-left">
          <p className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground lg:block">
            {network}
          </p>
          <p className="max-w-[8.5rem] truncate text-[13px] font-semibold text-foreground xl:max-w-[11rem]">
            {activeSignerLabel ? activeSignerLabel.signerName : "Connect wallet"}
          </p>
          <p className="hidden max-w-[11rem] truncate text-xs text-muted-foreground xl:block">
            {activeSignerLabel ? activeSignerLabel.walletName : deploymentReady ? "Choose signer" : "Network unavailable"}
          </p>
        </div>

        <div className="hidden items-center gap-1 xl:flex">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              deploymentReady ? "bg-primary" : "bg-destructive",
            )}
            aria-hidden="true"
          />
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              connected ? "bg-primary" : "bg-muted-foreground/35",
            )}
            aria-hidden="true"
          />
        </div>

        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.55rem)] z-50 w-[min(26rem,calc(100vw-2rem))]">
          <div className="overflow-hidden rounded-[1.15rem] border border-border/80 bg-[rgba(252,255,252,0.98)] shadow-[0_34px_90px_-34px_rgba(18,51,28,0.45)] backdrop-blur-xl">
            <div className="border-b border-border/70 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge variant="success">Wallet</Badge>
                    <Badge variant="outline" className="capitalize">{network}</Badge>
                    <Badge variant={deploymentReady ? "success" : "destructive"}>
                      {deploymentReady ? "Deployment ready" : "Network unavailable"}
                    </Badge>
                  </div>
                  <p className="truncate text-[15px] font-semibold text-foreground">
                    {activeSignerLabel ? activeSignerLabel.signerName : "No signer connected"}
                  </p>
                  <p className="mt-1 max-w-[21rem] text-[13px] leading-5 text-muted-foreground">
                    {activeSignerLabel
                      ? `${activeSignerLabel.walletName} is active for role discovery and transaction signing.`
                      : "Connect one signer here; the whole product will use that wallet context."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:border-primary/25 hover:text-foreground"
                  aria-label="Close wallet controls"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="space-y-3 p-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setNetwork("testnet")}
                  className={cn(
                    "rounded-[0.9rem] border p-2.5 text-left transition",
                    network === "testnet" ? "border-primary/35 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20",
                  )}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Testnet</span></div>
                  <p className="text-xs leading-5 text-muted-foreground">ckt addresses and test deployment.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setNetwork("mainnet")}
                  className={cn(
                    "rounded-[0.9rem] border p-2.5 text-left transition",
                    network === "mainnet" ? "border-primary/35 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20",
                  )}
                >
                  <div className="mb-1.5 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                  <p className="text-xs leading-5 text-muted-foreground">ckb addresses and main deployment.</p>
                </button>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-[0.9rem] border border-border/70 bg-white/80 p-2.5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">
                    {connected ? "Signer active" : "Choose signer"}
                  </span>
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
              </div>

              <div className="max-h-[19rem] space-y-1.5 overflow-y-auto pr-1">
                {signerOptions.length === 0 ? (
                  <div className="rounded-[0.9rem] border border-dashed border-border bg-white/75 p-3 text-sm text-muted-foreground">
                    No wallet signers discovered yet. Refresh the wallet list or install a CCC-compatible wallet.
                  </div>
                ) : (
                  signerOptions.map((option) => {
                    const optionConnected = walletState.activeSigner === option.signer;
                    return (
                      <button
                        key={`${option.walletName}-${option.signerName}`}
                        type="button"
                        onClick={() => void connectSigner(option.signer)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-[0.9rem] border p-2.5 text-left transition",
                          optionConnected ? "border-primary/35 bg-primary/10" : "border-border/70 bg-white/80 hover:border-primary/20 hover:bg-accent/60",
                        )}
                      >
                        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", optionConnected ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary")}>
                          {optionConnected ? <Check className="h-4 w-4" /> : <PlugZap className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-foreground">{option.signerName}</p>
                          <p className="truncate text-xs text-muted-foreground">{option.walletName}</p>
                        </div>
                        <Badge variant={optionConnected ? "success" : "outline"}>
                          {optionConnected ? "Active" : "Connect"}
                        </Badge>
                      </button>
                    );
                  })
                )}
              </div>

              {activeLockHash ? (
                <div className="rounded-[0.9rem] border border-border/70 bg-secondary/55 p-2.5 text-xs leading-5 text-muted-foreground">
                  Active lock hash: <span className="font-medium text-foreground">{shortHash(activeLockHash)}</span>
                </div>
              ) : null}

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
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
