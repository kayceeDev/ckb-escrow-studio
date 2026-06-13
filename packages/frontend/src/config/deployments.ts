import { initialDeployment, isDeploymentReady, loadDeploymentForNetwork } from "../studio";
import type { CkbNetwork, DeploymentFormState } from "../types";

type DeploymentEnvPrefix = "TESTNET" | "MAINNET";

export interface ProductArbitratorConfig {
  id: string;
  label: string;
  address: string;
  active: boolean;
  specialty?: string;
  weight?: number;
}

export interface ProductArbitratorSelectionInput {
  buyerLockHash: string;
  dateBucket?: string;
  network: CkbNetwork;
  pool?: ProductArbitratorConfig[];
  referenceId?: string;
  sellerAddress: string;
}

const STATIC_DEPLOYMENTS: Record<CkbNetwork, DeploymentFormState> = {
  testnet: {
    codeHash: "0x9a477688b4767d9cdbd0f526c25a9265171b63cdc72487452cd22fa92a255a8f",
    hashType: "data2",
    args: "0x",
    depTxHash: "0x6a1bdcfd076a04bceb14cad8069952a04f17e57091d1ac27b32304127c3ffe28",
    depIndex: "0",
    escrowLockCodeHash: "0x9a477688b4767d9cdbd0f526c25a9265171b63cdc72487452cd22fa92a255a8f",
    escrowLockHashType: "data2",
    escrowLockArgs: "0x",
  },
  mainnet: initialDeployment,
};

const STATIC_ARBITRATOR_POOLS: Record<CkbNetwork, ProductArbitratorConfig[]> = {
  testnet: [
    {
      id: "testnet-platform-arbitrator-1",
      label: "Platform arbitrator",
      address: "ckt1qrfrwcdnvssswdwpn3s9v8fp87emat306ctjwsm3nmlkjg8qyza2cqgqq93scsruacxnredg6waz09a7gj2urcs57uvdsqw3",
      active: true,
    },
  ],
  mainnet: [],
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

function defaultArbitratorFromEnv(network: CkbNetwork): string {
  return envValue(ENV_PREFIXES[network], "DEFAULT_ARBITRATOR");
}

function envArbitratorPool(network: CkbNetwork): ProductArbitratorConfig[] {
  const address = defaultArbitratorFromEnv(network).trim();
  if (!address) {
    return [];
  }

  return [
    {
      id: `${network}-platform-default`,
      label: "Platform arbitrator",
      address,
      active: true,
    },
  ];
}

function isActiveArbitrator(entry: ProductArbitratorConfig): boolean {
  return entry.active && entry.address.trim().length > 0;
}

function stableHash(seed: string): number {
  let hash = 2166136261;

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
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

export function resolveArbitratorPool(network: CkbNetwork): ProductArbitratorConfig[] {
  const envPool = envArbitratorPool(network);
  if (envPool.length > 0) {
    return envPool;
  }

  return STATIC_ARBITRATOR_POOLS[network];
}

export function hasActiveArbitratorPool(
  network: CkbNetwork,
  pool: ProductArbitratorConfig[] = resolveArbitratorPool(network),
): boolean {
  return pool.some(isActiveArbitrator);
}

export function resolveDefaultArbitrator(network: CkbNetwork): string {
  return resolveArbitratorPool(network).find(isActiveArbitrator)?.address ?? "";
}

export function selectAssignedArbitrator({
  buyerLockHash,
  dateBucket,
  network,
  pool = resolveArbitratorPool(network),
  referenceId,
  sellerAddress,
}: ProductArbitratorSelectionInput): ProductArbitratorConfig | null {
  const activePool = pool.filter(isActiveArbitrator);
  if (activePool.length === 0) {
    return null;
  }

  const assignmentSeed = [
    network,
    buyerLockHash.trim().toLowerCase(),
    sellerAddress.trim().toLowerCase(),
    referenceId?.trim() || dateBucket?.trim() || new Date().toISOString().slice(0, 10),
  ].join("|");

  const selectedIndex = stableHash(assignmentSeed) % activePool.length;
  return activePool[selectedIndex] ?? null;
}

export function hasConfiguredProductDeployment(network: CkbNetwork): boolean {
  return isDeploymentReady(resolveProductDeployment(network));
}
