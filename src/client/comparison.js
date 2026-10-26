import { DIFF_CONTEXT } from "./constants.js";
import { toHunks } from "./diff/hunks.js";
import { diffLines } from "./diff/lines.js";

/**
 * Diff two texts into the `ready` comparison shape the panes consume.
 * @param before - the old side text.
 * @param after - the new side text.
 * @returns `{ status, hunks, coarse }`.
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
  };
}

/**
 * Work out what the comparison shows for the selected file: the Session's stored
 * first pre-image against the file as it stands now, and nothing else. With no
 * pre-image there is no baseline, so the pane says so instead of inventing one.
 *
 * @param input - `{ selected, wholeState, baseState }`.
 * @returns the comparison, `null` while nothing is selected, or a status:
 *   `pending` (still reading), `unreadable`, `binary`, `oversized`, `no-base`.
 */
export function buildComparison({ selected, wholeState, baseState }) {
  if (selected === null) return null;
  if (wholeState !== undefined && wholeState.phase === "error") return { status: "unreadable" };
  if (wholeState !== undefined && wholeState.phase === "binary") return { status: "binary" };
  if (wholeState !== undefined && wholeState.phase === "oversized") return { status: "oversized" };
  if (wholeState === undefined || wholeState.phase === "loading") return { status: "pending" };
  // The path is gone from the disk: compare against "nothing" so the whole
  // pre-image reads as deleted, instead of claiming the file is unreadable.
  const gone = wholeState.phase === "missing";
  const current = gone ? "" : wholeState.text;
  if (baseState === undefined || baseState.phase === "loading") return { status: "pending" };
  if (baseState.phase !== "ready") return { status: "no-base" };
  const beforeText = baseState.absent === true ? "" : baseState.text;
  return { ...compare(beforeText, current), gone, absent: baseState.absent === true };
}
