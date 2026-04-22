import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CircleHelp,
  Scale,
  ShieldCheck,
  Store,
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
import type { ProductEscrowRecord } from "./mock-data";

function actionCopy(record: ProductEscrowRecord) {
  switch (record.state) {
    case "Funded":
      return [
        "Wait for seller to mark delivered",
        "Open a dispute if the scope or timing changes",
        "Request refund after the deadline if the seller never fulfills",
      ];
    case "Delivered":
      return ["Release payment", "Open dispute"];
    case "Disputed":
      return ["Await arbitrator decision"];
    default:
      return ["No direct buyer action available"];
  }
}

export function EscrowDetailProduct({ escrow }: { escrow: ProductEscrowRecord }) {
  const actions = actionCopy(escrow);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant={escrow.state === "Disputed" ? "destructive" : "success"}>
          {escrow.state}
        </Badge>
        <Badge variant="secondary">{escrow.role}</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="space-y-2">
              <CardTitle className="text-3xl">{escrow.title}</CardTitle>
              <CardDescription>{escrow.description}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button>Primary Buyer Action</Button>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio Operate</Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Scale className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Amount
                  </span>
                </div>
                <strong>{escrow.amount}</strong>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <CalendarClock className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Deadline
                  </span>
                </div>
                <strong>{escrow.deadline}</strong>
              </div>
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <div className="mb-2 flex items-center gap-2 text-primary">
                  <Store className="h-4 w-4" />
                  <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Seller
                  </span>
                </div>
                <strong>{escrow.seller}</strong>
              </div>
            </div>
            <div className="mt-4 rounded-[1.25rem] border border-border bg-secondary/55 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <CircleHelp className="h-4 w-4" />
                <strong>Status Guidance</strong>
              </div>
              <p>
                This page translates the protocol state into buyer-facing language so the next action is obvious without understanding CKB internals.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
            <CardDescription>
              State progression shown in buyer language instead of protocol jargon.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {escrow.timeline.map((step) => (
              <div
                key={step.label}
                className="rounded-[1.25rem] border border-border bg-white/75 p-4"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Badge
                    variant={
                      step.status === "done"
                        ? "success"
                        : step.status === "current"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {step.status}
                  </Badge>
                  <strong>{step.label}</strong>
                </div>
                <p className="text-sm text-muted-foreground">{step.note}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Buyer Actions</CardTitle>
            <CardDescription>
              Guided next steps from the buyer perspective.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {actions.map((action) => (
              <div
                key={action}
                className="rounded-[1.25rem] border border-border bg-white/75 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span>{action}</span>
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
              </div>
            ))}

            <div className="rounded-[1.25rem] border border-border bg-secondary/60 p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 text-primary">
                <ShieldCheck className="h-4 w-4" />
                <strong>Arbitrator</strong>
              </div>
              <p>{escrow.arbitrator}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
