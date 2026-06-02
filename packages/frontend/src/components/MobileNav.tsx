"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Globe, Menu, MoveRight, PlugZap, RefreshCcw, ShieldCheck, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { useProductWorkspaceContext } from "../product/ProductWorkspaceContext";
import { cn } from "../lib/utils";
import { Badge, Button, Card, CardContent } from "./ui";

interface MobileNavProps {
  items: Array<{ href: string; label: string }>;
}

export function MobileNav({ items }: MobileNavProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const {
    network,
    setNetwork,
    walletState,
    connectSigner,
    disconnectSigner,
    refreshWallets,
    deploymentReady,
    isFetchingEscrows,
    status,
  } = useProductWorkspaceContext();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;

    if (open) {
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  const signerOptions = walletState.wallets.flatMap((wallet) =>
    wallet.signers.map((signerInfo) => ({
      walletName: wallet.name,
      signerName: signerInfo.name,
      signer: signerInfo.signer,
    })),
  );

  const links = useMemo(
    () =>
      items.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group flex items-center justify-between rounded-[1.25rem] border px-4 py-4 transition-all",
              active
                ? "border-primary/30 bg-primary text-primary-foreground shadow-[0_20px_40px_-28px_rgba(30,122,70,0.75)]"
                : "border-border/70 bg-white/80 text-foreground hover:border-primary/25 hover:bg-accent/70",
            )}
            onClick={() => setOpen(false)}
          >
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-[0.01em]">{item.label}</span>
              <span className={cn("text-xs", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {item.href === "/" && "Live dashboard and role-based escrows"}
                {item.href === "/escrows/create" && "Start a new protected payment flow"}
              </span>
            </div>
            <MoveRight className={cn("h-4 w-4 transition-transform group-hover:translate-x-0.5", active ? "text-primary-foreground" : "text-muted-foreground")} />
          </Link>
        );
      }),
    [items, pathname],
  );

  return (
    <div className="md:hidden">
      <Button
        variant="outline"
        size="icon"
        className={cn(
          "relative border-border/80 bg-white/85 shadow-sm backdrop-blur",
          open && "border-primary/30 bg-primary text-primary-foreground",
        )}
        aria-expanded={open}
        aria-label={open ? "Close navigation" : "Open navigation"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(14,25,17,0.32)] backdrop-blur-sm transition-all duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        className={cn(
          "fixed inset-x-4 top-[4.75rem] z-50 origin-top transition-all duration-200",
          open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
        )}
      >
        <Card className="max-h-[calc(100vh-6rem)] overflow-y-auto border-border/80 bg-[rgba(252,255,252,0.96)] shadow-[0_30px_80px_-30px_rgba(18,51,28,0.35)] backdrop-blur-xl">
          <CardContent className="space-y-5 p-4">
            <div className="flex items-start justify-between gap-4 rounded-[1.25rem] border border-border/70 bg-white/80 p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="success">Wallet</Badge>
                  <Badge variant="outline" className="capitalize">{network}</Badge>
                  <Badge variant={deploymentReady ? "success" : "destructive"}>
                    {deploymentReady ? "Deployment ready" : "Network unavailable"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Escrow workspace</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Mobile wallet, network, and navigation controls stay in one place so the buyer flow keeps its context.
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
                <p className="text-xs text-muted-foreground">Default buyer-facing network with live deployment metadata.</p>
              </button>
              <button
                type="button"
                onClick={() => setNetwork("mainnet")}
                className={`rounded-[1.1rem] border p-3 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
              >
                <div className="mb-2 flex items-center gap-2 text-primary"><Globe className="h-4 w-4" /><span className="font-medium">Mainnet</span></div>
                <p className="text-xs text-muted-foreground">Structured support only until production deployment metadata is complete.</p>
              </button>
            </div>

            <div className="space-y-3 rounded-[1.25rem] border border-border/70 bg-white/80 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Wallet className="h-4 w-4 text-primary" />
                    Wallet
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {walletState.activeSigner ? "Connected signer ready for role-based actions" : "Connect a signer to unlock live escrow actions"}
                  </p>
                </div>
                <Badge variant={walletState.activeSigner ? "success" : "outline"}>
                  {walletState.activeSigner ? "Connected" : "Not connected"}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => void refreshWallets()}>
                  <RefreshCcw className="h-4 w-4" />
                  Refresh wallets
                </Button>
                {walletState.activeSigner ? (
                  <Button variant="outline" size="sm" onClick={() => void disconnectSigner()}>
                    Disconnect
                  </Button>
                ) : null}
              </div>

              {signerOptions.length > 0 ? (
                <div className="space-y-2">
                  {signerOptions.map((option) => {
                    const optionConnected = walletState.activeSigner === option.signer;
                    return (
                      <Button
                        key={`${option.walletName}-${option.signerName}`}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => void connectSigner(option.signer)}
                      >
                        <PlugZap className="h-4 w-4" />
                        <span className="truncate">{option.signerName}</span>
                        <span className="ml-auto text-xs text-muted-foreground">{optionConnected ? "Active" : option.walletName}</span>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No wallet signers discovered yet. Refresh or install a compatible wallet.</p>
              )}
            </div>

            <div className="rounded-[1.25rem] border border-border/70 bg-white/80 p-4 text-xs leading-5 text-muted-foreground">
              {status}
            </div>

            {isFetchingEscrows ? (
              <div className="rounded-[1.25rem] border border-dashed border-primary/20 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
                Refreshing live escrow discovery for the selected network.
              </div>
            ) : null}

            <div className="space-y-3">{links}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
