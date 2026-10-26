import { BASE_ROUTE, FILE_ROUTE, LIST_ROUTE, OPEN_ROUTE, WATCH_ROUTE } from "./constants.js";

/**
 * The query string of one route read.
 * @param params - the route's parameters.
 * @returns `?a=b&c=d`.
 */
function query(params) {
  return "?" + new URLSearchParams(params).toString();
}

/**
 * Read one JSON route. A non-2xx answer is a failure the caller has to decide on.
 * @param route - the authenticated route to read.
 * @param params - its parameters.
 * @param signal - cancellation.
 * @returns the parsed payload.
 */
async function getJson(route, params, signal) {
  const response = await fetch(route + query(params), {
    signal,
    headers: { accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

/**
 * Read the files this Session's file tools touched.
 * @param sessionId - the viewed Session.
 * @param signal - cancellation.
 * @returns `{ path, display }[]`, or none for a malformed payload.
 */
export async function readFiles(sessionId, signal) {
  const payload = await getJson(LIST_ROUTE, { sessionId }, signal);
  if (payload === null || typeof payload !== "object" || !Array.isArray(payload.files)) return [];
  return payload.files
    .filter((file) => file !== null && typeof file === "object" && typeof file.path === "string")
    .map((file) => ({ path: file.path, display: String(file.display ?? file.path) }));
}

/**
 * Read one file's text as it stood before this Session first touched it.
 * @param sessionId - the viewed Session.
 * @param path - the file's path as the list spells it.
 * @param signal - cancellation.
 * @returns `{ text }`, or `{ absent: true }` when the file did not exist yet.
 */
export async function readBase(sessionId, path, signal) {
  const response = await fetch(BASE_ROUTE + query({ sessionId, path }), {
    signal,
    headers: { accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const refusal = new Error(String(response.status));
    let reason = "";
    try {
      const payload = await response.json();
      if (payload !== null && typeof payload === "object" && typeof payload.error === "string")
        reason = payload.error;
    } catch (_error) {
      // A body that is not JSON leaves the status as the reason.
    }
    refusal.binary = reason === "binary";
    refusal.oversized = reason === "too-large";
    refusal.uncaptured = reason === "not-captured";
    throw refusal;
  }
  const payload = await response.json();
  if (payload === null || typeof payload !== "object") throw new Error("malformed");
  if (payload.absent === true) return { absent: true };
  if (typeof payload.text !== "string") throw new Error("malformed");
  return { text: payload.text };
}

/**
 * Read one file's current text from disk.
 *
 * The refusal carries the reason the comparison needs to explain itself: a path
 * that vanished is a deletion, not a read failure, and a binary or oversized file
 * has no readable diff either.
 *
 * @param sessionId - the viewed Session.
 * @param path - the file's path as the list spells it.
 * @param signal - cancellation.
 * @returns the text, or throws a refusal flagged `missing` / `binary` / `oversized`.
 */
export async function readWholeFile(sessionId, path, signal) {
  const response = await fetch(FILE_ROUTE + query({ sessionId, path }), {
    signal,
    headers: { accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    let reason = String(response.status);
    try {
      const refused = await response.json();
      if (refused !== null && typeof refused === "object" && typeof refused.error === "string")
        reason = refused.error;
    } catch (_error) {
      // A body that is not JSON leaves the status as the reason.
    }
    const refusal = new Error(reason);
    // A path that vanished (or stopped being a file) is a deletion, not a failure.
    refusal.missing =
      reason === "read-ENOENT" || reason === "read-ENOTDIR" || reason === "not-file";
    refusal.binary = reason === "binary";
    refusal.oversized = reason === "too-large";
    throw refusal;
  }
  const payload = await response.json();
  if (payload === null || typeof payload !== "object" || typeof payload.text !== "string")
    throw new Error("malformed");
  return payload.text;
}

/**
 * Ask the Host desktop to open one captured file in its default application.
 * @param sessionId - the viewed Session.
 * @param path - the file's path as the list spells it.
 */
export async function requestOpen(sessionId, path) {
  const response = await fetch(OPEN_ROUTE + query({ sessionId, path }), {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(String(response.status));
}

/**
 * Open the Host's invalidation stream for one Session and deliver each frame as it
 * arrives. Frames are newline-delimited JSON: `ready`, `file`, `added`, and `ping`.
 *
 * The promise settles when the stream ends (the Host restarted, or the tab closed
 * the connection); a failed open rejects.
 *
 * @param sessionId - the viewed Session.
 * @param options - `{ signal, onOpen, onFrame }`.
 * @returns when the stream ends; rejects when the route cannot be opened.
 */
export async function watchChanges(sessionId, options) {
  const { signal, onOpen, onFrame } = options;
  const response = await fetch(WATCH_ROUTE + query({ sessionId: String(sessionId) }), {
    signal,
    headers: { accept: "application/x-ndjson" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) throw new Error(String(response.status));
  if (response.body === null || response.body === undefined) throw new Error("no-body");
  if (typeof onOpen === "function") onOpen();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buffer += decoder.decode(value, { stream: true });
      let newline = buffer.indexOf("\n");
      while (newline !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (line !== "") {
          let frame;
          try {
            frame = JSON.parse(line);
          } catch (_error) {
            frame = null;
          }
          if (frame !== null && typeof frame === "object" && typeof onFrame === "function") {
            onFrame(frame);
          }
        }
        newline = buffer.indexOf("\n");
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch (_error) {
      // The Host already closed the body; nothing left to release.
    }
  }
}
