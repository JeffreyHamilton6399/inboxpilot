import { describe, it, expect, vi, afterEach } from "vitest";
import { TtlCache } from "./ttl-cache";

afterEach(() => vi.useRealTimers());

describe("TtlCache", () => {
  it("hands back what was put in", () => {
    const cache = new TtlCache<string>(1000, 10);
    cache.set("a", "one");
    expect(cache.get("a")).toBe("one");
  });

  it("reports nothing for a key it never had", () => {
    expect(new TtlCache<string>(1000, 10).get("nope")).toBeUndefined();
  });

  it("forgets an entry once it is stale", () => {
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000, 10);
    cache.set("a", "one");

    vi.advanceTimersByTime(999);
    expect(cache.get("a")).toBe("one");

    vi.advanceTimersByTime(1);
    expect(cache.get("a")).toBeUndefined();
  });

  it("actually drops the stale entry rather than only hiding it", () => {
    // The bug this class exists for: the old cache checked age on the way out
    // and never deleted anything, so memory only ever went up.
    vi.useFakeTimers();
    const cache = new TtlCache<string>(1000, 10);
    cache.set("a", "one");
    vi.advanceTimersByTime(2000);

    cache.get("a");
    expect(cache.size).toBe(0);
  });

  it("never grows past its cap", () => {
    const cache = new TtlCache<number>(60_000, 3);
    for (let i = 0; i < 100; i++) cache.set(`k${i}`, i);
    expect(cache.size).toBe(3);
  });

  it("drops the oldest write when it has to evict", () => {
    const cache = new TtlCache<number>(60_000, 3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4);

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("d")).toBe(4);
  });

  it("treats rewriting a key as making it the newest", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("a", 11); // a is now the most recent, so b is next to go
    cache.set("c", 3);

    expect(cache.get("a")).toBe(11);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("b")).toBeUndefined();
  });

  it("does not keep two entries for the same key", () => {
    const cache = new TtlCache<number>(60_000, 10);
    cache.set("a", 1);
    cache.set("a", 2);
    expect(cache.size).toBe(1);
  });

  it("clears stale entries out on write, not only on read", () => {
    // Keys nobody asks for again would otherwise sit there until evicted.
    vi.useFakeTimers();
    const cache = new TtlCache<number>(1000, 100);
    for (let i = 0; i < 50; i++) cache.set(`old${i}`, i);
    expect(cache.size).toBe(50);

    vi.advanceTimersByTime(2000);
    cache.set("fresh", 1);
    expect(cache.size).toBe(1);
  });
});
