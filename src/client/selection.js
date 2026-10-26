/**
 * The selectable value one list row stands for. The row itself is list-shaped; a
 * selection has to survive the list being rebuilt, so it keeps only data.
 *
 * @param row - one list row.
 * @returns the selection.
 */
export function selectionOf(row) {
  const file = row.file;
  return {
    path: file.path,
    display: file.display,
    added: file.added,
    deleted: file.deleted,
    binary: file.binary,
    oversized: file.oversized,
    entries: row.entries,
  };
}

/**
 * Whether two selections point at the same file through the same turns.
 * @param current - the selected value, or null.
 * @param next - the candidate selection.
 * @returns true when adopting `next` would not change anything.
 */
export function sameSelection(current, next) {
  if (current === null || next === null) return false;
  if (current.path !== next.path) return false;
  if (current.entries.length !== next.entries.length) return false;
  return current.entries.every(
    (entry, at) => entry.seq === next.entries[at].seq && entry.index === next.entries[at].index,
  );
}

/**
 * Whether one list row is the selected file.
 * @param row - one list row.
 * @param selected - the selected value, or null.
 * @returns true when the row should render as selected.
 */
export function rowMatchesSelection(row, selected) {
  return selected !== null && selected.path === row.file.path;
}
