import * as ccc from "@ckb-ccc/ccc";
import { EscrowService } from "@ckb-escrow/app";
import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";

import {
  STORAGE_KEYS,
  createActivityItem,
  createExplorerTxUrl,
  createStudioSnapshot,
  decodeEscrowHex,
  fetchEscrowCellsByType,
  initialActionForm,
  initialCreateForm,
  initialDeployment,
  loadStoredState,
  makeCellDep,
  makeEscrowCell,
  makeLock,
  makeTypeScript,
  parseStudioSnapshot,
  prettyJson,
  routeFromHash,
  ROUTE_LABELS,
  testnetClient,
  type RouteId,
} from "./studio.js";
import type {
  ActivityItem,
  ActionFormState,
  CreateEscrowFormState,
  DeploymentFormState,
  EscrowListItem,
  WalletState,
} from "./types.js";

const OverviewPage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.OverviewPage })),
);
const CreatePage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.CreatePage })),
);
const DetailPage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.DetailPage })),
);
const ActionsPage = lazy(async () =>
  import("./pages/index.js").then((module) => ({ default: module.ActionsPage })),
);

type AsyncAction = () => Promise<ccc.Transaction | ccc.Hex>;

export function App() {
  const [walletState, setWalletState] = useState<WalletState>({
    wallets: [],
    activeSigner: null,
  });
  const [deployment, setDeployment] = useState<DeploymentFormState>(() =>
    loadStoredState(STORAGE_KEYS.deployment, initialDeployment),
  );
  const [createForm, setCreateForm] = useState<CreateEscrowFormState>(() =>
    loadStoredState(STORAGE_KEYS.create, initialCreateForm),
  );
  const [actionForm, setActionForm] = useState<ActionFormState>(() =>
    loadStoredState(STORAGE_KEYS.action, initialActionForm),
  );
  const [txPreview, setTxPreview] = useState<string>("");
  const [lastTxHash, setLastTxHash] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [activity, setActivity] = useState<ActivityItem[]>(() =>
    loadStoredState(STORAGE_KEYS.activity, [] as ActivityItem[]),
  );
  const [route, setRoute] = useState<RouteId>(() => routeFromHash(window.location.hash));
  const [discoveredEscrows, setDiscoveredEscrows] = useState<EscrowListItem[]>([]);
  const [isFetchingEscrows, setIsFetchingEscrows] = useState(false);
  const controllerRef = useRef<ccc.SignersController | null>(null);
  const importRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function onHashChange() {
      setRoute(routeFromHash(window.location.hash));
    }

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.deployment, JSON.stringify(deployment));
  }, [deployment]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.create, JSON.stringify(createForm));
  }, [createForm]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.action, JSON.stringify(actionForm));
  }, [actionForm]);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEYS.activity, JSON.stringify(activity));
  }, [activity]);

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

  const decodedEscrow = useMemo(() => decodeEscrowHex(actionForm.escrowDataHex), [actionForm.escrowDataHex]);

  const service = walletState.activeSigner
    ? new EscrowService({
        deployment: {
          typeScript: makeTypeScript(deployment),
          cellDep: makeCellDep(deployment),
        },
        signer: walletState.activeSigner,
      })
    : null;

  async function refreshWallets() {
    if (!controllerRef.current) {
      return;
    }

    setStatus("Refreshing wallets...");
    controllerRef.current.disconnect();
    await controllerRef.current.refresh(testnetClient, (wallets) => {
      setWalletState((current) => ({
        wallets,
        activeSigner: current.activeSigner,
      }));
    });
    setStatus("Wallet refresh finished.");
  }

  async function runAction(label: string, action: AsyncAction) {
    try {
      setBusyAction(label);
      setStatus(`${label} in progress...`);
      const result = await action();

      if (typeof result === "string") {
        setLastTxHash(result);
        setTxPreview("");
        setStatus(`${label} submitted.`);
        setActivity((current) =>
          [
            createActivityItem(label, "submitted", `Transaction ${result} submitted.`, result),
            ...current,
          ].slice(0, 12),
        );
      } else {
        setTxPreview(prettyJson(result));
        setLastTxHash("");
        setStatus(`${label} prepared.`);
        setActivity((current) =>
          [
            createActivityItem(label, "prepared", `${label} transaction preview updated.`),
            ...current,
          ].slice(0, 12),
        );
      }
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setStatus(`${label} failed: ${detail}`);
      setActivity((current) =>
        [createActivityItem(label, "failed", detail), ...current].slice(0, 12),
      );
    } finally {
      setBusyAction(null);
    }
  }

  function exportSnapshot() {
    const snapshot = createStudioSnapshot(deployment, createForm, actionForm);
    const blob = new Blob([prettyJson(snapshot)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "ckb-escrow-studio.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus("Studio snapshot exported.");
  }

  async function importSnapshot(file: File) {
    try {
      const snapshot = parseStudioSnapshot(await file.text());
      setDeployment(snapshot.deployment);
      setCreateForm(snapshot.create);
      setActionForm(snapshot.action);
      setStatus("Studio snapshot imported.");
    } catch (error) {
      setStatus(`Import failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  function resetStudio() {
    setDeployment(initialDeployment);
    setCreateForm(initialCreateForm);
    setActionForm(initialActionForm);
    setTxPreview("");
    setLastTxHash("");
    setStatus("Studio forms reset.");
  }

  async function fetchEscrows() {
    try {
      setIsFetchingEscrows(true);
      setStatus("Fetching escrow cells by type script...");
      const escrows = await fetchEscrowCellsByType(deployment);
      setDiscoveredEscrows(escrows);
      setStatus(`Fetched ${escrows.length} escrow cell(s).`);
    } catch (error) {
      setStatus(`Escrow fetch failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFetchingEscrows(false);
    }
  }

  function loadEscrowIntoActionForm(escrow: EscrowListItem) {
    setActionForm((current) => ({
      ...current,
      escrowTxHash: escrow.txHash,
      escrowIndex: escrow.index,
      escrowCapacity: escrow.capacity,
      escrowLockCodeHash: escrow.lock.codeHash.toString(),
      escrowLockArgs: escrow.lock.args.toString(),
      escrowDataHex: escrow.decoded.dataHex,
    }));
    window.location.hash = "#/detail";
    setStatus(`Loaded escrow ${escrow.txHash}:${escrow.index} into Detail.`);
  }

  const pageProps = {
    createForm,
    actionForm,
    busy: busyAction !== null,
    decodedEscrow,
  };

  return (
    <div className="app-shell">
      <input
        ref={importRef}
        type="file"
        accept="application/json"
        className="hidden-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void importSnapshot(file);
          }
          event.target.value = "";
        }}
      />
      <header className="hero">
        <div>
          <p className="eyebrow">CKB Escrow Studio</p>
          <h1>Escrow flows prepared, signed, decoded, and operated like an actual product.</h1>
          <p className="lede">
            We are now moving from one giant workbench into an application shell. The protocol and CCC layers stay the same; the frontend becomes easier to navigate and extend.
          </p>
        </div>
        <div className="status-card">
          <span className="status-label">Status</span>
          <strong>{status}</strong>
          {lastTxHash ? (
            <>
              <code className="tx-hash">{lastTxHash}</code>
              <a
                className="activity-link"
                href={createExplorerTxUrl(lastTxHash)}
                target="_blank"
                rel="noreferrer"
              >
                Open in Explorer
              </a>
            </>
          ) : null}
        </div>
      </header>

      <nav className="route-nav">
        {(Object.entries(ROUTE_LABELS) as [RouteId, string][]).map(([routeId, label]) => (
          <a
            key={routeId}
            href={`#/${routeId}`}
            className={route === routeId ? "route-link active" : "route-link"}
          >
            {label}
          </a>
        ))}
      </nav>

      <Suspense fallback={<section className="panel"><p className="muted">Loading screen...</p></section>}>
        {route === "overview" ? (
          <OverviewPage
            walletState={walletState}
            decodedEscrow={decodedEscrow}
            status={status}
            lastTxHash={lastTxHash}
            deployment={deployment}
            createForm={createForm}
            actionForm={actionForm}
            activity={activity}
            discoveredEscrows={discoveredEscrows}
            isFetchingEscrows={isFetchingEscrows}
            onSelectSigner={(signer) =>
              setWalletState((current) => ({ ...current, activeSigner: signer }))
            }
            onRefreshWallets={() => void refreshWallets()}
            onExportSnapshot={exportSnapshot}
            onImportSnapshot={() => importRef.current?.click()}
            onResetStudio={resetStudio}
            onFetchEscrows={() => void fetchEscrows()}
            onLoadEscrow={loadEscrowIntoActionForm}
          />
        ) : null}

        {route === "create" ? (
          <CreatePage
            {...pageProps}
            onUpdate={(key, value) =>
              setCreateForm((current) => ({ ...current, [key]: value }))
            }
            onPreview={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }

              void runAction("Create preview", async () =>
                service.buildCreateEscrow({
                  sellerLock: makeLock(createForm.sellerCodeHash, createForm.sellerArgs),
                  arbitratorLock: makeLock(
                    createForm.arbitratorCodeHash,
                    createForm.arbitratorArgs,
                  ),
                  escrowLock: makeLock(createForm.escrowCodeHash, createForm.escrowArgs),
                  amountShannons: BigInt(createForm.amountShannons),
                  deadlineMs: BigInt(createForm.deadlineMs),
                  description: createForm.description,
                }),
              );
            }}
            onSend={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }

              void runAction("Create send", async () =>
                service.sendCreateEscrow({
                  sellerLock: makeLock(createForm.sellerCodeHash, createForm.sellerArgs),
                  arbitratorLock: makeLock(
                    createForm.arbitratorCodeHash,
                    createForm.arbitratorArgs,
                  ),
                  escrowLock: makeLock(createForm.escrowCodeHash, createForm.escrowArgs),
                  amountShannons: BigInt(createForm.amountShannons),
                  deadlineMs: BigInt(createForm.deadlineMs),
                  description: createForm.description,
                }),
              );
            }}
          />
        ) : null}

        {route === "detail" ? (
          <DetailPage
            txHash={actionForm.escrowTxHash}
            index={actionForm.escrowIndex}
            capacity={actionForm.escrowCapacity}
            state={decodedEscrow?.state ?? null}
            amount={decodedEscrow?.amountShannons.toString() ?? null}
            deadline={decodedEscrow?.deadlineMs.toString() ?? null}
            description={decodedEscrow?.descriptionText ?? null}
            buyerLockHash={decodedEscrow?.buyerLockHash ?? null}
            sellerLockHash={decodedEscrow?.sellerLockHash ?? null}
            arbitratorLockHash={decodedEscrow?.arbitratorLockHash ?? null}
            onOpenOperate={() => {
              window.location.hash = "#/actions";
              setStatus("Moved to Operate screen.");
            }}
          />
        ) : null}

        {route === "actions" ? (
          <ActionsPage
            {...pageProps}
            onUpdate={(key, value) =>
              setActionForm((current) => ({ ...current, [key]: value }))
            }
            onPreviewDeliver={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Deliver preview", async () =>
                service.buildDeliver(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onSendDeliver={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Deliver send", async () =>
                service.sendDeliver(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onPreviewDispute={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Dispute preview", async () =>
                service.buildDispute(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onSendDispute={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Dispute send", async () =>
                service.sendDispute(makeEscrowCell(actionForm, deployment)),
              );
            }}
            onPreviewRefund={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Refund preview", async () =>
                service.buildRefund({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
                  headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
                }),
              );
            }}
            onSendRefund={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Refund send", async () =>
                service.sendRefund({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  referenceTimestampMs: BigInt(actionForm.referenceTimestampMs || "0"),
                  headerDeps: actionForm.headerDepHash ? [actionForm.headerDepHash] : [],
                }),
              );
            }}
            onPreviewResolveToSeller={() => {
              if (!service) {
                setStatus("Select a signer before building transactions.");
                return;
              }
              void runAction("Resolve preview", async () =>
                service.buildResolveToSeller({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  recipientLock: makeLock(
                    actionForm.recipientCodeHash,
                    actionForm.recipientArgs,
                  ),
                }),
              );
            }}
            onSendResolveToSeller={() => {
              if (!service) {
                setStatus("Select a signer before sending transactions.");
                return;
              }
              void runAction("Resolve send", async () =>
                service.sendResolveToSeller({
                  escrowInput: makeEscrowCell(actionForm, deployment),
                  recipientLock: makeLock(
                    actionForm.recipientCodeHash,
                    actionForm.recipientArgs,
                  ),
                }),
              );
            }}
          />
        ) : null}
      </Suspense>

      <section className="panel preview-panel">
        <h2>Transaction Preview</h2>
        <pre>{txPreview || "Build or send a transaction to inspect it here."}</pre>
      </section>
    </div>
  );
}
