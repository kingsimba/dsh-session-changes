/**
 * The Host module loader, as seen from inside the bundle.
 *
 * `require` here is the factory parameter `lib/client.js` is wrapped in (see
 * scripts/build.mjs): rollup emits this call untouched, because it is a plain
 * reference rather than an import. Keeping it in one place is what lets every other
 * source file stay an ordinary ES module and still ask the Host for `react` and the
 * shared client primitives.
 *
 * @param name - a package name the Host knows how to resolve.
 * @returns whatever that package exports.
 */
export function loadModule(name) {
  return require(name);
}
