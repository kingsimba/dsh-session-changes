/**
 * A fresh id for one mounted Changes tab. A review write and the watch invalidation
 * it causes travel on two different connections, so the write carries this id and the
 * Host echoes it on the frames that write caused; the tab can then skip its own echo
 * while every other tab still refreshes. Uniqueness only has to hold across this page.
 *
 * @returns the tab's id.
 */
export function newClientId() {
  try {
    const crypto = globalThis.crypto;
    if (crypto !== undefined && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch (_error) {
    // Fall through to a timestamp id; it still separates the tabs of one page.
  }
  return "client-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
