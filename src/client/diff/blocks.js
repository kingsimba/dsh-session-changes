/**
 * Split one hunk into the change blocks a reviewer acts on: each run of deletions
 * and additions between context lines, with the exact ranges it covers on both
 * sides. The review buttons work one block at a time, so the ranges have to be
 * exact: a block with no deletions is a pure insertion at `oldStart`, and one with
 * no additions is a pure deletion at `newStart`.
 *
 * @param hunk - a hunk (`{ oldStart, newStart, lines }`) as the pane receives it.
 * @returns the blocks in file order, each with its 1-based start and line counts,
 *   the deleted and added line texts, and the `from`/`to` row indexes it spans.
 */
export function hunkBlocks(hunk) {
  const lines = Array.isArray(hunk.lines) ? hunk.lines : [];
  const blocks = [];
  let oldNo = hunk.oldStart;
  let newNo = hunk.newStart;
  let current = null;
  for (let at = 0; at < lines.length; at += 1) {
    const op = lines[at][0];
    const text = lines[at].slice(1);
    if (op === " ") {
      current = null;
      oldNo += 1;
      newNo += 1;
      continue;
    }
    if (current === null) {
      current = {
        from: at,
        to: at,
        oldStart: oldNo,
        oldLines: 0,
        newStart: newNo,
        newLines: 0,
        deleted: [],
        added: [],
      };
      blocks.push(current);
    }
    current.to = at;
    if (op === "-") {
      current.deleted.push(text);
      current.oldLines += 1;
      oldNo += 1;
    } else if (op === "+") {
      current.added.push(text);
      current.newLines += 1;
      newNo += 1;
    }
  }
  return blocks;
}
