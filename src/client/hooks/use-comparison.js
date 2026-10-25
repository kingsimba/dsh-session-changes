import { buildComparison } from "../comparison.js";
import { react } from "../react.js";

/**
 * The comparison for the selected file, recomputed only when one of its sources
 * changes.
 *
 * @param input - `{ mode, selected, diffs, wholeState, baseState, view }`.
 * @returns the comparison, or null while nothing is selected.
 */
export function useComparison({ mode, selected, diffs, wholeState, baseState, view }) {
  return react.useMemo(
    () => buildComparison({ mode, selected, diffs, wholeState, baseState, view }),
    [mode, selected, diffs, wholeState, baseState, view],
  );
}
