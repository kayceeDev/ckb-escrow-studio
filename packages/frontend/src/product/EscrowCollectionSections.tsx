"use client";

import Link from "next/link";
import { ArrowRight, Clock3, ReceiptText } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import type { ProductEscrowRecord } from "./contract";
import { getEscrowHistoryBucket, primaryActionLabel } from "./contract";

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

function escrowRouteId(escrow: ProductEscrowRecord): string {
  return escrow.source === "live" ? escrow.id.split(":")[0] ?? escrow.id : escrow.id;
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

export function EscrowGrid({
  title,
  body,
  records,
  emptyMessage,
  highlightedEscrowId,
}: {
  title: string;
  body: string;
  records: ProductEscrowRecord[];
  emptyMessage?: string;
  highlightedEscrowId?: string | null;
}) {
  if (records.length === 0 && !emptyMessage) {
    return null;
  }

  return (
    <section className="space-y-5">
      <SectionHeader title={title} body={body} />
      {records.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-sm leading-6 text-muted-foreground">
            {emptyMessage}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 xl:items-stretch">
          {records.map((escrow) => {
            const routeId = escrowRouteId(escrow);
            const isHighlighted =
              highlightedEscrowId != null &&
              (highlightedEscrowId === escrow.id || highlightedEscrowId === routeId);

            return (
              <Card
                key={escrow.id}
                className={`group flex h-full flex-col overflow-hidden transition duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_28px_70px_rgba(18,56,34,0.14)] ${
                  isHighlighted ? "border-primary/40 bg-primary/5 shadow-sm" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg leading-7">{escrow.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {isHighlighted ? <Badge variant="secondary">Just created</Badge> : null}
                      <StateBadge state={escrow.state} />
                    </div>
                  </div>
                  <CardDescription>{escrow.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{escrow.viewerRole}</Badge>
                    <Badge variant="outline">{primaryActionLabel(escrow)}</Badge>
                  </div>

                  <div className="rounded-[1.25rem] border border-primary/15 bg-[linear-gradient(135deg,rgba(219,241,225,0.86),rgba(255,252,244,0.9))] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Next step</p>
                    <p className="font-medium text-foreground">{escrow.guidance.summary}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{escrow.guidance.nextStep}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</p>
                      <p className="font-semibold">{escrow.amountLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white/80 p-4 shadow-sm">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
                      <p className="font-semibold">{escrow.deadlineLabel}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white/80 p-4 text-sm text-muted-foreground shadow-sm">
                    <p>
                      <strong className="text-foreground">Seller:</strong> {escrow.sellerLabel}
                    </p>
                    <p>
                      <strong className="text-foreground">Arbitrator:</strong> {escrow.arbitratorLabel}
                    </p>
                    {escrow.guidance.supportLabel ? (
                      <p className="mt-3 rounded-xl border border-dashed border-border bg-secondary/55 px-3 py-2 text-xs leading-5">
                        {escrow.guidance.supportLabel}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-auto pt-1">
                    <Button asChild className="w-full">
                      <Link href={`/escrows/${encodeURIComponent(routeId)}`}>
                        Open Escrow
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function EscrowHistoryTable({
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
      <div className="hidden overflow-hidden rounded-[1.5rem] border border-border bg-card/90 shadow-[var(--shadow-soft)] backdrop-blur md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-secondary/70 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Escrow</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">State</th>
              <th className="px-5 py-4">Counterparty</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Deadline</th>
              <th className="px-5 py-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/80">
            {records.map((escrow) => {
              const routeId = escrowRouteId(escrow);
              const counterparty = escrow.viewerRole === "seller" ? escrow.buyerLabel : escrow.sellerLabel;

              return (
                <tr key={escrow.id} className="bg-white/65 transition hover:bg-accent/35">
                  <td className="max-w-[260px] px-5 py-4">
                    <p className="truncate font-medium text-foreground">{escrow.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{escrow.description}</p>
                  </td>
                  <td className="px-5 py-4 capitalize text-muted-foreground">{escrow.viewerRole}</td>
                  <td className="px-5 py-4"><StateBadge state={escrow.state} /></td>
                  <td className="px-5 py-4 text-muted-foreground">{counterparty}</td>
                  <td className="px-5 py-4 font-medium">{escrow.amountLabel}</td>
                  <td className="px-5 py-4 text-muted-foreground">{escrow.deadlineLabel}</td>
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
          const routeId = escrowRouteId(escrow);
          const counterparty = escrow.viewerRole === "seller" ? escrow.buyerLabel : escrow.sellerLabel;

          return (
            <Card key={escrow.id} className="overflow-hidden">
              <CardContent className="space-y-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{escrow.title}</p>
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
                <Button asChild className="w-full">
                  <Link href={`/escrows/${encodeURIComponent(routeId)}`}>
                    Open Escrow
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

export function HistoryEmptyState({ active }: { active: boolean }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          {active ? <Clock3 className="h-5 w-5" /> : <ReceiptText className="h-5 w-5" />}
        </div>
        <div>
          <p className="font-semibold text-foreground">{active ? "No active participant escrows" : "No past escrow history yet"}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            {active
              ? "When this wallet is buyer, seller, or arbitrator on an open escrow, it will appear here."
              : "Completed, cancelled, refunded, and resolved escrows for this wallet will appear here as history."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
