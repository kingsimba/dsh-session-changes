/**
 * The selectable value one list row stands for. The row itself is list-shaped;
 * a selection has to survive the list being rebuilt, so it keeps only data.
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
 * Whether one list row is the selected file: the same path everywhere, and in
 * By-turn mode also the same review coordinates.
 *
 * @param row - one list row.
 * @param selected - the selected value, or null.
 * @param mode - `turn` or `overall`.
 * @returns true when the row should render as selected.
 */
export function rowMatchesSelection(row, selected, mode) {
  if (selected === null || selected.path !== row.file.path) return false;
  if (mode === "overall") return true;
  const mine = selected.entries[0];
  const theirs = row.entries[0];
  if (mine === undefined || theirs === undefined) return false;
  return mine.seq === theirs.seq && mine.index === theirs.index;
}

/**
 * Stable cache key of one review coordinate.
 * @param entry - a `{ seq, index, turn }` row.
 * @returns `seq:index`.
 */
export function entryKey(entry) {
  return String(entry.seq) + ":" + String(entry.index);
}

/**
 * The selected file's entry that the comparison should show.
 * @param selected - the selected value, or null.
 * @param entryIndex - the entry the user last picked.
 * @returns the entry, or undefined while nothing is selected.
 */
export function activeEntryOf(selected, entryIndex) {
  if (selected === null) return undefined;
  return selected.entries[Math.min(entryIndex, Math.max(0, selected.entries.length - 1))];
}
