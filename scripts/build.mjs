/**
 * Bundle `src/client` into the single classic script the Host serves as this
 * package's browser half: `lib/client.js`.
 *
 * The Host hands that file to `window.__ModuleLoader__.load`, whose factory
 * receives `require`. The artifact therefore has to be one file with no imports of
 * its own, so rollup inlines every relative module and leaves the factory's
 * `require` parameter as the only way out of the bundle.
 *
 *   node scripts/build.mjs          write lib/client.js
 *   node scripts/build.mjs --check  fail when lib/client.js is stale
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const ENTRY = join(ROOT, "src/client/index.js");
const TARGET = join(ROOT, "lib/client.js");

/** The module id the Host's loader keys the tab bundle by. */
const MODULE_ID = "dsh-session-changes";

/** Name of the IIFE rollup assigns the module namespace to, inside the factory. */
const BUNDLE_NAME = "__dshSessionChangesBundle";

const HEADER = `window.__ModuleLoader__.load({
	id: ${JSON.stringify(MODULE_ID)},
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
`;

const FOOTER = `		exports.apply = ${BUNDLE_NAME}.apply;
		exports.inject = ${BUNDLE_NAME}.inject;
		return module.exports;
	}
});
`;

/**
 * Inline a stylesheet as a string, so the tab can publish it through one style tag
 * instead of the Host having to serve a second asset.
 * @returns the rollup plugin.
 */
function cssText() {
  return {
    name: "dsh-css-text",
    async load(id) {
      if (!id.endsWith(".css")) return null;
      const text = await readFile(id, "utf8");
      return `export default ${JSON.stringify(text)};`;
    },
  };
}

/**
 * Nest one rollup chunk inside the factory body.
 * @param code - the chunk, at column zero.
 * @returns the same code, indented two tabs.
 */
function indent(code) {
  return code
    .split("\n")
    .map((line) => (line === "" ? line : "\t\t" + line))
    .join("\n");
}

/**
 * Build the bundle in memory.
 * @returns the finished script text.
 */
async function bundle() {
  const build = await rollup({
    input: ENTRY,
    plugins: [cssText()],
    onwarn(warning, warn) {
      // One module may import another that imports it back; the factory has no
      // initialization order problem, so this warning is noise here.
      if (warning.code === "CIRCULAR_DEPENDENCY") return;
      warn(warning);
    },
  });
  const { output } = await build.generate({
    format: "iife",
    name: BUNDLE_NAME,
    sourcemap: false,
    generatedCode: "es2015",
  });
  await build.close();
  return HEADER + indent(output[0].code.trimEnd()) + "\n" + FOOTER;
}

const script = await bundle();
const existing = await readFile(TARGET, "utf8").catch(() => null);

if (process.argv.includes("--check")) {
  if (existing === script) {
    console.log(`up to date: ${relative(ROOT, TARGET)} (${script.length} bytes)`);
  } else {
    console.error(
      `stale: ${relative(ROOT, TARGET)} does not match src/client — run \`pnpm run build\``,
    );
    process.exitCode = 1;
  }
} else if (existing === script) {
  console.log(`unchanged: ${relative(ROOT, TARGET)} (${script.length} bytes)`);
} else {
  await writeFile(TARGET, script, "utf8");
  console.log(`wrote: ${relative(ROOT, TARGET)} (${script.length} bytes)`);
}
