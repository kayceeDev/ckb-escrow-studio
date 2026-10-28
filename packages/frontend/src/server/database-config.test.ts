import { describe, expect, it } from "vitest";

import { isDatabaseRuntimeError, resolveDatabaseUrl } from "./database-config";

describe("database URL resolution", () => {
  it("prefers DATABASE_URL when both supported variables are valid", () => {
    expect(resolveDatabaseUrl({
      DATABASE_URL: "postgres://primary.example.test/escrow",
      POSTGRES_URL: "postgres://vercel.example.test/escrow",
    })).toMatchObject({
      source: "DATABASE_URL",
      url: "postgres://primary.example.test/escrow",
      configured: true,
      error: null,
    });
  });

  it("falls back to POSTGRES_URL when DATABASE_URL is a placeholder", () => {
    expect(resolveDatabaseUrl({
      DATABASE_URL: "postgres://user:password@host/escrow",
      POSTGRES_URL: "postgres://vercel.example.test/escrow",
    })).toMatchObject({
      source: "POSTGRES_URL",
      url: "postgres://vercel.example.test/escrow",
    });
  });

  it("distinguishes PostgreSQL failures from unrelated chain errors", () => {
    expect(isDatabaseRuntimeError(Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" }))).toBe(true);
    expect(isDatabaseRuntimeError(Object.assign(new Error("CKB RPC unavailable"), { code: -32000 }))).toBe(false);
    expect(isDatabaseRuntimeError(new Error("Escrow transaction is not committed yet"))).toBe(false);
  });
});
