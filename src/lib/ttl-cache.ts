/**
 * A small cache that actually lets go of things.
 *
 * The inbox cache was a bare Map that only ever grew: entries were checked for
 * age on the way out but never removed, so nothing was ever freed. That was
 * survivable while there was one entry per user, and stopped being survivable
 * once search and paging meant a new key — holding a page of messages — for
 * every distinct query anyone typed.
 *
 * A serverless instance is reused across many requests and many users, so an
 * unbounded module-level Map is a leak with a long enough fuse to reach
 * production before it is noticed.
 */
export class TtlCache<T> {
  private entries = new Map<string, { at: number; value: T }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries: number
  ) {}

  get(key: string): T | undefined {
    const hit = this.entries.get(key);
    if (!hit) return undefined;
    if (this.expired(hit.at)) {
      this.entries.delete(key);
      return undefined;
    }
    return hit.value;
  }

  set(key: string, value: T): void {
    // Re-inserting moves the key to the end, which is what makes the eviction
    // below drop the least recently written rather than an arbitrary one.
    this.entries.delete(key);
    this.entries.set(key, { at: Date.now(), value });

    this.sweep();
    while (this.entries.size > this.maxEntries) {
      const oldest = this.entries.keys().next();
      if (oldest.done) break;
      this.entries.delete(oldest.value);
    }
  }

  /** Visible for tests and diagnostics. */
  get size(): number {
    return this.entries.size;
  }

  private expired(at: number): boolean {
    return Date.now() - at >= this.ttlMs;
  }

  /** Drops everything already stale, so idle keys do not wait for eviction. */
  private sweep(): void {
    for (const [key, entry] of this.entries) {
      if (this.expired(entry.at)) this.entries.delete(key);
    }
  }
}
