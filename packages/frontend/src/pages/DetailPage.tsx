import { ArrowRight, FileSearch, ShieldCheck } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/index.js";
import { createExplorerTxUrl } from "../studio.js";

interface DetailPageProps {
  txHash: string;
  index: string;
  capacity: string;
  state: string | null;
  amount: string | null;
  deadline: string | null;
  description: string | null;
  buyerLockHash: string | null;
  sellerLockHash: string | null;
  arbitratorLockHash: string | null;
  onOpenOperate: () => void;
}

function suggestedAction(state: string | null): string {
  switch (state) {
    case "Funded":
      return "Seller can deliver, buyer can cancel, or refund after the deadline.";
    case "Delivered":
      return "Buyer can complete or either side can escalate to dispute.";
    case "Disputed":
      return "Arbitrator can resolve to buyer or seller.";
    default:
      return "Load an escrow cell to see the recommended next action.";
  }
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
      <dt className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="break-all text-sm leading-6">{value}</dd>
    </div>
  );
}

export function DetailPage({
  txHash,
  index,
  capacity,
  state,
  amount,
  deadline,
  description,
  buyerLockHash,
  sellerLockHash,
  arbitratorLockHash,
  onOpenOperate,
}: DetailPageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-primary" />
              Escrow Detail
            </CardTitle>
            <CardDescription>
              Focused view of the currently loaded escrow cell, with suggested next steps based on its state.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            {txHash ? (
              <Button asChild variant="outline">
                <a href={createExplorerTxUrl(txHash)} target="_blank" rel="noreferrer">
                  Open Transaction
                </a>
              </Button>
            ) : null}
            <Button onClick={onOpenOperate}>
              <ArrowRight className="h-4 w-4" />
              Open Operate Screen
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1.5rem] border border-border bg-secondary/70 p-5">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Current State
              </span>
              <strong className="text-xl">{state ?? "No escrow loaded"}</strong>
            </div>
            <div className="rounded-[1.5rem] border border-border bg-accent/70 p-5">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Suggested Next Step
              </span>
              <strong className="text-xl leading-7">{suggestedAction(state)}</strong>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cell Identity</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DetailField label="Transaction Hash" value={txHash || "Not loaded"} />
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Index" value={index || "0"} />
            <DetailField label="Capacity" value={capacity || "0"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Business Terms
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailField label="Amount" value={amount ?? "Unknown"} />
            <DetailField label="Deadline" value={deadline ?? "Unknown"} />
          </div>
          <DetailField label="Description" value={description ?? "Unknown"} />
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Participants</CardTitle>
          <CardDescription>
            These lock hashes determine who is authorized to act at each stage of the escrow lifecycle.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <DetailField label="Buyer Lock Hash" value={buyerLockHash ?? "Unknown"} />
          <DetailField label="Seller Lock Hash" value={sellerLockHash ?? "Unknown"} />
          <DetailField label="Arbitrator Lock Hash" value={arbitratorLockHash ?? "Unknown"} />
        </CardContent>
      </Card>
    </div>
  );
}
