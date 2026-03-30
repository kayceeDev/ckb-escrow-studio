import * as ccc from "@ckb-ccc/ccc";
import { decodeEscrowData, type EscrowCellView } from "@ckb-escrow/sdk";

import type {
  ActivityItem,
  ActionFormState,
  CreateEscrowFormState,
  DeploymentProfile,
  DeploymentFormState,
  EscrowListItem,
  StudioSnapshot,
} from "./types.js";

export const testnetClient = new ccc.ClientPublicTestnet();

export const STORAGE_KEYS = {
  deployment: "ckb-escrow:deployment",
  deploymentProfiles: "ckb-escrow:deployment-profiles",
  create: "ckb-escrow:create",
  action: "ckb-escrow:action",
  activity: "ckb-escrow:activity",
} as const;

export const initialDeployment: DeploymentFormState = {
  codeHash: "",
  hashType: "type",
  args: "0x",
  depTxHash: "",
  depIndex: "0",
};

export const initialCreateForm: CreateEscrowFormState = {
  sellerCodeHash: "",
  sellerArgs: "0x",
  arbitratorCodeHash: "",
  arbitratorArgs: "0x",
  escrowCodeHash: "",
  escrowArgs: "0x",
  amountShannons: "100000000",
  deadlineMs: "1700000000000",
  description: "Website redesign milestone",
};

export const initialActionForm: ActionFormState = {
  escrowTxHash: "",
  escrowIndex: "0",
  escrowCapacity: "200000000",
  escrowLockCodeHash: "",
  escrowLockArgs: "0x",
  escrowDataHex: "0x",
  recipientCodeHash: "",
  recipientArgs: "0x",
  referenceTimestampMs: "",
  headerDepHash: "",
};

export type RouteId = "overview" | "create" | "detail" | "actions";

export const ROUTE_LABELS: Record<RouteId, string> = {
  overview: "Overview",
  create: "Create",
  detail: "Detail",
  actions: "Operate",
};

export function loadStoredState<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  const raw = window.localStorage.getItem(key);
  if (!raw) {
    return fallback;
  }

  try {
    return { ...fallback, ...JSON.parse(raw) } as T;
  } catch {
    return fallback;
  }
}

export function makeTypeScript(form: DeploymentFormState): ccc.ScriptLike {
  return {
    codeHash: form.codeHash || "0x",
    hashType: form.hashType,
    args: form.args || "0x",
  };
}

export function makeCellDep(form: DeploymentFormState): ccc.CellDepLike {
  return {
    outPoint: {
      txHash: form.depTxHash || "0x",
      index: BigInt(form.depIndex || "0"),
    },
    depType: "code",
  };
}

export function makeLock(codeHash: string, args: string): ccc.ScriptLike {
  return {
    codeHash: codeHash || "0x",
    hashType: "type",
    args: args || "0x",
  };
}

export function makeEscrowCell(
  action: ActionFormState,
  deployment: DeploymentFormState,
): ccc.CellLike {
  return {
    outPoint: {
      txHash: action.escrowTxHash || "0x",
      index: BigInt(action.escrowIndex || "0"),
    },
    cellOutput: {
      capacity: BigInt(action.escrowCapacity || "0"),
      lock: makeLock(action.escrowLockCodeHash, action.escrowLockArgs),
      type: makeTypeScript(deployment),
    },
    outputData: action.escrowDataHex || "0x",
  };
}

export function decodeEscrowHex(dataHex: string): EscrowCellView | null {
  try {
    if (!dataHex || dataHex === "0x") {
      return null;
    }
    return decodeEscrowData(dataHex as `0x${string}`);
  } catch {
    return null;
  }
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_, nested) => (typeof nested === "bigint" ? nested.toString() : nested),
    2,
  );
}

export function routeFromHash(hash: string): RouteId {
  const route = hash.replace(/^#\/?/, "");
  if (route === "create" || route === "actions" || route === "detail") {
    return route;
  }
  return "overview";
}

export function createExplorerTxUrl(txHash: string): string {
  return `https://pudge.explorer.nervos.org/transaction/${txHash}?network=testnet`;
}

export function createActivityItem(
  label: string,
  status: ActivityItem["status"],
  detail: string,
  txHash?: string,
): ActivityItem {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label,
    status,
    createdAt: new Date().toISOString(),
    detail,
    ...(txHash ? { txHash } : {}),
  };
}

export function createStudioSnapshot(
  deployment: DeploymentFormState,
  create: CreateEscrowFormState,
  action: ActionFormState,
): StudioSnapshot {
  return {
    version: 1,
    deployment,
    create,
    action,
  };
}

export function createDeploymentProfile(
  name: string,
  deployment: DeploymentFormState,
): DeploymentProfile {
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    deployment,
  };
}

export function parseStudioSnapshot(raw: string): StudioSnapshot {
  const parsed = JSON.parse(raw) as Partial<StudioSnapshot>;

  if (parsed.version !== 1) {
    throw new Error("Unsupported studio snapshot version");
  }

  return {
    version: 1,
    deployment: {
      ...initialDeployment,
      ...parsed.deployment,
    },
    create: {
      ...initialCreateForm,
      ...parsed.create,
    },
    action: {
      ...initialActionForm,
      ...parsed.action,
    },
  };
}

export async function fetchEscrowCellsByType(
  deployment: DeploymentFormState,
  limit = 12,
): Promise<EscrowListItem[]> {
  const items: EscrowListItem[] = [];

  for await (const cell of testnetClient.findCellsByType(makeTypeScript(deployment), true, "desc", limit)) {
    try {
      items.push({
        txHash: cell.outPoint.txHash,
        index: cell.outPoint.index.toString(),
        capacity: cell.cellOutput.capacity.toString(),
        lock: cell.cellOutput.lock,
        decoded: decodeEscrowData(cell.outputData),
      });
    } catch {
      // Skip cells that do not decode as the current escrow protocol layout.
    }

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}
