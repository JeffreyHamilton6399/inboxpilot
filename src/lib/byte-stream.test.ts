import { describe, it, expect } from "vitest";
import { bufferToStream } from "./byte-stream";

/** Drains a stream into the chunks it produced, and the bytes overall. */
async function drain(stream: ReadableStream<Uint8Array>) {
  const chunks: Uint8Array[] = [];
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { chunks, bytes };
}

const sample = (n: number) => Uint8Array.from({ length: n }, (_, i) => i % 256);

describe("bufferToStream", () => {
  it("gives back exactly the bytes it was given", async () => {
    const data = sample(5000);
    const { bytes } = await drain(bufferToStream(data, 512));
    expect(bytes).toEqual(data);
  });

  it("splits into chunks of the requested size", async () => {
    const { chunks } = await drain(bufferToStream(sample(1000), 400));
    expect(chunks.map((c) => c.byteLength)).toEqual([400, 400, 200]);
  });

  it("emits one chunk when everything fits", async () => {
    const { chunks } = await drain(bufferToStream(sample(100), 4096));
    expect(chunks.map((c) => c.byteLength)).toEqual([100]);
  });

  it("closes immediately on an empty buffer", async () => {
    const { chunks, bytes } = await drain(bufferToStream(new Uint8Array(0)));
    expect(chunks).toEqual([]);
    expect(bytes.byteLength).toBe(0);
  });

  it("survives a size that divides exactly, without a trailing empty chunk", async () => {
    const { chunks } = await drain(bufferToStream(sample(800), 400));
    expect(chunks.map((c) => c.byteLength)).toEqual([400, 400]);
  });

  it("carries a payload past the 4.5 MB buffered-response cap", async () => {
    // The reason this exists: 4.5 MB is where Vercel stops accepting a
    // buffered body, and a PDF that size is unremarkable.
    const data = new Uint8Array(6 * 1024 * 1024);
    for (let i = 0; i < data.length; i++) data[i] = i % 256;

    const { chunks, bytes } = await drain(bufferToStream(data));

    expect(bytes.byteLength).toBe(data.byteLength);
    // Bytewise, but natively — a deep-equal over six million elements takes
    // longer than the whole rest of the suite.
    expect(Buffer.from(bytes).equals(Buffer.from(data))).toBe(true);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
