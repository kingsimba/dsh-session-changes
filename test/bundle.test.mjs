/**
 * The built bundle, rendered with a stubbed Host: registration, the list, the
 * comparison, a deleted file, and a binary one. These are the checks that would have
 * caught a broken refactor of the shipped artifact.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHarness, elementsOf, refuse, respond, textOf } from "./support/harness.mjs";

/** The list payload: the two files the Session touched. */
const FILES = {
  files: [
    { path: "src/app.js", display: "src/app.js" },
    { path: "notes.md", display: "notes.md" },
  ],
};

/**
 * A Host that answers the routes this tab reads.
 * @param options - `{ missing, baseMissing, binary }`.
 * @returns the fetch stub and the calls it saw.
 */
function host({ missing = [], baseMissing = false, binary = false } = {}) {
  const calls = [];
  const fetch = async (url) => {
    const text = String(url);
    calls.push(text);
    if (text.includes("session-changes.list")) return respond(FILES);
    if (text.includes("session-changes.base"))
      return baseMissing
        ? { ok: false, status: 404, json: async () => ({ error: "not-captured" }) }
        : respond({ text: "old line" });
    if (text.includes("session-changes.file")) {
      if (missing.some((path) => text.includes(encodeURIComponent(path)))) {
        return { ok: false, status: 404, json: async () => ({ error: "read-ENOENT" }) };
      }
      if (binary === true)
        return { ok: false, status: 415, json: async () => ({ error: "binary" }) };
      return respond({ text: "new line" });
    }
    return refuse();
  };
  return { fetch, calls };
}

/** Find the elements whose className contains one token. */
function withClass(tree, token) {
  return elementsOf(tree).filter((element) =>
    String(element.props.className ?? "")
      .split(" ")
      .includes(token),
  );
}

test("apply registers the tab type, both dictionaries, and the pane body", () => {
  const harness = createHarness();
  const { tabType, dictionaries } = harness.registrations;
  assert.equal(tabType.id, "dsh-session-changes");
  assert.equal(tabType.kind, "session-changes");
  assert.equal(tabType.priority, "builtin");
  assert.equal(tabType.guide.length, 1);
  assert.equal(tabType.guide[0].order, 45);
  assert.equal(dictionaries.namespace, "session-changes");
  assert.deepEqual(Object.keys(dictionaries.dictionaries).sort(), ["en", "zh"]);
  assert.deepEqual(harness.client.inject, ["slots", "locale", "sidebarRightTabs", "sidebarRight"]);
});

test("the list shows the touched files and diffs the pre-image", async () => {
  const { fetch } = host();
  const harness = createHarness({ fetch });
  harness.render({ sessionId: "session-1", tab: { visible: true } });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(withClass(tree, "dsc-root").length, 1);
  const rows = withClass(tree, "dsc-row");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].props["data-selected"], "true");
  assert.equal(rows[1].props["data-selected"], "false");
  // `src/app.js` and `notes.md` land in two folders.
  assert.equal(withClass(tree, "dsc-folder").length, 2);
  // One list, one comparison.
  assert.equal(withClass(tree, "dsc-chip").length, 0);
  assert.equal(withClass(tree, "dsc-lane").length, 2);
  assert.equal(withClass(tree, "dsc-lrow").length >= 2, true);
  assert.match(textOf(tree), /old line/);
  assert.match(textOf(tree), /new line/);
});

test("the header totals follow the rows", async () => {
  const { fetch } = host();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const stat = withClass(tree, "dsc-stat")[0];
  assert.ok(stat !== undefined);
  assert.match(textOf(stat), /\+2/);
  assert.match(textOf(stat), /−2/);
});

test("a file edited back to its pre-image drops out instead of reading +0 −0", async () => {
  const harness = createHarness({
    fetch: async (url) => {
      const text = String(url);
      if (text.includes("session-changes.list")) return respond(FILES);
      if (text.includes("session-changes.base")) return respond({ text: "same text" });
      if (text.includes("session-changes.file")) return respond({ text: "same text" });
      return refuse();
    },
  });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(withClass(tree, "dsc-row").length, 0);
  assert.equal(withClass(tree, "dsc-folder").length, 0);
  // ...and the list says why it is empty instead of claiming there were no changes.
  assert.match(textOf(tree), /edited back to where it started/);
});

test("the pane says so instead of inventing a baseline the Host never captured", async () => {
  const { fetch } = host({ baseMissing: true });
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /No pre-image was recorded/);
  assert.equal(withClass(tree, "dsc-lane").length, 0);
  assert.equal(withClass(tree, "dsc-lrow").length, 0);
});

test("a deleted file is marked in the list and compared as empty", async () => {
  const { fetch } = host({ missing: ["src/app.js"] });
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const rows = withClass(tree, "dsc-row");
  const deleted = rows.find((row) => String(row.props.title).includes("src/app.js"));
  assert.equal(deleted.props["data-missing"], "true");
  // The whole pre-image reads as deleted, and the pane says so.
  assert.match(textOf(tree), /Deleted/);
});

test("an empty Session shows the empty note instead of a list", async () => {
  const harness = createHarness({ fetch: async () => respond({ files: [] }) });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(withClass(tree, "dsc-row").length, 0);
  assert.match(textOf(tree), /No file changes recorded/);
});

test("a Host that refuses the list shows the error note and a retry", async () => {
  const harness = createHarness({ fetch: async () => refuse() });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /Could not read this Session's changes/);
  assert.equal(withClass(tree, "dsc-btn").length >= 1, true);
});

test("a binary file says so instead of drawing rows", async () => {
  const { fetch } = host({ binary: true });
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /Binary file; changes cannot be shown/);
  assert.equal(withClass(tree, "dsc-lrow").length, 0);
});
