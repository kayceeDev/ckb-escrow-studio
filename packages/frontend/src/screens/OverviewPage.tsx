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
  Input,
  Label,
} from "../components/ui";
import { createExplorerTxUrl } from "../studio";
import type {
  ActivityItem,
  ActionFormState,
  CreateEscrowFormState,
  DeploymentProfile,
  DeploymentFormState,
  EscrowListItem,
  CkbNetwork,
  WalletState,
} from "../types";

interface OverviewPageProps {
  walletState: WalletState;
  decodedEscrow: { state: string; amountShannons: bigint; deadlineMs: bigint; descriptionText: string } | null;
  status: string;
  lastTxHash: string;
  network: CkbNetwork;
  deployment: DeploymentFormState;
  deploymentProfiles: DeploymentProfile[];
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
  onSetNetwork: (network: CkbNetwork) => void;
  onUpdateDeployment: <K extends keyof DeploymentFormState>(
    key: K,
    value: DeploymentFormState[K],
  ) => void;
  onSaveDeploymentProfile: () => void;
  onApplyDeploymentProfile: (profile: DeploymentProfile) => void;
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
  network,
  deployment,
  deploymentProfiles,
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
  onSetNetwork,
  onUpdateDeployment,
  onSaveDeploymentProfile,
  onApplyDeploymentProfile,
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
            <StatCard label="Network" value={network} />
            <StatCard
              label="Active Signer"
              value={walletState.activeSigner ? "Selected" : "Missing"}
            />
            <StatCard
              label="Deployment Ready"
              value={deployment.codeHash && deployment.depTxHash ? "Yes" : "No"}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>Network</CardTitle>
          <CardDescription>
            Keep deployment profiles, wallets, addresses, and explorer links on the same CKB network.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => onSetNetwork("testnet")}
            className={`rounded-[1.25rem] border p-4 text-left transition ${network === "testnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={network === "testnet" ? "success" : "outline"}>Testnet</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Use ckt addresses, faucet funds, test deployments, and Pudge explorer links.
            </p>
          </button>
          <button
            type="button"
            onClick={() => onSetNetwork("mainnet")}
            className={`rounded-[1.25rem] border p-4 text-left transition ${network === "mainnet" ? "border-primary/30 bg-primary/10" : "border-border bg-white/75 hover:border-primary/20"}`}
          >
            <div className="mb-2 flex items-center gap-2">
              <Badge variant={network === "mainnet" ? "destructive" : "outline"}>Mainnet</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Use ckb addresses and a separately deployed mainnet escrow script profile.
            </p>
          </button>
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
            Deployment Configuration
          </CardTitle>
          <CardDescription>
            Configure protocol scripts once per network. Product create flows use these values automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Escrow Type Script
            </p>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Code hash</Label>
                <Input value={deployment.codeHash} onChange={(event) => onUpdateDeployment("codeHash", event.target.value)} placeholder="0x..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hash type</Label>
                  <select
                    value={deployment.hashType}
                    onChange={(event) => onUpdateDeployment("hashType", event.target.value as DeploymentFormState["hashType"])}
                    className="flex h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none ring-0 transition focus:border-primary/40"
                  >
                    <option value="type">type</option>
                    <option value="data">data</option>
                    <option value="data1">data1</option>
                    <option value="data2">data2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Args</Label>
                  <Input value={deployment.args} onChange={(event) => onUpdateDeployment("args", event.target.value)} placeholder="0x" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Escrow Lock Script
            </p>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>Code hash</Label>
                <Input value={deployment.escrowLockCodeHash} onChange={(event) => onUpdateDeployment("escrowLockCodeHash", event.target.value)} placeholder="0x..." />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Hash type</Label>
                  <select
                    value={deployment.escrowLockHashType}
                    onChange={(event) => onUpdateDeployment("escrowLockHashType", event.target.value as DeploymentFormState["escrowLockHashType"])}
                    className="flex h-11 w-full rounded-2xl border border-border bg-white px-4 text-sm text-foreground outline-none ring-0 transition focus:border-primary/40"
                  >
                    <option value="type">type</option>
                    <option value="data">data</option>
                    <option value="data1">data1</option>
                    <option value="data2">data2</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Args</Label>
                  <Input value={deployment.escrowLockArgs} onChange={(event) => onUpdateDeployment("escrowLockArgs", event.target.value)} placeholder="0x" />
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.25rem] border border-border bg-white/75 p-4">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cell Dep
            </p>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-2">
                <Label>Tx hash</Label>
                <Input value={deployment.depTxHash} onChange={(event) => onUpdateDeployment("depTxHash", event.target.value)} placeholder="0x..." />
              </div>
              <div className="space-y-2">
                <Label>Index</Label>
                <Input value={deployment.depIndex} onChange={(event) => onUpdateDeployment("depIndex", event.target.value)} placeholder="0" />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm" onClick={onSaveDeploymentProfile}>
              Save {network} Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Deployment Profiles</CardTitle>
          <CardDescription>
            Save named deployment presets so switching between environments is less error-prone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {deploymentProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deployment profiles saved yet.</p>
          ) : (
            deploymentProfiles.map((profile) => (
              <div
                key={profile.id}
                className="flex flex-col gap-3 rounded-[1.25rem] border border-border bg-white/75 p-4"
              >
                <div>
                  <strong>{profile.name}</strong>
                  <div className="mt-2">
                    <Badge variant={profile.network === "mainnet" ? "destructive" : "secondary"}>
                      {profile.network ?? "testnet"}
                    </Badge>
                  </div>
                  <p className="mt-1 break-all text-sm text-muted-foreground">
                    {profile.deployment.codeHash || "No code hash"}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onApplyDeploymentProfile(profile)}>
                  Apply Profile
                </Button>
              </div>
            ))
          )}
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
                  {item.hint ? (
                    <p className="mt-2 text-sm font-medium text-primary">{item.hint}</p>
                  ) : null}
                  {item.txHash ? (
                    <a
                      className="mt-3 inline-flex text-sm font-medium text-primary hover:underline"
                      href={createExplorerTxUrl(item.txHash, network)}
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
