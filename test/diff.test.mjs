/**
 * The pure half of the browser code: line diffing, hunk slicing, row pairing, and
 * the comparison the panes draw. None of it touches React, so it runs directly.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { buildComparison } from "../src/client/comparison.js";
import { hunkBlocks } from "../src/client/diff/blocks.js";
import { countChangedLines } from "../src/client/diff/counts.js";
import { sliceHunk, toHunks } from "../src/client/diff/hunks.js";
import { diffLines } from "../src/client/diff/lines.js";
import { buildDiffModel } from "../src/client/diff/model.js";
import { hunkRows, splitRows } from "../src/client/diff/rows.js";
import { spliceLines } from "../src/client/text-patch.js";

/** Only the lines that changed, as `op:text` strings. */
function changes(ops) {
  return ops.filter((entry) => entry.op !== " ").map((entry) => entry.op + entry.text);
}

const SELECTED = { path: "a.js", entries: [{ seq: 3, index: 0, turn: 1 }] };

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

test("hunkBlocks cuts a hunk into runs and keeps exact ranges on both sides", () => {
  const blocks = hunkBlocks({
    oldStart: 1,
    newStart: 1,
    lines: [" keep", "-old 1", "-old 2", "+new 1", " keep 2", "-old 3", "+new 3"],
  });
  assert.equal(blocks.length, 2);
  assert.deepEqual(blocks[0], {
    from: 1,
    to: 3,
    oldStart: 2,
    oldLines: 2,
    newStart: 2,
    newLines: 1,
    deleted: ["old 1", "old 2"],
    added: ["new 1"],
  });
  assert.deepEqual(blocks[1], {
    from: 5,
    to: 6,
    oldStart: 5,
    oldLines: 1,
    newStart: 4,
    newLines: 1,
    deleted: ["old 3"],
    added: ["new 3"],
  });
});

test("hunkBlocks anchors a pure insertion and a pure deletion at the right line", () => {
  const inserted = hunkBlocks({
    oldStart: 1,
    newStart: 1,
    lines: [" keep", "+added", " keep 2"],
  });
  assert.deepEqual(inserted, [
    {
      from: 1,
      to: 1,
      oldStart: 2,
      oldLines: 0,
      newStart: 2,
      newLines: 1,
      deleted: [],
      added: ["added"],
    },
  ]);
  const deleted = hunkBlocks({
    oldStart: 1,
    newStart: 1,
    lines: [" keep", "-gone", " keep 2"],
  });
  assert.deepEqual(deleted, [
    {
      from: 1,
      to: 1,
      oldStart: 2,
      oldLines: 1,
      newStart: 2,
      newLines: 0,
      deleted: ["gone"],
      added: [],
    },
  ]);
});

test("accepting a block writes its added lines over the pre-image's range", () => {
  const base = "keep\nold 1\nold 2\nkeep 2";
  // oldStart 2, oldLines 2, additions ["new 1"]
  assert.equal(spliceLines(base, 1, 2, ["new 1"]), "keep\nnew 1\nkeep 2");
});

test("reverting a block writes its deleted lines back over the current range", () => {
  const current = "keep\nnew 1\nkeep 2";
  // newStart 2, newLines 1, deletions ["old 1", "old 2"]
  assert.equal(spliceLines(current, 1, 1, ["old 1", "old 2"]), "keep\nold 1\nold 2\nkeep 2");
});

test("reverting a pure insertion removes the added lines and keeps the newline", () => {
  assert.equal(spliceLines("a\nadded\nb\n", 1, 1, []), "a\nb\n");
  // A pure deletion re-inserts at its new-side anchor.
  assert.equal(spliceLines("a\nb\n", 1, 0, ["gone"]), "a\ngone\nb\n");
  assert.equal(spliceLines("", 0, 0, ["first"]), "first");
});

test("buildDiffModel hands every changed row its block, and split rows share it", () => {
  const hunks = [
    {
      oldStart: 1,
      oldLines: 2,
      newStart: 1,
      newLines: 2,
      lines: [" keep", "-old", "+new", " keep 2"],
    },
  ];
  const inline = buildDiffModel({ hunks }, undefined, "inline");
  assert.equal(inline.blocks[0].changes.length, 1);
  assert.equal(inline.blocks[0].changes[0].key, "0:0");
  assert.equal(inline.blocks[0].changes[0].editable, true);
  assert.equal(inline.blocks[0].rows[0].block, undefined);
  assert.equal(inline.blocks[0].rows[1].block, inline.blocks[0].changes[0]);
  assert.equal(inline.blocks[0].rows[2].block, inline.blocks[0].changes[0]);

  const split = buildDiffModel({ hunks }, undefined, "split");
  const changed = split.blocks[0].rows.filter((row) => row.block !== undefined);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].left.kind, "del");
  assert.equal(changed[0].right.kind, "add");
  assert.equal(changed[0].block, split.blocks[0].changes[0]);
});

test("buildComparison waits for the current file to be read", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: undefined,
    baseState: undefined,
  });
  assert.deepEqual(comparison, { status: "pending" });
});

test("buildComparison waits for the pre-image read", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: { phase: "ready", text: "one" },
    baseState: { phase: "loading" },
  });
  assert.deepEqual(comparison, { status: "pending" });
});

test("buildComparison diffs the stored pre-image against the current file", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: { phase: "ready", text: "one\nTWO\n" },
    baseState: { phase: "ready", text: "one\ntwo\n" },
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
});

test("buildComparison shows a new file as additions only", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: { phase: "ready", text: "one\ntwo" },
    baseState: { phase: "ready", absent: true },
  });
  assert.equal(comparison.status, "ready");
  assert.deepEqual(
    comparison.hunks[0].lines.map((line) => line[0]),
    ["+", "+"],
  );
});

test("buildComparison reads a deleted path as an empty new side", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: { phase: "missing" },
    baseState: { phase: "ready", text: "one\ntwo" },
  });
  assert.equal(comparison.gone, true);
  assert.deepEqual(
    comparison.hunks[0].lines.map((line) => line[0]),
    ["-", "-"],
  );
});

test("buildComparison reports no-base when the Host has no pre-image", () => {
  const comparison = buildComparison({
    selected: SELECTED,
    wholeState: { phase: "ready", text: "kept" },
    baseState: { phase: "error" },
  });
  assert.deepEqual(comparison, { status: "no-base" });
});

test("buildComparison passes a binary or oversized file to the pane", () => {
  assert.deepEqual(
    buildComparison({ selected: SELECTED, wholeState: { phase: "binary" }, baseState: undefined }),
    { status: "binary" },
  );
  assert.deepEqual(
    buildComparison({
      selected: SELECTED,
      wholeState: { phase: "oversized" },
      baseState: undefined,
    }),
    { status: "oversized" },
  );
});
