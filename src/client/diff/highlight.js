/**
 * Tokenize one side of a hunk with the shared highlighter. Each side is highlighted
 * on its own because the omitted source lines are unavailable, which is the same
 * hunk-local pass the built-in review runs.
 *
 * @param rows - numbered hunk rows.
 * @param side - which line numbers to keep.
 * @param highlighter - the theme-bound highlighter.
 * @returns a map from line number to spans, or undefined while unavailable.
 */
export function highlightedSide(rows, side, highlighter) {
  const source = rows.flatMap((row) => {
    const no = row[side];
    return no === undefined ? [] : [{ no, text: row.text }];
  });
  if (source.length === 0) return new Map();
  const highlighted = highlighter(source.map((line) => line.text).join("\n"));
  if (highlighted === undefined) return undefined;
  return new Map(source.map((line, index) => [line.no, highlighted[index] ?? []]));
}
