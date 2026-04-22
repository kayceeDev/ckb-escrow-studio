"use client";

import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
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
import { productEscrows } from "./mock-data";

export function ProductHome() {
  return (
    <div className="mx-auto w-full max-w-[1280px] px-4 py-10 md:px-6 md:py-12">
      <header className="mb-10 grid gap-5 xl:grid-cols-[1.35fr_0.65fr]">
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
                A calm, trusted place to hold funds until work or goods are truly delivered.
              </h1>
              <p className="max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
                Create escrow for known parties, use the platform arbitrator by default, and keep every payment path explicit on CKB. No noisy marketplace clutter. Just escrow, delivery, dispute, and release.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {[
                {
                  title: "Simple setup",
                  body: "Buyer connects wallet, enters seller, chooses deadline, and funds the escrow.",
                },
                {
                  title: "Platform arbitrator",
                  body: "Start with a trusted default arbitrator or switch to a custom one when needed.",
                },
                {
                  title: "Clear state changes",
                  body: "Funded, delivered, disputed, refunded, and resolved are visible without protocol jargon.",
                },
              ].map((item) => (
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
              Why This Exists
            </CardTitle>
            <CardDescription>
              This product is not a marketplace. It is a dedicated escrow workflow for real deals between known parties.
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
          </CardContent>
        </Card>
      </header>

      <section className="mb-10 grid gap-4 md:grid-cols-3">
        {[
          {
            title: "1. Fund escrow",
            body: "Buyer creates the escrow, names the seller, and locks payment on chain.",
          },
          {
            title: "2. Seller delivers",
            body: "Seller marks work or goods as delivered when the obligation is fulfilled.",
          },
          {
            title: "3. Release or resolve",
            body: "Buyer releases funds, disputes, or refunds after deadline. Arbitrator resolves if needed.",
          },
        ].map((step) => (
          <Card key={step.title}>
            <CardHeader>
              <CardTitle className="text-lg">{step.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{step.body}</p>
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
