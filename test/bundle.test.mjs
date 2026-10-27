/**
 * The built bundle, rendered with a stubbed Host: registration, the list, the
 * comparison, a deleted file, and a binary one. These are the checks that would have
 * caught a broken refactor of the shipped artifact.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { hashText } from "../src/client/text-patch.js";
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
  assert.equal(tabType.guide[0].commandId, "session.changes.open");
  assert.equal(dictionaries.namespace, "session-changes");
  assert.deepEqual(Object.keys(dictionaries.dictionaries).sort(), ["en", "zh"]);
  assert.deepEqual(harness.client.inject, ["slots", "locale", "sidebarRightTabs", "sidebarRight"]);
});

test("apply registers an editable shortcut that opens the Changes tab", () => {
  const harness = createHarness();
  const command = harness.registrations.shortcut;
  assert.ok(command !== undefined);
  assert.equal(command.id, "session.changes.open");
  assert.equal(command.label(), "Open Session changes");
  assert.deepEqual(command.defaults, {
    "desktop:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
    "desktop:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
    "desktop:linux": { code: "KeyD", modifiers: ["primary", "alt"] },
    "web:macos": { code: "KeyD", modifiers: ["primary", "alt"] },
    "web:windows": { code: "KeyD", modifiers: ["primary", "alt"] },
  });
  assert.deepEqual(command.regions, ["page", "editable", "terminal"]);
  assert.deepEqual(command.modals, []);

  const resolution = command.resolve({ target: null });
  assert.equal(resolution.status, "handled");
  resolution.run();
  assert.deepEqual(harness.registrations.opened, [
    { kind: "session-changes", target: { sessionId: "session-1" } },
  ]);
});

test("the shortcut says why it is unavailable without a Session on screen", () => {
  const harness = createHarness({ target: null });
  const resolution = harness.registrations.shortcut.resolve({ target: null });

  assert.deepEqual(resolution, { status: "blocked", reason: "Select a session first" });
  assert.equal(harness.registrations.opened.length, 0);
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

/** A ten-line file whose fifth line changed, so hunks and the whole file differ. */
const LONG = Array.from({ length: 10 }, (_value, at) => `line ${at}`).join("\n");
const LONG_AFTER = LONG.replace("line 5", "LINE 5");

/** A Host serving the long file, with its pre-image equal to the base text. */
function longHost() {
  return async (url) => {
    const text = String(url);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "long.js", display: "long.js" }] });
    if (text.includes("session-changes.base")) return respond({ text: LONG });
    if (text.includes("session-changes.file")) return respond({ text: LONG_AFTER });
    return refuse();
  };
}

test("hunks are the default scope: the untouched head of the file is not drawn", async () => {
  const harness = createHarness({ fetch: longHost() });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /LINE 5/);
  assert.doesNotMatch(textOf(tree), /line 0/);
});

test("Full draws the whole file, and the toggle is remembered", async () => {
  const harness = createHarness({
    fetch: longHost(),
    storage: new Map([["dsh-session-changes.whole", "true"]]),
  });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(tree), /LINE 5/);
  assert.match(textOf(tree), /line 0/);
  assert.match(textOf(tree), /line 9/);
  // The toolbar offers the scope switch back to hunks.
  assert.match(textOf(tree), /Full/);
});

/** The buttons of the comparison's change blocks, in whichever layout. */
function actionButtons(tree) {
  return withClass(tree, "dsc-actionbar").flatMap((bar) => withClass(bar, "dsc-act"));
}

test("each changed block offers Accept and Revert on the right side", async () => {
  const { fetch } = host();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  // One replacement block: the right lane carries the pair, the left lane none.
  assert.equal(withClass(tree, "dsc-actionbar").length, 1);
  const buttons = actionButtons(tree);
  assert.deepEqual(
    buttons.map((button) => button.props["data-action"]),
    ["accept", "revert"],
  );
  assert.equal(textOf(buttons[0]), "Accept");
  assert.equal(textOf(buttons[1]), "Revert");
  // Context rows are not actionable.
  assert.equal(withClass(tree, "dsc-lrow").length, 2);
  assert.equal(buttons.length, 2);

  const inlineHarness = createHarness({
    fetch,
    storage: new Map([["dsh-session-changes.layout", "inline"]]),
  });
  const inlineTree = await inlineHarness.settle({ sessionId: "session-1", tab: { visible: true } });
  // Inline draws the deletion and the addition as separate rows; each carries the
  // same block's pair, and only the row under the pointer shows its own.
  assert.equal(withClass(inlineTree, "dsc-actionbar").length, 2);
  assert.deepEqual(
    actionButtons(inlineTree).map((button) => button.props["data-action"]),
    ["accept", "revert", "accept", "revert"],
  );

  // The wrapped side-by-side grid is a third rendering path: one right-hand cell
  // per changed row.
  const wrappedHarness = createHarness({
    fetch,
    storage: new Map([["dsh-session-changes.wrap", "true"]]),
  });
  const wrappedTree = await wrappedHarness.settle({
    sessionId: "session-1",
    tab: { visible: true },
  });
  assert.equal(withClass(wrappedTree, "dsc-cell").length, 2);
  assert.equal(withClass(wrappedTree, "dsc-actionbar").length, 1);
});

test("a deletion-only block offers its buttons on the red half, not an empty pad", async () => {
  const fetch = async (url) => {
    const text = String(url);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "a.js", display: "a.js" }] });
    if (text.includes("session-changes.base")) return respond({ text: "gone\n" });
    if (text.includes("session-changes.file")) return respond({ text: "" });
    return refuse();
  };
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const left = withClass(tree, "dsc-lane-left")[0];
  const right = withClass(tree, "dsc-lane-right")[0];
  // The block spans both deleted lines (the blank line after the newline), and each
  // changed row carries its own hover pair.
  assert.equal(withClass(left, "dsc-act").length, 4);
  assert.equal(withClass(right, "dsc-act").length, 0);
});

/**
 * A Host that records the review write, so a click can be checked end to end.
 * @returns `{ fetch, writes, reads }`.
 */
function recordingHost() {
  const writes = [];
  const reads = [];
  const fetch = async (url, init) => {
    const text = String(url);
    if (
      text.includes("session-changes.list") ||
      text.includes("session-changes.base") ||
      text.includes("session-changes.file")
    )
      reads.push(text);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "a.js", display: "a.js" }] });
    if (text.includes("session-changes.base")) return respond({ text: "old" });
    if (text.includes("session-changes.file")) return respond({ text: "new" });
    if (text.includes("session-changes.accept") || text.includes("session-changes.revert")) {
      writes.push({ url: text, body: JSON.parse(init.body) });
      return respond({ ok: true });
    }
    if (text.includes("session-changes.apply-file") || text.includes("session-changes.apply-all")) {
      writes.push({ url: text, body: JSON.parse(init.body) });
      return respond({ ok: true, files: 1, failed: 0 });
    }
    return refuse();
  };
  return { fetch, writes, reads };
}

test("clicking Accept posts the block's new text against the pre-image digest", async () => {
  const { fetch, writes, reads } = recordingHost();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const accept = actionButtons(tree).find((button) => button.props["data-action"] === "accept");
  assert.ok(accept !== undefined);
  const readsBefore = reads.length;
  accept.props.onClick({ stopPropagation() {} });
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(writes.length, 1);
  assert.match(writes[0].url, /session-changes\.accept$/);
  assert.equal(writes[0].body.path, "a.js");
  assert.equal(writes[0].body.text, "new");
  assert.equal(writes[0].body.expect, await hashText("old"));
  // The write names this tab, so the Host can omit its own invalidation echo.
  assert.equal(typeof writes[0].body.source, "string");
  assert.equal(writes[0].body.source.length > 0, true);
  // The block is applied from the texts already on screen: nothing is re-read.
  assert.equal(reads.length, readsBefore);
});

test("accepting a block updates the diff in place without re-reading the comparison", async () => {
  const baseText = "one\ntwo\nthree\nfour\nfive";
  const fileText = "one\nTWO\nthree\nFOUR\nfive";
  const reads = [];
  const fetch = async (url, init) => {
    const text = String(url);
    if (text.includes("session-changes.accept")) return respond({ ok: true });
    if (
      text.includes("session-changes.list") ||
      text.includes("session-changes.base") ||
      text.includes("session-changes.file")
    )
      reads.push(text);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "a.js", display: "a.js" }] });
    if (text.includes("session-changes.base")) return respond({ text: baseText });
    if (text.includes("session-changes.file")) return respond({ text: fileText });
    return refuse();
  };
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  assert.equal(withClass(tree, "dsc-actionbar").length, 2);
  const readsBefore = reads.length;
  const accept = actionButtons(tree).find((button) => button.props["data-action"] === "accept");
  accept.props.onClick({ stopPropagation() {} });
  const settled = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  // The first block is folded in locally, the second one still needs review, and
  // the file stays selected rather than flashing through a loading note.
  assert.equal(withClass(settled, "dsc-actionbar").length, 1);
  assert.equal(withClass(settled, "dsc-row")[0].props["data-selected"], "true");
  assert.equal(reads.length, readsBefore);
});

test("clicking Revert posts the pre-image's text against the live file digest", async () => {
  const { fetch, writes } = recordingHost();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const revert = actionButtons(tree).find((button) => button.props["data-action"] === "revert");
  assert.ok(revert !== undefined);
  revert.props.onClick({ stopPropagation() {} });
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(writes.length, 1);
  assert.match(writes[0].url, /session-changes\.revert$/);
  assert.equal(writes[0].body.text, "old");
  assert.equal(writes[0].body.expect, await hashText("new"));
});

test("a refused write shows the conflict note instead of failing silently", async () => {
  const fetch = async (url) => {
    const text = String(url);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "a.js", display: "a.js" }] });
    if (text.includes("session-changes.base")) return respond({ text: "old" });
    if (text.includes("session-changes.file")) return respond({ text: "new" });
    if (text.includes("session-changes.accept"))
      return { ok: false, status: 409, json: async () => ({ error: "changed" }) };
    return refuse();
  };
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const accept = actionButtons(tree).find((button) => button.props["data-action"] === "accept");
  accept.props.onClick({ stopPropagation() {} });
  const settled = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.match(textOf(settled), /changed after this diff was drawn/);
});

test("each file row offers Accept/Revert and the list has an Accept All/Revert All row", async () => {
  const { fetch } = host();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const rowActions = withClass(tree, "dsc-row-actions");
  assert.equal(rowActions.length, 2);
  for (const group of rowActions) {
    assert.deepEqual(
      withClass(group, "dsc-act").map((button) => button.props["data-action"]),
      ["accept", "revert"],
    );
  }
  const all = withClass(tree, "dsc-all")[0];
  assert.ok(all !== undefined);
  assert.deepEqual(
    withClass(all, "dsc-act").map((button) => button.props["data-action"]),
    ["accept-all", "revert-all"],
  );
});

test("reopening the tab re-reads the list but not every comparison", async () => {
  const { fetch, reads } = recordingHost();
  const harness = createHarness({ fetch });
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const comparisonReads = () =>
    reads.filter(
      (url) => url.includes("session-changes.base") || url.includes("session-changes.file"),
    ).length;
  const before = comparisonReads();
  assert.equal(before > 0, true);

  // A collapse stops the watch, and the reopen re-reads the list. An unchanged
  // list must not look like a new one: otherwise the selected row (and the whole
  // comparison) is rebuilt, and every row's counts are read again, on every
  // expand/collapse of the sidebar.
  await harness.settle({ sessionId: "session-1", tab: { visible: false } });
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.equal(comparisonReads(), before);
});

test("a file row's Accept applies that whole file, named by path", async () => {
  const { fetch, writes } = recordingHost();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const group = withClass(tree, "dsc-row-actions")[0];
  const accept = withClass(group, "dsc-act").find(
    (button) => button.props["data-action"] === "accept",
  );
  assert.ok(accept !== undefined);
  accept.props.onClick({ stopPropagation() {} });
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const write = writes.find((entry) => entry.url.includes("session-changes.apply-file"));
  assert.ok(write !== undefined);
  assert.equal(write.body.path, "a.js");
  assert.equal(write.body.action, "accept");
  assert.equal(typeof write.body.source, "string");
});

test("Accept All applies the list at once without asking", async () => {
  const { fetch, writes } = recordingHost();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const accept = withClass(tree, "dsc-act").find(
    (button) => button.props["data-action"] === "accept-all",
  );
  assert.ok(accept !== undefined);
  accept.props.onClick();
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const write = writes.find((entry) => entry.url.includes("session-changes.apply-all"));
  assert.ok(write !== undefined);
  assert.equal(write.body.action, "accept");
  assert.equal(typeof write.body.source, "string");
});

test("Revert All asks first, cancel writes nothing, and confirm reverts the list", async () => {
  const { fetch, writes } = recordingHost();
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const ask = withClass(tree, "dsc-act").find(
    (button) => button.props["data-action"] === "revert-all",
  );
  assert.ok(ask !== undefined);
  ask.props.onClick();
  const asked = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  assert.match(textOf(asked), /Revert every remaining change in the list\?/);
  assert.equal(withClass(asked, "dsc-all")[0].props["data-confirm"], "true");
  assert.equal(writes.length, 0);

  const cancel = withClass(asked, "dsc-act").find(
    (button) => button.props["data-action"] === "revert-all-cancel",
  );
  cancel.props.onClick();
  const cancelled = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  assert.equal(withClass(cancelled, "dsc-all")[0].props["data-confirm"], undefined);
  assert.equal(writes.length, 0);

  const askAgain = withClass(cancelled, "dsc-act").find(
    (button) => button.props["data-action"] === "revert-all",
  );
  askAgain.props.onClick();
  const askedAgain = await harness.settle({ sessionId: "session-1", tab: { visible: true } });
  const confirm = withClass(askedAgain, "dsc-act").find(
    (button) => button.props["data-action"] === "revert-all-confirm",
  );
  confirm.props.onClick();
  await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  const write = writes.find((entry) => entry.url.includes("session-changes.apply-all"));
  assert.ok(write !== undefined);
  assert.equal(write.body.action, "revert");
  assert.equal(typeof write.body.source, "string");
});

test("a row whose counts are still loading shows an ellipsis, never undefined", async () => {
  const pending = new Promise(() => {});
  const fetch = async (url) => {
    const text = String(url);
    if (text.includes("session-changes.list"))
      return respond({ files: [{ path: "a.js", display: "a.js" }] });
    if (text.includes("session-changes.base") || text.includes("session-changes.file"))
      return pending;
    return refuse();
  };
  const harness = createHarness({ fetch });
  const tree = await harness.settle({ sessionId: "session-1", tab: { visible: true } });

  assert.doesNotMatch(textOf(tree), /undefined/);
  const rowCounts = withClass(tree, "dsc-counts")[0];
  assert.ok(rowCounts !== undefined);
  assert.equal(textOf(rowCounts), "…");
});
