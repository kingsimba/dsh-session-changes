/**
 * Render two builds of the client bundle through the same stubs and compare their
 * element trees, scenario by scenario.
 *
 * This is how the src/client split was proven to change nothing: build the old
 * single-file bundle, build the new one, and diff what each would draw.
 *
 *   git show v0.11.1:lib/client.js > .baseline-client.js
 *   node scripts/compare-bundles.mjs .baseline-client.js
 *
 * Exits non-zero on the first scenario whose markup differs, and prints the first
 * differing character with context so the cause is easy to find.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHarness, refuse, respond } from "../test/support/harness.mjs";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

const baselinePath = process.argv[2];
if (baselinePath === undefined) {
  console.error("usage: node scripts/compare-bundles.mjs <baseline-client.js>");
  process.exit(2);
}
const baseline = readFileSync(join(ROOT, baselinePath), "utf8");

/** One hunk that turns `old line` into `new line`. */
const HUNK = {
  oldStart: 1,
  oldLines: 1,
  newStart: 1,
  newLines: 1,
  lines: ["-old line", "+new line"],
};

const LIST = {
  turns: [
    {
      turn: 1,
      seq: 7,
      total: 2,
      added: 2,
      deleted: 1,
      files: [
        { path: "src/app.js", display: "src/app.js", added: 1, deleted: 1 },
        { path: "notes.md", display: "notes.md", added: 1, deleted: 0 },
      ],
    },
  ],
};

/** Two turns, so the turn strip and the By-turn default have something to show. */
const TWO_TURNS = {
  turns: [
    {
      turn: 2,
      seq: 12,
      total: 1,
      added: 1,
      deleted: 0,
      files: [{ path: "src/app.js", display: "src/app.js", added: 1, deleted: 0 }],
    },
    ...LIST.turns,
  ],
};

/**
 * Serialize an expanded tree: tags, primitive props, text. Handlers are dropped,
 * because two equivalent components never share function identity.
 * @param node - the expanded tree.
 * @returns the comparable shape.
 */
function shape(node) {
  if (node === null) return null;
  if (Array.isArray(node)) return node.map(shape);
  if (typeof node === "string") return node;
  const props = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (key === "children" || value === undefined || typeof value === "function") continue;
    props[key] = value;
  }
  return { tag: node.type, props, children: node.children.map(shape) };
}

/**
 * A Host that answers every route the tab reads.
 * @param options - `{ missing, binary, drift }` to select the edge case.
 * @returns the fetch stub.
 */
function host({ missing = [], binary = false, drift = false } = {}) {
  return async (url) => {
    const text = String(url);
    if (text.includes("session-changes.list")) return respond(TWO_TURNS);
    if (text.includes("session-changes.exists"))
      return respond({ paths: Object.fromEntries(missing.map((path) => [path, "missing"])) });
    if (text.includes("session-changes.base")) return respond({ text: "old line" });
    if (text.includes("session-changes.file")) {
      if (missing.some((path) => text.includes(encodeURIComponent(path))))
        return { ok: false, status: 404, json: async () => ({ error: "read-ENOENT" }) };
      return respond({ text: drift ? "something else entirely" : "new line" });
    }
    if (text.includes("changes.diff")) {
      if (binary) return respond({ kind: "binary", path: "src/app.js", display: "src/app.js" });
      return respond({
        kind: "text",
        path: "src/app.js",
        display: "src/app.js",
        before: true,
        after: true,
        hunks: [HUNK],
      });
    }
    return refuse();
  };
}

const scenarios = [
  { name: "by-turn split", storage: {}, fetch: host() },
  { name: "by-turn inline", storage: { "dsh-session-changes.layout": "inline" }, fetch: host() },
  { name: "by-turn full", storage: { "dsh-session-changes.whole": "true" }, fetch: host() },
  { name: "overall split", storage: { "dsh-session-changes.mode": "overall" }, fetch: host() },
  {
    name: "overall inline",
    storage: { "dsh-session-changes.mode": "overall", "dsh-session-changes.layout": "inline" },
    fetch: host(),
  },
  {
    name: "overall full",
    storage: { "dsh-session-changes.mode": "overall", "dsh-session-changes.whole": "true" },
    fetch: host(),
  },
  {
    name: "deleted file",
    storage: { "dsh-session-changes.mode": "overall" },
    fetch: host({ missing: ["src/app.js"] }),
  },
  { name: "binary", storage: {}, fetch: host({ binary: true }) },
  { name: "drift", storage: { "dsh-session-changes.whole": "true" }, fetch: host({ drift: true }) },
  { name: "empty session", storage: {}, fetch: async () => respond({ turns: [] }) },
  { name: "list refused", storage: {}, fetch: async () => refuse() },
];

const props = { sessionId: "session-1", tab: { visible: true } };
let mismatches = 0;

for (const scenario of scenarios) {
  const before = await createHarness({
    source: baseline,
    storage: new Map(Object.entries(scenario.storage)),
    fetch: scenario.fetch,
  }).settle(props);
  const after = await createHarness({
    storage: new Map(Object.entries(scenario.storage)),
    fetch: scenario.fetch,
  }).settle(props);
  const left = JSON.stringify(shape(before));
  const right = JSON.stringify(shape(after));
  if (left === right) {
    console.log(`same  ${scenario.name}`);
    continue;
  }
  mismatches += 1;
  console.log(`DIFF  ${scenario.name} (${left.length} vs ${right.length} bytes)`);
  let at = 0;
  while (at < Math.min(left.length, right.length) && left[at] === right[at]) at += 1;
  console.log(`  first difference at ${at}:`);
  console.log(`  before: ${left.slice(Math.max(0, at - 160), at + 160)}`);
  console.log(`  after : ${right.slice(Math.max(0, at - 160), at + 160)}`);
}

assert.equal(mismatches, 0, `${mismatches} scenario(s) render differently`);
console.log(`\nall ${scenarios.length} scenarios render identically`);
