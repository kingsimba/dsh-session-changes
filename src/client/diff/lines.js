/**
 * Cell budget for the exact line diff: the LCS table is (n+1)x(m+1) Uint32 cells.
 * 8M cells ≈ 32 MB of transient memory and well under a frame for realistic files;
 * past it {@link diffLines} reports a coarse whole-block replacement instead.
 */
export const DIFF_CELL_CAP = 8000000;

/**
 * Line-level diff of two texts: the common prefix and suffix are kept as context
 * and only the middle is matched, so a large file with small edits stays cheap.
 * When the middle is too big for an exact match the middle is reported as one
 * wholesale replacement and `coarse` is set: still a readable two-sided diff,
 * never a dead end.
 *
 * @param before - the old side, one line per entry.
 * @param after - the new side, one line per entry.
 * @returns `{ ops, coarse }`: the ordered operations and whether they approximate.
 */
export function diffLines(before, after) {
  let pre = 0;
  while (pre < before.length && pre < after.length && before[pre] === after[pre]) pre += 1;
  let suf = 0;
  while (
    suf < before.length - pre &&
    suf < after.length - pre &&
    before[before.length - 1 - suf] === after[after.length - 1 - suf]
  )
    suf += 1;
  const head = before.slice(0, pre);
  const tail = before.slice(before.length - suf);
  const middleBefore = before.slice(pre, before.length - suf);
  const middleAfter = after.slice(pre, after.length - suf);
  const n = middleBefore.length;
  const m = middleAfter.length;
  const ops = [];
  for (const line of head) ops.push({ op: " ", text: line });
  if ((n + 1) * (m + 1) > DIFF_CELL_CAP) {
    for (const line of middleBefore) ops.push({ op: "-", text: line });
    for (const line of middleAfter) ops.push({ op: "+", text: line });
    for (const line of tail) ops.push({ op: " ", text: line });
    return { ops, coarse: true };
  }
  const width = m + 1;
  const table = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i -= 1)
    for (let j = m - 1; j >= 0; j -= 1) {
      table[i * width + j] =
        middleBefore[i] === middleAfter[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (middleBefore[i] === middleAfter[j]) {
      ops.push({ op: " ", text: middleBefore[i] });
      i += 1;
      j += 1;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      ops.push({ op: "-", text: middleBefore[i] });
      i += 1;
    } else {
      ops.push({ op: "+", text: middleAfter[j] });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ op: "-", text: middleBefore[i] });
    i += 1;
  }
  while (j < m) {
    ops.push({ op: "+", text: middleAfter[j] });
    j += 1;
  }
  for (const line of tail) ops.push({ op: " ", text: line });
  return { ops, coarse: false };
}
