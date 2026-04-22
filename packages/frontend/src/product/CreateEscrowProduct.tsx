"use client";

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "../components/ui";
import {
  CalendarClock,
  FileText,
  Scale,
  ShieldCheck,
  Store,
  UserRound,
  Vault,
} from "lucide-react";
import Link from "next/link";

function Field({
  label,
  icon,
  placeholder,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
        {icon}
        {label}
      </Label>
      <Input placeholder={placeholder} />
    </div>
  );
}

export function CreateEscrowProduct() {
  const [useCustomArbitrator, setUseCustomArbitrator] = useState(false);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant="success">Create Escrow</Badge>
        <Badge variant="secondary">Buyer journey</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Create a New Escrow</CardTitle>
            <CardDescription>
              Use this when you already know the seller and want funds held until the delivery milestone is complete.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Seller Wallet / Address"
                icon={<Store className="h-4 w-4" />}
                placeholder="ckt1..."
              />
              <Field
                label="Amount"
                icon={<Scale className="h-4 w-4" />}
                placeholder="350 CKB"
              />
              <Field
                label="Deadline"
                icon={<CalendarClock className="h-4 w-4" />}
                placeholder="2026-04-30"
              />
              <Field
                label="Reference / Order ID"
                icon={<Vault className="h-4 w-4" />}
                placeholder="INV-042"
              />
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
                <FileText className="h-4 w-4" />
                Description
              </Label>
              <Textarea placeholder="Describe the service, milestone, or goods being escrowed." />
            </div>

            <Card className="border-dashed bg-secondary/50 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Arbitrator</CardTitle>
                <CardDescription>
                  The platform arbitrator is selected by default for the easiest dispute flow.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-[1.25rem] border border-border bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <strong>Platform Arbitrator</strong>
                    <Badge variant="success">Default</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Start with the default platform arbitrator for a simpler buyer experience, or override it below.
                  </p>
                </div>

                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setUseCustomArbitrator((value) => !value)}
                >
                  {useCustomArbitrator ? "Use Platform Arbitrator" : "Use Custom Arbitrator"}
                </Button>

                {useCustomArbitrator ? (
                  <Field
                    label="Custom Arbitrator Wallet / Address"
                    icon={<UserRound className="h-4 w-4" />}
                    placeholder="ckt1..."
                  />
                ) : null}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button size="lg">Create & Fund Escrow</Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/studio">Use Studio Instead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer Checklist</CardTitle>
            <CardDescription>
              The product assumes wallet-first identity and one focused escrow per agreement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">Before you fund</p>
              <ul className="space-y-2">
                <li>Confirm the seller wallet carefully.</li>
                <li>Set a realistic deadline.</li>
                <li>Use a clear description of the exact deliverable.</li>
              </ul>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 font-medium text-foreground">After delivery</p>
              <ul className="space-y-2">
                <li>Release funds when the work is accepted.</li>
                <li>Dispute if the seller claims delivery too early.</li>
                <li>Refund only after the deadline path is valid.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
