import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Covers who is told "connect Gmail" and who is not.
 *
 * A regression here is invisible in every other test: the app builds, the
 * routes return, and a connected account is simply told to connect itself.
 */

const findFirst = vi.fn();
const update = vi.fn();

vi.mock("./db", () => ({
  db: {
    account: {
      findFirst: (...a: unknown[]) => findFirst(...a),
      update: (...a: unknown[]) => update(...a),
    },
  },
}));

const ORIGINAL = { ...process.env };

async function load() {
  vi.resetModules();
  vi.stubEnv("GOOGLE_CLIENT_ID", "id");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  return import("./gmail");
}

function account(over: Record<string, unknown> = {}) {
  return {
    id: "acct_1",
    userId: "user_1",
    provider: "gmail",
    email: "person@gmail.com",
    accessToken: "stored-access-token",
    refreshToken: "stored-refresh-token",
    expiryDate: new Date(Date.now() + 60 * 60 * 1000),
    ...over,
  };
}

beforeEach(() => {
  findFirst.mockReset();
  update.mockReset();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  process.env = { ...ORIGINAL };
});

describe("getGmailAuthForUser", () => {
  it("returns null only when there is genuinely no account", async () => {
    findFirst.mockResolvedValue(null);
    const { getGmailAuthForUser } = await load();
    await expect(getGmailAuthForUser("user_1")).resolves.toBeNull();
  });

  it("uses a valid token without contacting Google", async () => {
    findFirst.mockResolvedValue(account());
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { getGmailAuthForUser } = await load();
    await expect(getGmailAuthForUser("user_1")).resolves.toEqual({
      accessToken: "stored-access-token",
      email: "person@gmail.com",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats an unknown expiry as unknown, not as expired", async () => {
    // The regression: null expiryDate counted as expired, and an account with
    // no refresh token was then reported as not connected — so a working
    // connection rendered the "Connect Gmail" screen.
    findFirst.mockResolvedValue(account({ expiryDate: null, refreshToken: null }));
    const { getGmailAuthForUser } = await load();

    await expect(getGmailAuthForUser("user_1")).resolves.toEqual({
      accessToken: "stored-access-token",
      email: "person@gmail.com",
    });
  });

  it("refreshes an expired token and stores the new one", async () => {
    findFirst.mockResolvedValue(account({ expiryDate: new Date(Date.now() - 1000) }));
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ access_token: "fresh-token", expires_in: 3600 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    const { getGmailAuthForUser } = await load();
    await expect(getGmailAuthForUser("user_1")).resolves.toMatchObject({ accessToken: "fresh-token" });
    expect(update).toHaveBeenCalled();
  });

  it("still hands back the stored token when a refresh fails", async () => {
    // A failed refresh may just be a network blip. Gmail is the authority on
    // whether the token is dead, and its 401 carries a usable reason.
    findFirst.mockResolvedValue(account({ expiryDate: new Date(Date.now() - 1000) }));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 }))
    );

    const { getGmailAuthForUser } = await load();
    await expect(getGmailAuthForUser("user_1")).resolves.toMatchObject({
      accessToken: "stored-access-token",
    });
  });

  it("does not report an expired token with no refresh token as disconnected", async () => {
    findFirst.mockResolvedValue(
      account({ expiryDate: new Date(Date.now() - 1000), refreshToken: null })
    );
    const { getGmailAuthForUser } = await load();
    await expect(getGmailAuthForUser("user_1")).resolves.not.toBeNull();
  });
});

describe("GmailApiError", () => {
  it("separates a dead grant from every other refusal", async () => {
    const { GmailApiError } = await load();
    expect(new GmailApiError(401, "{}").needsReconnect).toBe(true);
    expect(new GmailApiError(403, "{}").needsReconnect).toBe(false);
    expect(new GmailApiError(429, "{}").needsReconnect).toBe(false);
  });

  it("pulls Google's own sentence out of the error body", async () => {
    const { GmailApiError } = await load();
    const body = JSON.stringify({
      error: { code: 403, message: "Gmail API has not been used in project 123 before or it is disabled." },
    });
    expect(new GmailApiError(403, body).reason).toMatch(/has not been used in project/);
  });

  it("falls back to the raw body when it is not JSON", async () => {
    const { GmailApiError } = await load();
    expect(new GmailApiError(500, "upstream exploded").reason).toBe("upstream exploded");
  });
});
