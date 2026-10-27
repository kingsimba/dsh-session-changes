/**
 * The page-level per-Session memory the tab restores after a Session switch.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  readCounts,
  readScroll,
  readSelection,
  writeCounts,
  writeScroll,
  writeSelection,
} from "../src/client/session-memory.js";

test("the selected file is remembered per Session", () => {
  assert.equal(readSelection("memory-a"), null);
  writeSelection("memory-a", "src/app.js");
  writeSelection("memory-b", "notes.md");
  assert.equal(readSelection("memory-a"), "src/app.js");
  assert.equal(readSelection("memory-b"), "notes.md");
  writeSelection("memory-a", null);
  assert.equal(readSelection("memory-a"), null);
});

test("the last counts are remembered per Session", () => {
  writeCounts("memory-a", { "a.js": { added: 2, deleted: 1 } });
  assert.deepEqual(readCounts("memory-a"), { "a.js": { added: 2, deleted: 1 } });
  // A Session that has not been read yet has no counts, not another Session's.
  assert.deepEqual(readCounts("memory-c"), {});
});

test("scroll offsets are remembered per view key", () => {
  const key = "memory-a\u0000a.js\u0000hunks\u0000split\u0000nowrap";
  assert.equal(readScroll(key), undefined);
  writeScroll(key, { top: 120, left: 4, top2: 120, left2: 4 });
  assert.deepEqual(readScroll(key), { top: 120, left: 4, top2: 120, left2: 4 });
  writeScroll(key, undefined);
  assert.equal(readScroll(key), undefined);
});
