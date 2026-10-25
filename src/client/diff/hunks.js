/**
 * Build one hunk from an operation range, numbering both sides from the range start.
 * @param ops - the whole operation list.
 * @param start - first operation of the hunk.
 * @param end - last operation of the hunk, inclusive.
 * @returns the served hunk shape.
 */
export function sliceHunk(ops, start, end) {
  let oldNo = 1;
  let newNo = 1;
  for (let at = 0; at < start; at += 1) {
    if (ops[at].op !== "+") oldNo += 1;
    if (ops[at].op !== "-") newNo += 1;
  }
  const lines = [];
  let oldLines = 0;
  let newLines = 0;
  for (let at = start; at <= end; at += 1) {
    lines.push(ops[at].op + ops[at].text);
    if (ops[at].op !== "+") oldLines += 1;
    if (ops[at].op !== "-") newLines += 1;
  }
  return { oldStart: oldNo, oldLines, newStart: newNo, newLines, lines };
}

/**
 * Group operations into hunks with a little context around each change.
 * @param ops - the whole operation list.
 * @param context - context lines to keep on either side of a change.
 * @returns the hunks, in file order; empty when nothing changed.
 */
export function toHunks(ops, context) {
  const changed = [];
  for (let at = 0; at < ops.length; at += 1) if (ops[at].op !== " ") changed.push(at);
  if (changed.length === 0) return [];
  const hunks = [];
  let start = Math.max(0, changed[0] - context);
  let end = Math.min(ops.length - 1, changed[0] + context);
  for (let at = 1; at < changed.length; at += 1) {
    const index = changed[at];
    if (index - context <= end + 1) {
      end = Math.min(ops.length - 1, index + context);
      continue;
    }
    hunks.push(sliceHunk(ops, start, end));
    start = Math.max(0, index - context);
    end = Math.min(ops.length - 1, index + context);
  }
  hunks.push(sliceHunk(ops, start, end));
  return hunks;
}

/**
 * Undo one turn's comparison on a file's text: each hunk's new-side range is
 * replaced with its old-side lines, so the caller walks back to the state before
 * the turn.
 *
 * @param text - the file as it stood after the turn.
 * @param hunks - the turn's hunks for that file.
 * @returns the text before the turn, or null when the hunk no longer lines up.
 */
export function reverseHunks(text, hunks) {
  let lines = text === "" ? [] : text.split("\n");
  let delta = 0;
  for (const hunk of Array.isArray(hunks) ? hunks : []) {
    const next = [];
    const prev = [];
    for (const line of Array.isArray(hunk.lines) ? hunk.lines : []) {
      if (line[0] === "-") prev.push(line.slice(1));
      else {
        next.push(line.slice(1));
        if (line[0] === " ") prev.push(line.slice(1));
      }
    }
    const start = hunk.newStart - 1 + delta;
    const end = start + next.length;
    if (start < 0 || end > lines.length) return null;
    for (let at = 0; at < next.length; at += 1) if (lines[start + at] !== next[at]) return null;
    lines = [...lines.slice(0, start), ...prev, ...lines.slice(end)];
    delta += prev.length - next.length;
  }
  return lines.join("\n");
}
