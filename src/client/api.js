import {
  BASE_ROUTE,
  DIFF_ROUTE,
  EXISTS_ROUTE,
  FILE_ROUTE,
  LIST_ROUTE,
  OPEN_ROUTE,
} from "./constants.js";

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
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

/**
 * Read this Session's recorded turns, newest first.
 * @param sessionId - the viewed Session.
 * @param signal - cancellation.
 * @returns the turn rows, or none for a malformed payload.
 */
export async function readTurns(sessionId, signal) {
  const payload = await getJson(LIST_ROUTE, { sessionId }, signal);
  return payload !== null && typeof payload === "object" && Array.isArray(payload.turns)
    ? payload.turns
    : [];
}

/**
 * Read one review entry's served comparison.
 * @param sessionId - the viewed Session.
 * @param entry - the file's coordinates for one turn.
 * @param signal - cancellation.
 * @returns the served payload (`kind: text | binary | oversized`).
 */
export async function readDiff(sessionId, entry, signal) {
  return getJson(
    DIFF_ROUTE,
    { sessionId: String(sessionId), seq: String(entry.seq), index: String(entry.index) },
    signal,
  );
}

/**
 * Read the Session's first pre-image of one file.
 * @param sessionId - the viewed Session.
 * @param seq - the announcing event, whose summary carries the working directory.
 * @param path - the file's path as the summary spells it.
 * @param signal - cancellation.
 * @returns `{ text }`, or `{ absent: true }` when the file did not exist yet.
 */
export async function readBase(sessionId, seq, path, signal) {
  const payload = await getJson(
    BASE_ROUTE,
    { sessionId: String(sessionId), seq: String(seq), path: String(path) },
    signal,
  );
  if (payload === null || typeof payload !== "object") throw new Error("malformed");
  if (payload.absent === true) return { absent: true };
  if (typeof payload.text !== "string") throw new Error("malformed");
  return { text: payload.text };
}

/**
 * Read one changed file's current text from this package's own Host route.
 *
 * @param sessionId - the viewed Session.
 * @param seq - the announcing event, whose summary carries the working directory.
 * @param path - the file's path as the summary spells it.
 * @param signal - cancellation.
 * @returns the file's text, or throws a refusal flagged `missing` / `oversized`.
 */
export async function readWholeFile(sessionId, seq, path, signal) {
  const response = await fetch(
    FILE_ROUTE + query({ sessionId: String(sessionId), seq: String(seq), path: String(path) }),
    { signal, headers: { accept: "application/json" }, credentials: "same-origin" },
  );
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
    refusal.oversized = reason === "too-large";
    throw refusal;
  }
  const payload = await response.json();
  if (payload === null || typeof payload !== "object" || typeof payload.text !== "string")
    throw new Error("malformed");
  return payload.text;
}

/**
 * Ask the Host which of the listed paths still exist on disk.
 * @param sessionId - the viewed Session.
 * @param seq - the newest announcing event.
 * @param signal - cancellation.
 * @returns `{ [path]: "file" | "other" | "missing" | "unknown" }`.
 */
export async function readExists(sessionId, seq, signal) {
  const payload = await getJson(
    EXISTS_ROUTE,
    { sessionId: String(sessionId), seq: String(seq) },
    signal,
  );
  return payload !== null &&
    typeof payload === "object" &&
    payload.paths !== null &&
    typeof payload.paths === "object"
    ? payload.paths
    : {};
}

/**
 * Ask the Host desktop to open one file in its default application.
 * @param sessionId - the viewed Session.
 * @param entry - the file's coordinates for one turn.
 */
export async function requestOpen(sessionId, entry) {
  const response = await fetch(
    OPEN_ROUTE +
      query({
        sessionId: String(sessionId),
        seq: String(entry.seq),
        index: String(entry.index),
        action: "open",
      }),
    { method: "POST", credentials: "same-origin" },
  );
  if (!response.ok) throw new Error(String(response.status));
}
