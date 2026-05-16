"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";

import { createCellDep, createTypeScript } from "./utils";
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
  loadDeploymentForNetwork,
  loadNetwork,
  NETWORK_CLIENTS,
  STORAGE_KEYS,
} from "../studio";
import type { CkbNetwork, DeploymentFormState, EscrowListItem, WalletState } from "../types";

export type ProductNetwork = CkbNetwork;

const PRODUCT_STORAGE_KEYS = {
  network: STORAGE_KEYS.network,
} as const;

function isDeploymentReady(deployment: DeploymentFormState): boolean {
  return Boolean(deployment.codeHash && deployment.depTxHash);
}

export type ProductWorkspaceValue = ReturnType<typeof useProductWorkspace>;

export function useProductWorkspace() {
  const [network, setNetworkState] = useState<ProductNetwork>(() => loadNetwork());
  const [walletState, setWalletState] = useState<WalletState>({ wallets: [], activeSigner: null });
  const [deployment, setDeployment] = useState<DeploymentFormState>(() =>
    loadDeploymentForNetwork(loadNetwork()),
  );
  const [escrows, setEscrows] = useState<EscrowListItem[]>([]);
  const [isFetchingEscrows, setIsFetchingEscrows] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [activeLockHash, setActiveLockHash] = useState<string | null>(null);
  const [participantScripts, setParticipantScripts] = useState<ParticipantScriptRegistry>(() =>
    loadParticipantScriptRegistry(),
  );
  const controllerRef = useRef<ccc.SignersController | null>(null);

  const client = useMemo(() => NETWORK_CLIENTS[network], [network]);

  const refreshWallets = useCallback(async () => {
    if (!controllerRef.current) {
      return;
    }

    setStatus(`Refreshing ${network} wallets...`);
    controllerRef.current.disconnect();
    await controllerRef.current.refresh(client, (wallets) => {
      setWalletState((current) => ({
        wallets,
        activeSigner:
          current.activeSigner &&
          wallets.some((wallet) =>
            wallet.signers.some((signerInfo) => signerInfo.signer === current.activeSigner),
          )
            ? current.activeSigner
            : null,
      }));
    });
    setStatus(`Wallet discovery finished for ${network}.`);
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
        setDeployment(loadDeploymentForNetwork(network));
      }
      if (event.key === STORAGE_KEYS.mainnetDeployment && network === "mainnet") {
        setDeployment(loadDeploymentForNetwork(network));
      }
      if (event.key === PARTICIPANT_SCRIPT_STORAGE_KEY) {
        setParticipantScripts(loadParticipantScriptRegistry());
      }
      if (event.key === PRODUCT_STORAGE_KEYS.network) {
        const nextNetwork = loadNetwork();
        setNetworkState(nextNetwork);
        setDeployment(loadDeploymentForNetwork(nextNetwork));
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
      return;
    }

    try {
      setIsFetchingEscrows(true);
      setStatus(`Fetching ${network} escrow cells...`);
      const fetched = await fetchEscrowCellsByType(deployment, 48, client);
      setEscrows(fetched);
      setStatus(`Fetched ${fetched.length} ${network} escrow cell(s).`);
    } catch (error) {
      setStatus(`Escrow fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetchingEscrows(false);
    }
  }, [client, deployment, network]);

  useEffect(() => {
    if (isDeploymentReady(deployment)) {
      void refreshEscrows();
    }
  }, [deployment, refreshEscrows]);

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
      setWalletState((current) => ({ ...current, activeSigner: signer }));
      setStatus("Wallet connected.");
    } catch (error) {
      setStatus(`Wallet connect failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }, []);

  const disconnectSigner = useCallback(async () => {
    if (!walletState.activeSigner) {
      return;
    }

    try {
      setStatus("Disconnecting wallet...");
      await walletState.activeSigner.disconnect();
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
    setDeployment(loadDeploymentForNetwork(nextNetwork));
    setEscrows([]);
    setWalletState({ wallets: [], activeSigner: null });
    setActiveLockHash(null);
  }, []);

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
    isFetchingEscrows,
    refreshEscrows,
    status,
    activeLockHash,
    service,
    participantScripts,
    saveParticipantScript,
  };
}
