/**
 * Page-level memory for what a Session's Changes tab was showing. The sidebar
 * unmounts the tab body when the user switches Session or workspace, and the tab
 * system may reuse the same component instance for another Session; this module
 * keeps the parts a fresh mount cannot derive from the Host:
 *
 *  - the selected file path,
 *  - the last known `+added/−deleted` counts (so rows do not read `+undefined` and a
 *    fully accepted file does not flash back while the counts are re-read),
 *  - the comparison's scroll offsets per file and view mode.
 *
 * Everything here is a cache: the next Host read replaces it. It lives for the page
 * session only, so a reload starts clean.
 */

/** Selected path per Session. */
const selected = new Map();

/** Last known `{ [path]: counts }` per Session. */
const counts = new Map();

/** Scroll offsets per view key. */
const scrolls = new Map();

/**
 * The file last selected in one Session.
 * @param sessionId - the viewed Session.
 * @returns the path, or null when nothing usable was remembered.
 */
export function readSelection(sessionId) {
  const path = selected.get(String(sessionId));
  return typeof path === "string" && path !== "" ? path : null;
}

/**
 * Remember the selected file of one Session.
 * @param sessionId - the viewed Session.
 * @param path - the selected path, or null to forget it.
 */
export function writeSelection(sessionId, path) {
  if (typeof path === "string" && path !== "") selected.set(String(sessionId), path);
  else selected.delete(String(sessionId));
}

/**
 * The last known counts of one Session.
 * @param sessionId - the viewed Session.
 * @returns `{ [path]: counts }`, or an empty object.
 */
export function readCounts(sessionId) {
  return counts.get(String(sessionId)) ?? {};
}

/**
 * Replace the counts remembered for one Session.
 * @param sessionId - the viewed Session.
 * @param value - the counts to keep.
 */
export function writeCounts(sessionId, value) {
  counts.set(String(sessionId), value);
}

/**
 * The scroll offsets remembered for one view key.
 * @param key - Session, file, scope and layout.
 * @returns `{ top, left, top2?, left2? }`, or undefined.
 */
export function readScroll(key) {
  return scrolls.get(key);
}

/**
 * Remember the scroll offsets of one view key.
 * @param key - Session, file, scope and layout.
 * @param value - the offsets to keep.
 */
export function writeScroll(key, value) {
  if (value === undefined) scrolls.delete(key);
  else scrolls.set(key, value);
}
