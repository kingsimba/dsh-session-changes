/**
 * The built bundle, rendered with a stubbed Host: registration, the two list modes,
 * the comparison, and a deleted file. These are the checks that would have caught a
 * broken refactor of the shipped artifact.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHarness, elementsOf, refuse, respond, textOf } from "./support/harness.mjs";

/** One hunk that turns `old line` into `new line`. */
const TEXT_HUNK = {
  oldStart: 1,
  oldLines: 1,
  newStart: 1,
  newLines: 1,
  lines: ["-old line", "+new line"],
};

/** A text comparison payload, as `api/changes.diff` serves it. */
function textPayload(path) {
  return {
    kind: "text",
    path,
    display: path,
    before: true,
    after: true,
    hunks: [TEXT_HUNK],
  };
}

/** The list payload: one turn, two files. */
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

/**
 * A Host that answers the routes this tab reads.
 * @param options - `{ missing }`: paths the disk no longer has.
 * @returns the fetch stub and the calls it saw.
 */
function host({ missing = [] } = {}) {
  const calls = [];
  const fetch = async (url) => {
    const text = String(url);
    calls.push(text);
    if (text.includes("session-changes.list")) return respond(LIST);
    if (text.includes("session-changes.exists"))
      return respond({
        paths: Object.fromEntries(missing.map((path) => [path, "missing"])),
      });
    if (text.includes("session-changes.base")) return respond({ text: "old line" });
    if (text.includes("session-changes.file")) {
      if (missing.some((path) => text.includes(encodeURIComponent(path)))) {
        return { ok: false, status: 404, json: async () => ({ error: "read-ENOENT" }) };
      }
      return respond({ text: "new line" });
    }
    if (text.includes("changes.diff")) {
      const path = new URL(text, "http://host/").searchParams.get("path") ?? "src/app.js";
      return respond(textPayload(path));
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

test("By turn renders the turn's files and the selected file's comparison", async () => {
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
  // One chip for the one turn.
  assert.equal(withClass(tree, "dsc-chip").length, 1);
  // The comparison drew the hunk, both lanes.
  assert.equal(withClass(tree, "dsc-lane").length, 2);
  assert.equal(withClass(tree, "dsc-lrow").length >= 2, true);
  assert.match(textOf(tree), /new line/);
});

test("Overall compares the stored pre-image against the current file", async () => {
  const { fetch } = host();
  const harness = createHarness({
    fetch,
    storage: new Map([["dsh-session-changes.mode", "overall"]]),
  });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const rows = withClass(tree, "dsc-row");
  assert.equal(rows.length, 2);
  // Overall folds both files into one list and compares from the Session's start.
  assert.match(textOf(tree), /old line/);
  assert.match(textOf(tree), /new line/);
  assert.equal(withClass(tree, "dsc-chip").length, 0);
  assert.equal(withClass(tree, "dsc-lrow").length >= 2, true);
  assert.equal(withClass(tree, "dsc-note").length, 0);
});

test("a deleted file is marked in the list and compared as empty", async () => {
  const { fetch } = host({ missing: ["src/app.js"] });
  const harness = createHarness({
    fetch,
    storage: new Map([["dsh-session-changes.mode", "overall"]]),
  });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const rows = withClass(tree, "dsc-row");
  const deleted = rows.find((row) => String(row.props.title).includes("src/app.js"));
  assert.equal(deleted.props["data-missing"], "true");
  // The whole pre-image reads as deleted, and the pane says so.
  assert.match(textOf(tree), /Deleted/);
});

test("an empty Session shows the empty note instead of a list", async () => {
  const harness = createHarness({ fetch: async () => respond({ turns: [] }) });
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

test("a binary comparison says so instead of drawing rows", async () => {
  const harness = createHarness({
    fetch: async (url) => {
      const text = String(url);
      if (text.includes("session-changes.list")) return respond(LIST);
      if (text.includes("session-changes.exists")) return respond({ paths: {} });
      if (text.includes("changes.diff"))
        return respond({ kind: "binary", path: "src/app.js", display: "src/app.js" });
      return refuse();
    },
  });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /Binary file; changes cannot be shown/);
  assert.equal(withClass(tree, "dsc-lrow").length, 0);
});
