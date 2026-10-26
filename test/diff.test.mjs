/**
 * The pure half of the browser code: line diffing, hunk slicing, row pairing, and
 * the comparison the panes draw. None of it touches React, so it runs directly.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildComparison } from "../src/client/comparison.js";
import { countChangedLines } from "../src/client/diff/counts.js";
import { reverseHunks, sliceHunk, toHunks } from "../src/client/diff/hunks.js";
import { diffLines } from "../src/client/diff/lines.js";
import { hunkRows, splitRows } from "../src/client/diff/rows.js";

/** Only the lines that changed, as `op:text` strings. */
function changes(ops) {
  return ops.filter((entry) => entry.op !== " ").map((entry) => entry.op + entry.text);
}

test("diffLines keeps the common prefix and suffix as context", () => {
  const { ops, coarse } = diffLines(["a", "b", "c"], ["a", "B", "c"]);
  assert.equal(coarse, false);
  assert.deepEqual(changes(ops), ["-b", "+B"]);
  assert.deepEqual(ops[0], { op: " ", text: "a" });
  assert.deepEqual(ops[ops.length - 1], { op: " ", text: "c" });
});

test("diffLines reports a coarse block instead of dying on a huge middle", () => {
  const before = Array.from({ length: 4000 }, (_value, at) => `old ${at}`);
  const after = Array.from({ length: 4000 }, (_value, at) => `new ${at}`);
  const { ops, coarse } = diffLines(before, after);
  assert.equal(coarse, true);
  assert.equal(ops.length, 8000);
  assert.equal(ops[0].op, "-");
  assert.equal(ops[ops.length - 1].op, "+");
});

test("diffLines handles two empty inputs", () => {
  const { ops, coarse } = diffLines([], []);
  assert.deepEqual(ops, []);
  assert.equal(coarse, false);
});

test("countChangedLines numbers the same diff the pane draws", () => {
  assert.deepEqual(countChangedLines("a\nb\nc", "a\nB\nc"), { added: 1, deleted: 1 });
  assert.deepEqual(countChangedLines("", "one\ntwo"), { added: 2, deleted: 0 });
  assert.deepEqual(countChangedLines("one\ntwo", ""), { added: 0, deleted: 2 });
  assert.deepEqual(countChangedLines("same", "same"), { added: 0, deleted: 0 });
});

test("toHunks merges nearby changes and splits distant ones", () => {
  const near = [];
  for (let at = 0; at < 6; at += 1) near.push({ op: " ", text: `line ${at}` });
  near[1] = { op: "-", text: "old 1" };
  near.push({ op: "+", text: "added 1" });
  near[3] = { op: "-", text: "old 3" };
  assert.equal(toHunks(near, 3).length, 1);

  const far = [];
  for (let at = 0; at < 40; at += 1) far.push({ op: " ", text: `line ${at}` });
  far[1] = { op: "-", text: "old 1" };
  far[30] = { op: "+", text: "added 30" };
  assert.equal(toHunks(far, 3).length, 2);
});

test("toHunks finds nothing to do for identical sides", () => {
  assert.deepEqual(toHunks([{ op: " ", text: "a" }], 3), []);
});

test("sliceHunk numbers both sides from the range start", () => {
  const ops = [
    { op: " ", text: "a" },
    { op: "-", text: "b" },
    { op: "+", text: "B" },
    { op: " ", text: "c" },
  ];
  const hunk = sliceHunk(ops, 1, 2);
  assert.deepEqual(hunk, {
    oldStart: 2,
    oldLines: 1,
    newStart: 2,
    newLines: 1,
    lines: ["-b", "+B"],
  });
});

test("reverseHunks walks a change back to its old text", () => {
  const before = ["one", "two", "three", "four"];
  const after = ["one", "TWO", "three", "four", "five"];
  const hunks = toHunks(diffLines(before, after).ops, 1);
  assert.equal(reverseHunks(after.join("\n"), hunks), before.join("\n"));
});

test("reverseHunks refuses a hunk that no longer lines up", () => {
  const hunks = toHunks(diffLines(["a", "b"], ["a", "B"]).ops, 0);
  assert.equal(reverseHunks("a\nC", hunks), null);
});

test("splitRows pairs a deletion run with the additions that follow", () => {
  const numbered = hunkRows({
    oldStart: 1,
    oldLines: 3,
    newStart: 1,
    newLines: 3,
    lines: [" keep", "-old 1", "-old 2", "+new 1", " keep 2"],
  });
  const rows = splitRows(numbered);
  assert.equal(rows.length, 4);
  assert.equal(rows[0].left.kind, "context");
  assert.equal(rows[0].right.kind, "context");
  assert.equal(rows[1].left.text, "old 1");
  assert.equal(rows[1].right.text, "new 1");
  assert.equal(rows[2].left.text, "old 2");
  assert.equal(rows[2].right, undefined);
  assert.equal(rows[3].left.text, "keep 2");
  assert.equal(rows[3].right.text, "keep 2");
});

test("buildComparison is not ready until the whole file was read", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] },
    diffs: {},
    wholeState: undefined,
    baseState: undefined,
    view: { groups: [] },
  });
  assert.deepEqual(comparison, { status: "pending" });
});

test("buildComparison diffs the stored pre-image against the current file", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] },
    diffs: {},
    wholeState: { phase: "ready", text: "one\nTWO\n" },
    baseState: { phase: "ready", text: "one\ntwo\n" },
    view: { groups: [] },
  });
  assert.equal(comparison.status, "ready");
  assert.equal(comparison.gone, false);
  assert.deepEqual(
    changes(
      comparison.hunks[0].lines.map((line) => ({
        op: line[0],
        text: line.slice(1),
      })),
    ),
    ["-two", "+TWO"],
  );
  assert.equal(comparison.full.length, 1);
});

test("buildComparison shows a new file as additions only", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] },
    diffs: {},
    wholeState: { phase: "ready", text: "one\ntwo" },
    baseState: { phase: "ready", absent: true },
    view: { groups: [] },
  });
  assert.equal(comparison.status, "ready");
  assert.deepEqual(
    comparison.hunks[0].lines.map((line) => line[0]),
    ["+", "+"],
  );
});

test("buildComparison reads a deleted path as an empty new side", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] },
    diffs: {},
    wholeState: { phase: "missing" },
    baseState: { phase: "ready", text: "one\ntwo" },
    view: { groups: [] },
  });
  assert.equal(comparison.gone, true);
  assert.deepEqual(
    comparison.hunks[0].lines.map((line) => line[0]),
    ["-", "-"],
  );
});

test("buildComparison reports no-base instead of rebuilding one from the turns", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 5, index: 0, turn: 2 }] },
    diffs: {
      "5:0": {
        phase: "ready",
        data: {
          kind: "text",
          path: "a.js",
          before: true,
          after: true,
          hunks: [
            { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-gone", "+kept"] },
          ],
        },
      },
    },
    wholeState: { phase: "ready", text: "kept" },
    baseState: { phase: "error" },
    view: { groups: [] },
  });
  assert.deepEqual(comparison, { status: "no-base" });
});

test("buildComparison waits for the pre-image read in Overall", () => {
  const comparison = buildComparison({
    mode: "overall",
    selected: { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] },
    diffs: {},
    wholeState: { phase: "ready", text: "one" },
    baseState: { phase: "loading" },
    view: { groups: [] },
  });
  assert.deepEqual(comparison, { status: "pending" });
});

test("buildComparison reports drift when a turn no longer lines up", () => {
  const comparison = buildComparison({
    mode: "turn",
    selected: { path: "a.js", entries: [{ seq: 5, index: 0, turn: 2 }] },
    diffs: {
      "5:0": {
        phase: "ready",
        data: {
          kind: "text",
          path: "a.js",
          before: true,
          after: true,
          hunks: [
            { oldStart: 1, oldLines: 1, newStart: 1, newLines: 1, lines: ["-gone", "+kept"] },
          ],
        },
      },
    },
    wholeState: { phase: "ready", text: "something else" },
    baseState: undefined,
    view: { groups: [{ turn: 2, total: 1, folders: [] }] },
  });
  assert.deepEqual(comparison, { status: "drift" });
});
