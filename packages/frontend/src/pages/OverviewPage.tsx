import type * as ccc from "@ckb-ccc/ccc";
import {
  Activity,
  Download,
  FolderDown,
  RefreshCcw,
  Search,
  Shield,
  Wallet,
} from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/index.js";
import { createExplorerTxUrl } from "../studio.js";
import type {
  ActivityItem,
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  EscrowListItem,
  WalletState,
} from "../types.js";

interface OverviewPageProps {
  walletState: WalletState;
  decodedEscrow: { state: string; amountShannons: bigint; deadlineMs: bigint; descriptionText: string } | null;
  status: string;
  lastTxHash: string;
  deployment: DeploymentFormState;
  createForm: CreateEscrowFormState;
  actionForm: ActionFormState;
  activity: ActivityItem[];
  discoveredEscrows: EscrowListItem[];
  isFetchingEscrows: boolean;
  onSelectSigner: (signer: ccc.Signer) => void;
  onRefreshWallets: () => void;
  onExportSnapshot: () => void;
  onImportSnapshot: () => void;
  onResetStudio: () => void;
  onFetchEscrows: () => void;
  onLoadEscrow: (escrow: EscrowListItem) => void;
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <strong className="text-xl">{value}</strong>
    </div>
  );
}

export function OverviewPage({
  walletState,
  decodedEscrow,
  status,
  lastTxHash,
  deployment,
  createForm,
  actionForm,
  activity,
  discoveredEscrows,
  isFetchingEscrows,
  onSelectSigner,
  onRefreshWallets,
  onExportSnapshot,
  onImportSnapshot,
  onResetStudio,
  onFetchEscrows,
  onLoadEscrow,
}: OverviewPageProps) {
  return (
    <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              System Snapshot
            </CardTitle>
            <CardDescription>
              Quick operational view of wallet state, deployment config, and currently loaded escrow context.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={onRefreshWallets}>
              <RefreshCcw className="h-4 w-4" />
              Refresh Wallets
            </Button>
            <Button variant="outline" onClick={onExportSnapshot}>
              <Download className="h-4 w-4" />
              Export Studio
            </Button>
            <Button variant="outline" onClick={onImportSnapshot}>
              <FolderDown className="h-4 w-4" />
              Import Studio
            </Button>
            <Button variant="destructive" onClick={onResetStudio}>
              Reset Forms
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Wallets" value={walletState.wallets.length} />
            <StatCard
              label="Active Signer"
              value={walletState.activeSigner ? "Selected" : "Missing"}
            />
            <StatCard
              label="Deployment Ready"
              value={deployment.codeHash && deployment.depTxHash ? "Yes" : "No"}
            />
            <StatCard label="Loaded Escrow" value={decodedEscrow?.state ?? "None"} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Wallets
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {walletState.wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No wallets discovered yet.</p>
          ) : (
            walletState.wallets.map((wallet) => (
              <div
                key={wallet.name}
                className="rounded-[1.25rem] border border-border bg-white/75 p-4"
              >
                <strong>{wallet.name}</strong>
                <p className="mb-3 mt-1 text-sm text-muted-foreground">
                  {wallet.signers.length} signer(s)
                </p>
                <div className="flex flex-wrap gap-2">
                  {wallet.signers.map((signerInfo) => (
                    <Button
                      key={`${wallet.name}-${signerInfo.name}`}
                      variant={
                        walletState.activeSigner === signerInfo.signer ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => onSelectSigner(signerInfo.signer)}
                    >
                      {signerInfo.name}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Deployment Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Type Script Code Hash
            </p>
            <p className="break-all text-sm">{deployment.codeHash || "Not set"}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Hash Type
              </p>
              <p className="text-sm">{deployment.hashType}</p>
            </div>
            <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Dep Index
              </p>
              <p className="text-sm">{deployment.depIndex}</p>
            </div>
          </div>
          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cell Dep Tx Hash
            </p>
            <p className="break-all text-sm">{deployment.depTxHash || "Not set"}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create Defaults</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <StatCard label="Amount" value={createForm.amountShannons} />
            <StatCard label="Deadline" value={createForm.deadlineMs} />
          </div>
          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Description
            </p>
            <p className="text-sm">{createForm.description}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Escrow Decode</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {decodedEscrow ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <StatCard label="State" value={decodedEscrow.state} />
                <StatCard label="Amount" value={decodedEscrow.amountShannons.toString()} />
              </div>
              <StatCard label="Deadline" value={decodedEscrow.deadlineMs.toString()} />
              <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Description
                </p>
                <p className="text-sm">{decodedEscrow.descriptionText}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Paste or load escrow data to decode a live escrow cell.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />
              Discovered Escrows
            </CardTitle>
            <CardDescription>
              Query escrow cells by the configured type script and load one into the detail and operate views.
            </CardDescription>
          </div>
          <Button variant="outline" onClick={onFetchEscrows}>
            {isFetchingEscrows ? "Loading..." : "Fetch Escrows"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {discoveredEscrows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No escrow cells loaded yet.</p>
          ) : (
            discoveredEscrows.map((escrow) => (
              <div
                key={`${escrow.txHash}:${escrow.index}`}
                className="grid gap-3 rounded-[1.25rem] border border-border bg-white/75 p-4 xl:grid-cols-[1.2fr_0.9fr_auto]"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong>{escrow.decoded.state}</strong>
                    <Badge variant="secondary">
                      {escrow.decoded.amountShannons.toString()} shannons
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{escrow.decoded.descriptionText}</p>
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <code className="block break-all">{escrow.txHash}</code>
                  <div>index {escrow.index}</div>
                  <div>capacity {escrow.capacity}</div>
                </div>
                <div className="flex items-start justify-end">
                  <Button variant="outline" size="sm" onClick={() => onLoadEscrow(escrow)}>
                    Load Escrow
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Activity
          </CardTitle>
          <CardDescription>
            Preview, submission, and failure events are tracked here so testnet work does not disappear into one status line.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Status" value={status} />
            <StatCard label="Last Tx" value={lastTxHash || "None"} />
            <StatCard label="Loaded Data" value={actionForm.escrowDataHex || "0x"} />
          </div>
          <div className="space-y-3">
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity yet.</p>
            ) : (
              activity.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[1.25rem] border border-border bg-white/75 p-4"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <strong>{item.label}</strong>
                    <Badge
                      variant={
                        item.status === "submitted"
                          ? "success"
                          : item.status === "failed"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {item.status}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                  {item.txHash ? (
                    <a
                      className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                      href={createExplorerTxUrl(item.txHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View on Explorer
                    </a>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
