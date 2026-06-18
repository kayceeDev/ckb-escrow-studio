"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";
import type { IndexedEscrowRecord } from "@ckb-escrow/indexer";

import { createCellDep, createTypeScript } from "./utils";
import { productIndexerClient } from "./indexer-api";
import {
  loadParticipantScriptRegistry,
  PARTICIPANT_SCRIPT_STORAGE_KEY,
  persistParticipantScriptRegistry,
  storedScriptFromScriptLike,
  type ParticipantScriptRegistry,
  type StoredParticipantScript,
} from "./registry";
import {
  fetchEscrowCellsByType,
  isDeploymentReady,
  loadNetwork,
  NETWORK_CLIENTS,
  STORAGE_KEYS,
} from "../studio";
import { resolveProductDeployment } from "../config/deployments";
import type { CkbNetwork, DeploymentFormState, EscrowListItem, WalletState } from "../types";

export type ProductNetwork = CkbNetwork;

const PRODUCT_STORAGE_KEYS = {
  network: STORAGE_KEYS.network,
  activeSigner: "ckb-escrow:product-active-signer",
} as const;

interface StoredActiveSigner {
  network: ProductNetwork;
  walletName: string;
  signerName: string;
}

function signerStorageKey(walletName: string, signerName: string): string {
  return `${walletName}:${signerName}`;
}

function loadStoredActiveSigner(): StoredActiveSigner | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(PRODUCT_STORAGE_KEYS.activeSigner);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredActiveSigner>;
    if (
      (parsed.network === "testnet" || parsed.network === "mainnet") &&
      typeof parsed.walletName === "string" &&
      typeof parsed.signerName === "string"
    ) {
      return {
        network: parsed.network,
        walletName: parsed.walletName,
        signerName: parsed.signerName,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function saveStoredActiveSigner(value: StoredActiveSigner): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PRODUCT_STORAGE_KEYS.activeSigner, JSON.stringify(value));
}

function clearStoredActiveSigner(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PRODUCT_STORAGE_KEYS.activeSigner);
}

export type ProductWorkspaceValue = ReturnType<typeof useProductWorkspace>;

export function useProductWorkspace() {
  const [network, setNetworkState] = useState<ProductNetwork>(() => loadNetwork());
  const [walletState, setWalletState] = useState<WalletState>({ wallets: [], activeSigner: null });
  const [deployment, setDeployment] = useState<DeploymentFormState>(() =>
    resolveProductDeployment(loadNetwork()),
  );
  const [escrows, setEscrows] = useState<EscrowListItem[]>([]);
  const [indexedEscrows, setIndexedEscrows] = useState<IndexedEscrowRecord[]>([]);
  const [isFetchingEscrows, setIsFetchingEscrows] = useState(false);
  const [hasFetchedEscrows, setHasFetchedEscrows] = useState(false);
  const [escrowFetchError, setEscrowFetchError] = useState<string | null>(null);
  const [status, setStatus] = useState("Idle");
  const [activeLockHash, setActiveLockHash] = useState<string | null>(null);
  const [chainTipTimestampMs, setChainTipTimestampMs] = useState<bigint | null>(null);
  const [participantScripts, setParticipantScripts] = useState<ParticipantScriptRegistry>(() =>
    loadParticipantScriptRegistry(),
  );
  const controllerRef = useRef<ccc.SignersController | null>(null);
  const restoredSignerRef = useRef<string | null>(null);

  const client = useMemo(() => NETWORK_CLIENTS[network], [network]);

  const refreshWallets = useCallback(async () => {
    if (!controllerRef.current) {
      return;
    }

    try {
      setStatus(`Refreshing ${network} wallets...`);
      controllerRef.current.disconnect();
      await controllerRef.current.refresh(client, (wallets) => {
        const storedSigner = loadStoredActiveSigner();
        const restoredSigner =
          storedSigner?.network === network
            ? wallets
                .flatMap((wallet) =>
                  wallet.signers.map((signerInfo) => ({
                    walletName: wallet.name,
                    signerName: signerInfo.name,
                    signer: signerInfo.signer,
                  })),
                )
                .find(
                  (option) =>
                    option.walletName === storedSigner.walletName &&
                    option.signerName === storedSigner.signerName,
                )
            : undefined;

        setWalletState((current) => ({
          wallets,
          activeSigner:
            current.activeSigner &&
            wallets.some((wallet) =>
              wallet.signers.some((signerInfo) => signerInfo.signer === current.activeSigner),
            )
              ? current.activeSigner
              : restoredSigner?.signer
                ? restoredSigner.signer
                : null,
        }));
      });
      setStatus(`Wallet discovery finished for ${network}.`);
    } catch (error) {
      setStatus(`Wallet discovery failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [client, network]);

  useEffect(() => {
    const controller = new ccc.SignersController();
    controllerRef.current = controller;
    void refreshWallets();
    return () => controller.disconnect();
  }, [refreshWallets]);

  useEffect(() => {
    function syncStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEYS.deployment && network === "testnet") {
        setDeployment(resolveProductDeployment(network));
      }
      if (event.key === STORAGE_KEYS.mainnetDeployment && network === "mainnet") {
        setDeployment(resolveProductDeployment(network));
      }
      if (event.key === PARTICIPANT_SCRIPT_STORAGE_KEY) {
        setParticipantScripts(loadParticipantScriptRegistry());
      }
      if (event.key === PRODUCT_STORAGE_KEYS.network) {
        const nextNetwork = loadNetwork();
        setNetworkState(nextNetwork);
        setDeployment(resolveProductDeployment(nextNetwork));
        setWalletState({ wallets: [], activeSigner: null });
        setActiveLockHash(null);
        setChainTipTimestampMs(null);
        setEscrows([]);
        setIndexedEscrows([]);
        setHasFetchedEscrows(false);
        setEscrowFetchError(null);
        restoredSignerRef.current = null;
      }
    }

    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, [network]);

  useEffect(() => {
    persistParticipantScriptRegistry(participantScripts);
  }, [participantScripts]);

  useEffect(() => {
    async function updateActiveLockHash() {
      if (!walletState.activeSigner) {
        setActiveLockHash(null);
        return;
      }

      try {
        const address = await walletState.activeSigner.getRecommendedAddressObj();
        const normalizedScript = ccc.Script.from(address.script);
        const lockHash = normalizedScript.hash();
        setActiveLockHash(lockHash);
        setParticipantScripts((current) => ({
          ...current,
          [lockHash]: storedScriptFromScriptLike(normalizedScript),
        }));
      } catch {
        setActiveLockHash(null);
      }
    }

    void updateActiveLockHash();
  }, [walletState.activeSigner]);

  const refreshEscrows = useCallback(async () => {
    if (!isDeploymentReady(deployment)) {
      setEscrows([]);
      setHasFetchedEscrows(false);
      setEscrowFetchError(null);
      return [] as EscrowListItem[];
    }

    try {
      setIsFetchingEscrows(true);
      setEscrowFetchError(null);
      setStatus(`Fetching ${network} escrow cells...`);
      const referenceHeader = await client.getTipHeader();
      setChainTipTimestampMs(BigInt(String(referenceHeader.timestamp)));
      const [fetched, indexed] = await Promise.all([
        fetchEscrowCellsByType(deployment, 48, client),
        activeLockHash
          ? productIndexerClient.listEscrows({ network, lockHash: activeLockHash, status: "all" })
          : Promise.resolve([]),
      ]);
      setEscrows(fetched);
      setIndexedEscrows(indexed);
      setHasFetchedEscrows(true);
      setStatus(`Fetched ${fetched.length} live cell(s) and ${indexed.length} indexed history record(s).`);
      return fetched;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setEscrowFetchError(message);
      setHasFetchedEscrows(true);
      setStatus(`Escrow fetch failed: ${message}`);
      return [] as EscrowListItem[];
    } finally {
      setIsFetchingEscrows(false);
    }
  }, [activeLockHash, client, deployment, network]);

  useEffect(() => {
    if (isDeploymentReady(deployment)) {
      void refreshEscrows();
      return;
    }

    setEscrows([]);
    setIndexedEscrows([]);
    setHasFetchedEscrows(false);
    setEscrowFetchError(null);
  }, [deployment, network, refreshEscrows]);

  const service = useMemo(
    () =>
      walletState.activeSigner && isDeploymentReady(deployment)
        ? new EscrowService({
            deployment: {
              typeScript: createTypeScript(deployment),
              cellDep: createCellDep(deployment),
            },
            signer: walletState.activeSigner,
          })
        : null,
    [deployment, walletState.activeSigner],
  );

  const connectSigner = useCallback(async (signer: ccc.Signer) => {
    try {
      setStatus("Connecting wallet...");
      await signer.connect();
      setWalletState((current) => {
        for (const wallet of current.wallets) {
          const signerInfo = wallet.signers.find((candidate) => candidate.signer === signer);
          if (signerInfo) {
            saveStoredActiveSigner({
              network,
              walletName: wallet.name,
              signerName: signerInfo.name,
            });
            restoredSignerRef.current = signerStorageKey(wallet.name, signerInfo.name);
            break;
          }
        }

        return { ...current, activeSigner: signer };
      });
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(`Wallet connect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [network]);

  const disconnectSigner = useCallback(async () => {
    if (!walletState.activeSigner) {
      return;
    }

    try {
      setStatus("Disconnecting wallet...");
      await walletState.activeSigner.disconnect();
      clearStoredActiveSigner();
      restoredSignerRef.current = null;
      setWalletState((current) => ({ ...current, activeSigner: null }));
      setActiveLockHash(null);
      setStatus("Wallet disconnected.");
    } catch (error) {
      setStatus(`Wallet disconnect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, [walletState.activeSigner]);

  const setNetwork = useCallback((nextNetwork: ProductNetwork) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(PRODUCT_STORAGE_KEYS.network, nextNetwork);
    }
    setNetworkState(nextNetwork);
    setDeployment(resolveProductDeployment(nextNetwork));
    setWalletState({ wallets: [], activeSigner: null });
    setActiveLockHash(null);
    setChainTipTimestampMs(null);
    setEscrows([]);
    setIndexedEscrows([]);
    setHasFetchedEscrows(false);
    setEscrowFetchError(null);
    restoredSignerRef.current = null;
    setStatus(`Switched to ${nextNetwork}. Refreshing wallet and escrow context...`);
  }, []);

  useEffect(() => {
    const activeSigner = walletState.activeSigner;
    if (!activeSigner) {
      return;
    }

    const activeOption = walletState.wallets
      .flatMap((wallet) =>
        wallet.signers.map((signerInfo) => ({
          walletName: wallet.name,
          signerName: signerInfo.name,
          signer: signerInfo.signer,
        })),
      )
      .find((option) => option.signer === activeSigner);

    if (!activeOption) {
      return;
    }

    const key = signerStorageKey(activeOption.walletName, activeOption.signerName);
    if (restoredSignerRef.current === key) {
      return;
    }

    restoredSignerRef.current = key;
    void activeSigner
      .connect()
      .then(() => {
        saveStoredActiveSigner({
          network,
          walletName: activeOption.walletName,
          signerName: activeOption.signerName,
        });
        setStatus("Wallet reconnected.");
      })
      .catch(() => {
        clearStoredActiveSigner();
        restoredSignerRef.current = null;
        setStatus(`Could not restore the previous ${network} wallet. Choose a signer to continue.`);
        setWalletState((current) =>
          current.activeSigner === activeSigner ? { ...current, activeSigner: null } : current,
        );
      });
  }, [network, walletState.activeSigner, walletState.wallets]);

  const saveParticipantScript = useCallback((lockHash: string, script: StoredParticipantScript) => {
    setParticipantScripts((current) => ({
      ...current,
      [lockHash]: {
        codeHash: script.codeHash.startsWith("0x") ? script.codeHash : `0x${script.codeHash}`,
        hashType: script.hashType,
        args: script.args.startsWith("0x") ? script.args : `0x${script.args}`,
        ...(script.label ? { label: script.label } : {}),
      },
    }));
  }, []);

  return {
    network,
    setNetwork,
    client,
    walletState,
    connectSigner,
    disconnectSigner,
    refreshWallets,
    deployment,
    deploymentReady: isDeploymentReady(deployment),
    escrows,
    indexedEscrows,
    isFetchingEscrows,
    hasFetchedEscrows,
    escrowFetchError,
    refreshEscrows,
    status,
    activeLockHash,
    chainTipTimestampMs,
    service,
    participantScripts,
    saveParticipantScript,
  };
}
