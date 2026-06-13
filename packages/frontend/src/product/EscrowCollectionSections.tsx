"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui";
import type { ProductEscrowRecord } from "./contract";

export function SectionHeader({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
      <div>
        <h2 className="text-2xl font-semibold md:text-3xl">{title}</h2>
        <p className="mt-1 max-w-[72ch] text-sm text-muted-foreground md:text-base">{body}</p>
      </div>
    </div>
  );
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
            const escrowRouteId = escrow.source === "live" ? escrow.id.split(":")[0] ?? escrow.id : escrow.id;
            const isHighlighted =
              highlightedEscrowId != null &&
              (highlightedEscrowId === escrow.id || highlightedEscrowId === escrowRouteId);

            return (
              <Card
                key={escrow.id}
                className={`flex h-full flex-col overflow-hidden transition ${
                  isHighlighted ? "border-primary/40 bg-primary/5 shadow-sm" : ""
                }`}
              >
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg leading-7">{escrow.title}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      {isHighlighted ? <Badge variant="secondary">Just created</Badge> : null}
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
                  </div>
                  <CardDescription>{escrow.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex h-full flex-col space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">{escrow.viewerRole}</Badge>
                    <Badge variant="outline">{escrow.actions.length} action path(s)</Badge>
                  </div>

                  <div className="rounded-[1.25rem] border border-primary/15 bg-primary/5 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-primary/80">Next step</p>
                    <p className="font-medium text-foreground">{escrow.guidance.summary}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{escrow.guidance.nextStep}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-white/75 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Amount</p>
                      <p className="font-semibold">{escrow.amountLabel}</p>
                    </div>
                    <div className="rounded-2xl border border-border bg-white/75 p-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Deadline</p>
                      <p className="font-semibold">{escrow.deadlineLabel}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-white/75 p-4 text-sm text-muted-foreground">
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
                      <Link href={`/escrows/${encodeURIComponent(escrowRouteId)}`}>
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
