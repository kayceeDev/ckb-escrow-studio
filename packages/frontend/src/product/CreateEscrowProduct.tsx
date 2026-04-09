"use client";

import { useState } from "react";
import { Check, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";

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

export function CreateEscrowProduct() {
  const [useCustomArbitrator, setUseCustomArbitrator] = useState(false);

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1100px] px-4 py-8 md:px-6">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Badge variant="success">Buyer-first flow</Badge>
        <Badge variant="secondary">Platform arbitrator default</Badge>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <CardTitle>Create Escrow</CardTitle>
            <CardDescription>
              The connected wallet acts as the buyer. Enter the seller, amount, deadline, and the service or goods description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Seller Wallet / Address</Label>
                <Input placeholder="ckt1..." />
              </div>
              <div className="space-y-2">
                <Label>Amount</Label>
                <Input placeholder="350 CKB" />
              </div>
              <div className="space-y-2">
                <Label>Deadline</Label>
                <Input placeholder="2026-04-30" />
              </div>
              <div className="space-y-2">
                <Label>Reference / Order ID</Label>
                <Input placeholder="INV-042" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea placeholder="Describe the service, milestone, or goods being escrowed." />
            </div>

            <Card className="border-dashed bg-secondary/50 shadow-none">
              <CardHeader>
                <CardTitle className="text-base">Arbitrator</CardTitle>
                <CardDescription>
                  Use the platform arbitrator for the simplest flow, or override with a custom arbitrator wallet.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-border bg-white/80 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    <strong>Platform Arbitrator</strong>
                    <Badge variant="success">Default</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This preset keeps the v1 UX simple. It can be overridden if you need a custom arbitrator.
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
                  <div className="space-y-2">
                    <Label>Custom Arbitrator Wallet / Address</Label>
                    <Input placeholder="ckt1..." />
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-3">
              <Button>Create & Fund Escrow</Button>
              <Button asChild variant="outline">
                <Link href="/studio">Open Studio Instead</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How This Works</CardTitle>
            <CardDescription>
              Standalone escrow means the buyer already knows the seller and the deal terms.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
            <div className="flex items-start gap-3">
              <Check className="mt-0.5 h-4 w-4 text-primary" />
              <p>The connected wallet is the buyer identity for v1.</p>
            </div>
            <div className="flex items-start gap-3">
              <UserRound className="mt-0.5 h-4 w-4 text-primary" />
              <p>The seller is entered as an address or wallet identity.</p>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-4 w-4 text-primary" />
              <p>The platform arbitrator is used by default to simplify dispute handling.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
