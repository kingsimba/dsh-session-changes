import { buildComparison } from "../comparison.js";
import { react } from "../react.js";

/**
 * The comparison for the selected file, recomputed only when one of its sources
 * changes.
 *
 * @param input - `{ selected, wholeState, baseState }`.
 * @returns the comparison, or null while nothing is selected.
 */
export function useComparison({ selected, wholeState, baseState }) {
  return react.useMemo(
    () => buildComparison({ selected, wholeState, baseState }),
    [selected, wholeState, baseState],
  );
}
