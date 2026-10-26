import { diffLines } from "./lines.js";

/**
 * Added and deleted line counts between two texts, using the same line diff the
 * comparison pane draws, so a row's numbers and the pane beside it cannot disagree.
 *
 * @param before - the old side text.
 * @param after - the new side text.
 * @returns `{ added, deleted }`.
 */
export function countChangedLines(before, after) {
  const { ops } = diffLines(
    before === "" ? [] : before.split("\n"),
    after === "" ? [] : after.split("\n"),
  );
  let added = 0;
  let deleted = 0;
  for (const change of ops) {
    if (change.op === "+") added += 1;
    else if (change.op === "-") deleted += 1;
  }
  return { added, deleted };
}
