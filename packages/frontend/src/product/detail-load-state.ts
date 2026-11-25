export type EscrowDetailLoadState =
  | "ready"
  | "loading"
  | "confirming"
  | "synchronizing"
  | "error"
  | "not-found";

export function getEscrowDetailLoadState(input: {
  hasRecord: boolean;
  hasLastKnownRecord: boolean;
  submittedTxHash: string | null;
  isFetchingEscrows: boolean;
  hasFetchedEscrows: boolean;
  isFetchingIndexedDetail: boolean;
  hasError: boolean;
}): EscrowDetailLoadState {
  if (input.hasRecord) return "ready";
  if (input.submittedTxHash) return "confirming";
  if (input.hasLastKnownRecord) return "synchronizing";
  if (input.isFetchingEscrows || !input.hasFetchedEscrows || input.isFetchingIndexedDetail) {
    return "loading";
  }
  if (input.hasError) return "error";
  return "not-found";
}
