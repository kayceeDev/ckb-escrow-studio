import * as ccc from "@ckb-ccc/ccc";

import { makeCellDep, makeEscrowCell, makeTypeScript } from "../studio";
import type { DeploymentFormState, EscrowListItem } from "../types";

export function createTypeScript(deployment: DeploymentFormState): ccc.ScriptLike {
  return makeTypeScript(deployment);
}

export function createCellDep(deployment: DeploymentFormState): ccc.CellDepLike {
  return makeCellDep(deployment);
}

export function createEscrowInput(
  escrow: EscrowListItem,
  deployment: DeploymentFormState,
): ccc.CellLike {
  return makeEscrowCell(
    {
      escrowTxHash: escrow.txHash,
      escrowIndex: escrow.index,
      escrowCapacity: escrow.capacity,
      escrowLockCodeHash: escrow.lock.codeHash.toString(),
      escrowLockHashType: (ccc.Script.from(escrow.lock).hashType as DeploymentFormState["escrowLockHashType"]),
      escrowLockArgs: escrow.lock.args.toString(),
      escrowDataHex: escrow.decoded.dataHex,
      recipientCodeHash: "",
      recipientArgs: "0x",
      referenceTimestampMs: "",
      headerDepHash: "",
    },
    deployment,
  );
}
