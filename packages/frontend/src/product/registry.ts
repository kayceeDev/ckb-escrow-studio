import * as ccc from "@ckb-ccc/ccc";

export type StoredParticipantScript = {
  codeHash: string;
  hashType: "type" | "data" | "data1" | "data2";
  args: string;
  label?: string;
};

export type ParticipantScriptRegistry = Record<string, StoredParticipantScript>;

export const PARTICIPANT_SCRIPT_STORAGE_KEY = "ckb-escrow:participant-scripts";

function normalizeHex(value: string): `0x${string}` {
  const prefixed = value.startsWith("0x") ? value : `0x${value}`;
  return prefixed as `0x${string}`;
}

export function loadParticipantScriptRegistry(): ParticipantScriptRegistry {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(PARTICIPANT_SCRIPT_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as ParticipantScriptRegistry;
  } catch {
    return {};
  }
}

export function persistParticipantScriptRegistry(registry: ParticipantScriptRegistry): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(PARTICIPANT_SCRIPT_STORAGE_KEY, JSON.stringify(registry));
}

export function normalizeStoredScript(script: StoredParticipantScript): StoredParticipantScript {
  return {
    codeHash: normalizeHex(script.codeHash),
    hashType: script.hashType,
    args: normalizeHex(script.args),
    ...(script.label ? { label: script.label } : {}),
  };
}

export function scriptHashFromStored(script: StoredParticipantScript): string {
  return ccc.Script.from(normalizeStoredScript(script)).hash();
}

export function storedScriptFromScriptLike(
  script: ccc.ScriptLike,
  label?: string,
): StoredParticipantScript {
  const normalized = ccc.Script.from(script);
  return {
    codeHash: normalized.codeHash.toString(),
    hashType: normalized.hashType as StoredParticipantScript["hashType"],
    args: normalized.args.toString(),
    ...(label ? { label } : {}),
  };
}
