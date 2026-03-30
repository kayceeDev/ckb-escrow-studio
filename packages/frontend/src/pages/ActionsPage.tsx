import type { ChangeEvent, ReactNode } from "react";
import {
  ArrowLeftRight,
  Clock3,
  Database,
  Fingerprint,
  KeyRound,
  Link2,
  Shield,
} from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Textarea,
} from "../components/ui/index.js";
import type { ActionFormState } from "../types.js";

interface ActionsPageProps {
  actionForm: ActionFormState;
  busy: boolean;
  onUpdate: <K extends keyof ActionFormState>(
    key: K,
    value: ActionFormState[K],
  ) => void;
  onPreviewDeliver: () => void;
  onSendDeliver: () => void;
  onPreviewDispute: () => void;
  onSendDispute: () => void;
  onPreviewRefund: () => void;
  onSendRefund: () => void;
  onPreviewResolveToSeller: () => void;
  onSendResolveToSeller: () => void;
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

export function ActionsPage({
  actionForm,
  busy,
  onUpdate,
  onPreviewDeliver,
  onSendDeliver,
  onPreviewDispute,
  onSendDispute,
  onPreviewRefund,
  onSendRefund,
  onPreviewResolveToSeller,
  onSendResolveToSeller,
}: ActionsPageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <Card>
        <CardHeader>
          <CardTitle>Operate Escrow</CardTitle>
          <CardDescription>
            Load an escrow cell and prepare or submit deliver, dispute, refund, and resolution flows.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Field
              icon={<Link2 className="h-4 w-4" />}
              label="Escrow Tx Hash"
              value={actionForm.escrowTxHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("escrowTxHash", value)}
            />
            <Field
              icon={<Database className="h-4 w-4" />}
              label="Escrow Index"
              value={actionForm.escrowIndex}
              onChange={(value) => onUpdate("escrowIndex", value)}
            />
            <Field
              icon={<Database className="h-4 w-4" />}
              label="Escrow Capacity"
              value={actionForm.escrowCapacity}
              onChange={(value) => onUpdate("escrowCapacity", value)}
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              label="Escrow Lock Code Hash"
              value={actionForm.escrowLockCodeHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("escrowLockCodeHash", value)}
            />
            <Field
              icon={<KeyRound className="h-4 w-4" />}
              label="Escrow Lock Args"
              value={actionForm.escrowLockArgs}
              onChange={(value) => onUpdate("escrowLockArgs", value)}
            />
            <Field
              icon={<Shield className="h-4 w-4" />}
              label="Recipient Code Hash"
              value={actionForm.recipientCodeHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("recipientCodeHash", value)}
            />
            <Field
              icon={<Shield className="h-4 w-4" />}
              label="Recipient Args"
              value={actionForm.recipientArgs}
              onChange={(value) => onUpdate("recipientArgs", value)}
            />
            <Field
              icon={<Clock3 className="h-4 w-4" />}
              label="Reference Timestamp (refund)"
              value={actionForm.referenceTimestampMs}
              onChange={(value) => onUpdate("referenceTimestampMs", value)}
            />
            <Field
              icon={<Fingerprint className="h-4 w-4" />}
              label="Header Dep Hash (refund)"
              value={actionForm.headerDepHash}
              placeholder="0x..."
              onChange={(value) => onUpdate("headerDepHash", value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em]">
              <ArrowLeftRight className="h-4 w-4" />
              Escrow Data Hex
            </Label>
            <Textarea
              value={actionForm.escrowDataHex}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                onUpdate("escrowDataHex", event.target.value)
              }
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onPreviewDeliver} disabled={busy}>
              Preview Deliver
            </Button>
            <Button onClick={onSendDeliver} disabled={busy}>
              Send Deliver
            </Button>
            <Button variant="outline" onClick={onPreviewDispute} disabled={busy}>
              Preview Dispute
            </Button>
            <Button onClick={onSendDispute} disabled={busy}>
              Send Dispute
            </Button>
            <Button variant="outline" onClick={onPreviewRefund} disabled={busy}>
              Preview Refund
            </Button>
            <Button onClick={onSendRefund} disabled={busy}>
              Send Refund
            </Button>
            <Button variant="outline" onClick={onPreviewResolveToSeller} disabled={busy}>
              Preview Resolve To Seller
            </Button>
            <Button onClick={onSendResolveToSeller} disabled={busy}>
              Send Resolve To Seller
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Operator Notes</CardTitle>
          <CardDescription>
            This screen mirrors the contract state machine. Use discovery and detail first, then operate from a loaded cell.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
          <p>
            Refund requires both a reference timestamp and a matching header dependency because the contract reads blockchain context through header deps.
          </p>
          <p>
            Resolution requires the arbitrator signer to be active and the correct recipient lock script to be supplied.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
