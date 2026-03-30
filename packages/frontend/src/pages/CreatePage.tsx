import type { ChangeEvent, ReactNode } from "react";
import { CalendarClock, FileText, Scale, ShieldCheck, Store, Vault } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "../components/ui/index.js";
import type { CreateEscrowFormState } from "../types.js";

interface CreatePageProps {
  createForm: CreateEscrowFormState;
  busy: boolean;
  onUpdate: <K extends keyof CreateEscrowFormState>(
    key: K,
    value: CreateEscrowFormState[K],
  ) => void;
  onPreview: () => void;
  onSend: () => void;
}

function Field({
  icon,
  label,
  value,
  placeholder,
  onChange,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
        {icon}
        {label}
      </Label>
      <Input
        value={value}
        placeholder={placeholder}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
    </div>
  );
}

export function CreatePage({
  createForm,
  busy,
  onUpdate,
  onPreview,
  onSend,
}: CreatePageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <Card>
        <CardHeader>
          <CardTitle>Create Escrow</CardTitle>
          <CardDescription>
            Configure seller, arbitrator, escrow lock, amount, deadline, and description for a new escrow cell.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              icon={<Store className="h-4 w-4" />}
              label="Seller Lock Code Hash"
              value={createForm.sellerCodeHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("sellerCodeHash", value)}
            />
            <Field
              icon={<Store className="h-4 w-4" />}
              label="Seller Args"
              value={createForm.sellerArgs}
              onChange={(value) => onUpdate("sellerArgs", value)}
            />
            <Field
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Arbitrator Lock Code Hash"
              value={createForm.arbitratorCodeHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("arbitratorCodeHash", value)}
            />
            <Field
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Arbitrator Args"
              value={createForm.arbitratorArgs}
              onChange={(value) => onUpdate("arbitratorArgs", value)}
            />
            <Field
              icon={<Vault className="h-4 w-4" />}
              label="Escrow Lock Code Hash"
              value={createForm.escrowCodeHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("escrowCodeHash", value)}
            />
            <Field
              icon={<Vault className="h-4 w-4" />}
              label="Escrow Args"
              value={createForm.escrowArgs}
              onChange={(value) => onUpdate("escrowArgs", value)}
            />
            <Field
              icon={<Scale className="h-4 w-4" />}
              label="Amount (shannons)"
              value={createForm.amountShannons}
              onChange={(value) => onUpdate("amountShannons", value)}
            />
            <Field
              icon={<CalendarClock className="h-4 w-4" />}
              label="Deadline (ms)"
              value={createForm.deadlineMs}
              onChange={(value) => onUpdate("deadlineMs", value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
              <FileText className="h-4 w-4" />
              Description
            </Label>
            <Input
              value={createForm.description}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                onUpdate("description", event.target.value)
              }
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onPreview} disabled={busy}>
              Preview Create
            </Button>
            <Button onClick={onSend} disabled={busy}>
              Send Create
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Protocol Notes</CardTitle>
          <CardDescription>
            This flow creates the initial funded escrow cell. The buyer lock is derived from the currently selected signer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            The frontend never hand-builds escrow bytes in the form layer. It delegates that to the protocol SDK and app service.
          </p>
          <p>
            That keeps the UX simpler and reduces the risk of the frontend drifting away from the Rust contract layout.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
