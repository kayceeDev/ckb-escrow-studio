import * as ccc from "@ckb-ccc/ccc";
import {
  buildCreateEscrowTransaction,
  buildDeliverTransaction,
  buildDisputeTransaction,
  buildSettlementTransaction,
  completeFeeBySigner,
  completeSettlementFeeBySigner,
  type EscrowSettlementAction,
  type EscrowDeployment,
} from "@ckb-escrow/ccc-adapter";

import type {
  EscrowServiceCompleteParams,
  EscrowServiceCreateParams,
  EscrowServiceOptions,
  EscrowServiceRefundParams,
  EscrowServiceResolveParams,
} from "./types.js";

export class EscrowService {
  readonly deployment: EscrowDeployment;
  readonly signer: ccc.Signer;

  constructor(options: EscrowServiceOptions) {
    this.deployment = options.deployment;
    this.signer = options.signer;
  }

  private async currentSignerLock(): Promise<ccc.Script> {
    const address = await this.signer.getRecommendedAddressObj();
    return address.script;
  }

  private async signerAuthorizationInput(): Promise<ccc.CellInputLike> {
    for await (const cell of this.signer.findCells(
      {
        scriptLenRange: [0, 1],
        outputDataLenRange: [0, 1],
      },
      true,
      "desc",
      1,
    )) {
      return {
        previousOutput: cell.outPoint,
        cellOutput: {
          capacity: cell.cellOutput.capacity,
          lock: cell.cellOutput.lock,
          type: cell.cellOutput.type ?? null,
        },
        outputData: cell.outputData,
      };
    }

    throw new Error("No signer cell is available to authorize this escrow action.");
  }

  private async finalizeAndSend(
    tx: ccc.Transaction,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    await completeFeeBySigner(
      tx,
      this.signer,
      feeRate === undefined ? undefined : { feeRate },
    );
    return this.signer.sendTransaction(tx as unknown as ccc.TransactionLike);
  }

  private async finalizeSettlementAndSend(
    tx: ccc.Transaction,
    context: {
      action: EscrowSettlementAction;
      escrowInput: ccc.CellLike;
      recipientLock: ccc.ScriptLike;
    },
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    await completeSettlementFeeBySigner(
      tx,
      this.signer,
      context,
      feeRate === undefined ? undefined : { feeRate },
    );
    return this.signer.sendTransaction(tx as unknown as ccc.TransactionLike);
  }

  async buildCreateEscrow(params: EscrowServiceCreateParams): Promise<ccc.Transaction> {
    const buyerLock = params.buyerLock ?? (await this.currentSignerLock());
    return buildCreateEscrowTransaction(this.deployment, {
      ...params,
      buyerLock,
    });
  }

  async sendCreateEscrow(params: EscrowServiceCreateParams): Promise<ccc.Hex> {
    const tx = await this.buildCreateEscrow(params);
    return this.finalizeAndSend(tx, params.feeRate);
  }

  buildDeliver(escrowInput: ccc.CellLike): ccc.Transaction {
    return buildDeliverTransaction(this.deployment, {
      escrowInput,
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async buildDeliverWithSignerInput(escrowInput: ccc.CellLike): Promise<ccc.Transaction> {
    return buildDeliverTransaction(this.deployment, {
      escrowInput,
      signerInput: await this.signerAuthorizationInput(),
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async sendDeliver(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const tx = await this.buildDeliverWithSignerInput(escrowInput);
    return this.finalizeAndSend(tx, feeRate);
  }

  buildDispute(escrowInput: ccc.CellLike): ccc.Transaction {
    return buildDisputeTransaction(this.deployment, {
      escrowInput,
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async buildDisputeWithSignerInput(escrowInput: ccc.CellLike): Promise<ccc.Transaction> {
    return buildDisputeTransaction(this.deployment, {
      escrowInput,
      signerInput: await this.signerAuthorizationInput(),
      escrowLock: ccc.Cell.from(escrowInput).cellOutput.lock,
    });
  }

  async sendDispute(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const tx = await this.buildDisputeWithSignerInput(escrowInput);
    return this.finalizeAndSend(tx, feeRate);
  }

  async buildCancel(
    escrowInput: ccc.CellLike,
    recipientLock?: ccc.ScriptLike,
  ): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "Cancel", {
      escrowInput,
      signerInput: await this.signerAuthorizationInput(),
      recipientLock: recipientLock ?? (await this.currentSignerLock()),
    });
  }

  async sendCancel(
    escrowInput: ccc.CellLike,
    feeRate?: ccc.NumLike,
  ): Promise<ccc.Hex> {
    const recipientLock = await this.currentSignerLock();
    const tx = await this.buildCancel(escrowInput, recipientLock);
    return this.finalizeSettlementAndSend(
      tx,
      { action: "Cancel", escrowInput, recipientLock },
      feeRate,
    );
  }

  async buildRefund(
    params: EscrowServiceRefundParams,
    recipientLock?: ccc.ScriptLike,
  ): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "Refund", {
      escrowInput: params.escrowInput,
      signerInput: params.signerInput ?? (await this.signerAuthorizationInput()),
      recipientLock: recipientLock ?? (await this.currentSignerLock()),
      referenceTimestampMs: params.referenceTimestampMs,
      headerDeps: params.headerDeps,
    });
  }

  async sendRefund(params: EscrowServiceRefundParams): Promise<ccc.Hex> {
    const recipientLock = await this.currentSignerLock();
    const tx = await this.buildRefund(params, recipientLock);
    return this.finalizeSettlementAndSend(
      tx,
      { action: "Refund", escrowInput: params.escrowInput, recipientLock },
      params.feeRate,
    );
  }

  buildComplete(params: EscrowServiceCompleteParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "Complete", {
      escrowInput: params.escrowInput,
      ...(params.signerInput ? { signerInput: params.signerInput } : {}),
      recipientLock: params.sellerLock,
    });
  }

  async buildCompleteWithSignerInput(params: EscrowServiceCompleteParams): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "Complete", {
      escrowInput: params.escrowInput,
      signerInput: params.signerInput ?? (await this.signerAuthorizationInput()),
      recipientLock: params.sellerLock,
    });
  }

  async sendComplete(params: EscrowServiceCompleteParams): Promise<ccc.Hex> {
    const tx = await this.buildCompleteWithSignerInput(params);
    return this.finalizeSettlementAndSend(
      tx,
      {
        action: "Complete",
        escrowInput: params.escrowInput,
        recipientLock: params.sellerLock,
      },
      params.feeRate,
    );
  }

  buildResolveToBuyer(params: EscrowServiceResolveParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "ResolveToBuyer", {
      escrowInput: params.escrowInput,
      ...(params.signerInput ? { signerInput: params.signerInput } : {}),
      recipientLock: params.recipientLock,
    });
  }

  async buildResolveToBuyerWithSignerInput(params: EscrowServiceResolveParams): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "ResolveToBuyer", {
      escrowInput: params.escrowInput,
      signerInput: params.signerInput ?? (await this.signerAuthorizationInput()),
      recipientLock: params.recipientLock,
    });
  }

  async sendResolveToBuyer(params: EscrowServiceResolveParams): Promise<ccc.Hex> {
    const tx = await this.buildResolveToBuyerWithSignerInput(params);
    return this.finalizeSettlementAndSend(
      tx,
      {
        action: "ResolveToBuyer",
        escrowInput: params.escrowInput,
        recipientLock: params.recipientLock,
      },
      params.feeRate,
    );
  }

  buildResolveToSeller(params: EscrowServiceResolveParams): ccc.Transaction {
    return buildSettlementTransaction(this.deployment, "ResolveToSeller", {
      escrowInput: params.escrowInput,
      ...(params.signerInput ? { signerInput: params.signerInput } : {}),
      recipientLock: params.recipientLock,
    });
  }

  async buildResolveToSellerWithSignerInput(params: EscrowServiceResolveParams): Promise<ccc.Transaction> {
    return buildSettlementTransaction(this.deployment, "ResolveToSeller", {
      escrowInput: params.escrowInput,
      signerInput: params.signerInput ?? (await this.signerAuthorizationInput()),
      recipientLock: params.recipientLock,
    });
  }

  async sendResolveToSeller(params: EscrowServiceResolveParams): Promise<ccc.Hex> {
    const tx = await this.buildResolveToSellerWithSignerInput(params);
    return this.finalizeSettlementAndSend(
      tx,
      {
        action: "ResolveToSeller",
        escrowInput: params.escrowInput,
        recipientLock: params.recipientLock,
      },
      params.feeRate,
    );
  }
}
