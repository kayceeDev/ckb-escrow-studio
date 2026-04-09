"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck, Wallet } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import { productEscrows } from "./mock-data";

export function ProductHome() {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[1280px] px-4 py-8 md:px-6">
      <header className="mb-8 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="overflow-hidden">
          <CardContent className="space-y-5 p-8 md:p-10">
            <Badge variant="success" className="w-fit">
              Standalone Escrow
            </Badge>
            <div className="space-y-3">
              <h1 className="max-w-4xl font-serif text-4xl font-semibold tracking-tight text-balance md:text-6xl">
                Create and manage decentralized escrow for deals between known parties.
              </h1>
              <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
                Start with a default platform arbitrator or switch to your own. This is a buyer-first product shell built on the CKB escrow protocol.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href="/escrows/create">
                  Create Escrow
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Default Model</CardTitle>
            <CardDescription>
              Wallet-first identity, buyer-driven creation, platform arbitrator by default, and optional custom arbitrator override.
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
              <p className="text-sm text-muted-foreground">Simple dispute UX by default, with custom override later in the create flow.</p>
            </div>
          </CardContent>
        </Card>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">My Escrows</h2>
            <p className="text-sm text-muted-foreground">
              Buyer-first dashboard using seeded data until live-chain product views are wired.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {productEscrows.map((escrow) => (
            <Card key={escrow.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-lg">{escrow.title}</CardTitle>
                  <Badge variant={escrow.state === "Disputed" ? "destructive" : "secondary"}>
                    {escrow.state}
                  </Badge>
                </div>
                <CardDescription>{escrow.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
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
    </div>
  );
}
