const contractErrorHints: Record<string, string> = {
  "-101": "Escrow cell data is too short. Check that the frontend is encoding the full escrow layout.",
  "-102": "Escrow state byte is invalid. The on-chain contract rejected the state code.",
  "-103": "Description length does not match the payload. Re-encode the escrow data.",
  "-104": "Immutable escrow fields changed unexpectedly during transition.",
  "-105": "This transition is not legal from the current escrow state.",
  "-106": "The required signer is missing for this action.",
  "-107": "The payout outputs do not satisfy the contract’s money-flow rules.",
  "-108": "Refund requires a header timestamp at or after the escrow deadline.",
};

export interface FormattedEscrowError {
  detail: string;
  hint?: string;
}

export function formatEscrowError(error: unknown): FormattedEscrowError {
  const detail = error instanceof Error ? error.message : String(error);

  const matchedCode = Object.keys(contractErrorHints).find((code) => detail.includes(code));
  if (matchedCode) {
    const hint = contractErrorHints[matchedCode];
    return hint ? { detail, hint } : { detail };
  }

  if (detail.includes("PoolRejectedTransactionByMinFeeRate")) {
    return {
      detail,
      hint: "The transaction fee is below the current CKB minimum fee rate. Rebuild the transaction and let the wallet add a fee input before submitting.",
    };
  }

  if (detail.toLowerCase().includes("signer")) {
    return {
      detail,
      hint: "Make sure the correct wallet/signer is selected for the current action.",
    };
  }

  if (detail.toLowerCase().includes("header")) {
    return {
      detail,
      hint: "Refunds need a valid header dependency and a reference timestamp after the deadline.",
    };
  }

  return { detail };
}
