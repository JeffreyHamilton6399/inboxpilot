/** How much is handed over at a time. Small enough to stay chunked, big enough not to churn. */
const CHUNK_SIZE = 256 * 1024;

/**
 * Serves a buffer as a stream rather than as one body.
 *
 * Vercel caps a *buffered* function response at 4.5 MB and answers anything
 * larger with FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE — which a 6 MB PDF reaches
 * comfortably, and Gmail will carry attachments to 25 MB. A streamed response
 * is not subject to that cap, so the same bytes go out in chunks.
 *
 * This is about how the bytes leave, not how they arrive: Gmail hands
 * attachments over as base64 inside a JSON body, so the whole file is in
 * memory regardless and there is no upstream stream to forward.
 */
export function bufferToStream(
  data: Uint8Array,
  chunkSize: number = CHUNK_SIZE
): ReadableStream<Uint8Array> {
  let offset = 0;

  return new ReadableStream({
    pull(controller) {
      if (offset >= data.byteLength) {
        controller.close();
        return;
      }
      const end = Math.min(offset + chunkSize, data.byteLength);
      // subarray, not slice: a view costs nothing, a copy costs the file again.
      controller.enqueue(data.subarray(offset, end));
      offset = end;
    },
  });
}
