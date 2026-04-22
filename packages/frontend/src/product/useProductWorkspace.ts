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
} from "./registry";
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
  const [participantScripts, setParticipantScripts] = useState<ParticipantScriptRegistry>(() =>
    loadParticipantScriptRegistry(),
  );
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
    function syncStorage(event: StorageEvent) {
      if (event.key === STORAGE_KEYS.deployment) {
        setDeployment(loadStoredState(STORAGE_KEYS.deployment, initialDeployment));
      }
      if (event.key === PARTICIPANT_SCRIPT_STORAGE_KEY) {
        setParticipantScripts(loadParticipantScriptRegistry());
      }
    }

    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, []);

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

  const saveParticipantScript = useCallback((lockHash: string, script: { codeHash: string; hashType: "type" | "data" | "data1" | "data2"; args: string; label?: string }) => {
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
    participantScripts,
    saveParticipantScript,
  };
}
