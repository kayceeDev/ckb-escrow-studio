"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Dot,
  HandCoins,
  LayoutPanelTop,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Store,
  TimerReset,
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
} from "../components/ui";
import { buyerHighlights, productEscrows } from "./mock-data";

export function ProductHome() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 md:py-12">
      <header className="mb-12 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-6 p-8 md:p-12">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="success" className="w-fit">
                Standalone Escrow
              </Badge>
              <Badge variant="secondary" className="w-fit">
                Buyer-first
              </Badge>
            </div>

            <div className="space-y-4">
              <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-balance md:text-7xl">
                Escrow that feels trustworthy enough for real work, not just a wallet demo.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                Create escrow for known parties, choose a seller, set a deadline, and release funds only when delivery is real. No marketplace noise. No hidden admin balances. Just a focused escrow workflow on CKB.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              {[
                "Known parties only",
                "Buyer-first flow",
                "Platform arbitrator default",
                "Manual override available",
              ].map((item) => (
                <div
                  key={item}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-white/70 px-3 py-2"
                >
                  <Dot className="h-4 w-4 text-primary" />
                  {item}
                </div>
              ))}
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {buyerHighlights.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[1.5rem] border border-border bg-white/70 p-4"
                >
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {item.title}
                  </p>
                  <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/escrows/create">
                  Create Escrow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Product Promise
            </CardTitle>
            <CardDescription>
              This is a standalone escrow app for real agreements between people who already know each other.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <Wallet className="h-4 w-4" />
                <span className="text-sm font-semibold">Wallet-first identity</span>
              </div>
              <p className="text-sm text-muted-foreground">No email/password registration in v1.</p>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <span className="text-sm font-semibold">Platform arbitrator</span>
              </div>
              <p className="text-sm text-muted-foreground">Simple dispute UX by default, with custom override in the create flow.</p>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CalendarClock className="h-4 w-4" />
                <span className="text-sm font-semibold">Deadline-aware refunds</span>
              </div>
              <p className="text-sm text-muted-foreground">Refund logic is tied to the escrow deadline and enforced by the contract.</p>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <LockKeyhole className="h-4 w-4" />
                <span className="text-sm font-semibold">No hidden custody</span>
              </div>
              <p className="text-sm text-muted-foreground">Funds are held in the escrow cell logic, not treated like an opaque web2 balance.</p>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="mb-12 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "1. Fund escrow",
            body: "Buyer creates the escrow, names the seller, and locks payment on chain.",
            icon: <HandCoins className="h-5 w-5 text-primary" />,
          },
          {
            title: "2. Seller delivers",
            body: "Seller marks work or goods as delivered when the obligation is fulfilled.",
            icon: <CheckCircle2 className="h-5 w-5 text-primary" />,
          },
          {
            title: "3. Release or resolve",
            body: "Buyer releases funds, disputes, or refunds after deadline. Arbitrator resolves if needed.",
            icon: <TimerReset className="h-5 w-5 text-primary" />,
          },
        ].map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {step.icon}
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-12 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "For Buyers",
            body: "Create escrow, monitor delivery, release funds, dispute, or refund after deadline.",
            icon: <LayoutPanelTop className="h-5 w-5 text-primary" />,
          },
          {
            title: "For Sellers",
            body: "See whether payment is locked, then mark delivered when the work is actually done.",
            icon: <Store className="h-5 w-5 text-primary" />,
          },
          {
            title: "For Arbitrators",
            body: "Resolve only the escrows that have escalated into explicit disputes.",
            icon: <ShieldCheck className="h-5 w-5 text-primary" />,
          },
        ].map((item) => (
          <Card key={item.title}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {item.icon}
                {item.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{item.body}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">Sample Escrows</h2>
            <p className="text-sm text-muted-foreground md:text-base">
              Seeded examples showing how funded, delivered, and disputed escrows should feel in the product shell.
            </p>
          </div>
          <Badge variant="outline">Seeded Preview</Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productEscrows.map((escrow) => (
            <Card key={escrow.id} className="overflow-hidden">
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">{escrow.title}</CardTitle>
                  <Badge
                    variant={
                      escrow.state === "Disputed"
                        ? "destructive"
                        : escrow.state === "Delivered"
                          ? "secondary"
                          : "success"
                    }
                  >
                    {escrow.state}
                  </Badge>
                </div>
                <CardDescription>{escrow.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{escrow.role}</Badge>
                  <Badge variant="outline">{escrow.arbitrator}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-white/75 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Amount
                    </p>
                    <p className="font-semibold">{escrow.amount}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-white/75 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                      Deadline
                    </p>
                    <p className="font-semibold">{escrow.deadline}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-white/75 p-4 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">Seller:</strong> {escrow.seller}</p>
                  <p><strong className="text-foreground">Arbitrator:</strong> {escrow.arbitrator}</p>
                </div>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/escrows/${escrow.id}`}>Open Escrow</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Designed for Real Agreements</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-muted-foreground">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              <p>Use escrow for milestone-based freelance work, goods delivery, or partner-based service agreements.</p>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary" />
              <p>Keep the product clean for buyers and sellers while preserving protocol-level tooling in the studio route.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Need Low-Level Control?</CardTitle>
            <CardDescription>
              Deployment profiles, escrow discovery, and raw operation tools remain available when you need them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/studio">Go to Studio</Link>
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
