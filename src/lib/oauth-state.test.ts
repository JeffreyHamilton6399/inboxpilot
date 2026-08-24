import { describe, it, expect, beforeAll } from "vitest";
import { createHmac } from "crypto";
import { createState, verifyState } from "./oauth-state";

beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret-not-used-anywhere-real";
});

describe("OAuth state", () => {
  it("accepts a state it just issued, for the user it was issued to", () => {
    const { state, nonce } = createState("user_abc");
    expect(verifyState(state, nonce, "user_abc")).toBe(true);
  });

  it("rejects a state issued for a different user", () => {
    // This is the attack the previous code allowed: name someone else's id
    // and their account gets the mailbox attached.
    const { state, nonce } = createState("attacker");
    expect(verifyState(state, nonce, "victim")).toBe(false);
  });

  it("rejects a state whose user id was edited after signing", () => {
    const { state, nonce } = createState("victim");
    const parts = state.split(".");
    const forged = [parts[0], "attacker", parts[2], parts[3]].join(".");
    expect(verifyState(forged, nonce, "attacker")).toBe(false);
  });

  it("rejects a valid state without the matching cookie", () => {
    const { state } = createState("user_abc");
    expect(verifyState(state, undefined, "user_abc")).toBe(false);
    expect(verifyState(state, "some-other-nonce", "user_abc")).toBe(false);
  });

  it("rejects a cookie without a state", () => {
    const { nonce } = createState("user_abc");
    expect(verifyState(null, nonce, "user_abc")).toBe(false);
  });

  it("rejects a state with a forged signature", () => {
    const { state, nonce } = createState("user_abc");
    const parts = state.split(".");
    expect(verifyState([parts[0], parts[1], parts[2], "garbage"].join("."), nonce, "user_abc")).toBe(false);
  });

  it("rejects malformed states rather than throwing", () => {
    const { nonce } = createState("user_abc");
    for (const bad of ["", "a", "a.b", "a.b.c", "a.b.c.d.e"]) {
      expect(verifyState(bad, nonce, "user_abc")).toBe(false);
    }
  });

  it("rejects a state older than ten minutes", () => {
    const { state, nonce } = createState("user_abc");
    const parts = state.split(".");
    // Re-sign an old timestamp so the signature is valid and only age fails.
    const old = String(Date.now() - 11 * 60 * 1000);
    const payload = `${parts[0]}.${parts[1]}.${old}`;
    const sig = createHmac("sha256", process.env.NEXTAUTH_SECRET!).update(payload).digest("base64url");
    expect(verifyState(`${payload}.${sig}`, nonce, "user_abc")).toBe(false);
  });

  it("issues a different nonce every time", () => {
    const seen = new Set(Array.from({ length: 50 }, () => createState("u").nonce));
    expect(seen.size).toBe(50);
  });
});
