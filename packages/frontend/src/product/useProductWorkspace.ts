"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";

import { createCellDep, createTypeScript } from "./utils";
import { fetchEscrowCellsByType, initialDeployment, loadStoredState, STORAGE_KEYS, testnetClient } from "../studio";
import type { DeploymentFormState, EscrowListItem, WalletState } from "../types";

function isDeploymentReady(deployment: DeploymentFormState): boolean {
  return Boolean(deployment.codeHash && deployment.depTxHash);
}

export function useProductWorkspace() {
  const [walletState, setWalletState] = useState<WalletState>({ wallets: [], activeSigner: null });
  const [deployment, setDeployment] = useState<DeploymentFormState>(() =>
    loadStoredState(STORAGE_KEYS.deployment, initialDeployment),
  );
  const [escrows, setEscrows] = useState<EscrowListItem[]>([]);
  const [isFetchingEscrows, setIsFetchingEscrows] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [activeLockHash, setActiveLockHash] = useState<string | null>(null);
  const controllerRef = useRef<ccc.SignersController | null>(null);

  useEffect(() => {
    const controller = new ccc.SignersController();
    controllerRef.current = controller;

    async function refreshWallets() {
      setStatus("Refreshing wallets...");
      await controller.refresh(testnetClient, (wallets) => {
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
      setStatus("Wallet discovery finished.");
    }

    void refreshWallets();
    return () => controller.disconnect();
  }, []);

  useEffect(() => {
    function syncDeployment(event: StorageEvent) {
      if (event.key === STORAGE_KEYS.deployment) {
        setDeployment(loadStoredState(STORAGE_KEYS.deployment, initialDeployment));
      }
    }

    window.addEventListener("storage", syncDeployment);
    return () => window.removeEventListener("storage", syncDeployment);
  }, []);

  useEffect(() => {
    async function updateActiveLockHash() {
      if (!walletState.activeSigner) {
        setActiveLockHash(null);
        return;
      }

      try {
        const address = await walletState.activeSigner.getRecommendedAddressObj();
        setActiveLockHash(ccc.Script.from(address.script).hash());
      } catch {
        setActiveLockHash(null);
      }
    }

    void updateActiveLockHash();
  }, [walletState.activeSigner]);

  const refreshWallets = useCallback(async () => {
    if (!controllerRef.current) {
      return;
    }

    setStatus("Refreshing wallets...");
    controllerRef.current.disconnect();
    await controllerRef.current.refresh(testnetClient, (wallets) => {
      setWalletState((current) => ({ ...current, wallets }));
    });
    setStatus("Wallet refresh finished.");
  }, []);

  const refreshEscrows = useCallback(async () => {
    if (!isDeploymentReady(deployment)) {
      setEscrows([]);
      return;
    }

    try {
      setIsFetchingEscrows(true);
      setStatus("Fetching escrow cells...");
      const fetched = await fetchEscrowCellsByType(deployment, 48);
      setEscrows(fetched);
      setStatus(`Fetched ${fetched.length} escrow cell(s).`);
    } catch (error) {
      setStatus(`Escrow fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetchingEscrows(false);
    }
  }, [deployment]);

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

  return {
    walletState,
    setActiveSigner: (signer: ccc.Signer | null) =>
      setWalletState((current) => ({ ...current, activeSigner: signer })),
    refreshWallets,
    deployment,
    deploymentReady: isDeploymentReady(deployment),
    escrows,
    isFetchingEscrows,
    refreshEscrows,
    status,
    activeLockHash,
    service,
  };
}
