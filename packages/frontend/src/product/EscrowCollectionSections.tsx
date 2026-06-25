"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Clock3, ReceiptText, Sparkles } from "lucide-react";

import { Badge, Button, Card, CardContent } from "../components/ui";
import type { ProductEscrowRecord } from "./contract";
import { getEscrowHistoryBucket, primaryActionLabel, productEscrowRouteId } from "./contract";

export function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-[72ch] text-sm leading-6 text-muted-foreground md:text-base">{body}</p>
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: ProductEscrowRecord["state"] }) {
  const bucket = getEscrowHistoryBucket(state);
  const variant =
    state === "Disputed"
      ? "destructive"
      : bucket === "past"
        ? "outline"
        : state === "Delivered"
          ? "secondary"
          : "success";

  return <Badge variant={variant}>{state}</Badge>;
}

function counterpartyFor(escrow: ProductEscrowRecord): string {
  if (escrow.viewerRole === "seller") {
    return escrow.buyerLabel;
  }
  if (escrow.viewerRole === "buyer") {
    return escrow.sellerLabel;
  }
  return escrow.state === "Disputed" ? "Buyer and seller" : escrow.sellerLabel;
}

export function CompactEscrowCards({
  records,
  emptyMessage,
}: {
  records: ProductEscrowRecord[];
  emptyMessage: string;
}) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-foreground">Nothing urgent right now</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{emptyMessage}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      {records.slice(0, 3).map((escrow) => {
        const routeId = productEscrowRouteId(escrow);
        return (
          <Card key={escrow.id} className="overflow-hidden border-primary/15 bg-white/82 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_70px_rgba(18,56,34,0.12)]">
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">{escrow.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{escrow.amountLabel} · {escrow.deadlineLabel}</p>
                </div>
                <StateBadge state={escrow.state} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{escrow.viewerRole}</Badge>
                <Badge variant="secondary">{primaryActionLabel(escrow)}</Badge>
              </div>
              <Button asChild className="w-full">
                <Link href={`/escrows/${encodeURIComponent(routeId)}`}>
                  Open deal
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

export function EscrowLedgerTable({
  records,
  emptyMessage,
}: {
  records: ProductEscrowRecord[];
  emptyMessage: string;
}) {
  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
          {emptyMessage}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card/92 shadow-[var(--shadow-soft)] backdrop-blur md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-secondary/70 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Escrow</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">State</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Deadline</th>
              <th className="px-5 py-4">Next</th>
              <th className="px-5 py-4 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {records.map((escrow) => {
              const routeId = productEscrowRouteId(escrow);
              const counterparty = counterpartyFor(escrow);

              return (
                <tr key={escrow.id} className="bg-white/68 transition hover:bg-accent/35">
                  <td className="max-w-[260px] px-5 py-4">
                    <p className="truncate font-medium text-foreground">{escrow.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{escrow.description}</p>
                  </td>
                  <td className="px-5 py-4 capitalize text-muted-foreground">{escrow.viewerRole}</td>
                  <td className="px-5 py-4"><StateBadge state={escrow.state} /></td>
                  <td className="px-5 py-4 text-muted-foreground">{counterparty}</td>
                  <td className="px-5 py-4 font-medium">{escrow.amountLabel}</td>
                  <td className="px-5 py-4 text-muted-foreground">{escrow.deadlineLabel}</td>
                  <td className="px-5 py-4 text-muted-foreground">{primaryActionLabel(escrow)}</td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/escrows/${encodeURIComponent(routeId)}`}>Open</Link>
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">
        {records.map((escrow) => {
          const routeId = productEscrowRouteId(escrow);
          const counterparty = counterpartyFor(escrow);

          return (
            <Card key={escrow.id} className="overflow-hidden bg-white/82">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-foreground">{escrow.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{counterparty}</p>
                  </div>
                  <StateBadge state={escrow.state} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-secondary/65 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Role</p>
                    <p className="mt-1 capitalize text-foreground">{escrow.viewerRole}</p>
                  </div>
                  <div className="rounded-2xl bg-secondary/65 p-3">
                    <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">Amount</p>
                    <p className="mt-1 text-foreground">{escrow.amountLabel}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-border bg-white/75 p-3 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">Next:</span> {primaryActionLabel(escrow)}
                </div>
                <Button asChild className="w-full">
                  <Link href={`/escrows/${encodeURIComponent(routeId)}`}>
                    Open escrow
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export const EscrowHistoryTable = EscrowLedgerTable;

export function HistoryEmptyState({ active }: { active: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {active ? <Clock3 className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
        </div>
        <div>
          <p className="font-semibold text-foreground">{active ? "No active escrows" : "No past escrow history yet"}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {active
              ? "When this wallet is part of an open escrow, it will appear here."
              : "Completed, cancelled, refunded, and resolved escrows for this wallet will appear here as history."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
