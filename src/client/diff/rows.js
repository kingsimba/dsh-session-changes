/**
 * Number a hunk's lines: context lines count on both sides, deletions on the
 * old side, additions on the new side.
 *
 * @param hunk - a served hunk.
 * @returns the rows in order.
 */
export function hunkRows(hunk) {
  let oldNo = hunk.oldStart;
  let newNo = hunk.newStart;
  return (Array.isArray(hunk.lines) ? hunk.lines : []).map((line) => {
    const text = line.slice(1);
    switch (line[0]) {
      case "+":
        return { kind: "add", old: undefined, new: newNo++, text };
      case "-":
        return { kind: "del", old: oldNo++, new: undefined, text };
      default:
        return { kind: "context", old: oldNo++, new: newNo++, text };
    }
  });
}

/**
 * Pair numbered rows for the side-by-side view: each run of deletions is aligned
 * with the run of additions that follows it, row by row, and context lines sit on
 * both sides.
 *
 * @param rows - the hunk's numbered rows.
 * @returns the paired rows in order.
 */
export function splitRows(rows) {
  const out = [];
  let dels = [];
  let adds = [];
  const flush = () => {
    for (let at = 0; at < Math.max(dels.length, adds.length); at += 1) {
      const left = dels[at];
      const right = adds[at];
      out.push({
        ...(left === undefined ? {} : { left }),
        ...(right === undefined ? {} : { right }),
      });
    }
    dels = [];
    adds = [];
  };
  for (const row of rows) {
    if (row.kind === "del") dels.push({ no: row.old, text: row.text, kind: "del" });
    else if (row.kind === "add") adds.push({ no: row.new, text: row.text, kind: "add" });
    else {
      flush();
      out.push({
        left: { no: row.old, text: row.text, kind: "context" },
        right: { no: row.new, text: row.text, kind: "context" },
      });
    }
  }
  flush();
  return out;
}

/**
 * The range header of one hunk.
 * @param hunk - a served hunk.
 * @returns `@@ -a,b +c,d @@`.
 */
export function hunkLabel(hunk) {
  return (
    "@@ -" +
    String(hunk.oldStart) +
    "," +
    String(hunk.oldLines) +
    " +" +
    String(hunk.newStart) +
    "," +
    String(hunk.newLines) +
    " @@"
  );
}
