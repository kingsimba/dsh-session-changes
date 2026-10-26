/**
 * One list row, as data: the selection keeps only this, so it survives the list
 * being rebuilt.
 *
 * @param row - one built row.
 * @returns the selection.
 */
export function selectionOf(row) {
  return {
    path: row.path,
    display: row.display,
    added: row.added,
    deleted: row.deleted,
    binary: row.binary,
    oversized: row.oversized,
    missing: row.missing,
  };
}

/**
 * Whether two selections point at the same file.
 * @param current - the selected value, or null.
 * @param next - the candidate selection.
 * @returns true when adopting `next` would not change anything.
 */
export function sameSelection(current, next) {
  return current !== null && next !== null && current.path === next.path;
}

/**
 * Whether one row is the selected file.
 * @param row - one built row.
 * @param selected - the selected value, or null.
 * @returns true when the row should render as selected.
 */
export function rowMatchesSelection(row, selected) {
  return selected !== null && selected.path === row.path;
}
