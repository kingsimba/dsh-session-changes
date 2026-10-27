/**
 * Splice one change block into a full text: replace `count` lines starting at the
 * 0-based `start` with the block's lines from the other side. Both sides of the
 * comparison are read as `text.split("\n")`, which round-trips exactly, so a
 * trailing newline survives an accept or a revert.
 *
 * @param text - the full side text to patch.
 * @param start - 0-based index of the first replaced line.
 * @param count - how many lines to replace (0 for a pure insertion).
 * @param lines - the replacement lines.
 * @returns the patched text.
 */
export function spliceLines(text, start, count, lines) {
  const list = text === "" ? [] : text.split("\n");
  list.splice(start, count, ...lines);
  return list.join("\n");
}

/**
 * SHA-256 of a text as lowercase hex, the fingerprint the Host compares before it
 * replaces a side. A browser without WebCrypto yields null, which tells the Host to
 * skip the stale-view check rather than refuse every action.
 *
 * @param text - the text the browser last read.
 * @returns the digest, or null when WebCrypto is unavailable.
 */
export async function hashText(text) {
  const subtle = globalThis.crypto === undefined ? undefined : globalThis.crypto.subtle;
  if (subtle === undefined || subtle === null) return null;
  const bytes = new TextEncoder().encode(text);
  const digest = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
