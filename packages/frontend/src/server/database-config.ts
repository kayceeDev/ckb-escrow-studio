export type DatabaseEnvironmentKey = "DATABASE_URL" | "POSTGRES_URL";

export interface DatabaseUrlResolution {
  url: string | null;
  source: DatabaseEnvironmentKey | null;
  configured: boolean;
  error: string | null;
}

function isUsablePostgresUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "postgres:" || url.protocol === "postgresql:") && url.hostname !== "host";
  } catch {
    return false;
  }
}

export function resolveDatabaseUrl(
  environment: Partial<Record<DatabaseEnvironmentKey, string | undefined>> = process.env as Partial<
    Record<DatabaseEnvironmentKey, string | undefined>
  >,
): DatabaseUrlResolution {
  const candidates = [
    ["DATABASE_URL", environment.DATABASE_URL?.trim()],
    ["POSTGRES_URL", environment.POSTGRES_URL?.trim()],
  ] as const;
  const configured = candidates.filter(([, value]) => Boolean(value));

  for (const [source, value] of configured) {
    if (value && isUsablePostgresUrl(value)) {
      return { url: value, source, configured: true, error: null };
    }
  }

  if (configured.length > 0) {
    return {
      url: null,
      source: null,
      configured: true,
      error: `${configured.map(([key]) => key).join(" and ")} must contain a valid PostgreSQL URL with a real hostname.`,
    };
  }

  return { url: null, source: null, configured: false, error: null };
}

export function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

export function isDatabaseRuntimeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const candidate = error as { code?: unknown; name?: unknown; severity?: unknown; message?: unknown };
  if (candidate.name === "DatabaseError" || typeof candidate.severity === "string") return true;
  if (typeof candidate.code === "string" && /^(?:[0-9A-Z]{5}|E[A-Z_]+)$/.test(candidate.code)) return true;

  return typeof candidate.message === "string" && /(?:postgres|database|connection terminated|pool.*closed|timeout.*connect)/i.test(candidate.message);
}
