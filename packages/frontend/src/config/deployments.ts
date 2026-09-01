import { initialDeployment, isDeploymentReady, loadDeploymentForNetwork } from "../studio";
import type { CkbNetwork, DeploymentFormState } from "../types";

interface ProductPublicEnv {
  typeCodeHash: string;
  typeHashType: string;
  typeArgs: string;
  depTxHash: string;
  depIndex: string;
  lockCodeHash: string;
  lockHashType: string;
  lockArgs: string;
  defaultArbitrator: string;
}

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
    codeHash: "0xfecca11f654402d119c2f2a88e33f86601715c7201d231c364b4960b63d74455",
    hashType: "data2",
    args: "0x",
    depTxHash: "0x7b3704ef45b6619e94fefb4cdd405828b0f7343ffcea379d10f90fa7cac768ff",
    depIndex: "0",
    escrowLockCodeHash: "0xfecca11f654402d119c2f2a88e33f86601715c7201d231c364b4960b63d74455",
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

const PUBLIC_ENV: Record<CkbNetwork, ProductPublicEnv> = {
  testnet: {
    typeCodeHash: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_CODE_HASH ?? "",
    typeHashType: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_HASH_TYPE ?? "",
    typeArgs: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_TYPE_ARGS ?? "",
    depTxHash: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_TX_HASH ?? "",
    depIndex: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEP_INDEX ?? "",
    lockCodeHash: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_CODE_HASH ?? "",
    lockHashType: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_HASH_TYPE ?? "",
    lockArgs: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_LOCK_ARGS ?? "",
    defaultArbitrator: process.env.NEXT_PUBLIC_CKB_ESCROW_TESTNET_DEFAULT_ARBITRATOR ?? "",
  },
  mainnet: {
    typeCodeHash: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_CODE_HASH ?? "",
    typeHashType: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_HASH_TYPE ?? "",
    typeArgs: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_TYPE_ARGS ?? "",
    depTxHash: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEP_TX_HASH ?? "",
    depIndex: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEP_INDEX ?? "",
    lockCodeHash: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_CODE_HASH ?? "",
    lockHashType: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_HASH_TYPE ?? "",
    lockArgs: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_LOCK_ARGS ?? "",
    defaultArbitrator: process.env.NEXT_PUBLIC_CKB_ESCROW_MAINNET_DEFAULT_ARBITRATOR ?? "",
  },
};

function deploymentFromEnv(network: CkbNetwork): DeploymentFormState {
  const env = PUBLIC_ENV[network];

  return {
    codeHash: env.typeCodeHash,
    hashType: parseHashType(env.typeHashType),
    args: env.typeArgs || "0x",
    depTxHash: env.depTxHash,
    depIndex: env.depIndex || "0",
    escrowLockCodeHash: env.lockCodeHash,
    escrowLockHashType: parseLockHashType(env.lockHashType),
    escrowLockArgs: env.lockArgs || "0x",
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
  return PUBLIC_ENV[network].defaultArbitrator;
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
