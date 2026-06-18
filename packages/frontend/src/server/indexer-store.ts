import { MemoryEscrowIndexerStorage } from "@ckb-escrow/indexer";

declare global {
  // Keep one dev storage instance across Next.js module reloads.
  var __ckbEscrowIndexerStorage: MemoryEscrowIndexerStorage | undefined;
}

export function getEscrowIndexerStorage(): MemoryEscrowIndexerStorage {
  globalThis.__ckbEscrowIndexerStorage ??= new MemoryEscrowIndexerStorage();
  return globalThis.__ckbEscrowIndexerStorage;
}
