import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./db", () => ({ db: { account: { findFirst: vi.fn(), update: vi.fn() } } }));

const { listMessages } = await import("./gmail");

/** The URLs the code asked for, in order. */
let asked: string[] = [];

/**
 * Answers the list call with the given page, and every per-message metadata
 * call with a stub, which is all listMessages needs to get through.
 */
function mockGmail(page: { messages?: { id: string }[]; nextPageToken?: string }) {
  vi.spyOn(globalThis, "fetch").mockImplementation(((url: string) => {
    asked.push(String(url));
    const body = String(url).includes("/messages?")
      ? page
      : { id: String(url).split("/messages/")[1]?.split("?")[0], labelIds: [] };
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve(body),
      text: () => Promise.resolve(""),
    } as Response);
  }) as typeof fetch);
}

const listUrl = () => asked.find((u) => u.includes("/messages?")) ?? "";

beforeEach(() => {
  asked = [];
});
afterEach(() => vi.restoreAllMocks());

describe("listMessages paging", () => {
  it("hands back the token Gmail gave for the next page", async () => {
    mockGmail({ messages: [{ id: "a" }], nextPageToken: "PAGE2" });
    const page = await listMessages("token", 40);
    expect(page.nextPageToken).toBe("PAGE2");
    expect(page.messages.map((m) => m.id)).toEqual(["a"]);
  });

  it("reports no token on the last page", async () => {
    mockGmail({ messages: [{ id: "a" }] });
    expect((await listMessages("token", 40)).nextPageToken).toBeUndefined();
  });

  it("keeps the token even when the page came back empty", async () => {
    // Gmail can return a page with nothing on it and still have more; losing
    // the token here would strand the list at that point.
    mockGmail({ messages: [], nextPageToken: "PAGE2" });
    const page = await listMessages("token", 40);
    expect(page.messages).toEqual([]);
    expect(page.nextPageToken).toBe("PAGE2");
  });

  it("asks for the page it was given a token for", async () => {
    mockGmail({ messages: [{ id: "a" }] });
    await listMessages("token", 40, undefined, "PAGE2");
    expect(listUrl()).toContain("pageToken=PAGE2");
  });

  it("sends no pageToken for the first page", async () => {
    mockGmail({ messages: [{ id: "a" }] });
    await listMessages("token", 40);
    expect(listUrl()).not.toContain("pageToken");
  });

  it("carries the search across pages", async () => {
    mockGmail({ messages: [{ id: "a" }] });
    await listMessages("token", 40, "from:sarah", "PAGE2");
    const url = listUrl();
    expect(url).toContain(`q=${encodeURIComponent("from:sarah")}`);
    expect(url).toContain("pageToken=PAGE2");
  });

  it("encodes a query with characters a URL would otherwise eat", async () => {
    mockGmail({ messages: [{ id: "a" }] });
    await listMessages("token", 40, 'subject:"q&a" older_than:7d');
    // A raw & would have split the query string and silently truncated it.
    expect(listUrl()).toContain("%26");
  });
});
