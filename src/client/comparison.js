import { DIFF_CONTEXT } from "./constants.js";
import { reverseHunks, sliceHunk, toHunks } from "./diff/hunks.js";
import { diffLines } from "./diff/lines.js";
import { entryKey } from "./selection.js";

/**
 * One whole-file range for the `Full` scope; an empty diff has no range at all.
 * @param ops - the operation list.
 * @returns zero or one hunk.
 */
function wholeRange(ops) {
  return ops.length === 0 ? [] : [sliceHunk(ops, 0, ops.length - 1)];
}

/**
 * Diff two texts into the `ready` comparison shape both panes consume.
 * @param before - the old side text.
 * @param after - the new side text.
 * @returns `{ status, hunks, full, coarse }`.
 */
function compare(before, after) {
  const diff = diffLines(
    before === "" ? [] : before.split("\n"),
    after === "" ? [] : after.split("\n"),
  );
  return {
    status: "ready",
    coarse: diff.coarse,
    hunks: toHunks(diff.ops, DIFF_CONTEXT),
    full: wholeRange(diff.ops),
  };
}

/**
 * Work out what the comparison shows for the selected file.
 *
 * Overall prefers the Session's stored pre-image: an exact baseline, never
 * reconstructed. By turn walks the file back through the turns newer than the one
 * being viewed, which is the only option because just the first pre-image is kept.
 *
 * @param input - the current view state.
 * @returns the comparison, `null` while nothing is selected, or a status:
 *   `pending` (still reading), `unreadable`, `oversized`, `binary`, `drift`.
 */
export function buildComparison({ mode, selected, diffs, wholeState, baseState, view }) {
  if (selected === null) return null;
  if (wholeState !== undefined && wholeState.phase === "error") return { status: "unreadable" };
  if (wholeState !== undefined && wholeState.phase === "oversized") return { status: "oversized" };
  if (wholeState === undefined || wholeState.phase === "loading") return { status: "pending" };
  // The path is gone from the disk: compare against "nothing" so the whole
  // pre-image reads as deleted, instead of claiming the file is unreadable.
  const gone = wholeState.phase === "missing";
  const current = gone ? "" : wholeState.text;
  if (mode === "overall" && baseState !== undefined && baseState.phase === "ready") {
    const beforeText = baseState.absent === true ? "" : baseState.text;
    return { ...compare(beforeText, current), gone };
  }
  if (gone) return { status: "ready", gone: true, hunks: [], full: [] };
  let text = current;
  const ordered = [...selected.entries].sort((a, b) => b.turn - a.turn);
  const target = mode === "overall" || view.groups.length === 0 ? undefined : view.groups[0].turn;
  let after;
  for (const item of ordered) {
    if (target !== undefined && item.turn === target) after = text;
    const state = diffs[entryKey(item)];
    if (state === undefined || state.phase !== "ready") return { status: "pending" };
    const payload = state.data;
    if (payload === undefined || payload.kind !== "text") return { status: "binary" };
    if (payload.before !== true) {
      text = "";
      continue;
    }
    const back = reverseHunks(text, payload.hunks);
    if (back === null) return { status: "drift" };
    text = back;
  }
  const afterText = mode === "overall" ? current : after === undefined ? current : after;
  return { ...compare(text, afterText), gone: false };
}
