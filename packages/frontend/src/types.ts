import type * as ccc from "@ckb-ccc/ccc";
import type { EscrowCellView } from "@ckb-escrow/sdk";

export type CkbNetwork = "testnet" | "mainnet";

export interface DeploymentFormState {
  codeHash: string;
  hashType: "type" | "data";
  args: string;
  depTxHash: string;
  depIndex: string;
}

export interface CreateEscrowFormState {
  sellerCodeHash: string;
  sellerArgs: string;
  arbitratorCodeHash: string;
  arbitratorArgs: string;
  escrowCodeHash: string;
  escrowArgs: string;
  amountShannons: string;
  deadlineMs: string;
  description: string;
}

export interface ActionFormState {
  escrowTxHash: string;
  escrowIndex: string;
  escrowCapacity: string;
  escrowLockCodeHash: string;
  escrowLockArgs: string;
  escrowDataHex: string;
  recipientCodeHash: string;
  recipientArgs: string;
  referenceTimestampMs: string;
  headerDepHash: string;
}

export interface WalletState {
  wallets: {
    name: string;
    icon: string;
    signers: ccc.SignerInfo[];
  }[];
  activeSigner: ccc.Signer | null;
}

export interface StudioSnapshot {
  version: 1;
  network?: CkbNetwork;
  deployment: DeploymentFormState;
  create: CreateEscrowFormState;
  action: ActionFormState;
}

export interface DeploymentProfile {
  id: string;
  name: string;
  network?: CkbNetwork;
  deployment: DeploymentFormState;
}

export interface EscrowListItem {
  txHash: string;
  index: string;
  capacity: string;
  decoded: EscrowCellView;
  lock: ccc.ScriptLike;
}

export interface ActivityItem {
  id: string;
  label: string;
  status: "prepared" | "submitted" | "failed";
  createdAt: string;
  txHash?: string;
  detail: string;
  hint?: string;
}
