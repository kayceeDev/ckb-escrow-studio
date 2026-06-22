import { describe, expect, it } from "vitest";

import { hashEvidenceText } from "./dispute-api";

describe("dispute evidence hashing", () => {
  it("uses a real SHA-256 digest for evidence text", async () => {
    const expected = `0x${Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("delivery proof"))))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")}`;

    await expect(hashEvidenceText("delivery proof")).resolves.toBe(expected);
  });
});
