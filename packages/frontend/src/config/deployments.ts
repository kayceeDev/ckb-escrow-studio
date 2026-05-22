import { initialDeployment, isDeploymentReady, loadDeploymentForNetwork } from "../studio";
import type { CkbNetwork, DeploymentFormState } from "../types";

type DeploymentEnvPrefix = "TESTNET" | "MAINNET";

const STATIC_DEPLOYMENTS: Record<CkbNetwork, DeploymentFormState> = {
  testnet: {
    codeHash: "0xcd5061b3db81563eed169d78258f1214394a77c4e267ede8388efbd647c1b15a",
    hashType: "data2",
    args: "0x",
    depTxHash: "0xe5fc121d59cc0379230e4c8e68ad7ee2d10c2ab42415c7303121ed43d9516a97",
    depIndex: "0",
    escrowLockCodeHash: "0xcd5061b3db81563eed169d78258f1214394a77c4e267ede8388efbd647c1b15a",
    escrowLockHashType: "data2",
    escrowLockArgs: "0x",
  },
  mainnet: initialDeployment,
};

const ENV_PREFIXES: Record<CkbNetwork, DeploymentEnvPrefix> = {
  testnet: "TESTNET",
  mainnet: "MAINNET",
};

function envValue(prefix: DeploymentEnvPrefix, key: string): string {
  return process.env[`NEXT_PUBLIC_CKB_ESCROW_${prefix}_${key}`] ?? "";
}

function deploymentFromEnv(network: CkbNetwork): DeploymentFormState {
  const prefix = ENV_PREFIXES[network];

  return {
    codeHash: envValue(prefix, "TYPE_CODE_HASH"),
    hashType: parseHashType(envValue(prefix, "TYPE_HASH_TYPE")),
    args: envValue(prefix, "TYPE_ARGS") || "0x",
    depTxHash: envValue(prefix, "DEP_TX_HASH"),
    depIndex: envValue(prefix, "DEP_INDEX") || "0",
    escrowLockCodeHash: envValue(prefix, "LOCK_CODE_HASH"),
    escrowLockHashType: parseLockHashType(envValue(prefix, "LOCK_HASH_TYPE")),
    escrowLockArgs: envValue(prefix, "LOCK_ARGS") || "0x",
  };
}

function parseHashType(value: string): DeploymentFormState["hashType"] {
  if (value === "data" || value === "data1" || value === "data2") {
    return value;
  }

  return "type";
}

function parseLockHashType(value: string): DeploymentFormState["escrowLockHashType"] {
  return parseHashType(value);
}

function hasStoredDeploymentOverride(network: CkbNetwork): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = loadDeploymentForNetwork(network);
  return isDeploymentReady(stored);
}

export function resolveProductDeployment(network: CkbNetwork): DeploymentFormState {
  const envDeployment = deploymentFromEnv(network);
  if (isDeploymentReady(envDeployment)) {
    return envDeployment;
  }

  const staticDeployment = STATIC_DEPLOYMENTS[network];
  if (isDeploymentReady(staticDeployment)) {
    return staticDeployment;
  }

  if (hasStoredDeploymentOverride(network)) {
    return loadDeploymentForNetwork(network);
  }

  return initialDeployment;
}

export function hasConfiguredProductDeployment(network: CkbNetwork): boolean {
  return isDeploymentReady(resolveProductDeployment(network));
}
