/**
 * Set by `apply`; the last-resort opener when a tab body has no bound tab actions.
 * Kept in one module so the container and the entry can share it without importing
 * each other.
 */
let resourceOpener = null;

/**
 * Install the Host's resource opener.
 * @param opener - `ctx.sidebarRight.openResource`.
 */
export function setResourceOpener(opener) {
  resourceOpener = opener;
}

/**
 * Open one review resource, when the Host exposes an opener at all.
 * @param address - the `dsh-resource://` address.
 * @param options - the tab actions' options.
 */
export function openResource(address, options) {
  if (typeof resourceOpener === "function") resourceOpener(address, options);
}
